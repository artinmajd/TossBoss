// Hub view — two panels that swap in-place:
//   Panel A (hub)    → join with a code  OR  open the create form
//   Panel B (create) → configure + create a new room
//
// session  — Supabase session or null (guest)
// storedName — previously entered name from sessionStorage (guests only)

export default function Multiplayer({ session = null, storedName = '' } = {}) {
    const needsName  = !session;
    const displayName = session
        ? (session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Player')
        : '';

    const nameFieldJoin = needsName
        ? `<div class="mp-section">
               <label class="mp-label" for="mp-join-name">Your Name</label>
               <input id="mp-join-name" class="mp-input" type="text"
                      placeholder="Enter your name" maxlength="20"
                      value="${storedName}" autocomplete="off" spellcheck="false">
           </div>`
        : `<input id="mp-join-name" type="hidden" value="${displayName}">`;

    const nameFieldCreate = needsName
        ? `<div class="mp-section">
               <label class="mp-label" for="mp-create-name">Your Name</label>
               <input id="mp-create-name" class="mp-input" type="text"
                      placeholder="Enter your name" maxlength="20"
                      autocomplete="off" spellcheck="false">
           </div>`
        : `<input id="mp-create-name" type="hidden" value="${displayName}">`;

    return `
        <div id="multiplayer-screen" class="view-screen">

            <!-- ── Panel A: Hub ───────────────────────── -->
            <div class="home-content" id="mp-hub">
                <h1 class="logo-title mp-long-title">Multiplayer</h1>
                <p class="subtitle">Compete Against Friends</p>

                ${nameFieldJoin}

                <div class="mp-section">
                    <label class="mp-label" for="mp-code-input">Join a Room</label>
                    <div class="mp-input-row">
                        <input id="mp-code-input" class="mp-input mp-code-input" type="text"
                               placeholder="XXXXXX" maxlength="6"
                               autocomplete="off" spellcheck="false">
                        <button id="btn-mp-join" class="mp-join-btn" title="Join Room">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="mp-divider">
                    <span class="mp-divider-line"></span>
                    <span class="mp-divider-text">or</span>
                    <span class="mp-divider-line"></span>
                </div>

                <button id="btn-mp-show-create" class="play-btn mp-create-btn">
                    <svg class="mp-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                    </svg>
                    Create New Room
                </button>
                <button id="btn-mp-back" class="play-btn secondary-btn">Back</button>
                <p id="mp-hub-error" class="mp-error" hidden></p>
            </div>

            <!-- ── Panel B: Create Form ───────────────── -->
            <div class="home-content" id="mp-create" hidden>
                <button id="btn-mp-create-back" class="mp-text-back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                         style="width:14px;height:14px;flex-shrink:0;">
                        <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
                    </svg>
                    Back
                </button>
                <h1 class="logo-title">New Room</h1>
                <p class="subtitle">Configure Your Game</p>

                ${nameFieldCreate}

                <div class="mp-section">
                    <label class="mp-label">Game Mode</label>
                    <div class="mp-mode-row">
                        <button id="mp-mode-pp" class="mp-mode-pick active">
                            <div class="pingpong-icon mp-mode-icon"></div>
                            Ping Pong
                        </button>
                        <button id="mp-mode-bb" class="mp-mode-pick">
                            <div class="basketball-icon mp-mode-icon"></div>
                            Basketball
                        </button>
                    </div>
                </div>

                <div class="mp-section">
                    <div class="mp-slider-header">
                        <label class="mp-label">Target Score</label>
                        <span class="mp-slider-value" id="mp-target-display">50 pts</span>
                    </div>
                    <input id="mp-target-slider" class="mp-slider" type="range"
                           min="25" max="150" step="5" value="50">
                    <div class="mp-slider-ends">
                        <span>25</span><span>150</span>
                    </div>
                </div>

                <button id="btn-mp-create-confirm" class="play-btn mp-create-btn">
                    Create Room
                </button>
                <p id="mp-create-error" class="mp-error" hidden></p>
            </div>

        </div>
    `;
}
