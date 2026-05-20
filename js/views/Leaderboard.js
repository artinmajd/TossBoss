export default function Leaderboard() {
    return `
        <div id="leaderboard-screen" class="view-screen">
            <div class="leaderboard-content">
                <h1 class="logo-title">Leaderboard</h1>

                <div class="leaderboard-tabs">
                    <button id="tab-pingpong" class="tab-btn active">
                        <div class="pingpong-icon tab-icon"></div>
                        Ping Pong
                    </button>
                    <button id="tab-basketball" class="tab-btn">
                        <div class="basketball-icon tab-icon"></div>
                        Basketball
                    </button>
                </div>

                <div class="lb-table-header">
                    <span class="lb-col-rank">#</span>
                    <span class="lb-col-name">Player</span>
                    <span class="lb-col-score lb-sortable active-sort" id="lb-sort-score">Best Score</span>
                    <span class="lb-col-streak lb-sortable" id="lb-sort-streak">Best Streak</span>
                </div>

                <div id="leaderboard-list"></div>

                <button id="btn-lb-back" class="play-btn secondary-btn" style="margin-top:1.25rem;">Back</button>
            </div>
        </div>
    `;
}
