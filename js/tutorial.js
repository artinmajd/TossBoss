/**
 * Tutorial overlay — animated drag demonstration with aiming circle and line
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

    // Start and end points for the drag (in viewport percentage)
    const startX = 0.3;
    const startY = 0.45;
    const endX = 0.55;
    const endY = 0.3;

    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = (elapsed % cycleTime) / cycleTime;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Only draw during the drag phase (0% to 45% of cycle)
        if (progress <= 0.45) {
            const dragProgress = progress / 0.45; // 0 to 1 during drag

            // Interpolate finger position
            const currentX = startX + (endX - startX) * dragProgress;
            const currentY = startY + (endY - startY) * dragProgress;

            const pixelStartX = startX * canvas.width;
            const pixelStartY = startY * canvas.height;
            const pixelCurrentX = currentX * canvas.width;
            const pixelCurrentY = currentY * canvas.height;

            // Calculate drag vector
            const dx = pixelCurrentX - pixelStartX;
            const dy = pixelCurrentY - pixelStartY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Draw aiming line
            if (distance > 5) {
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 6]);
                ctx.beginPath();
                ctx.moveTo(pixelStartX, pixelStartY);
                ctx.lineTo(pixelCurrentX, pixelCurrentY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw arrowhead at the end
                const angle = Math.atan2(dy, dx);
                const arrowSize = 12;
                ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
                ctx.beginPath();
                ctx.moveTo(pixelCurrentX, pixelCurrentY);
                ctx.lineTo(
                    pixelCurrentX - arrowSize * Math.cos(angle - Math.PI / 6),
                    pixelCurrentY - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    pixelCurrentX - arrowSize * Math.cos(angle + Math.PI / 6),
                    pixelCurrentY - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
            }

            // Draw aiming circle at start point
            const radius = Math.min(40 + distance * 0.3, 80);
            const gradient = ctx.createRadialGradient(
                pixelStartX, pixelStartY, 0,
                pixelStartX, pixelStartY, radius
            );
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
            gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pixelStartX, pixelStartY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw circle outline
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pixelStartX, pixelStartY, radius, 0, Math.PI * 2);
            ctx.stroke();
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
        overlay.style.display = 'flex';
    }
}
