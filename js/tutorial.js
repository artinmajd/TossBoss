/**
 * Tutorial overlay — animated drag demonstration with real aiming visuals
 */

let animationFrame = null;
let startTime = null;

export function initTutorial(getBallPosition, getCanvasTransform) {
    const overlay = document.getElementById('tutorial-overlay');
    const canvas = document.getElementById('tutorial-canvas');
    const gameCanvas = document.getElementById('simulation-canvas');
    const fingerEl = document.querySelector('.tutorial-finger');

    if (!overlay || !canvas || !gameCanvas || !fingerEl) return;

    const ctx = canvas.getContext('2d');

    // Match tutorial canvas to game canvas dimensions
    const resizeCanvas = () => {
        canvas.width = gameCanvas.width;
        canvas.height = gameCanvas.height;
        // Position tutorial canvas to overlay game canvas exactly
        const rect = gameCanvas.getBoundingClientRect();
        canvas.style.position = 'absolute';
        canvas.style.left = rect.left + 'px';
        canvas.style.top = rect.top + 'px';
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Tutorial drag animation parameters
    const cycleTime = 3000; // 3 seconds per cycle

    // Speech bubble message
    const message = 'Drag from ANYWHERE on the screen to start aiming and power';

    const drawSpeechBubble = (ballX, ballY, ballRadius, scale, virtualWidth, virtualHeight) => {
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

        // Bubble sits above the ball
        let bx = ballX;
        let bottom = ballY - ballRadius - 22 * scale;
        let top = bottom - bh;
        let left = bx - bw / 2;

        // Clamp inside virtual playfield
        if (left < 6 * scale) { left = 6 * scale; bx = left + bw / 2; }
        if (left + bw > virtualWidth - 6 * scale) { left = virtualWidth - 6 * scale - bw; bx = left + bw / 2; }
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

        // Get game transform and ball position
        const transform = getCanvasTransform ? getCanvasTransform() : null;
        const ballPos = getBallPosition ? getBallPosition() : null;
        if (!ballPos || !transform) return;

        // Clear with identity transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply same transform as game canvas (letterbox)
        ctx.setTransform(
            transform.dpr * transform.viewScale, 0,
            0, transform.dpr * transform.viewScale,
            transform.dpr * transform.viewOffsetX,
            transform.dpr * transform.viewOffsetY
        );

        const scale = Math.min(transform.width, transform.height) / 800;

        // Ball position in virtual coordinates
        const ballX = ballPos.x;
        const ballY = ballPos.y;

        // Finger position is FIXED on screen (not relative to ball)
        // Start at 20% from left edge
        const fingerStartX = transform.width * 0.2;
        const fingerStartY = transform.height * 0.35;

        // Animation phases: drag (0-15%), hold (15-25%), angle adjust (25-90%), rest (90-100%)
        let fingerCurrentX, fingerCurrentY;
        let aimStartX, aimStartY, aimCurrentX, aimCurrentY;
        let shouldDraw = false;

        if (progress <= 0.15) {
            // DRAG PHASE: pull back at 45-degree angle to build power
            shouldDraw = true;
            const dragProgress = progress / 0.15;

            // Pull at 45-degree angle (equal X and Y offset)
            const distance = transform.height * 0.2 * dragProgress;
            const xOffset = -distance * Math.cos(Math.PI / 4); // 45 degrees
            const yOffset = distance * Math.sin(Math.PI / 4);

            fingerCurrentX = fingerStartX + xOffset;
            fingerCurrentY = fingerStartY + yOffset;

            aimStartX = fingerStartX;
            aimStartY = fingerStartY;
            aimCurrentX = fingerCurrentX;
            aimCurrentY = fingerCurrentY;
        } else if (progress <= 0.25) {
            // HOLD PHASE: stay at dragged position for a moment
            shouldDraw = true;

            const distance = transform.height * 0.2;
            const baseXOffset = -distance * Math.cos(Math.PI / 4);
            const baseYOffset = distance * Math.sin(Math.PI / 4);

            fingerCurrentX = fingerStartX + baseXOffset;
            fingerCurrentY = fingerStartY + baseYOffset;

            aimStartX = fingerStartX;
            aimStartY = fingerStartY;
            aimCurrentX = fingerCurrentX;
            aimCurrentY = fingerCurrentY;
        } else if (progress <= 0.9) {
            // ANGLE ADJUSTMENT PHASE: move finger up/down vertically to adjust aim
            shouldDraw = true;
            const adjustProgress = (progress - 0.25) / 0.65; // 0 to 1 during adjust phase

            // Keep finger at end of drag position
            const distance = transform.height * 0.2;
            const baseXOffset = -distance * Math.cos(Math.PI / 4);
            const baseYOffset = distance * Math.sin(Math.PI / 4);

            // Move up and down 4 times slowly
            const verticalAdjust = Math.sin(adjustProgress * Math.PI * 4) * transform.height * 0.08;

            fingerCurrentX = fingerStartX + baseXOffset;
            fingerCurrentY = fingerStartY + baseYOffset + verticalAdjust;

            aimStartX = fingerStartX;
            aimStartY = fingerStartY;
            aimCurrentX = fingerCurrentX;
            aimCurrentY = fingerCurrentY;

        }

        if (shouldDraw) {
            const dx = aimStartX - aimCurrentX;
            const dy = aimStartY - aimCurrentY;

            // Draw trajectory prediction starting from the BALL
            const powerMultiplier = 8;
            let simVx = dx * powerMultiplier;
            let simVy = dy * powerMultiplier;

            const speed = Math.hypot(simVx, simVy);
            const maxSpeed = 4000;
            if (speed > maxSpeed) {
                simVx = (simVx / speed) * maxSpeed;
                simVy = (simVy / speed) * maxSpeed;
            }

            // Trajectory starts from the actual ball position
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

                const floorY = transform.height * 0.85;
                if (simY + 12 >= floorY) {
                    simY = floorY - 12;
                    simVy = -simVy * bounceFactor;
                    simVx *= friction;
                }
                if (simY - 12 <= 0) {
                    simY = 12;
                    simVy = -simVy * bounceFactor;
                }
                if (simX + 12 >= transform.width) {
                    simX = transform.width - 12;
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

            // Position finger element over the aimCurrent position
            const gameRect = gameCanvas.getBoundingClientRect();
            // Convert virtual coordinates to screen coordinates
            const screenX = gameRect.left + (aimCurrentX * transform.viewScale * transform.dpr + transform.viewOffsetX * transform.dpr) / transform.dpr;
            const screenY = gameRect.top + (aimCurrentY * transform.viewScale * transform.dpr + transform.viewOffsetY * transform.dpr) / transform.dpr;

            fingerEl.style.left = screenX + 'px';
            fingerEl.style.top = screenY + 'px';
            fingerEl.style.opacity = '1';
            // Position fingertip on the dot (finger is rotated -20deg)
            // Adjust both X and Y to account for rotation
            fingerEl.style.transform = 'translate(-35%, -15%)';
        }

        if (!shouldDraw) {
            // Hide finger when not in active phase
            fingerEl.style.opacity = '0';
        }

        // Draw speech bubble above the real game ball
        try {
            drawSpeechBubble(ballX, ballY, ballPos.radius, scale, transform.width, transform.height);
        } catch (e) {
            console.error('Speech bubble error:', e);
        }

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
