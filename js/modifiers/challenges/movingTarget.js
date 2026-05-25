// Moving Target — the first challenge.
//
// While active, the current target (cup in pingpong, hoop in basketball)
// oscillates around its original position via simple harmonic motion.
// The original IS the equilibrium of the swing — speed peaks there, the
// target hangs at each extreme. After DURATION seconds the amplitude
// smoothly decays (smoothstep envelope) over WIND_DOWN seconds so the
// target settles back at the original with no teleport.
//
// Scoring during the active phase is doubled via gameCtx.scoreMultiplier.
// A HUD badge ("MOVING TARGET / Reward: 2X points") is shown for the
// active phase and hidden when the wind-down begins.

const DURATION  = 20;    // active phase in seconds
const WIND_DOWN = 1.0;   // amplitude decay duration in seconds
const PERIOD    = 4;     // seconds per full oscillation cycle
const AMP_X     = 0.12;  // cup amplitude as a fraction of playfield width
const AMP_Y     = 0.15;  // hoop amplitude as a fraction of playfield height

// Hermite smoothstep — 0 at t=0, 1 at t=1, zero derivative at both ends.
function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

export default function movingTarget() {
    let activatedAt = 0;
    let mode = 'pingpong';
    let amp = 0;
    let badgeHidden = false;

    const elapsed = () => (performance.now() - activatedAt) / 1000;

    return {
        id: 'moving-target',
        type: 'challenge',
        name: 'Moving Target',
        weight: 1,

        onActivate(ctx) {
            activatedAt = performance.now();
            mode = ctx.gameMode;
            amp = mode === 'pingpong' ? ctx.width * AMP_X : ctx.height * AMP_Y;
            badgeHidden = false;
            ctx.scoreMultiplier = 2;
            ctx.showChallengeBadge('MOVING TARGET', '2X');
            // The previous throw was eaten by the black hole — give the
            // player a fresh ball at the launch position so they can throw
            // immediately into the moving target.
            ctx.resetBallToStart();
        },

        onDeactivate(ctx) {
            // Defensive cleanup (mode switch / forced clear). Normal
            // expiry already does the same via onUpdate's wind-down.
            ctx.scoreMultiplier = 1;
            ctx.targetOffset.x = 0;
            ctx.targetOffset.y = 0;
            ctx.hideChallengeBadge();
        },

        onUpdate(ctx /*, dt */) {
            const t = elapsed();

            // Envelope: 1 during the active phase, smoothstep down over
            // WIND_DOWN, then 0. Multiplying amplitude by the envelope
            // shrinks the swing smoothly to zero (= original position).
            const env = t <= DURATION
                ? 1
                : Math.max(0, 1 - smoothstep((t - DURATION) / WIND_DOWN));

            // SHM around the original. The leading minus sign + sin makes
            // the target dip toward the negative side first (cup → left,
            // hoop → up), then oscillate symmetrically. Speed is highest
            // as the swing crosses zero — i.e. at the original position.
            const swing = -amp * env * Math.sin((2 * Math.PI * t) / PERIOD);
            if (mode === 'pingpong') {
                ctx.targetOffset.x = swing;
                ctx.targetOffset.y = 0;
            } else {
                ctx.targetOffset.x = 0;
                ctx.targetOffset.y = swing;
            }

            // The active phase is over the moment t hits DURATION:
            // multiplier goes back to 1× and the badge hides, so the
            // wind-down is a clear "challenge ended, motion just settling"
            // beat rather than a continuation of the bonus.
            if (t >= DURATION) {
                ctx.scoreMultiplier = 1;
                if (!badgeHidden) {
                    ctx.hideChallengeBadge();
                    badgeHidden = true;
                }
            }
        },

        isExpired() {
            return elapsed() > DURATION + WIND_DOWN + 0.05;
        },
    };
}
