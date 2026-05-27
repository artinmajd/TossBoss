// Post-game result screen shown to both players.
// outcome — 'win' | 'lose' | 'tie'
// myScore, oppScore, myName, oppName — from sessionStorage mp_result

const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function MultiplayerResult({ outcome, myScore, oppScore, myName, oppName }) {
    const bannerMap = {
        win:  { icon: '🏆', label: 'You Win!',    cls: 'mp-result-win'  },
        lose: { icon: '💀', label: 'You Lose…',   cls: 'mp-result-lose' },
        tie:  { icon: '🤝', label: "It's a Tie!", cls: 'mp-result-tie'  },
    };
    const { icon, label, cls } = bannerMap[outcome] ?? bannerMap.tie;

    return `
        <div id="mp-result-screen" class="view-screen">
            <div class="home-content mp-result-card">

                <div class="mp-result-banner ${cls}">
                    <span class="mp-result-icon">${icon}</span>
                    <span class="mp-result-label">${label}</span>
                </div>

                <div class="mp-result-scores">
                    <div class="mp-result-player ${outcome === 'win' ? 'mp-rs-winner' : ''}">
                        <span class="mp-rs-name">${esc(myName)}</span>
                        <span class="mp-rs-score">${myScore}</span>
                    </div>
                    <span class="mp-rs-vs">vs</span>
                    <div class="mp-result-player ${outcome === 'lose' ? 'mp-rs-winner' : ''}">
                        <span class="mp-rs-name">${esc(oppName)}</span>
                        <span class="mp-rs-score">${oppScore}</span>
                    </div>
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
