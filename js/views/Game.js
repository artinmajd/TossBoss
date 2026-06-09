export default function Game(session) {
    return `
        <div id="game-screen" class="view-screen bg-pingpong">
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
              <div id="top-bar">
                <button id="menu-toggle" class="mode-btn" title="Menu" aria-label="Toggle menu">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:18px;height:18px;"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <div id="nav-bar">
                    <button id="btn-home" class="mode-btn" title="Back to Home">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </button>
                    <button id="btn-leaderboard-game" class="mode-btn" title="Leaderboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    </button>
                    <button id="btn-settings" class="mode-btn" title="Settings">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                    <button id="btn-help" class="mode-btn" title="Help">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </button>
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
                        <div class="help-row help-desktop-only"><span class="help-key"><kbd>Space</kbd></span><span>fast-forward</span></div>
                        <div class="help-row help-mobile-only"><span class="help-key">Hold finger</span><span>fast-forward</span></div>
                    </div>
                    <div class="help-divider"></div>
                    <div class="help-section">
                        <div class="help-title">Challenges</div>
                        <div class="help-row">
                            <span class="help-key help-bh-label"><span class="help-bh-icon"></span>Black Hole</span>
                            <span>appears every 10 throws</span>
                        </div>
                        <div class="help-row">
                            <span class="help-key">To trigger</span>
                            <span>throw the ball into it</span>
                        </div>
                        <div class="help-row">
                            <span class="help-key">Each time</span>
                            <span>random challenge, unique reward</span>
                        </div>
                    </div>
                </div>
                <div id="settings-bubble">
                    <div class="help-title">Settings</div>
                    <div class="settings-row">
                        <span class="settings-label">Music</span>
                        <button class="settings-toggle" id="toggle-music" role="switch" aria-checked="true">
                            <span class="settings-toggle-knob"></span>
                        </button>
                    </div>
                    <div class="settings-row">
                        <span class="settings-label">Sound Effects</span>
                        <button class="settings-toggle" id="toggle-sfx" role="switch" aria-checked="true">
                            <span class="settings-toggle-knob"></span>
                        </button>
                    </div>
                </div>

                <div id="challenge-badge" hidden>
                    <div class="challenge-badge-content">
                        <div class="challenge-title">MOVING TARGET</div>
                        <div class="challenge-reward">Reward: <span>2X</span> points</div>
                        <div class="challenge-sub" hidden></div>
                    </div>
                    <svg class="challenge-timer" viewBox="0 0 24 24" aria-hidden="true">
                        <circle class="challenge-timer-bg" cx="12" cy="12" r="9"/>
                        <circle class="challenge-timer-arc" cx="12" cy="12" r="9"/>
                    </svg>
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
                    <button id="btn-lb-modal-close" class="lb-modal-close" title="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <h1 class="logo-title">Leaderboard</h1>
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
                        <span class="lb-col-score lb-sortable active-sort" id="lb-modal-sort-score">Best Score</span>
                        <span class="lb-col-streak lb-sortable" id="lb-modal-sort-streak">Best Streak</span>
                    </div>
                    <div id="lb-modal-list"></div>
                    ${!session ? '<p class="lb-signin-note">Sign in to save your scores to the leaderboard</p>' : ''}
                </div>
            </div>

            <div id="heart-decor" aria-hidden="true">
                <img src="assets/heart.webp?v=2" alt="">
                <img src="assets/heart.webp?v=2" alt="">
            </div>

            <button id="fullscreen-btn" aria-label="Toggle Fullscreen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </button>
        </div>
    `;
}
