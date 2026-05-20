let canvas, ctx, width, height, scale, basketballImg, hoopImg;
let gameMode = 'pingpong', baseRadius = 18, bounceFactor = 0.85, airResistance = 0.995, friction = 0.99;
let score = 0, scoredThisThrow = false, fullscreenAttempted = false, isResting = true, isBehindNet = false, wasAboveRim = false, isDisqualified = false;
let ball = {x: 0, y: 0, vx: 0, vy: 0, radius: 18};
let isAiming = false, aimStart = {x: 0, y: 0}, aimCurrent = {x: 0, y: 0}, isSpaceDown = false;
let animationId = null, gameInitialized = false;

const gravity = 9.8, pixelsPerMeter = 100, frameRate = 60, dt = 1 / frameRate, groundLevel = 0.85;

export function initGame() {
    if (gameInitialized) return;
    
    canvas = document.getElementById('simulation-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    width = window.innerWidth;
    height = window.innerHeight;
    
    basketballImg = new Image();
    basketballImg.src = 'assets/basketball.png';
    hoopImg = new Image();
    hoopImg.src = 'assets/hoop_transparent.png';
    
    // UI Event Listeners
    document.getElementById('mode-pingpong')?.addEventListener('click', () => setMode('pingpong'));
    document.getElementById('mode-basketball')?.addEventListener('click', () => setMode('basketball'));
    document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullscreen);
    document.getElementById('reset-btn')?.addEventListener('click', resetBall);
    
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    resizeCanvas();
    gameInitialized = true;
    animate();
}

export function destroyGame() {
    if (!gameInitialized) return;
    cancelAnimationFrame(animationId);
    
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('mouseup', handlePointerUp);
    window.removeEventListener('touchend', handlePointerUp);
    
    gameInitialized = false;
}

// ---- ALL THE ORIGINAL FUNCTIONS GO HERE ---- //
