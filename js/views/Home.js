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
        </div>
    `;
}
