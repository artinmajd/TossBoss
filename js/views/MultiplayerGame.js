// Multiplayer game screen — stripped-down game canvas with MP HUD.
// No mode switching, no leaderboard, no challenges/black holes.

export default function MultiplayerGame({ myName, targetScore, gameMode }) {
    const modeClass = gameMode === 'pingpong' ? ' bg-pingpong' : '';

    return `
        <div id="game-screen" class="view-screen${modeClass}">

            <!-- Rotate-to-landscape warning -->
            <div id="orientation-warning">
                <div class="warning-content">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#38bdf8"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                    <h2>Rotate Device</h2>
                    <p>Please hold your device horizontally to play.</p>
                </div>
            </div>

            <!-- ── MP top HUD ───────────────────────────────────────────── -->
            <div id="mp-game-hud">
                <!-- Hamburger menu — same pattern as single-player #top-left -->
                <div id="mp-top-left" class="mp-quit-btn">
                    <button id="mp-btn-menu" class="mode-btn" title="Menu">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                             stroke-linecap="round" style="width:18px;height:18px;">
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                    <div id="mp-nav-bar">
                        <button id="mp-btn-settings" class="mode-btn" title="Settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                 stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </button>
                        <button id="mp-btn-quit" class="mode-btn" title="Quit game">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                                 style="width:16px;height:16px;">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                        </button>
                    </div>
                    <!-- Settings bubble (same as single-player) -->
                    <div id="mp-settings-bubble" class="mp-settings-bubble">
                        <div class="help-title">Settings</div>
                        <div class="settings-row">
                            <span class="settings-label">Music</span>
                            <button class="settings-toggle" id="mp-toggle-music" role="switch" aria-checked="true">
                                <span class="settings-toggle-knob"></span>
                            </button>
                        </div>
                        <div class="settings-row">
                            <span class="settings-label">Sound Effects</span>
                            <button class="settings-toggle" id="mp-toggle-sfx" role="switch" aria-checked="true">
                                <span class="settings-toggle-knob"></span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Own card wrapper — carries the conic-gradient timer ring -->
                <div class="mp-card-self mp-self-timer-wrap" id="mp-card-mine-wrap">
                    <!-- SVG timer ring — stroked rounded-rect follows the card border exactly -->
                    <svg class="mp-card-timer-svg" id="mp-card-timer-svg"
                         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path id="mp-card-timer-track"/>
                        <path id="mp-card-timer-fill"/>
                    </svg>
                    <div class="mp-player-card" id="mp-card-mine">
                        <span class="mp-hud-pname">${myName}</span>
                        <div class="mp-card-score-row">
                            <span class="mp-hud-pscore" id="mp-score-mine">0</span>
                            <span class="mp-card-target">/ ${targetScore}</span>
                            <div id="mp-mine-hearts" class="mp-opp-hearts">
                                <img src="assets/heart.webp?v=2" alt="" class="mp-opp-heart">
                                <img src="assets/heart.webp?v=2" alt="" class="mp-opp-heart">
                            </div>
                        </div>
                        <div class="mp-hud-stats">
                            <span class="mp-hud-throws" id="mp-throws-mine">shots: 0</span>
                            <span class="mp-hud-streak-val" id="mp-streak-mine"></span>
                        </div>
                    </div>
                </div>

                <!-- Opponent cards — built dynamically by app.js, one per other
                     player, in turn order. Right-aligned, and scrolls
                     horizontally when there are too many to fit. -->
                <div id="mp-opp-cards" class="mp-opp-cards-row"></div>
            </div>

            <!-- Canvas -->
            <canvas id="simulation-canvas"></canvas>

            <!-- Score area — hidden but needed by the engine -->
            <div id="score-area" class="mp-score-area-hidden">
                <div id="score-display">
                    <div class="score-label">Score</div>
                    <div id="score-current">0</div>
                    <div id="score-streak"></div>
                    <div id="score-bonus"></div>
                </div>
                <div id="best-display">
                    <div class="best-content">
                        <div class="score-label">Best</div>
                        <div id="score-best">0</div>
                        <div id="score-best-streak"></div>
                    </div>
                    <div id="all-time-pane"><span>All Time</span></div>
                </div>
            </div>

            <!-- Challenge badge — hidden; director is off in MP -->
            <div id="challenge-badge" hidden>
                <div class="challenge-badge-content">
                    <div class="challenge-title"></div>
                    <div class="challenge-reward">Reward: <span></span></div>
                    <div class="challenge-sub" hidden></div>
                </div>
                <svg class="challenge-timer" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="challenge-timer-bg" cx="12" cy="12" r="9"/>
                    <circle class="challenge-timer-arc" cx="12" cy="12" r="9"/>
                </svg>
            </div>

            <div id="toast-container"></div>

            <div id="heart-decor" aria-hidden="true">
                <img src="assets/heart.webp?v=2" alt="">
                <img src="assets/heart.webp?v=2" alt="">
            </div>

            <!-- Countdown overlay (3 s at game start) -->
            <div id="mp-countdown-overlay" class="mp-countdown-overlay">
                <div class="mp-countdown-content">
                    <p class="mp-countdown-sub">Get ready!</p>
                    <div class="mp-countdown-num" id="mp-countdown-num">3</div>
                </div>
            </div>

            <!-- Game-over flash (shown before navigating to result screen) -->
            <div id="mp-gameover-overlay" class="mp-gameover-overlay hidden">
                <div class="mp-gameover-content">
                    <div class="mp-gameover-text" id="mp-gameover-text"></div>
                    <div class="mp-gameover-scores" id="mp-gameover-scores"></div>
                </div>
            </div>

            <button id="fullscreen-btn" aria-label="Toggle Fullscreen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
            </button>
        </div>
    `;
}
