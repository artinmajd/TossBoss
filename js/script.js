const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let scale = 1;

// Load images
const basketballImg = new Image();
basketballImg.src = 'assets/basketball.png';

const hoopImg = new Image();
hoopImg.src = 'assets/hoop_transparent.png';

// Physics parameters
const gravity = 9.8; 
const pixelsPerMeter = 100; 
const frameRate = 60;
const dt = 1 / frameRate; 
const groundLevel = 0.85; 

// Dynamic mode parameters
let gameMode = 'pingpong'; 
let baseRadius = 18;
let bounceFactor = 0.85; 
let airResistance = 0.995; 
let friction = 0.99; 

// Game state
let score = 0;
let scoredThisThrow = false;
let fullscreenAttempted = false;
let isResting = true; 
let isBehindNet = false;
let wasAboveRim = false;
let isDisqualified = false;

// Ball object
const ball = {
    x: 0, 
    y: 0,      
    vx: 0,
    vy: 0,
    radius: 18,
};

// Aiming state
let isAiming = false;
let aimStart = { x: 0, y: 0 };
let aimCurrent = { x: 0, y: 0 };

const resetBtn = document.getElementById('reset-btn');

function setMode(mode) {
    if (isAiming) return; // Prevent changing mode while aiming
    
    gameMode = mode;
    score = 0;
    
    document.getElementById('mode-pingpong').classList.remove('active');
    document.getElementById('mode-basketball').classList.remove('active');
    document.getElementById(`mode-${mode}`).classList.add('active');
    
    const title = document.getElementById('game-title');
    if (title) {
        title.innerText = mode === 'pingpong' ? 'Ping Pong Physics' : 'Basketball Physics';
    }
    
    if (mode === 'pingpong') {
        baseRadius = 18;
        bounceFactor = 0.85;
        airResistance = 0.995;
        friction = 0.99;
    } else {
        baseRadius = 26; // Larger ball
        bounceFactor = 0.76; 
        airResistance = 0.998;
        friction = 0.97;
    }
    
    resizeCanvas();
}

document.getElementById('mode-pingpong').addEventListener('click', () => setMode('pingpong'));
document.getElementById('mode-basketball').addEventListener('click', () => setMode('basketball'));

const fullscreenBtn = document.getElementById('fullscreen-btn');

fullscreenBtn.addEventListener('click', () => {
    const docElm = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (docElm.requestFullscreen) {
            docElm.requestFullscreen().catch(e => console.log(e));
        } else if (docElm.webkitRequestFullscreen) {
            docElm.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
});

function resetBall() {
    const minX = ball.radius * 2;
    const maxX = width * 0.65;
    ball.x = minX + Math.random() * (maxX - minX);
    ball.y = height * groundLevel - ball.radius;
    ball.vx = 0;
    ball.vy = 0;
    isAiming = false;
    scoredThisThrow = false;
    isResting = true;
    isBehindNet = false;
    wasAboveRim = false;
    isDisqualified = false;
}

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    
    // High-DPI Display Support (Retina Screens)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    scale = Math.min(1, Math.max(0.4, height / 650));
    
    ball.radius = baseRadius * scale;
    resetBall();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

resetBtn.addEventListener('click', resetBall);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        resetBall();
    }
});

// Pointer Events
function getPointerPos(e) {
    if (e.touches) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handlePointerDown(e) {
    if (e.target.closest('button') || scoredThisThrow) return;
    if (!isResting) return;
    
    const pos = getPointerPos(e);
    
    isAiming = true;
    isResting = false;
    wasAboveRim = false;
    isDisqualified = false;
    aimStart = { x: pos.x, y: pos.y };
    aimCurrent = { x: pos.x, y: pos.y };
    ball.vx = 0;
    ball.vy = 0;
}

function handlePointerMove(e) {
    if (!isAiming) return;
    const pos = getPointerPos(e);
    
    let dx = pos.x - aimStart.x;
    let dy = pos.y - aimStart.y;
    const dragDist = Math.hypot(dx, dy);
    const maxDrag = Math.min(width, height) * 0.3; // Cap drag to 30% of the screen dimension
    
    if (dragDist > maxDrag) {
        dx = (dx / dragDist) * maxDrag;
        dy = (dy / dragDist) * maxDrag;
        aimCurrent = { x: aimStart.x + dx, y: aimStart.y + dy };
    } else {
        aimCurrent = { x: pos.x, y: pos.y };
    }
}

function handlePointerUp(e) {
    if (!isAiming) return;
    isAiming = false;
    
    const dx = aimStart.x - aimCurrent.x;
    const dy = aimStart.y - aimCurrent.y;
    
    const powerMultiplier = 8;
    ball.vx = dx * powerMultiplier;
    ball.vy = dy * powerMultiplier;
    
    const speed = Math.hypot(ball.vx, ball.vy);
    const maxSpeed = 4000;
    if (speed > maxSpeed) {
        ball.vx = (ball.vx / speed) * maxSpeed;
        ball.vy = (ball.vy / speed) * maxSpeed;
    }
}

canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

canvas.addEventListener('touchstart', (e) => { 
    if (e.target.closest('button')) return; // Allow button clicks naturally
    e.preventDefault(); 
    handlePointerDown(e); 
}, { passive: false });
canvas.addEventListener('touchmove', (e) => { 
    if (e.target.closest('button')) return;
    e.preventDefault(); 
    handlePointerMove(e); 
}, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// Physics update
function updatePhysics() {
    if (isAiming || isResting) return;
    
    const floorY = height * groundLevel;
    
    ball.vy += gravity * pixelsPerMeter * dt;
    ball.vx *= airResistance;
    ball.vy *= airResistance;
    
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    
    if (gameMode === 'pingpong') {
        const cupWidthTop = 110 * scale;
        const cupWidthBottom = 70 * scale;
        const cupHeight = 130 * scale;
        const cupX = width * 0.85; 
        const cupY = floorY;
        const cupRimY = cupY - cupHeight;
        const cupLeftRim = cupX - cupWidthTop / 2;
        const cupRightRim = cupX + cupWidthTop / 2;
        
        const distLeftRim = Math.hypot(ball.x - cupLeftRim, ball.y - cupRimY);
        const distRightRim = Math.hypot(ball.x - cupRightRim, ball.y - cupRimY);
        
        if (distLeftRim < ball.radius) {
            const overlap = ball.radius - distLeftRim;
            const nx = (ball.x - cupLeftRim) / distLeftRim;
            const ny = (ball.y - cupRimY) / distLeftRim;
            
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx = (ball.vx - 2 * dot * nx) * bounceFactor;
                ball.vy = (ball.vy - 2 * dot * ny) * bounceFactor;
            }
        } else if (distRightRim < ball.radius) {
            const overlap = ball.radius - distRightRim;
            const nx = (ball.x - cupRightRim) / distRightRim;
            const ny = (ball.y - cupRimY) / distRightRim;
            
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx = (ball.vx - 2 * dot * nx) * bounceFactor;
                ball.vy = (ball.vy - 2 * dot * ny) * bounceFactor;
            }
        } else if (ball.y + ball.radius > cupRimY && ball.y < cupY + ball.radius) {
            const wallLeftX = cupLeftRim + ((ball.y - cupRimY)/cupHeight) * ((cupWidthTop - cupWidthBottom)/2);
            const wallRightX = cupRightRim - ((ball.y - cupRimY)/cupHeight) * ((cupWidthTop - cupWidthBottom)/2);
            
            if (ball.x > wallLeftX && ball.x < wallRightX) {
                if (!scoredThisThrow && ball.y > cupRimY + ball.radius * 0.8) {
                    scoredThisThrow = true;
                    score++;
                    setTimeout(resetBall, 1500); 
                }
                
                if (ball.x - ball.radius < wallLeftX) {
                    ball.x = wallLeftX + ball.radius;
                    ball.vx = Math.abs(ball.vx) * 0.5;
                }
                if (ball.x + ball.radius > wallRightX) {
                    ball.x = wallRightX - ball.radius;
                    ball.vx = -Math.abs(ball.vx) * 0.5;
                }
                if (ball.y + ball.radius > cupY) {
                    ball.y = cupY - ball.radius;
                    ball.vy = -Math.abs(ball.vy) * 0.3; 
                    ball.vx *= 0.8;
                    if (Math.abs(ball.vy) < 25 * scale) {
                        ball.vy = 0;
                        if (Math.abs(ball.vx) < 15 * scale) {
                            ball.vx = 0;
                            isResting = true;
                        }
                    }
                }
            } else {
                if (ball.x + ball.radius > wallLeftX && ball.x < cupX) {
                    ball.x = wallLeftX - ball.radius;
                    ball.vx = -Math.abs(ball.vx) * bounceFactor;
                } else if (ball.x - ball.radius < wallRightX && ball.x > cupX) {
                    ball.x = wallRightX + ball.radius;
                    ball.vx = Math.abs(ball.vx) * bounceFactor;
                }
            }
        }
    } else if (gameMode === 'basketball') {
        let hoopWidth = 140 * scale;
        const hoopRimY = height * 0.45; 
        const backboardX = width; // Flush against the right wall
        
        if (hoopImg.complete && hoopImg.naturalHeight !== 0) {
            const imgHeight = 320 * scale;
            const S = imgHeight / hoopImg.naturalHeight;
            // Map the physics hoop width to the exact orange rim pixels (874 - 169)
            hoopWidth = (874 - 169) * S; 
        }

        const hoopLeftRim = backboardX - hoopWidth;
        // The rim has physical thickness and sticks out from the backboard.
        const hoopRightRim = backboardX - 12 * scale; 
        
        const distLeftRim = Math.hypot(ball.x - hoopLeftRim, ball.y - hoopRimY);
        const distRightRim = Math.hypot(ball.x - hoopRightRim, ball.y - hoopRimY);
        
        // Front left rim bounce
        if (distLeftRim < ball.radius) {
            const overlap = ball.radius - distLeftRim;
            const nx = (ball.x - hoopLeftRim) / distLeftRim;
            const ny = (ball.y - hoopRimY) / distLeftRim;
            
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx = (ball.vx - 2 * dot * nx) * bounceFactor;
                ball.vy = (ball.vy - 2 * dot * ny) * bounceFactor;
            }
        }
        
        // Front right rim bounce
        if (distRightRim < ball.radius) {
            const overlap = ball.radius - distRightRim;
            const nx = (ball.x - hoopRightRim) / distRightRim;
            const ny = (ball.y - hoopRimY) / distRightRim;
            
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx = (ball.vx - 2 * dot * nx) * bounceFactor;
                ball.vy = (ball.vy - 2 * dot * ny) * bounceFactor;
            }
        }
        
        // Backboard collision
        if (ball.x + ball.radius > backboardX && ball.y > hoopRimY - 120 * scale && ball.y < hoopRimY + 40 * scale) {
            ball.x = backboardX - ball.radius;
            if (ball.vx > 0) {
                ball.vx = -ball.vx * bounceFactor;
            }
        }
        
        // Net physics (going through the hole)
        if (ball.y > hoopRimY && ball.y < hoopRimY + 90 * scale) {
            // Tapering net width logic
            const netLeft = hoopLeftRim + ((ball.y - hoopRimY)/(90*scale)) * (30*scale);
            const netRight = hoopRightRim - ((ball.y - hoopRimY)/(90*scale)) * (30*scale);
            
            if (ball.x > netLeft && ball.x < netRight) {
                isBehindNet = true;
                
                // If it enters the net from the bottom (never went above the rim first), disqualify it!
                if (!wasAboveRim) {
                    isDisqualified = true;
                }
                
                // Simulate drag of going through the net
                ball.vx *= 0.95;
                ball.vy -= gravity * pixelsPerMeter * dt * 0.5; // slow down the fall drastically
                
                if (!scoredThisThrow && !isDisqualified && ball.vy > 0 && ball.y > hoopRimY + ball.radius) {
                    if (wasAboveRim) {
                        scoredThisThrow = true;
                        score++;
                        setTimeout(resetBall, 1500);
                    }
                }
            }
        }
        
        if (ball.y + ball.radius < hoopRimY) {
            wasAboveRim = true;
        }
        if (ball.y > hoopRimY + 120 * scale) {
            wasAboveRim = false;
        }
        
        // Reset depth state if the ball exits the net area
        if (ball.y > hoopRimY + 120 * scale || ball.y < hoopRimY || ball.x < hoopLeftRim || ball.x > hoopRightRim) {
            isBehindNet = false;
        }
    }
    
    // Ground
    if (ball.y + ball.radius >= floorY && (gameMode === 'basketball' || ball.x <= width * 0.85 - (110*scale)/2 || ball.x >= width * 0.85 + (110*scale)/2)) {
        ball.y = floorY - ball.radius;
        ball.vy = -ball.vy * bounceFactor;
        ball.vx *= friction;
        if (Math.abs(ball.vy) < 25 * scale) {
            ball.vy = 0;
            if (Math.abs(ball.vx) < 15 * scale) {
                ball.vx = 0;
                isResting = true;
            }
        }
    }
    
    // Ceiling
    if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy * bounceFactor;
    }
    
    // Walls
    if (ball.x + ball.radius > width) {
        ball.x = width - ball.radius;
        if (ball.vx > 0) ball.vx = -ball.vx * bounceFactor;
    } else if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        if (ball.vx < 0) ball.vx = -ball.vx * bounceFactor;
    }
}

// Draw scene
function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.clearRect(0, 0, width, height);
    
    const floorY = height * groundLevel;
    
    // Floor markings
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(width, floorY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, floorY, width, height - floorY);
    
    const markSpacing = 150 * scale;
    for(let x = 0; x < width; x += markSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x, floorY + 20 * scale);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, floorY + 20 * scale);
        ctx.lineTo(x - 30 * scale, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Background Targets
    if (gameMode === 'pingpong') {
        const cupWidthTop = 110 * scale;
        const cupWidthBottom = 70 * scale;
        const cupHeight = 130 * scale;
        const cupX = width * 0.85;
        const cupY = floorY;
        const cupRimY = cupY - cupHeight;
        const cupLeftRim = cupX - cupWidthTop / 2;
        const cupRightRim = cupX + cupWidthTop / 2;
        
        ctx.beginPath();
        ctx.ellipse(cupX, floorY, cupWidthBottom / 2 * 1.2, 8 * scale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cupLeftRim, cupRimY);
        ctx.lineTo(cupX - cupWidthBottom / 2, cupY);
        ctx.lineTo(cupX + cupWidthBottom / 2, cupY);
        ctx.lineTo(cupRightRim, cupRimY);
        ctx.closePath();
        ctx.fillStyle = '#7f1d1d';
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(cupX, cupRimY, cupWidthTop / 2, 12 * scale, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#450a0a';
        ctx.fill();
    } else {
        // Basketball backboard & back hoop
        let hoopWidth = 140 * scale;
        const hoopRimY = height * 0.45; 
        const backboardX = width; // Flush against right wall
        
        if (hoopImg.complete && hoopImg.naturalHeight !== 0) {
            const imgHeight = 320 * scale;
            const S = imgHeight / hoopImg.naturalHeight;
            hoopWidth = (874 - 169) * S; 
            
            const hoopLeftRim = backboardX - hoopWidth;
            const hoopRightRim = backboardX - 12 * scale;
            
            const imgWidth = hoopImg.naturalWidth * S;
            // Align physics backboardX with image pixel 874, and hoopRimY with the LEFT RIM pixel Y (816)
            const xOffset = backboardX - 874 * S;
            const yOffset = hoopRimY - 816 * S;
            
            ctx.drawImage(hoopImg, xOffset, yOffset, imgWidth, imgHeight);
        } else {
            const hoopLeftRim = backboardX - hoopWidth;
            const hoopRightRim = backboardX;
            
            ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
            ctx.fillRect(backboardX, hoopRimY - 140 * scale, 12 * scale, 200 * scale);
            
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 4 * scale;
            ctx.strokeRect(backboardX - 4 * scale, hoopRimY - 60 * scale, 10 * scale, 60 * scale);
            
            ctx.beginPath();
            ctx.ellipse((hoopLeftRim + hoopRightRim)/2, hoopRimY, hoopWidth/2, 10 * scale, 0, Math.PI, Math.PI * 2);
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 6 * scale;
            ctx.stroke();
        }
    }

    // Aiming visual
    if (isAiming) {
        let dx = aimStart.x - aimCurrent.x;
        let dy = aimStart.y - aimCurrent.y;
        
        const powerMultiplier = 8;
        let simVx = dx * powerMultiplier;
        let simVy = dy * powerMultiplier;
        
        const speed = Math.hypot(simVx, simVy);
        const maxSpeed = 4000;
        if (speed > maxSpeed) {
            simVx = (simVx / speed) * maxSpeed;
            simVy = (simVy / speed) * maxSpeed;
            dx = simVx / powerMultiplier;
            dy = simVy / powerMultiplier;
        }
        
        let simX = ball.x;
        let simY = ball.y;
        
        // Forward prediction
        ctx.beginPath();
        ctx.moveTo(simX, simY);
        
        const predictionSteps = 30; 
        for(let i = 0; i < predictionSteps; i++) {
            simVy += gravity * pixelsPerMeter * dt;
            simVx *= airResistance;
            simVy *= airResistance;
            
            simX += simVx * dt;
            simY += simVy * dt;
            
            if (simY + ball.radius >= floorY) {
                simY = floorY - ball.radius;
                simVy = -simVy * bounceFactor;
                simVx *= friction;
            }
            if (simY - ball.radius <= 0) {
                simY = ball.radius;
                simVy = -simVy * bounceFactor;
            }
            if (simX + ball.radius >= width) {
                simX = width - ball.radius;
                simVx = -simVx * bounceFactor;
            } else if (simX - ball.radius <= 0) {
                simX = ball.radius;
                simVx = -simVx * bounceFactor;
            }
            
            ctx.lineTo(simX, simY);
        }
        
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'; 
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Virtual joystick UI under the user's finger
        ctx.beginPath();
        ctx.arc(aimStart.x, aimStart.y, 35 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(aimCurrent.x, aimCurrent.y, 15 * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
    }
    
    // Shadow
    const isOverCup = gameMode === 'pingpong' && ball.x > width * 0.85 - (110*scale)/2 && ball.x < width * 0.85 + (110*scale)/2;
    if (ball.y < floorY + 50 && !isOverCup) {
        const distToGround = Math.max(0, floorY - ball.y);
        const shadowScale = Math.max(0, 1 - distToGround / 200);
        const shadowWidth = ball.radius * 1.2 * shadowScale; 
        const shadowHeight = ball.radius * 0.25 * shadowScale;
        
        if (shadowScale > 0) {
            ctx.beginPath();
            ctx.ellipse(ball.x, floorY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
            ctx.fill();
        }
    }
    
    // Draw ball
    ctx.save();
    ctx.translate(ball.x, ball.y);
    
    const rotation = ball.x / ball.radius;
    ctx.rotate(rotation);
    
    if (gameMode === 'pingpong') {
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        
        const gradient = ctx.createRadialGradient(-ball.radius*0.35, -ball.radius*0.35, ball.radius*0.1, 0, 0, ball.radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.6, 'rgba(226, 232, 240, 0.8)');
        gradient.addColorStop(1, 'rgba(100, 116, 139, 0.9)');
        
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    } else {
        // Basketball Image
        if (basketballImg.complete && basketballImg.naturalHeight !== 0) {
            ctx.beginPath();
            ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
            ctx.clip(); 
            
            const r = ball.radius * 1.05; 
            ctx.drawImage(basketballImg, -r, -r, r * 2, r * 2);
            
            // Add a subtle volume shadow to the flat image to make it fit the 3D scene
            const gradient = ctx.createRadialGradient(-ball.radius*0.35, -ball.radius*0.35, ball.radius*0.1, 0, 0, ball.radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
            gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
            ctx.fillStyle = gradient;
            ctx.fill();
        } else {
            // Fallback
            ctx.beginPath();
            ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ea580c';
            ctx.fill();
        }
    }
    ctx.restore();
    
    // Foreground Targets
    if (gameMode === 'pingpong') {
        const cupWidthTop = 110 * scale;
        const cupWidthBottom = 70 * scale;
        const cupHeight = 130 * scale;
        const cupX = width * 0.85;
        const cupY = floorY;
        const cupRimY = cupY - cupHeight;
        const cupLeftRim = cupX - cupWidthTop / 2;
        const cupRightRim = cupX + cupWidthTop / 2;
        
        const cupGradient = ctx.createLinearGradient(cupLeftRim, 0, cupRightRim, 0);
        cupGradient.addColorStop(0, 'rgba(220, 38, 38, 0.85)');
        cupGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.85)');
        cupGradient.addColorStop(1, 'rgba(185, 28, 28, 0.85)');
        
        ctx.beginPath();
        ctx.moveTo(cupLeftRim, cupRimY);
        ctx.lineTo(cupX - cupWidthBottom / 2, cupY);
        ctx.lineTo(cupX + cupWidthBottom / 2, cupY);
        ctx.lineTo(cupRightRim, cupRimY);
        ctx.closePath();
        ctx.fillStyle = cupGradient;
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(cupX, cupRimY, cupWidthTop / 2, 12 * scale, 0, 0, Math.PI);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3 * scale;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cupLeftRim + (4 * scale), cupRimY + (25 * scale));
        ctx.lineTo(cupRightRim - (4 * scale), cupRimY + (25 * scale));
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
    } else {
        // Basketball Front Net & Rim
        let hoopWidth = 140 * scale;
        const hoopRimY = height * 0.45; 
        const backboardX = width; // Flush against right wall
        
        if (hoopImg.complete && hoopImg.naturalHeight !== 0) {
            const imgHeight = 320 * scale;
            const S = imgHeight / hoopImg.naturalHeight;
            hoopWidth = (874 - 169) * S; 
            
            const hoopLeftRim = backboardX - hoopWidth;
            const imgWidth = hoopImg.naturalWidth * S;
            const xOffset = backboardX - 874 * S;
            const yOffset = hoopRimY - 816 * S;
            const rightRimY = hoopRimY - 267 * S;
            
            if (isBehindNet) {
                // 3D Depth Illusion: Redraw only the FRONT half of the hoop image over the ball!
                ctx.save();
                ctx.beginPath();
                // Create a diagonal clipping mask that separates the front rim/net from the backboard/back rim
                ctx.moveTo(hoopLeftRim - 50 * scale, hoopRimY + 8 * scale);
                ctx.lineTo(backboardX + 50 * scale, rightRimY + 8 * scale);
                ctx.lineTo(backboardX + 200 * scale, height);
                ctx.lineTo(hoopLeftRim - 200 * scale, height);
                ctx.closePath();
                ctx.clip();
                
                ctx.drawImage(hoopImg, xOffset, yOffset, imgWidth, imgHeight);
                ctx.restore();
            }
            
        } else {
            const hoopLeftRim = backboardX - hoopWidth;
            const hoopRightRim = backboardX - 12 * scale; 
            
            // Front Rim
            ctx.beginPath();
            ctx.ellipse((hoopLeftRim + hoopRightRim)/2, hoopRimY, hoopWidth/2, 10 * scale, 0, 0, Math.PI);
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 6 * scale;
            ctx.stroke();
            
            // Net
            ctx.beginPath();
            ctx.moveTo(hoopLeftRim, hoopRimY);
            ctx.lineTo(hoopLeftRim + 30 * scale, hoopRimY + 90 * scale);
            ctx.lineTo(hoopRightRim - 30 * scale, hoopRimY + 90 * scale);
            ctx.lineTo(hoopRightRim, hoopRimY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.setLineDash([4 * scale, 6 * scale]);
            ctx.lineWidth = 2 * scale;
            ctx.stroke();
            ctx.setLineDash([]);
        }
        

    }
    
    // Score
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold ${Math.floor(36 * scale)}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const padding = Math.max(20, width * 0.05);
    ctx.fillText(`Score: ${score}`, width - padding, padding);
    
    if (scoredThisThrow) {
        ctx.fillStyle = '#4ade80';
        ctx.font = `bold ${Math.floor(54 * scale)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SCORE!', width / 2, height / 3);
    }
}

function animate() {
    updatePhysics();
    draw();
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
