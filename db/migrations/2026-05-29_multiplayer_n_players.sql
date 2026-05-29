-- ============================================================================
--  Multiplayer: 2-player → up to 8-player rooms
--  Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- ============================================================================
--
--  Model change: instead of fixed host_*/guest_* columns, every player lives
--  in a single JSONB `players` array on the room row. Turn order = array order
--  (host is players[0]). `current_turn` becomes an integer index into players[].
--
--  Player entry shape:
--    { "id":"uuid", "name":"Artin", "score":0, "streak":0,
--      "lives":2, "maxLives":2, "throws":0 }
--
--  Kept columns: code, host_id, game_mode, target_score, status, current_turn
--  New columns:  players (jsonb), max_players (int)
--  Dropped:      host_name, host_score, guest_id, guest_name, guest_score
-- ----------------------------------------------------------------------------

-- 1) New columns -------------------------------------------------------------
alter table rooms add column if not exists players     jsonb not null default '[]'::jsonb;
alter table rooms add column if not exists max_players  int   not null default 8;

-- 2) current_turn: text ('host'|'guest') → integer index --------------------
--    Existing rooms are stale games, so resetting them all to 0 is fine.
alter table rooms alter column current_turn drop default;
alter table rooms alter column current_turn type int using 0;
alter table rooms alter column current_turn set default 0;

-- 3) Drop the now-redundant per-player columns -------------------------------
alter table rooms drop column if exists host_name;
alter table rooms drop column if exists host_score;
alter table rooms drop column if exists guest_id;
alter table rooms drop column if exists guest_name;
alter table rooms drop column if exists guest_score;

-- 4) Atomic join RPC ---------------------------------------------------------
--    Appending to a JSONB array from the client is a read-modify-write and
--    would lose updates if several people join at the same instant. This
--    function does it atomically under a row lock, enforces capacity, and is
--    idempotent (re-joining returns the room unchanged).
create or replace function join_room(p_code text, p_player jsonb)
returns rooms
language plpgsql
security definer
as $$
declare
  r rooms;
begin
  select * into r from rooms
    where code = p_code and status = 'waiting'
    for update;

  if not found then
    raise exception 'Room not found or already started';
  end if;

  -- Already in the room (refresh / double-tap) → no-op, return current state.
  if exists (
    select 1 from jsonb_array_elements(r.players) e
    where e->>'id' = p_player->>'id'
  ) then
    return r;
  end if;

  if jsonb_array_length(r.players) >= r.max_players then
    raise exception 'Room is full';
  end if;

  update rooms
    set players = players || p_player
    where code = p_code
    returning * into r;

  return r;
end;
$$;
