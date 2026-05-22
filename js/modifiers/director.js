// Director — decides WHEN to activate challenges and offer powerups, based on
// game state and events. Modifiers define WHAT happens; the director defines
// WHEN. It receives game events via notify() and a per-frame tick().

import blackHole from './elements/blackHole.js';

export function createDirector() {
    let shotsSinceReset = 0;   // throws since the last score reset
    let prevScore = 0;         // score seen on the previous frame
    let blackHoleActive = false;

    return {
        // Once per frame.
        tick(ctx, manager) {
            // A score reset (2-miss reset or mode switch) restarts the count.
            if (prevScore > 0 && ctx.score === 0) shotsSinceReset = 0;
            prevScore = ctx.score;

            // The black hole finished its life and was pruned by the manager
            // — re-arm so another can be earned after 10 more shots.
            if (blackHoleActive && !manager.active.some(m => m.id === 'black-hole')) {
                blackHoleActive = false;
                shotsSinceReset = 0;
            }
        },

        // A game event from the engine: 'throw' | 'score' | 'miss'.
        notify(event, ctx, manager) {
            if (event === 'throw') {
                shotsSinceReset++;
                // Black hole spawns this many shots into an un-reset run.
                // The test user can shorten it via tester_config.
                const threshold = ctx.tester?.blackHoleShotThreshold ?? 10;
                if (!blackHoleActive && shotsSinceReset >= threshold && ctx.score > 0) {
                    manager.add(blackHole(), ctx);
                    blackHoleActive = true;
                }
            }
        },

        // Reset director state — called on a mode switch (each game has its
        // own modifier lifecycle).
        reset() {
            shotsSinceReset = 0;
            prevScore = 0;
            blackHoleActive = false;
        },
    };
}
