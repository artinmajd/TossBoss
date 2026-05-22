export default function Auth() {
    return `
        <div id="auth-screen" class="view-screen">
            <div class="home-content">
                <h1 class="logo-title">TossBoss</h1>
                <p class="subtitle">Sink Shots. Stack Streaks.</p>

                <div id="auth-error" class="auth-error" style="display:none;"></div>

                <!-- Initial choice -->
                <div id="auth-choice">
                    <button id="btn-show-signin" class="play-btn">Sign In</button>
                    <button id="btn-show-signup" class="play-btn secondary-btn">Create Account</button>
                    <button id="btn-guest" class="play-btn secondary-btn">Back</button>
                </div>

                <!-- Sign In form -->
                <div id="auth-signin-form" style="display:none;">
                    <form>
                        <input id="signin-email" type="email" placeholder="Email" autocomplete="email" required />
                        <input id="signin-password" type="password" placeholder="Password" autocomplete="current-password" required />
                        <button type="submit" id="btn-login" class="play-btn">Sign In</button>
                        <button type="button" id="btn-back-signin" class="play-btn secondary-btn">Back</button>
                    </form>
                </div>

                <!-- Create Account form -->
                <div id="auth-signup-form" style="display:none;">
                    <form>
                        <input id="signup-name" type="text" placeholder="Name (optional)" autocomplete="name" />
                        <input id="signup-email" type="email" placeholder="Email" autocomplete="email" required />
                        <input id="signup-password" type="password" placeholder="Password" autocomplete="new-password" required />
                        <button type="submit" id="btn-signup" class="play-btn">Create Account</button>
                        <button type="button" id="btn-back-signup" class="play-btn secondary-btn">Back</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}
