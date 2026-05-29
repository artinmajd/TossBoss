// Room management — Supabase CRUD + Realtime subscriptions.
// All room state lives in the `rooms` table. Players are stored in a single
// JSONB `players` array (turn order = array order; host is players[0]).
// `current_turn` is an integer index into that array.
// Real-time throw events use a separate broadcast channel (no DB write).

import { supabase } from '../supabase.js';

// Unambiguous character set — no 0/O/1/I confusion.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(len = 6) {
    return Array.from({ length: len },
        () => CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join('');
}

// Fresh player entry. Lives default to 2 (matches the engine's base lives).
export function makePlayer(id, name) {
    return { id, name, score: 0, streak: 0, lives: 2, maxLives: 2, throws: 0 };
}

// Create a new room. The host becomes players[0]. Returns { room, error }.
export async function createRoom({ hostId, hostName, gameMode, targetScore, maxPlayers = 12 }) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = genCode();
        const { data, error } = await supabase
            .from('rooms')
            .insert({
                code,
                host_id:      hostId,
                game_mode:    gameMode,
                target_score: targetScore,
                max_players:  maxPlayers,
                status:       'waiting',
                current_turn: 0,
                players:      [makePlayer(hostId, hostName)],
            })
            .select()
            .single();
        if (!error) return { room: data, error: null };
        // Postgres unique-constraint violation → try a new code.
        if (error.code !== '23505') return { room: null, error };
    }
    return { room: null, error: new Error('Could not generate a unique room code. Try again.') };
}

// Join an existing room. Atomic + idempotent via the join_room RPC, which
// enforces capacity and ignores duplicate joins. Returns { room, error }.
export async function joinRoom({ code, playerId, playerName }) {
    const { data, error } = await supabase.rpc('join_room', {
        p_code:   code.toUpperCase(),
        p_player: makePlayer(playerId, playerName),
    });

    if (error) {
        // Surface the RPC's RAISE message (room full / not found) cleanly.
        const msg = /full/i.test(error.message) ? 'Room is full.'
                  : /not found|started/i.test(error.message) ? 'Room not found or game already started.'
                  : error.message;
        return { room: null, error: new Error(msg) };
    }
    // rpc returning a single row may come back as an object or 1-element array.
    const room = Array.isArray(data) ? data[0] : data;
    if (!room) return { room: null, error: new Error('Room not found or game already started.') };
    return { room, error: null };
}

// Fetch a room by its code. Returns { room, error }.
export async function getRoomByCode(code) {
    const { data, error } = await supabase
        .from('rooms')
        .select()
        .eq('code', code.toUpperCase())
        .single();
    return { room: data ?? null, error };
}

// Subscribe to all UPDATE events on one room row.
// onUpdate(newRow) fires whenever the row changes.
// Returns an unsubscribe function.
export function subscribeToRoom(code, onUpdate) {
    const ch = supabase
        .channel(`room-pg-${code}`)
        .on(
            'postgres_changes',
            {
                event:  'UPDATE',
                schema: 'public',
                table:  'rooms',
                filter: `code=eq.${code}`,
            },
            payload => onUpdate(payload.new)
        )
        .subscribe();
    return () => supabase.removeChannel(ch);
}

// Returns a Supabase broadcast channel for real-time throw events.
// The caller is responsible for subscribing / unsubscribing.
export function getRoomBroadcastChannel(code) {
    return supabase.channel(`room-bc-${code}`);
}
