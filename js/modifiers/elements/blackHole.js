// Black Hole — a swirling neon-red void that appears on the playfield once
// the player sustains a scoring run (the trigger lives in director.js).
//
// It belongs to a single game (mode) and is cleared on a mode switch.
// Lifecycle: expands in, holds, then shrinks out — 8 seconds on screen.
//
// If the player flies the ball into it, the hole "consumes" the ball:
// it absorbs the ball (a short shrink-toward-center animation), holds
// briefly, then runs the same shrink-out animation as normal expiry,
// expiring early. While consumed it sets ctx.blackHoleConsumed so the
// director can spawn a random challenge once the hole is gone.

const LIFETIME    = 8;     // seconds on screen for a non-consumed hole
const EXPAND      = 0.32;  // grow-in duration (s)
const SHRINK      = 0.45;  // shrink-out duration (s)
const ABSORB      = 0.4;   // ball shrink-into-hole animation (s)
const POST_HOLD   = 0.5;   // hold after the ball is gone, before shrinking out (s)

// Shared image — loaded once, reused by every spawn.
const sprite = new Image();
sprite.src = 'assets/black_hole_red.webp';

export default function blackHole() {
    let x = 0;
    let y = 0;
    let radius = 0;
    let spawnTime = 0;

    // Consumption state
    let consumed   = false;
    let consumedAt = 0;
    let ballStart  = { x: 0, y: 0 };
    let ballR0     = 0;

    const elapsed   = () => (performance.now() - spawnTime)   / 1000;
    const consumedT = () => (performance.now() - consumedAt)  / 1000;

    // Animation scale 0..1 — ease-out expand, hold, ease-in shrink. When
    // consumed, the timeline switches: hold for ABSORB + POST_HOLD, then
    // run the same shrink curve over SHRINK seconds (matches normal
    // expiry visually).
    function animScale() {
        if (consumed) {
            const tc = consumedT();
            if (tc < ABSORB + POST_HOLD) return 1;
            const p = (tc - (ABSORB + POST_HOLD)) / SHRINK;
            return Math.max(0, 1 - p * p * p);
        }
        const e = elapsed();
        if (e < EXPAND) {
            const p = e / EXPAND;
            return 1 - Math.pow(1 - p, 3);
        }
        if (e > LIFETIME - SHRINK) {
            const p = (e - (LIFETIME - SHRINK)) / SHRINK;
            return Math.max(0, 1 - p * p * p);
        }
        return 1;
    }

    // Random spot on the playfield, clear of the active target (cup / hoop).
    // Y range is kept in the upper half so the hole never appears right
    // above the floor — it must feel like a sky-borne obstacle, not a puddle.
    function pickSpot(ctx) {
        const minX = ctx.width  * 0.12, maxX = ctx.width  * 0.90;
        const minY = ctx.height * 0.15, maxY = ctx.height * 0.55;
        const t = ctx.target;
        const clear = (t ? t.r : 0) + radius + 10;
        for (let i = 0; i < 50; i++) {
            const px = minX + Math.random() * (maxX - minX);
            const py = minY + Math.random() * (maxY - minY);
            if (!t || Math.hypot(px - t.x, py - t.y) > clear) return { x: px, y: py };
        }
        return { x: ctx.width * 0.3, y: ctx.height * 0.4 };
    }

    function smoothstep(t) {
        const x = Math.max(0, Math.min(1, t));
        return x * x * (3 - 2 * x);
    }

    return {
        id: 'black-hole',
        type: 'element',
        name: 'Black Hole',

        onActivate(ctx) {
            radius = 38 * ctx.scale;
            spawnTime = performance.now();
            const spot = pickSpot(ctx);
            x = spot.x;
            y = spot.y;
        },

        onUpdate(ctx /*, dt */) {
            if (consumed) return;
            // Only consume once the hole is visibly grown — a touch in the
            // first split second of the expand animation feels unfair.
            if (elapsed() < EXPAND * 0.5) return;

            const b = ctx.ball;
            if (!b) return;
            // Compare against the *animated* visible radius so the test
            // matches what the player sees.
            const r = radius * animScale();
            const d = Math.hypot(b.x - x, b.y - y);
            if (d < r * 0.85 + b.radius * 0.5) {
                consumed     = true;
                consumedAt   = performance.now();
                ballStart    = { x: b.x, y: b.y };
                ballR0       = b.radius;
                ctx.absorbBall();
                ctx.blackHoleConsumed = true;
            }
        },

        // Manager removes the modifier when this returns true.
        isExpired() {
            if (consumed) return consumedT() > ABSORB + POST_HOLD + SHRINK;
            return elapsed() >= LIFETIME;
        },

        onDraw(ctx) {
            const s = animScale();
            if (s <= 0.001) return;
            if (!sprite.complete || !sprite.naturalWidth) return;

            const c = ctx.ctx2d;
            const r = radius * s;
            const time = performance.now() / 1000;

            c.save();
            c.globalAlpha = 0.9;
            c.shadowColor = '#ff1a3c';
            c.shadowBlur = 28 * s;
            c.translate(x, y);

            // Absorption: draw the shrinking ball in WORLD space (before
            // the swirl-rotate transform) so it doesn't spin with the
            // image. Local (0,0) is the hole's center, so the ball lerps
            // from (ballStart - hole) to (0, 0).
            if (consumed && consumedT() < ABSORB) {
                const p  = smoothstep(consumedT() / ABSORB);
                const bx = (ballStart.x - x) * (1 - p);
                const by = (ballStart.y - y) * (1 - p);
                const br = ballR0 * (1 - p);
                c.save();
                c.globalAlpha = 1;
                c.shadowBlur = 0;
                c.fillStyle = '#f8fafc';
                c.beginPath();
                c.arc(bx, by, br, 0, Math.PI * 2);
                c.fill();
                c.restore();
            }

            c.rotate(time * 1.8);              // swirl rate
            c.drawImage(sprite, -r, -r, r * 2, r * 2);

            // "CHALLENGE" curved along the arc and spinning with the hole.
            const fontSize = Math.max(7, r * 0.34);
            c.font = `700 ${fontSize}px Orbitron, sans-serif`;
            c.fillStyle = '#ff1a3c';
            c.shadowColor = '#ff1a3c';
            c.shadowBlur = 10 * s;
            c.textAlign = 'center';
            c.textBaseline = 'bottom';

            const textR = r * 1.08;
            const word = 'CHALLENGE';
            const widths = [...word].map(ch => c.measureText(ch).width);
            const totalAngle = widths.reduce((a, b) => a + b, 0) / textR;
            c.strokeStyle = 'rgba(255,255,255,0.9)';
            c.lineWidth = fontSize * 0.18;
            c.lineJoin = 'round';
            let a = -totalAngle / 2;
            for (let i = 0; i < word.length; i++) {
                const cw = widths[i] / textR;
                c.save();
                c.rotate(a + cw / 2);
                c.translate(0, -textR);
                c.strokeText(word[i], 0, 0);
                c.fillText(word[i], 0, 0);
                c.restore();
                a += cw;
            }

            c.restore();
        },
    };
}
