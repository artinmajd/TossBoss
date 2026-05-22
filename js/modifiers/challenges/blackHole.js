// Black Hole — a small swirling neon-red void that appears somewhere on the
// playfield once the player has sustained a scoring run (the trigger lives in
// director.js). Works in both ping pong and basketball modes.
//
// For now it is purely a visual element: it spawns, swirls, and stays. It has
// no effect on the ball yet.

export default function blackHole() {
    let x = 0;
    let y = 0;
    let radius = 0;

    // Pick a random spot on the playfield, kept clear of the active target
    // (cup / hoop) so it never blocks a clean shot.
    function pickSpot(ctx) {
        const minX = ctx.width * 0.12;
        const maxX = ctx.width * 0.90;
        const minY = ctx.height * 0.20;
        const maxY = ctx.height * 0.78;
        const t = ctx.target;
        const clear = (t ? t.r : 0) + radius + 10;

        for (let i = 0; i < 50; i++) {
            const px = minX + Math.random() * (maxX - minX);
            const py = minY + Math.random() * (maxY - minY);
            if (!t || Math.hypot(px - t.x, py - t.y) > clear) {
                return { x: px, y: py };
            }
        }
        // Fallback: left-of-centre — always far from the right-side target.
        return { x: ctx.width * 0.3, y: ctx.height * 0.5 };
    }

    return {
        id: 'black-hole',
        type: 'challenge',
        name: 'Black Hole',

        onActivate(ctx) {
            radius = 38 * ctx.scale;
            const spot = pickSpot(ctx);
            x = spot.x;
            y = spot.y;
        },

        onDraw(ctx) {
            const c = ctx.ctx2d;
            const time = performance.now() / 1000;

            c.save();
            c.translate(x, y);

            // Event horizon — a black core fading to deep red at the edge.
            const core = c.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
            core.addColorStop(0, '#000000');
            core.addColorStop(0.7, '#0b0007');
            core.addColorStop(1, 'rgba(35, 0, 12, 0.92)');
            c.fillStyle = core;
            c.beginPath();
            c.arc(0, 0, radius, 0, Math.PI * 2);
            c.fill();

            // Two arms spiralling inward, rotating over time = the swirl.
            c.rotate(time * 1.8);
            for (let arm = 0; arm < 2; arm++) {
                c.rotate(Math.PI);
                c.strokeStyle = arm === 0
                    ? 'rgba(255, 70, 100, 0.7)'
                    : 'rgba(255, 30, 68, 0.5)';
                c.lineWidth = 2;
                c.beginPath();
                for (let a = 0; a <= Math.PI * 2.6; a += 0.18) {
                    const rr = radius * (0.95 - a / (Math.PI * 3.1));
                    const px = Math.cos(a) * rr;
                    const py = Math.sin(a) * rr;
                    if (a === 0) c.moveTo(px, py);
                    else c.lineTo(px, py);
                }
                c.stroke();
            }

            // Neon-red glowing rim — the outline, drawn on top.
            c.shadowColor = '#ff1f44';
            c.shadowBlur = 14;
            c.strokeStyle = '#ff1f44';
            c.lineWidth = 2.5;
            c.beginPath();
            c.arc(0, 0, radius, 0, Math.PI * 2);
            c.stroke();

            c.restore();
        },
    };
}
