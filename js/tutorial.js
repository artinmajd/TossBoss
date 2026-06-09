/**
 * Tutorial overlay — animated drag demonstration with real aiming visuals
 */

let animationFrame = null;
let startTime = null;

export function initTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    const canvas = document.getElementById('tutorial-canvas');

    if (!overlay || !canvas) return;

    const ctx = canvas.getContext('2d');

    // Resize canvas to match viewport
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Tutorial drag animation parameters
    const cycleTime = 3000; // 3 seconds per cycle

    // Ball position matches game initial position (left side, 85% down)
    const ballXPercent = 0.25; // Left quarter of screen
    const ballYPercent = 0.85; // groundLevel from engine.js

    // Start point (where finger starts, at ball)
    const startX = ballXPercent;
    const startY = ballYPercent;
    // End point (drag BACKWARDS to aim forward)
    const endX = ballXPercent - 0.2;
    const endY = ballYPercent + 0.15;

    // Speech bubble message
    const message = 'Drag from ANYWHERE on the screen to start aiming and power';

    const drawSpeechBubble = (ballX, ballY, scale) => {
        const lines = [message];
        ctx.save();
        const fpx = Math.max(14, Math.round(22 * scale));
        ctx.font = `400 ${fpx}px 'Bangers', 'Comic Sans MS', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let maxW = 0;
        for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
        const padX = 14 * scale, padY = 9 * scale, lineH = fpx * 1.1;
        const bw = maxW + padX * 2;
        const bh = lines.length * lineH + padY * 2;
        const r = 13 * scale;
        const ballRadius = 25;

        // Bubble sits above the ball
        let bx = ballX;
        let bottom = ballY - ballRadius - 22 * scale;
        let top = bottom - bh;
        let left = bx - bw / 2;

        // Clamp inside viewport
        if (left < 6 * scale) { left = 6 * scale; bx = left + bw / 2; }
        if (left + bw > canvas.width - 6 * scale) { left = canvas.width - 6 * scale - bw; bx = left + bw / 2; }
        if (top < 6 * scale) { top = 6 * scale; bottom = top + bh; }

        // Tail
        const tailX = Math.max(left + r + 8 * scale, Math.min(left + bw - r - 8 * scale, ballX));
        const tailHalf = 9 * scale;

        ctx.beginPath();
        ctx.moveTo(left + r, top);
        ctx.lineTo(left + bw - r, top);
        ctx.arcTo(left + bw, top, left + bw, top + r, r);
        ctx.lineTo(left + bw, bottom - r);
        ctx.arcTo(left + bw, bottom, left + bw - r, bottom, r);
        ctx.lineTo(tailX + tailHalf, bottom);
        ctx.lineTo(ballX, ballY - ballRadius * 0.5);
        ctx.lineTo(tailX - tailHalf, bottom);
        ctx.lineTo(left + r, bottom);
        ctx.arcTo(left, bottom, left, bottom - r, r);
        ctx.lineTo(left, top + r);
        ctx.arcTo(left, top, left + r, top, r);
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 10 * scale;
        ctx.shadowOffsetY = 3 * scale;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = Math.max(2, 3 * scale);
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        lines.forEach((l, i) => ctx.fillText(l, bx, top + padY + lineH / 2 + i * lineH));
        ctx.restore();
    };

    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = (elapsed % cycleTime) / cycleTime;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const scale = Math.min(canvas.width, canvas.height) / 800;

        // Ball position (start point)
        const ballX = startX * canvas.width;
        const ballY = startY * canvas.height;

        // Only draw during the drag phase (0% to 45% of cycle)
        if (progress <= 0.45) {
            const dragProgress = progress / 0.45; // 0 to 1 during drag

            // Interpolate finger position (dragging BACKWARDS)
            const currentX = startX + (endX - startX) * dragProgress;
            const currentY = startY + (endY - startY) * dragProgress;

            const pixelCurrentX = currentX * canvas.width;
            const pixelCurrentY = currentY * canvas.height;

            // aimStart is where finger started (ball position)
            // aimCurrent is where finger is now
            // We drag BACKWARDS to aim forward
            const aimStartX = ballX;
            const aimStartY = ballY;
            const aimCurrentX = pixelCurrentX;
            const aimCurrentY = pixelCurrentY;

            const dx = aimStartX - aimCurrentX;
            const dy = aimStartY - aimCurrentY;

            // Draw trajectory prediction (simplified, matching engine.js logic)
            const powerMultiplier = 8;
            let simVx = dx * powerMultiplier;
            let simVy = dy * powerMultiplier;

            const speed = Math.hypot(simVx, simVy);
            const maxSpeed = 4000;
            if (speed > maxSpeed) {
                simVx = (simVx / speed) * maxSpeed;
                simVy = (simVy / speed) * maxSpeed;
            }

            let simX = ballX;
            let simY = ballY;

            const gravity = 9.81;
            const pixelsPerMeter = 100;
            const dt = 1 / 60;
            const airResistance = 0.996;
            const bounceFactor = 0.7;
            const friction = 0.9;

            ctx.beginPath();
            ctx.moveTo(simX, simY);

            const predictionSteps = 30;
            for (let i = 0; i < predictionSteps; i++) {
                simVy += gravity * pixelsPerMeter * dt;
                simVx *= airResistance;
                simVy *= airResistance;

                simX += simVx * dt;
                simY += simVy * dt;

                if (simY + 12 >= canvas.height) {
                    simY = canvas.height - 12;
                    simVy = -simVy * bounceFactor;
                    simVx *= friction;
                }
                if (simY - 12 <= 0) {
                    simY = 12;
                    simVy = -simVy * bounceFactor;
                }
                if (simX + 12 >= canvas.width) {
                    simX = canvas.width - 12;
                    simVx = -simVx * bounceFactor;
                } else if (simX - 12 <= 0) {
                    simX = 12;
                    simVx = -simVx * bounceFactor;
                }

                ctx.lineTo(simX, simY);
            }

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 8]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Virtual joystick UI - circle at aimStart
            ctx.beginPath();
            ctx.arc(aimStartX, aimStartY, 35 * scale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 2 * scale;
            ctx.stroke();

            // Dot at aimCurrent
            ctx.beginPath();
            ctx.arc(aimCurrentX, aimCurrentY, 15 * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }

        // Draw speech bubble above the real game ball
        drawSpeechBubble(ballX, ballY, scale);

        animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    // Return cleanup function
    return () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        startTime = null;
        window.removeEventListener('resize', resizeCanvas);
    };
}

export function hideTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

export function showTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.style.display = 'block';
    }
}
