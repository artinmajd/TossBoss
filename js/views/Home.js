// Mobile-only hint nudging users to install the site to their home screen.
// The wording and icon match the user's browser; hidden on desktop and when
// the site is already running as an installed app.
function installHint() {
    const ua = navigator.userAgent || '';
    // iPadOS 13+ reports a Mac user agent — disambiguate via touch points.
    const isIOS = /iPhone|iPad|iPod/.test(ua)
        || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    if (!isIOS && !isAndroid) return '';

    const installed = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    if (installed) return '';

    const shareIcon = `<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span>`;
    const menuIcon = `<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></span>`;

    const icon = isIOS ? shareIcon : menuIcon;
    const chipLabel = isIOS ? 'Add to Home Screen' : 'Add to Home screen';

    return `
            <div id="install-hint">
                <span class="install-hint-title">Best on mobile</span>
                <span class="install-hint-body">Add TossBoss to your Home Screen — tap ${icon} then <span class="ui-chip">${chipLabel}</span></span>
            </div>`;
}

export default function Home(session) {
    const displayName = session
        ? (session.user.user_metadata?.name || session.user.email)
        : null;

    const userSection = session
        ? `<p class="user-email">Welcome, <span class="user-name">${displayName}</span></p>
           <button id="btn-play-game" class="play-btn">Play</button>
           <button id="btn-leaderboard" class="play-btn secondary-btn">Leaderboard</button>
           <button id="btn-logout" class="play-btn secondary-btn">Sign Out</button>`
        : `<button id="btn-play-game" class="play-btn">Play as Guest</button>
           <button id="btn-leaderboard" class="play-btn secondary-btn">Leaderboard</button>
           <button id="btn-signin" class="play-btn secondary-btn">Sign In / Sign Up</button>`;

    return `
        <div id="home-screen" class="view-screen">
            <div class="home-content">
                <h1 class="logo-title">TossBoss</h1>
                <p class="subtitle">Sink Shots. Stack Streaks.</p>
                ${userSection}
            </div>
            ${installHint()}
        </div>
    `;
}
