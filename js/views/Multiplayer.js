export default function Multiplayer() {
    return `
        <div id="multiplayer-screen" class="view-screen">
            <div class="home-content">
                <h1 class="logo-title">Multiplayer</h1>
                <p class="subtitle">Compete Against Friends</p>

                <div class="mp-section">
                    <label class="mp-label" for="mp-room-code">Join a Room</label>
                    <div class="mp-input-row">
                        <input
                            id="mp-room-code"
                            type="text"
                            class="mp-input"
                            placeholder="Enter room code"
                            maxlength="8"
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <button id="btn-mp-join" class="mp-join-btn" title="Join Room">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>

                <div class="mp-divider">
                    <span class="mp-divider-line"></span>
                    <span class="mp-divider-text">or</span>
                    <span class="mp-divider-line"></span>
                </div>

                <button id="btn-mp-create" class="play-btn mp-create-btn">
                    <svg class="mp-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                    Create New Room
                </button>
                <button id="btn-mp-back" class="play-btn secondary-btn">Back</button>
            </div>
        </div>
    `;
}
