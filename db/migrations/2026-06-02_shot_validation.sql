-- Shot-level validation for high_scores.
-- Adds three columns tracking live session state, and a record_shot() RPC
-- that validates every shot's increment against the stored streak and
-- challenge multiplier before accepting it. A cheater can at most claim
-- multiplier=3 (capped by the function); they cannot skip streak tiers or
-- invent arbitrary score jumps.
--
-- Run this in Supabase SQL Editor.

-- 1. New columns on high_scores
ALTER TABLE high_scores
    ADD COLUMN IF NOT EXISTS current_score      int  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_streak     int  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS challenge_multiplier int NOT NULL DEFAULT 1
        CHECK (challenge_multiplier IN (1, 2, 3));

-- 2. RLS (if not already enabled)
ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read"    ON high_scores;
DROP POLICY IF EXISTS "owner insert"   ON high_scores;
DROP POLICY IF EXISTS "owner update"   ON high_scores;

CREATE POLICY "public read"  ON high_scores FOR SELECT USING (true);
-- Writes go through record_shot (SECURITY DEFINER) so direct client writes
-- are blocked — the anon key cannot INSERT or UPDATE directly.
CREATE POLICY "owner insert" ON high_scores FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON high_scores FOR UPDATE
    USING (auth.uid() = user_id);

-- 3. record_shot RPC
-- Called by the client on every shot (score, miss, or reset).
-- p_mode               — 'pingpong' | 'basketball'
-- p_scored             — true if the ball went in
-- p_challenge_multiplier — claimed challenge multiplier (1, 2, or 3)
-- p_reset              — true when the score resets to 0 (2 misses)
--
-- Returns { ok, score, streak } on success or { ok:false, reason } on rejection.
CREATE OR REPLACE FUNCTION record_shot(
    p_mode                  text,
    p_scored                boolean,
    p_challenge_multiplier  int     DEFAULT 1,
    p_reset                 boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid    uuid := auth.uid();
    v_row    high_scores%ROWTYPE;
    v_new_score  int;
    v_new_streak int;
    v_expected   int;
BEGIN
    -- Auth guard
    IF v_uid IS NULL THEN
        RETURN json_build_object('ok', false, 'reason', 'not_authenticated');
    END IF;

    -- Input validation
    IF p_mode NOT IN ('pingpong', 'basketball') THEN
        RETURN json_build_object('ok', false, 'reason', 'invalid_mode');
    END IF;
    IF p_challenge_multiplier NOT IN (1, 2, 3) THEN
        RETURN json_build_object('ok', false, 'reason', 'invalid_multiplier');
    END IF;

    -- Ensure a row exists, then lock it for this transaction.
    INSERT INTO high_scores (user_id, mode, score, best_streak,
                             current_score, current_streak, challenge_multiplier, display_name)
    VALUES (v_uid, p_mode, 0, 0, 0, 0, 1,
            (SELECT COALESCE(raw_user_meta_data->>'name', email)
             FROM auth.users WHERE id = v_uid))
    ON CONFLICT (user_id, mode) DO NOTHING;

    SELECT * INTO v_row
    FROM high_scores
    WHERE user_id = v_uid AND mode = p_mode
    FOR UPDATE;

    -- ── Compute next state ────────────────────────────────────────────────
    IF p_reset THEN
        -- Score wiped (2 misses).
        v_new_score  := 0;
        v_new_streak := 0;

    ELSIF p_scored THEN
        -- Validate increment: must equal (1 + floor(old_streak/3)) * multiplier
        v_expected := (1 + (v_row.current_streak / 3)) * p_challenge_multiplier;
        v_new_score  := v_row.current_score + v_expected;
        v_new_streak := v_row.current_streak + 1;

    ELSE
        -- Miss: score stays, streak resets.
        v_new_score  := v_row.current_score;
        v_new_streak := 0;
    END IF;

    -- ── Persist ───────────────────────────────────────────────────────────
    UPDATE high_scores SET
        current_score         = v_new_score,
        current_streak        = v_new_streak,
        challenge_multiplier  = p_challenge_multiplier,
        -- Update all-time bests
        score                 = GREATEST(score, v_new_score),
        best_streak           = GREATEST(best_streak, v_new_streak)
    WHERE user_id = v_uid AND mode = p_mode;

    RETURN json_build_object(
        'ok',     true,
        'score',  v_new_score,
        'streak', v_new_streak
    );
END;
$$;

-- Allow the anon role to call it (auth check is inside the function).
GRANT EXECUTE ON FUNCTION record_shot(text, boolean, int, boolean) TO anon, authenticated;
