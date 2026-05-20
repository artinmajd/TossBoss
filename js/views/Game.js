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
                    <button id="btn-leaderboard-game" class="mode-btn" title="Leaderboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    </button>
                    <button id="btn-help" class="mode-btn" title="Help">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </button>
                    <div id="help-bubble">
                        <div class="help-section">
                            <div class="help-title">Scoring</div>
                            <div class="help-row"><span class="help-key">3 in a row</span><span>+2 per shot</span></div>
                            <div class="help-row"><span class="help-key">6 in a row</span><span>+3 per shot</span></div>
                            <div class="help-row"><span class="help-key">9, 12, 15…</span><span class="help-infinite">climbs forever</span></div>
                            <div class="help-row"><span class="help-key">2 misses</span><span>score resets</span></div>
                            <div class="help-row"><span class="help-key">miss on bonus</span><span>bonus lost, 2 chances</span></div>
                        </div>
                        <div class="help-divider"></div>
                        <div class="help-section">
                            <div class="help-row"><span class="help-key"><kbd>Space</kbd></span><span>fast-forward</span></div>
                        </div>
                    </div>
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

            <div id="score-area">
                <div id="score-display">
                    <div class="score-label">Score</div>
                    <div id="score-current">0</div>
                    <div id="score-streak"></div>
                    <div id="score-bonus"></div>
                </div>
                <div id="best-display">
                    <div class="best-content">
                        <div class="score-label">Score</div>
                        <div id="score-best">0</div>
                        <div id="score-best-streak"></div>
                    </div>
                    <div id="all-time-pane"><span>All Time</span></div>
                </div>
            </div>

            <div id="toast-container"></div>

            <div id="lb-modal" class="lb-modal-overlay" style="display:none;">
                <div class="lb-modal-card">
                    <div class="lb-modal-header">
                        <span class="lb-modal-title">Leaderboard</span>
                        <button id="btn-lb-modal-close" class="mode-btn" title="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="leaderboard-tabs lb-modal-tabs">
                        <button id="lb-modal-tab-pingpong" class="tab-btn active">
                            <div class="pingpong-icon tab-icon"></div>
                            Ping Pong
                        </button>
                        <button id="lb-modal-tab-basketball" class="tab-btn">
                            <div class="basketball-icon tab-icon"></div>
                            Basketball
                        </button>
                    </div>
                    <div class="lb-table-header">
                        <span class="lb-col-rank">#</span>
                        <span class="lb-col-name">Player</span>
                        <span class="lb-col-score lb-sortable" id="lb-modal-sort-score">Best Score <span class="lb-sort-arrow active-sort">▼</span></span>
                        <span class="lb-col-streak lb-sortable" id="lb-modal-sort-streak">Best Streak <span class="lb-sort-arrow">▼</span></span>
                    </div>
                    <div id="lb-modal-list"></div>
                </div>
            </div>

            <button id="fullscreen-btn" aria-label="Toggle Fullscreen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </button>
        </div>
    `;
}
