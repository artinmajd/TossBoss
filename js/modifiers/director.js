// Director — decides WHEN to activate challenges and offer powerups, based on
// game state and events. Modifiers define WHAT happens; the director defines
// WHEN. It receives game events via notify() and a per-frame tick().

import blackHole from './elements/blackHole.js';

const NORMAL_PERIOD = 10;     // black hole appears before every 10th shot
const REST_VEL = 0.5;         // |v| below this counts as "ball at rest"

export function createDirector() {
    let shotsSinceReset = 0;   // throws since the last score reset
    let prevScore = 0;         // score seen on the previous frame
    let blackHoleActive = false;
    let armedForRestSpawn = false;  // normal mode: armed when shot N-1 fires;
                                    // spawns the next time the ball rests.

    return {
        // Once per frame.
        tick(ctx, manager) {
            // A score reset (2-miss reset or mode switch) restarts the count.
            if (prevScore > 0 && ctx.score === 0) {
                shotsSinceReset = 0;
                armedForRestSpawn = false;
            }
            prevScore = ctx.score;

            // The black hole finished its life and was pruned by the manager
            // — re-arm so another can be earned after the next 10 shots.
            if (blackHoleActive && !manager.active.some(m => m.id === 'black-hole')) {
                blackHoleActive = false;
                armedForRestSpawn = false;
            }

            // Normal mode: if armed, spawn the black hole as soon as the ball
            // is at rest and the player is ready to take the next shot.
            if (armedForRestSpawn && !blackHoleActive && !ctx.tester && ctx.score > 0) {
                const b = ctx.ball;
                if (b && Math.hypot(b.vx, b.vy) < REST_VEL) {
                    manager.add(blackHole(), ctx);
                    blackHoleActive = true;
                    armedForRestSpawn = false;
                    shotsSinceReset = 0;
                }
            }
        },

        // A game event from the engine: 'throw' | 'score' | 'miss'.
        notify(event, ctx, manager) {
            if (event !== 'throw') return;
            shotsSinceReset++;

            if (ctx.tester) {
                // Test mode (unchanged): spawn immediately after the Nth throw.
                const threshold = ctx.tester.blackHoleShotThreshold ?? NORMAL_PERIOD;
                if (!blackHoleActive && shotsSinceReset >= threshold && ctx.score > 0) {
                    manager.add(blackHole(), ctx);
                    blackHoleActive = true;
                }
            } else {
                // Normal mode: if the next shot will be the 10·Xth, arm the
                // spawn — tick() will fire it once the ball comes to rest.
                if ((shotsSinceReset + 1) % NORMAL_PERIOD === 0) {
                    armedForRestSpawn = true;
                }
            }
        },

        // Reset director state — called on a mode switch (each game has its
        // own modifier lifecycle).
        reset() {
            shotsSinceReset = 0;
            prevScore = 0;
            blackHoleActive = false;
            armedForRestSpawn = false;
        },
    };
}
