// Director — decides WHEN to activate challenges and offer powerups, based on
// game state and events. Modifiers define WHAT happens; the director defines
// WHEN. It receives game events via notify() and a per-frame tick().

import blackHole          from './elements/blackHole.js';
import { modifierRegistry } from './registry.js';

const NORMAL_PERIOD = 10;     // black hole appears before every 10th shot
const REST_VEL = 0.5;         // |v| below this counts as "ball at rest"

// Weighted random challenge pick.
// playCounts: Map<challengeId, number> — times each challenge has been played
// this session. Weight = 1 / (plays + 1), so unplayed challenges are always
// preferred but already-played ones are never locked out.
function pickRandomChallenge(playCounts) {
    const challenges = modifierRegistry
        .map(f => ({ factory: f, sample: f() }))
        .filter(x => x.sample.type === 'challenge');
    if (!challenges.length) return null;

    const weighted = challenges.map(c => ({
        factory: c.factory,
        id:      c.sample.id,
        weight:  1 / ((playCounts.get(c.sample.id) ?? 0) + 1),
    }));
    const total = weighted.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const c of weighted) {
        r -= c.weight;
        if (r <= 0) return c;
    }
    return weighted[weighted.length - 1];
}

export function createDirector() {
    let shotsSinceReset = 0;   // throws since the last score reset
    let prevScore = 0;         // score seen on the previous frame
    let blackHoleActive = false;
    let armedForRestSpawn = false;  // armed after shot N-1; fires when ball rests

    // Session-wide play history — NOT cleared on reset() so it persists
    // across mode switches for the lifetime of the browser session.
    const playCounts = new Map();

    return {
        // Once per frame.
        tick(ctx, manager) {
            // A score reset (2-miss reset or mode switch) restarts the count.
            if (prevScore > 0 && ctx.score === 0) {
                shotsSinceReset = 0;
                armedForRestSpawn = false;
            }
            prevScore = ctx.score;

            // Black hole expired — clear the flag so the next cycle can arm.
            // If it was consumed by the ball, spawn a random challenge now.
            if (blackHoleActive && !manager.active.some(m => m.id === 'black-hole')) {
                blackHoleActive = false;
                armedForRestSpawn = false;
                if (ctx.blackHoleConsumed) {
                    ctx.blackHoleConsumed = false;
                    const pick = pickRandomChallenge(playCounts);
                    if (pick) {
                        playCounts.set(pick.id, (playCounts.get(pick.id) ?? 0) + 1);
                        manager.add(pick.factory(), ctx);
                    }
                }
            }

            // Spawn once the ball is at rest and the arm is set.
            if (armedForRestSpawn && !blackHoleActive && ctx.score > 0) {
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

            // Period is configurable for the test user; normal players use 10.
            const period = ctx.tester?.blackHoleShotThreshold ?? NORMAL_PERIOD;
            if ((shotsSinceReset + 1) % period === 0) {
                armedForRestSpawn = true;
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
