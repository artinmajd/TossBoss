export default function Game() {
    return `
        <div id="game-screen" class="view-screen">
            <div id="orientation-warning">
                <div class="warning-content">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                    <h2>Rotate Device</h2>
                    <p>Please hold your device horizontally (landscape mode) to play.</p>
                </div>
            </div>

            <div id="top-left">
                <div id="nav-bar">
                    <button id="btn-home" class="mode-btn" title="Back to Home">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </button>
                    <button id="btn-help" class="mode-btn" title="Help">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </button>
                    <div id="help-bubble">Hold <kbd>Space</kbd> to fast-forward</div>
                </div>
                <div id="mode-bar">
                    <button id="mode-pingpong" class="mode-btn active" title="Ping Pong Mode">
                        <div class="pingpong-icon"></div>
                    </button>
                    <button id="mode-basketball" class="mode-btn" title="Basketball Mode">
                        <div class="basketball-icon"></div>
                    </button>
                </div>
            </div>

            <canvas id="simulation-canvas"></canvas>

            <div id="score-display">
                <div id="score-current">Score: 0</div>
                <div id="score-best">Best: 0</div>
            </div>

            <button id="fullscreen-btn" aria-label="Toggle Fullscreen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </button>
        </div>
    `;
}
