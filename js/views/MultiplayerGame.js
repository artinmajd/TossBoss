// Multiplayer game screen — stripped-down game canvas with MP HUD.
// No mode switching, no leaderboard, no challenges/black holes.

export default function MultiplayerGame({ myName, oppName, targetScore, gameMode }) {
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
                <button id="mp-btn-quit" class="mode-btn mp-quit-btn" title="Quit game">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                         style="width:16px;height:16px;">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </button>

                <div class="mp-hud-scores">
                    <!-- My side -->
                    <div class="mp-hud-side" id="mp-hud-mine">
                        <span class="mp-hud-pname">${myName}</span>
                        <span class="mp-hud-pscore" id="mp-score-mine">0</span>
                        <div class="mp-hud-stats">
                            <span class="mp-hud-throws" id="mp-throws-mine">0↑</span>
                            <span class="mp-hud-streak-val" id="mp-streak-mine"></span>
                        </div>
                    </div>

                    <!-- Center: target + turn label + timer -->
                    <div class="mp-hud-center-col">
                        <span class="mp-hud-target">/ ${targetScore}</span>
                        <span class="mp-turn-indicator" id="mp-turn-indicator">⏳ Waiting…</span>
                        <div class="mp-turn-timer hidden" id="mp-turn-timer">
                            <svg class="mp-timer-ring" viewBox="0 0 24 24" aria-hidden="true">
                                <circle class="mp-timer-ring-bg"  cx="12" cy="12" r="9"/>
                                <circle class="mp-timer-ring-arc" cx="12" cy="12" r="9" id="mp-timer-arc"/>
                            </svg>
                            <span class="mp-timer-num" id="mp-timer-value">15</span>
                        </div>
                    </div>

                    <!-- Opponent side -->
                    <div class="mp-hud-side mp-hud-opp-side" id="mp-hud-theirs">
                        <span class="mp-hud-pname">${oppName}</span>
                        <span class="mp-hud-pscore" id="mp-score-theirs">0</span>
                        <div class="mp-hud-stats">
                            <span class="mp-hud-throws" id="mp-throws-theirs">0↑</span>
                            <span class="mp-hud-streak-val" id="mp-streak-theirs"></span>
                        </div>
                    </div>
                </div>
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
