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

function emptyRow(index) {
    return `
        <div class="mp-player-row mp-player-row-empty" data-slot="${index}">
            <span class="mp-player-avatar">➕</span>
            <span class="mp-player-name">Waiting for player…</span>
            <span class="mp-ready-dot mp-dot-waiting"></span>
        </div>`;
}

// Builds the inner HTML of the players list (filled rows + empty slots).
// Exported so app.js can re-render the list when the room updates in realtime.
export function renderWaitingPlayers(room) {
    const players    = Array.isArray(room.players) ? room.players : [];
    const maxPlayers = room.max_players ?? 8;
    let rows = '';
    for (let i = 0; i < maxPlayers; i++) {
        rows += i < players.length ? playerRow(players[i], i) : emptyRow(i);
    }
    return rows;
}

export default function MultiplayerWaiting({ room, role }) {
    const isHost     = role === 'host';
    const players    = Array.isArray(room.players) ? room.players : [];
    const maxPlayers = room.max_players ?? 8;
    const canStart   = players.length >= 2;

    const modeLabel = room.game_mode === 'pingpong' ? '🏓 Ping Pong' : '🏀 Basketball';

    // Filled rows + empty placeholder rows up to capacity.
    let rows = '';
    for (let i = 0; i < maxPlayers; i++) {
        rows += i < players.length ? playerRow(players[i], i) : emptyRow(i);
    }

    const statusMsg = canStart
        ? (isHost ? "✅ Ready! Start when everyone has joined." : '✅ Waiting for host to start…')
        : (isHost ? 'Share the code with your friends.'        : 'Waiting for more players…');

    return `
        <div id="mp-waiting-screen" class="view-screen">
            <div class="home-content mp-waiting-card">

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
                    <span class="mp-info-chip" id="mp-count-chip">👥 ${players.length}/${maxPlayers}</span>
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

                <button id="btn-mp-leave" class="play-btn secondary-btn">Leave Room</button>
            </div>
        </div>
    `;
}
