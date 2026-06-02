// Waiting room shown after a room is created or joined.
// Renders every player in room.players plus empty slots up to max_players.
// The host (players[0]) sees the Start Game button (enabled at 2+ players).

const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One row of the players list. index 0 = host (crown).
function playerRow(player, index) {
    const avatar = index === 0 ? '👑' : '⚔️';
    return `
        <div class="mp-player-row" data-slot="${index}">
            <span class="mp-player-avatar">${avatar}</span>
            <span class="mp-player-name">${esc(player.name)}</span>
            <span class="mp-ready-dot mp-dot-ready"></span>
        </div>`;
}

// A single dashed "waiting for players…" row, shown only while there's room.
function waitingRow() {
    return `
        <div class="mp-player-row mp-player-row-empty">
            <span class="mp-player-avatar">➕</span>
            <span class="mp-player-name">Waiting for players…</span>
            <span class="mp-ready-dot mp-dot-waiting"></span>
        </div>`;
}

// Builds the inner HTML of the players list: every joined player, plus a
// single dashed "waiting" row while the room isn't full (Option A — the list
// grows dynamically rather than showing a fixed number of empty slots).
// Exported so app.js can re-render the list when the room updates in realtime.
export function renderWaitingPlayers(room) {
    const players    = Array.isArray(room.players) ? room.players : [];
    const maxPlayers = room.max_players ?? 8;
    let rows = players.map((p, i) => playerRow(p, i)).join('');
    if (players.length < maxPlayers) rows += waitingRow();
    return rows;
}

// Status line text for the waiting room, given current fill state.
export function waitingStatus(room, isHost) {
    const players    = Array.isArray(room.players) ? room.players : [];
    const maxPlayers = room.max_players ?? 8;
    const full       = players.length >= maxPlayers;
    const canStart   = players.length >= 2;

    if (full) {
        return isHost
            ? '🔒 Room is full — start whenever you’re ready.'
            : '🔒 Room is full — waiting for host to start…';
    }
    if (canStart) {
        return isHost
            ? '✅ Ready! Start now, or wait for more players.'
            : '✅ Waiting for host to start…';
    }
    return isHost
        ? 'Share the code with your friends.'
        : 'Waiting for more players…';
}

export default function MultiplayerWaiting({ room, role }) {
    const isHost     = role === 'host';
    const players    = Array.isArray(room.players) ? room.players : [];
    const maxPlayers = room.max_players ?? 8;
    const canStart   = players.length >= 2;

    const modeLabel = room.game_mode === 'pingpong' ? '🏓 Ping Pong' : '🏀 Basketball';

    const rows      = renderWaitingPlayers(room);
    const statusMsg = waitingStatus(room, isHost);

    return `
        <div id="mp-waiting-screen" class="view-screen">
            <div class="home-content mp-waiting-card">

                <button id="btn-mp-leave" class="mp-text-back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                         style="width:14px;height:14px;flex-shrink:0;">
                        <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
                    </svg>
                    Back
                </button>

                <p class="mp-sub-label">Room Code</p>
                <div class="mp-code-badge">
                    <span id="mp-code-text">${room.code}</span>
                    <button id="btn-mp-copy" class="mp-copy-btn" title="Copy code">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                             style="width:16px;height:16px;">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>

                <div class="mp-game-info">
                    <span class="mp-info-chip">${modeLabel}</span>
                    <span class="mp-info-chip">🎯 ${room.target_score} pts</span>
                    <span class="mp-info-chip" id="mp-count-chip">👥 ${players.length}/${maxPlayers}</span>${players.length >= maxPlayers ? `
                    <span class="mp-info-chip mp-chip-full" id="mp-full-chip">🔒 Full</span>` : ''}
                </div>

                <div class="mp-players-list" id="mp-players-list">
                    ${rows}
                </div>

                <p class="mp-waiting-status" id="mp-waiting-msg">${statusMsg}</p>

                ${isHost ? `
                <button id="btn-mp-start" class="play-btn mp-create-btn"
                        ${!canStart ? 'disabled' : ''}>
                    Start Game
                </button>` : ''}

            </div>
        </div>
    `;
}
