// Director — decides WHEN to activate challenges and offer powerups, based on
// game state and events. Modifiers define WHAT happens; the director defines
// WHEN. It receives game events via notify() and a per-frame tick().

import blackHole from './challenges/blackHole.js';

export function createDirector() {
    let shotsSinceReset = 0;   // throws since the last score reset
    let prevScore = 0;         // score seen on the previous frame
    let blackHoleSpawned = false;

    return {
        // Once per frame. Watches for a score reset (score dropping to 0 —
        // covers both a 2-miss reset and a mode switch) and restarts the
        // shot counter.
        tick(ctx /* , manager */) {
            if (prevScore > 0 && ctx.score === 0) {
                shotsSinceReset = 0;
            }
            prevScore = ctx.score;
        },

        // A game event from the engine: 'throw' | 'score' | 'miss'.
        notify(event, ctx, manager) {
            if (event === 'throw') {
                shotsSinceReset++;
                // Black hole: 10 shots into an un-reset run with a live score.
                if (!blackHoleSpawned && shotsSinceReset >= 10 && ctx.score > 0) {
                    manager.add(blackHole(), ctx);
                    blackHoleSpawned = true;
                }
            }
        },

        // Reset director state (for a fresh run).
        reset() {
            shotsSinceReset = 0;
            prevScore = 0;
            blackHoleSpawned = false;
        },
    };
}
