// Room management — Supabase CRUD + Realtime subscriptions.
// All room state lives in the `rooms` table. Real-time throw events
// use a separate broadcast channel (no DB write, zero latency).

import { supabase } from '../supabase.js';

// Unambiguous character set — no 0/O/1/I confusion.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(len = 6) {
    return Array.from({ length: len },
        () => CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join('');
}

// Create a new room. Returns { room, error }.
export async function createRoom({ hostId, hostName, gameMode, targetScore }) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = genCode();
        const { data, error } = await supabase
            .from('rooms')
            .insert({
                code,
                host_id:      hostId,
                host_name:    hostName,
                game_mode:    gameMode,
                target_score: targetScore,
                status:       'waiting',
                current_turn: 'host',
            })
            .select()
            .single();
        if (!error) return { room: data, error: null };
        // Postgres unique-constraint violation → try a new code.
        if (error.code !== '23505') return { room: null, error };
    }
    return { room: null, error: new Error('Could not generate a unique room code. Try again.') };
}

// Guest joins an existing room. Returns { room, error }.
export async function joinRoom({ code, guestId, guestName }) {
    const { data: room, error: findErr } = await supabase
        .from('rooms')
        .select()
        .eq('code', code.toUpperCase())
        .eq('status', 'waiting')
        .single();

    if (findErr || !room) {
        return { room: null, error: new Error('Room not found or game already started.') };
    }
    if (room.host_id === guestId) {
        return { room: null, error: new Error('You cannot join your own room.') };
    }

    const { data, error } = await supabase
        .from('rooms')
        .update({ guest_id: guestId, guest_name: guestName, status: 'active' })
        .eq('code', code.toUpperCase())
        .eq('status', 'waiting')
        .select()
        .single();

    if (error) return { room: null, error };
    return { room: data, error: null };
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
