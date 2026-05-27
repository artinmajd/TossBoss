// Waiting room shown after a room is created or joined.
// Both players see each other's names; host sees the Start Game button.

const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function MultiplayerWaiting({ room, role }) {
    const isHost    = role === 'host';
    const guestReady = !!room.guest_name;

    const modeLabel = room.game_mode === 'pingpong' ? '🏓 Ping Pong' : '🏀 Basketball';

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
                </div>

                <div class="mp-players-list">
                    <div class="mp-player-row">
                        <span class="mp-player-avatar">👑</span>
                        <span class="mp-player-name">${esc(room.host_name)}</span>
                        <span class="mp-ready-dot mp-dot-ready"></span>
                    </div>
                    <div class="mp-player-row">
                        <span class="mp-player-avatar">⚔️</span>
                        <span class="mp-player-name" id="mp-guest-name-el">
                            ${guestReady ? esc(room.guest_name) : 'Waiting for opponent…'}
                        </span>
                        <span class="mp-ready-dot ${guestReady ? 'mp-dot-ready' : 'mp-dot-waiting'}"
                              id="mp-guest-dot"></span>
                    </div>
                </div>

                <p class="mp-waiting-status" id="mp-waiting-msg">
                    ${guestReady
                        ? (isHost ? '✅ Both players ready! Start when you\'re ready.' : '✅ Both players ready! Waiting for host…')
                        : (isHost ? 'Share the code with your friend.' : 'Waiting for host to start the game…')
                    }
                </p>

                ${isHost ? `
                <button id="btn-mp-start" class="play-btn mp-create-btn"
                        ${!guestReady ? 'disabled' : ''}>
                    Start Game
                </button>` : ''}

                <button id="btn-mp-leave" class="play-btn secondary-btn">Leave Room</button>
            </div>
        </div>
    `;
}
