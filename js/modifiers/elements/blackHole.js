// Black Hole — a swirling neon-red void that appears on the playfield once
// the player sustains a scoring run (the trigger lives in director.js).
//
// It belongs to a single game (mode) and is cleared on a mode switch.
// Lifecycle: expands in, holds, then shrinks out — 8 seconds on screen.
// Purely visual for now: no effect on the ball.

const LIFETIME = 8;      // seconds on screen
const EXPAND   = 0.32;   // grow-in duration (s)
const SHRINK   = 0.45;   // shrink-out duration (s)

// Shared image — loaded once, reused by every spawn.
const sprite = new Image();
sprite.src = 'assets/black_hole_red.webp';

export default function blackHole() {
    let x = 0;
    let y = 0;
    let radius = 0;
    let spawnTime = 0;

    const elapsed = () => (performance.now() - spawnTime) / 1000;

    // Animation scale 0..1 — ease-out expand, hold, ease-in shrink.
    function animScale() {
        const e = elapsed();
        if (e < EXPAND) {
            const p = e / EXPAND;
            return 1 - Math.pow(1 - p, 3);              // ease-out grow
        }
        if (e > LIFETIME - SHRINK) {
            const p = (e - (LIFETIME - SHRINK)) / SHRINK;
            return Math.max(0, 1 - p * p * p);          // ease-in shrink
        }
        return 1;
    }

    // Random spot on the playfield, clear of the active target (cup / hoop).
    function pickSpot(ctx) {
        const minX = ctx.width * 0.12, maxX = ctx.width * 0.90;
        const minY = ctx.height * 0.20, maxY = ctx.height * 0.78;
        const t = ctx.target;
        const clear = (t ? t.r : 0) + radius + 10;
        for (let i = 0; i < 50; i++) {
            const px = minX + Math.random() * (maxX - minX);
            const py = minY + Math.random() * (maxY - minY);
            if (!t || Math.hypot(px - t.x, py - t.y) > clear) return { x: px, y: py };
        }
        // Fallback: left-of-centre — always far from the right-side target.
        return { x: ctx.width * 0.3, y: ctx.height * 0.5 };
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

        // The manager removes the modifier once this returns true.
        isExpired() {
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
            c.rotate(time * 1.8);              // same swirl rate as before
            c.drawImage(sprite, -r, -r, r * 2, r * 2);

            // "CHALLENGE" lettered ring — spins with the image.
            const text = 'CHALLENGE';
            const textR = r * 1.62;
            const fontSize = Math.max(7, r * 0.34);
            c.font = `700 ${fontSize}px Orbitron, sans-serif`;
            c.fillStyle = '#ff1a3c';
            c.shadowColor = '#ff1a3c';
            c.shadowBlur = 10 * s;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            const step = (Math.PI * 2) / text.length;
            for (let i = 0; i < text.length; i++) {
                c.save();
                c.rotate(i * step);
                c.translate(0, -textR);
                c.rotate(Math.PI / 2);   // face clockwise along the ring
                c.fillText(text[i], 0, 0);
                c.restore();
            }

            c.restore();
        },
    };
}
