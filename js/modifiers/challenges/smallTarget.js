// Small Target challenge — the cup (pingpong) or hoop (basketball) shrinks
// by 30%, making it harder to score. Reward: 3× points + 1 extra life.
//
// Timing:
//   0 → RAMP_IN    : target smoothly shrinks from 1 → TARGET_SCALE
//   RAMP_IN → 20 s : target held at TARGET_SCALE, multiplier & life active
//   20 s → 20 s + RAMP_OUT : target smoothly grows back to 1
//   > 20 s + RAMP_OUT : expired

const DURATION    = 20;          // active seconds
const RAMP_IN     = 0.6;         // seconds to shrink to target size
const RAMP_OUT    = 0.6;         // seconds to grow back at end
const TARGET_SCALE = 0.7;        // 30% smaller

function smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
}

export default function smallTarget() {
    let activatedAt  = null;
    let lifeRemoved  = false;

    const elapsed = () => (performance.now() - activatedAt) / 1000;

    return {
        id:   'small-target',
        type: 'challenge',
        name: 'Small Target',

        onActivate(ctx) {
            activatedAt  = performance.now();
            lifeRemoved  = false;

            ctx.scoreMultiplier = 3;
            ctx.extraLives      = 1;
            ctx.addExtraLife();
            ctx.showChallengeBadge('SMALL TARGET', '3X', '+ 1 extra life');
            ctx.resetBallToStart();
        },

        onUpdate(ctx) {
            const t = elapsed();

            // Scale ramp-in: 1 → TARGET_SCALE
            // Hold: TARGET_SCALE
            // Scale ramp-out: TARGET_SCALE → 1
            let ts;
            if (t < RAMP_IN) {
                ts = 1 - smoothstep(t / RAMP_IN) * (1 - TARGET_SCALE);
            } else if (t < DURATION) {
                ts = TARGET_SCALE;
            } else if (t < DURATION + RAMP_OUT) {
                ts = TARGET_SCALE + smoothstep((t - DURATION) / RAMP_OUT) * (1 - TARGET_SCALE);
            } else {
                ts = 1;
            }
            ctx.targetScale = ts;

            // When the active phase ends, drop the rewards.
            if (t >= DURATION && !lifeRemoved) {
                lifeRemoved         = true;
                ctx.scoreMultiplier = 1;
                ctx.extraLives      = 0;
                ctx.removeExtraLife();
                ctx.hideChallengeBadge();
            }
        },

        onDeactivate(ctx) {
            ctx.targetScale     = 1;
            ctx.scoreMultiplier = 1;
            if (!lifeRemoved) {
                lifeRemoved    = true;
                ctx.extraLives = 0;
                ctx.removeExtraLife();
            }
            ctx.hideChallengeBadge();
        },

        isExpired() {
            return activatedAt !== null && elapsed() >= DURATION + RAMP_OUT;
        },
    };
}
