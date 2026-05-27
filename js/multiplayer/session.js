// Multiplayer session helpers — player identity + name persistence.
// Signed-in users use their Supabase user.id; guests get an anonymous
// UUID that lives in sessionStorage for the duration of the browser tab.

import { supabase } from '../supabase.js';

export async function getPlayerId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;
    let id = sessionStorage.getItem('mp_anon_id');
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem('mp_anon_id', id);
    }
    return id;
}

export function storePlayerName(name) {
    sessionStorage.setItem('mp_player_name', name.trim());
}

export function getStoredPlayerName() {
    return sessionStorage.getItem('mp_player_name') || '';
}
