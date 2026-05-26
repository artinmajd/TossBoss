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
//
// Trap-aware swing (pingpong): the cup is allowed to push the ball
// toward the wall, but the moment the ball is pinned against the wall
// AND the cup is touching it from the other side, the SHM phase is
// reflected so the cup immediately reverses direction. The ball is
// never compressed against the wall.

const DURATION  = 20;    // active phase in seconds
const WIND_DOWN = 1.0;   // amplitude decay duration in seconds
const PERIOD    = 4;     // seconds per full oscillation cycle
const AMP_X     = 0.12;  // cup amplitude as a fraction of playfield width
const AMP_Y     = 0.15;  // hoop amplitude as a fraction of playfield height
const CUP_HALF_TOP = 55; // half of cupWidthTop — multiplied by ctx.scale at runtime

// Hermite smoothstep — 0 at t=0, 1 at t=1, zero derivative at both ends.
function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

// Position-preserving direction-reversing reflection of the SHM phase.
// sin(π - θ) = sin(θ)  AND  cos(π - θ) = -cos(θ). In phase-time units
// (phaseT = θ · PERIOD / (2π)) this is PERIOD/2 − phaseT, modulo PERIOD.
function reflectPhase(phaseT) {
    let p = (PERIOD / 2) - phaseT;
    p = ((p % PERIOD) + PERIOD) % PERIOD;
    return p;
}

export default function movingTarget() {
    let activatedAt  = 0;     // real time start (used for envelope and isExpired)
    let lastTickAt   = 0;     // real time of previous onUpdate, for realDt
    let phaseT       = 0;     // virtual phase clock — advances per tick, reflectable on trap
    let mode         = 'pingpong';
    let amp          = 0;
    let badgeHidden  = false;

    const elapsed = () => (performance.now() - activatedAt) / 1000;

    return {
        id: 'moving-target',
        type: 'challenge',
        name: 'Moving Target',
        weight: 1,

        onActivate(ctx) {
            activatedAt = performance.now();
            lastTickAt  = activatedAt;
            phaseT      = 0;
            mode        = ctx.gameMode;
            amp         = mode === 'pingpong' ? ctx.width * AMP_X : ctx.height * AMP_Y;
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
            const now    = performance.now();
            const realDt = (now - lastTickAt) / 1000;
            lastTickAt   = now;

            // Phase advances by wall-clock real time. Decoupling this from
            // `elapsed()` lets us reflect the phase on a trap without
            // disturbing the envelope or expiry clock.
            phaseT += realDt;

            const t = elapsed();
            const env = t <= DURATION
                ? 1
                : Math.max(0, 1 - smoothstep((t - DURATION) / WIND_DOWN));

            // SHM around the original. Minus sign + sin makes the target
            // dip toward the negative side first (cup → left, hoop → up).
            let swing = -amp * env * Math.sin((2 * Math.PI * phaseT) / PERIOD);

            if (mode === 'pingpong') {
                // Engine clamps the cup so its rims never leave the
                // playfield. Reproduce that clamp here so the trap check
                // sees the same position the player sees.
                const halfTop = CUP_HALF_TOP * ctx.scale;
                const homeX   = ctx.width * 0.85;
                const minX    = halfTop;
                const maxX    = ctx.width - halfTop;
                const rawCupX = homeX + swing;
                const cupX    = Math.max(minX, Math.min(maxX, rawCupX));
                const cupRight = cupX + halfTop;
                const cupLeft  = cupX - halfTop;

                const ballLeftEdge  = ctx.ball.x - ctx.ball.radius;
                const ballRightEdge = ctx.ball.x + ctx.ball.radius;
                // 0.5 px tolerance — large enough that a cup that just
                // retreated by one tick's worth of motion (~3 px/tick at
                // peak velocity) won't re-trigger; small enough that an
                // actual contact registers.
                const TOL = 0.5;

                // Right trap: ball pinned at right wall, cup touching it
                // from the left. Clamp the swing so the cup never crosses
                // the ball's left edge, AND reflect the phase so the next
                // tick already moves the cup leftward.
                if (ballRightEdge >= ctx.width - 1 && cupRight >= ballLeftEdge - TOL) {
                    const maxSwing = (ballLeftEdge - halfTop) - homeX;
                    if (swing > maxSwing) swing = maxSwing;
                    phaseT = reflectPhase(phaseT);
                }
                // Left trap: symmetric. Unlikely with the cup's home X near
                // the right side, but covered for completeness.
                else if (ballLeftEdge <= 1 && cupLeft <= ballRightEdge + TOL) {
                    const minSwing = (ballRightEdge + halfTop) - homeX;
                    if (swing < minSwing) swing = minSwing;
                    phaseT = reflectPhase(phaseT);
                }

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
