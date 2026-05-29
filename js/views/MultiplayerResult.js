// Post-game result screen — ranked standings for all players.
// outcome   — 'win' | 'lose' | 'tie' (this player's result)
// standings — [{ id, name, score, rank }] sorted by score desc
// myId      — this player's id, to highlight their row

const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const medal = rank => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

export default function MultiplayerResult({ outcome, standings = [], myId }) {
    const bannerMap = {
        win:  { icon: '🏆', label: 'You Win!',    cls: 'mp-result-win'  },
        lose: { icon: '💀', label: 'You Lose…',   cls: 'mp-result-lose' },
        tie:  { icon: '🤝', label: "It's a Tie!", cls: 'mp-result-tie'  },
    };
    const { icon, label, cls } = bannerMap[outcome] ?? bannerMap.tie;

    const rows = standings.map(p => `
        <div class="mp-standing-row ${p.rank === 1 ? 'mp-standing-winner' : ''} ${p.id === myId ? 'mp-standing-me' : ''}">
            <span class="mp-standing-rank">${medal(p.rank)}</span>
            <span class="mp-standing-name">${esc(p.name)}${p.id === myId ? ' <span class="mp-standing-you">(You)</span>' : ''}</span>
            <span class="mp-standing-score">${p.score}</span>
        </div>`).join('');

    return `
        <div id="mp-result-screen" class="view-screen">
            <div class="home-content mp-result-card">

                <div class="mp-result-banner ${cls}">
                    <span class="mp-result-icon">${icon}</span>
                    <span class="mp-result-label">${label}</span>
                </div>

                <div class="mp-standings">
                    ${rows}
                </div>

                <button id="btn-mp-play-again" class="play-btn mp-create-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                         style="width:18px;height:18px;flex-shrink:0;">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Play Again
                </button>

                <button id="btn-mp-result-home" class="play-btn secondary-btn">
                    Home
                </button>
            </div>
        </div>
    `;
}
