import { saveHighScore } from './supabase.js';
import { createModifierManager } from './modifiers/manager.js';
import { createGameContext } from './modifiers/context.js';
import { createDirector } from './modifiers/director.js';

export function initGame(initialData = { pingpong: { score: 0, bestStreak: 0 }, basketball: { score: 0, bestStreak: 0 } }, testerRules = null) {
    const canvas = document.getElementById('simulation-canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let animationId;
    let isSpaceDown = false;
    
    let width, height;
    let scale = 1;

    // View transform: maps the virtual playfield onto the real canvas.
    let viewScale = 1;
    let viewOffsetX = 0;
    let viewOffsetY = 0;

    // Fixed desktop playfield = iPhone 17 landscape viewport (874x402). The
    // physics constants are in absolute pixels, so running the desktop in the
    // exact same coordinate space as the phone makes the gameplay identical —
    // same gravity feel, same speed, same arcs. The desktop window letterboxes
    // and scales this up; resizing the window never changes difficulty.
    const DESKTOP_W = 874;
    const DESKTOP_H = 402;
    
    // Load images
    const basketballImg = new Image();
    basketballImg.src = 'assets/basketball.png';

    const hoopImg = new Image();
    hoopImg.src = 'assets/hoop_transparent.png';

    const cupImg = new Image();
    cupImg.src = 'assets/cup.webp';
    
    // Physics parameters
    const gravity = 9.8;
    const pixelsPerMeter = 100;
    const frameRate = 60;       // physics ticks per simulated second
    const dt = 1 / frameRate;   // fixed timestep — see the fixed-step loop in animate()
    const groundLevel = 0.85;

    // Dynamic mode parameters
    let gameMode = 'pingpong'; 
    let baseRadius = 18;
    let bounceFactor = 0.85; 
    let airResistance = 0.995; 
    let friction = 0.99; 
    
    // Game state
    let score = 0;
    let highScores = { pingpong: initialData.pingpong.score, basketball: initialData.basketball.score };
    let bestStreaks = { pingpong: initialData.pingpong.bestStreak, basketball: initialData.basketball.bestStreak };
    let consecutiveHits = 0;
    let consecutiveMisses = 0;
    let wasThrown = false;
    let scoredThisThrow = false;
    let fullscreenAttempted = false;
    let isResting = true;
    let isTouchHeld = false;
    let isBehindNet = false;
    let wasAboveRim = false;
    let isDisqualified = false;
    let ballAbsorbed = false;   // a modifier (e.g. the black hole) has taken the ball:
                                // physics is frozen, the engine skips drawing it, and
                                // the modifier draws the absorption animation itself.

    // Return animation state
    let ballReturning = false;
    let returnT = 0;
    const RETURN_DURATION = 0.35; // seconds
    let returnFrom = { x: 0, y: 0 };
    let returnCtrl = { x: 0, y: 0 };
    let returnTo   = { x: 0, y: 0 };
    
    // Ball object
    const ball = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 18,
    };

    // --- Modifier system: challenges + powerups (see js/modifiers/) ---
    const gameCtx = createGameContext({ ball, ctx2d: ctx, tester: testerRules });
    const modifiers = createModifierManager();
    const director = createDirector();

    // Action methods modifiers can call on the context. These touch engine
    // state directly so they live here, not in context.js.
    gameCtx.absorbBall = () => {
        ballAbsorbed = true;
        ball.vx = 0;
        ball.vy = 0;
        scoredThisThrow = true;   // suppresses both score & miss for this throw
        ballReturning = false;
        wasThrown = false;        // the throw is consumed — when the modifier
                                  // later calls resetBallToStart() the
                                  // wasResting→true transition must NOT count
                                  // as a miss.
    };
    gameCtx.resetBallToStart = () => {
        ballAbsorbed = false;
        resetBall();
    };
    // Hide-out animation timer — kept here so a quick hide→show doesn't
    // leave a stale timeout that nukes the freshly-shown badge.
    let challengeBadgeHideTimer = null;
    gameCtx.showChallengeBadge = (title, reward) => {
        const el = document.getElementById('challenge-badge');
        if (!el) return;
        if (challengeBadgeHideTimer) {
            clearTimeout(challengeBadgeHideTimer);
            challengeBadgeHideTimer = null;
        }
        const t = el.querySelector('.challenge-title');
        const r = el.querySelector('.challenge-reward span');
        if (t) t.textContent = title;
        if (r) r.textContent = reward;
        el.hidden = false;
        // Force a reflow so the transition kicks off from the off-screen
        // hidden state instead of snapping straight to .visible.
        void el.offsetWidth;
        el.classList.add('visible');
    };
    gameCtx.hideChallengeBadge = () => {
        const el = document.getElementById('challenge-badge');
        if (!el) return;
        el.classList.remove('visible');
        // After the slide-out transition completes (matches CSS 0.5 s),
        // restore display: none so the element doesn't intercept hits.
        if (challengeBadgeHideTimer) clearTimeout(challengeBadgeHideTimer);
        challengeBadgeHideTimer = setTimeout(() => {
            if (!el.classList.contains('visible')) el.hidden = true;
            challengeBadgeHideTimer = null;
        }, 520);
    };

    // Live cup/hoop positions — fold in gameCtx.targetOffset so modifiers like
    // the Moving Target challenge can shift the target without the engine
    // needing to know who's driving it. With offset = {0,0} these are the
    // original hard-coded positions (width*0.85 / height*0.45).
    function getCupX()     { return width  * 0.85 + (gameCtx.targetOffset?.x || 0); }
    function getHoopRimY() { return height * 0.45 + (gameCtx.targetOffset?.y || 0); }

    // Refresh the modifier context from live engine state (called each frame).
    function syncContext() {
        gameCtx.score = score;
        gameCtx.streak = consecutiveHits;
        gameCtx.misses = consecutiveMisses;
        gameCtx.lives = 2 - consecutiveMisses;
        gameCtx.gameMode = gameMode;
        gameCtx.width = width;
        gameCtx.height = height;
        gameCtx.scale = scale;
        gameCtx.dt = dt;
        gameCtx.floorY = height * groundLevel;
        // The active target (cup / hoop) with a keep-clear radius — used by
        // modifiers that must not spawn on top of it.
        if (gameMode === 'pingpong') {
            gameCtx.target = { x: getCupX(), y: height * groundLevel - 65 * scale, r: 150 * scale };
        } else {
            gameCtx.target = { x: width - 80 * scale, y: getHoopRimY(), r: 170 * scale };
        }
    }

    // Aiming state
    let isAiming = false;
    let isCarryingBall = false;   // test user: dragging the ball to reposition it
    let aimStart = { x: 0, y: 0 };
    let aimCurrent = { x: 0, y: 0 };
    
    
    function setMode(mode) {
        if (isAiming) return; // Prevent changing mode while aiming
        
        gameMode = mode;
        score = 0;
        scoredThisThrow = false;
        consecutiveHits = 0;
        consecutiveMisses = 0;
        wasThrown = false;
        
        document.getElementById('mode-pingpong').classList.remove('active');
        document.getElementById('mode-basketball').classList.remove('active');
        document.getElementById(`mode-${mode}`).classList.add('active');
        
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
        
        const screen = document.getElementById('game-screen');
        if (screen) screen.classList.toggle('bg-pingpong', mode === 'pingpong');

        resizeCanvas();
        resetBall();
        updateLives();
        updateStreakFire();
        updateScoreDisplay();

        // A modifier (e.g. the black hole) belongs to a single game — clear
        // it and re-arm the director when switching modes. Reset any
        // modifier-writable fields on the context so a fresh mode starts
        // with a clean slate.
        modifiers.clear(gameCtx);
        director.reset();
        gameCtx.blackHoleConsumed = false;
        gameCtx.scoreMultiplier   = 1;
        gameCtx.targetOffset.x    = 0;
        gameCtx.targetOffset.y    = 0;
    }



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
        ballAbsorbed = false;
    }
    
    function startReturn() {
        const minX = ball.radius * 2;
        const maxX = width * 0.65;
        const targetX = minX + Math.random() * (maxX - minX);
        const targetY = height * groundLevel - ball.radius;
        returnFrom = { x: ball.x, y: ball.y };
        returnTo   = { x: targetX, y: targetY };
        returnCtrl = {
            x: (returnFrom.x + returnTo.x) / 2,
            y: Math.min(returnFrom.y, returnTo.y) - height * 0.22
        };
        returnT = 0;
        ballReturning = true;
        scoredThisThrow = false;
        isResting = false;
        isAiming = false;
        wasAboveRim = false;
        isBehindNet = false;
        isDisqualified = false;
    }

    function resizeCanvas() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // High-DPI support — the backing store covers the whole window.
        const dpr = window.devicePixelRatio || 1;
        canvas.width = winW * dpr;
        canvas.height = winH * dpr;
        canvas.style.width = winW + 'px';
        canvas.style.height = winH + 'px';

        // Save relative position before the coordinate space changes.
        const prevW = width;
        const prevH = height;

        const isPhone = window.matchMedia('(pointer: coarse) and (max-height: 500px)').matches;
        if (isPhone) {
            // Small phones in landscape: fill the screen edge-to-edge.
            width = winW;
            height = winH;
            viewScale   = 1;
            viewOffsetX = 0;
            viewOffsetY = 0;
        } else {
            // Desktop: a fixed playfield, centered with contain-fit. Resizing
            // the window only changes the display scale, never the gameplay,
            // so a windowed game plays identically to a fullscreen one.
            width = DESKTOP_W;
            height = DESKTOP_H;
            viewScale = Math.min(winW / width, winH / height);
            viewOffsetX = (winW - width * viewScale) / 2;
            viewOffsetY = (winH - height * viewScale) / 2;
        }

        scale = Math.min(1, Math.max(0.4, height / 650));
        ball.radius = baseRadius * scale;

        // Expose playfield edges + the visual scale (same factor the cup and
        // ball are drawn at) as CSS vars so DOM overlays can anchor to the bg
        // and scale with the screen.
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            const bgBottom = winH - (viewOffsetY + height * viewScale);
            gameScreen.style.setProperty('--bg-left', viewOffsetX + 'px');
            gameScreen.style.setProperty('--bg-right', viewOffsetX + 'px');
            gameScreen.style.setProperty('--bg-bottom', bgBottom + 'px');
            gameScreen.style.setProperty('--game-scale', (scale * viewScale).toFixed(4));
        }

        // Preserve the ball's relative position across resizes.
        // resetBall() is called explicitly for initial placement and mode changes.
        if (prevW > 0 && prevH > 0) {
            ball.x = (ball.x / prevW) * width;
            ball.y = (ball.y / prevH) * height;
            ball.x = Math.max(ball.radius, Math.min(width - ball.radius, ball.x));
            ball.y = Math.max(ball.radius, Math.min(height * groundLevel - ball.radius, ball.y));
        }
    }

    resizeCanvas();
    resetBall();
    
    

    
    // Pointer Events
    function getPointerPos(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        // Convert screen coordinates into virtual playfield coordinates.
        return {
            x: (clientX - viewOffsetX) / viewScale,
            y: (clientY - viewOffsetY) / viewScale,
        };
    }
    
    function handlePointerDown(e) {
        if (e.target.closest('button') || scoredThisThrow || ballReturning) return;
        if (!isResting) return;
        // Close open mobile HUDs; block throw on this tap so it only dismisses the menu
        const _topLeft   = document.getElementById('top-left');
        const anyOpen = _topLeft?.classList.contains('menu-open');
        _topLeft?.classList.remove('menu-open');
        document.getElementById('menu-toggle')?.classList.remove('selected');
        if (anyOpen) return;
        
        const pos = getPointerPos(e);

        // Test user: press on the ball to pick it up and drag it anywhere.
        if (gameCtx.tester?.freeBallPlacement &&
            Math.hypot(pos.x - ball.x, pos.y - ball.y) <= ball.radius * 1.8) {
            isCarryingBall = true;
            return;
        }

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
        if (isCarryingBall) {
            const pos = getPointerPos(e);
            ball.x = Math.max(ball.radius, Math.min(width - ball.radius, pos.x));
            ball.y = Math.max(ball.radius, Math.min(height * groundLevel - ball.radius, pos.y));
            return;
        }
        if (!isAiming) return;
        const pos = getPointerPos(e);
        
        let dx = pos.x - aimStart.x;
        let dy = pos.y - aimStart.y;
        const dragDist = Math.hypot(dx, dy);
        const dragCoeff = Math.min(width, height) < 500 ? 0.36 : 0.30;
        const maxDrag = Math.min(width, height) * dragCoeff;
        
        if (dragDist > maxDrag) {
            dx = (dx / dragDist) * maxDrag;
            dy = (dy / dragDist) * maxDrag;
            aimCurrent = { x: aimStart.x + dx, y: aimStart.y + dy };
        } else {
            aimCurrent = { x: pos.x, y: pos.y };
        }
    }
    
    function handlePointerUp(e) {
        clearTimeout(touchHoldTimer);
        isTouchHeld = false;
        if (isCarryingBall) {
            isCarryingBall = false;
            return;
        }
        if (!isAiming) return;
        isAiming = false;

        const dx = aimStart.x - aimCurrent.x;
        const dy = aimStart.y - aimCurrent.y;

        if (Math.hypot(dx, dy) < 12) {
            isResting = true;
            return;
        }

        const powerMultiplier = 8;
        ball.vx = dx * powerMultiplier;
        ball.vy = dy * powerMultiplier;

        const speed = Math.hypot(ball.vx, ball.vy);
        const maxSpeed = 4000;
        if (speed > maxSpeed) {
            ball.vx = (ball.vx / speed) * maxSpeed;
            ball.vy = (ball.vy / speed) * maxSpeed;
        }
        wasThrown = true;
        syncContext();
        modifiers.emit('throw', gameCtx);
        director.notify('throw', gameCtx, modifiers);
    }
    
    
    // Physics update
    function updatePhysics() {
        // While the ball is absorbed by a modifier, the modifier owns its
        // position and visuals — the engine pauses its own simulation.
        if (ballAbsorbed) return;
        if (ballReturning) {
            returnT = Math.min(returnT + dt / RETURN_DURATION, 1);
            // ease-out cubic — fast start, soft landing
            const e = 1 - Math.pow(1 - returnT, 3);
            const u = 1 - e;
            ball.x = u*u*returnFrom.x + 2*u*e*returnCtrl.x + e*e*returnTo.x;
            ball.y = u*u*returnFrom.y + 2*u*e*returnCtrl.y + e*e*returnTo.y;
            if (returnT >= 1) {
                ballReturning = false;
                ball.x = returnTo.x;
                ball.y = returnTo.y;
                ball.vx = 0;
                ball.vy = 0;
                isResting = true;
            }
            return;
        }
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
            const cupX = getCupX();
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
                        wasThrown = false;
                        handleScore();
                        setTimeout(startReturn, 1400);
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
            const hoopRimY = getHoopRimY();
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
                            wasThrown = false;
                            handleScore();
                            setTimeout(startReturn, 1400);
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
        if (ball.y + ball.radius >= floorY && (gameMode === 'basketball' || ball.x <= getCupX() - (110*scale)/2 || ball.x >= getCupX() + (110*scale)/2)) {
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

        // Clear the whole canvas, then map virtual coordinates onto the
        // (centered) playfield via the view transform.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale,
                         dpr * viewOffsetX, dpr * viewOffsetY);

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
            const cupX = getCupX();
            const cupY = floorY;
            const cupRimY = cupY - cupHeight;
            const cupLeftRim = cupX - cupWidthTop / 2;
            const cupRightRim = cupX + cupWidthTop / 2;
            
            // shadow
            ctx.beginPath();
            ctx.ellipse(cupX, floorY - 3 * scale, cupWidthBottom / 2 * 0.9, 6 * scale, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fill();

            // cup image: content bbox in source is (218,110)→(1036,1155), image is 1254×1254
            if (cupImg.complete && cupImg.naturalHeight !== 0) {
                const sx = cupWidthTop / 818;   // scale so content width = cupWidthTop
                const sy = cupHeight / 1045;    // scale so content height = cupHeight
                const imgW = 1254 * sx;
                const imgH = 1254 * sy;
                const drawX = cupLeftRim - 218 * sx;
                const drawY = cupRimY - 110 * sy;
                ctx.drawImage(cupImg, drawX, drawY, imgW, imgH);
                // full rim opening, drawn behind the ball so the ball appears
                // to sit *inside* the cup. The front lip is redrawn on top in
                // the foreground pass.
                const rimY = cupRimY + cupHeight * 0.06 + 1;
                ctx.beginPath();
                ctx.ellipse(cupX, rimY, cupWidthTop / 2, 10 * scale, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#f0f0f0';
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(cupX, rimY, cupWidthTop / 2 - 4 * scale, 7 * scale, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#c0392b';
                ctx.fill();
            } else {
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
            }
        } else {
            // Basketball backboard & back hoop
            let hoopWidth = 140 * scale;
            const hoopRimY = getHoopRimY();
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
        const isOverCup = gameMode === 'pingpong' && ball.x > getCupX() - (110*scale)/2 && ball.x < getCupX() + (110*scale)/2;
        if (ball.y < floorY + 50 && !isOverCup) {
            const distToGround = Math.max(0, floorY - ball.y);
            const shadowScale = Math.max(0, 1 - distToGround / 200);
            const shadowWidth = ball.radius * 0.9 * shadowScale;
            const shadowHeight = ball.radius * 0.18 * shadowScale;
            
            if (shadowScale > 0) {
                ctx.beginPath();
                ctx.ellipse(ball.x, floorY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
                ctx.fill();
            }
        }
        
        // Clip the ball so it never renders inside the cup below the front rim
        // — once it drops in it's hidden behind the cup. The hole is a trapezoid
        // matching the cup's taper, so a ball resting *beside* the narrow base
        // is not clipped.
        let ballClipped = false;
        if (gameMode === 'pingpong') {
            const cwTop = 110 * scale;
            const cwBottom = 70 * scale;
            const cHeight = 130 * scale;
            const cX = getCupX();
            const cY = floorY;
            const cRimY = cY - cHeight;
            const mouthY = cRimY + cHeight * 0.06 + 1 + 10 * scale;
            const mouthHalfW = cwTop / 2 - ((mouthY - cRimY) / cHeight) * ((cwTop - cwBottom) / 2);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            ctx.moveTo(cX - mouthHalfW, mouthY);
            ctx.lineTo(cX - cwBottom / 2, cY);
            ctx.lineTo(cX + cwBottom / 2, cY);
            ctx.lineTo(cX + mouthHalfW, mouthY);
            ctx.closePath();
            ctx.clip('evenodd');
            ballClipped = true;
        }

        // Draw ball — skipped while a modifier owns it (e.g. the black hole
        // is running its absorption animation and drawing the ball itself).
        if (ballAbsorbed) {
            if (ballClipped) ctx.restore();
            // continue past the ball draw entirely
        } else {

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
        if (ballClipped) ctx.restore();

        }  // end if (!ballAbsorbed) ball-draw block

        // Foreground Targets
        if (gameMode === 'pingpong') {
            const cupWidthTop = 110 * scale;
            const cupWidthBottom = 70 * scale;
            const cupHeight = 130 * scale;
            const cupX = getCupX();
            const cupY = floorY;
            const cupRimY = cupY - cupHeight;
            const cupLeftRim = cupX - cupWidthTop / 2;
            const cupRightRim = cupX + cupWidthTop / 2;

            if (cupImg.complete && cupImg.naturalHeight !== 0) {
                // Only the front lip (lower half of the rim ring) is drawn here,
                // on top of the ball — so a ball dropping in passes behind the
                // near edge of the cup and reads as going *inside* it.
                const rimY = cupRimY + cupHeight * 0.06 + 1;
                ctx.beginPath();
                ctx.ellipse(cupX, rimY, cupWidthTop / 2, 10 * scale, 0, 0, Math.PI);
                ctx.ellipse(cupX, rimY, cupWidthTop / 2 - 4 * scale, 7 * scale, 0, Math.PI, 0, true);
                ctx.closePath();
                ctx.fillStyle = '#f0f0f0';
                ctx.fill();
            } else {
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
            }
    
        } else {
            // Basketball Front Net & Rim
            let hoopWidth = 140 * scale;
            const hoopRimY = getHoopRimY();
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

        // Modifier visuals (challenges / powerups) draw in playfield
        // coordinates, before the letterbox mask is applied on top.
        modifiers.draw(gameCtx);

        // Mask the letterbox margins so the playfield reads as a framed
        // screen. No-op on touch devices, where there are no margins.
        if (viewOffsetX > 0.5 || viewOffsetY > 0.5) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#060608';
            const mx = viewOffsetX * dpr;
            const my = viewOffsetY * dpr;
            const pw = width * viewScale * dpr;
            const ph = height * viewScale * dpr;
            if (mx > 0.5) {
                ctx.fillRect(0, 0, mx, canvas.height);
                ctx.fillRect(mx + pw, 0, canvas.width - mx - pw, canvas.height);
            }
            if (my > 0.5) {
                ctx.fillRect(0, 0, canvas.width, my);
                ctx.fillRect(0, my + ph, canvas.width, canvas.height - my - ph);
            }
        }
    }

    function showToast(message, type) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `game-toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 1000);
    }

    function updateScoreDisplay() {
        const scoreEl      = document.getElementById('score-current');
        const bestEl       = document.getElementById('score-best');
        const streakEl     = document.getElementById('score-streak');
        const bonusEl      = document.getElementById('score-bonus');
        const bestStreakEl = document.getElementById('score-best-streak');

        if (scoreEl) scoreEl.textContent = score;
        if (bestEl)  bestEl.textContent  = highScores[gameMode];

        if (streakEl) {
            streakEl.textContent = `streak ${consecutiveHits}`;
        }

        if (bonusEl) {
            const bonus = Math.floor(consecutiveHits / 3);
            const mult  = gameCtx.scoreMultiplier || 1;
            // Per-shot value reflects both the streak bonus AND any active
            // challenge multiplier so the player always sees the real reward.
            const perShot = Math.round((1 + bonus) * mult);
            if (mult > 1 && bonus > 0) {
                bonusEl.textContent = `(+${perShot} per shot · ${mult}X)`;
            } else if (mult > 1) {
                bonusEl.textContent = `(+${perShot} per shot · ${mult}X)`;
            } else if (bonus > 0) {
                bonusEl.textContent = `(+${perShot} per shot)`;
            } else {
                bonusEl.textContent = '';
            }
        }

        if (bestStreakEl) {
            bestStreakEl.textContent = `streak ${bestStreaks[gameMode]}`;
        }
    }

    // --- Lives / hearts ---------------------------------------------------
    function getHearts() {
        return document.querySelectorAll('#heart-decor img');
    }

    // Sync the hearts to the current life count (2 - consecutiveMisses).
    // Hearts are lost right-to-left: the right heart dims on the 1st miss.
    function updateLives() {
        const lives = 2 - consecutiveMisses;   // 2, 1, or 0
        getHearts().forEach((h, i) => {
            const lit = i === 0 ? lives >= 1 : lives >= 2;
            h.classList.remove('heart-refill');
            h.classList.toggle('heart-dim', !lit);
        });
    }

    // Both hearts flare back to full with a pop-and-glow animation.
    function refillLives() {
        getHearts().forEach(h => {
            h.classList.remove('heart-refill', 'heart-dim');
            void h.offsetWidth;   // restart the animation
            h.classList.add('heart-refill');
            setTimeout(() => h.classList.remove('heart-refill'), 600);
        });
    }

    // Hearts catch fire while a scoring streak (bonus tier) is active.
    // When the streak breaks, the flame dies down gradually rather than
    // cutting out at once.
    function updateStreakFire() {
        const onFire = consecutiveHits >= 3;
        getHearts().forEach(h => {
            if (onFire) {
                h.classList.remove('heart-fire-out');
                h.classList.add('heart-fire');
            } else if (h.classList.contains('heart-fire')) {
                h.classList.remove('heart-fire');
                h.classList.add('heart-fire-out');
                setTimeout(() => h.classList.remove('heart-fire-out'), 600);
            }
        });
    }

    function handleScore() {
        const prevBonus = Math.floor(consecutiveHits / 3);
        const basePoints = 1 + prevBonus;
        // Active challenge (e.g. Moving Target) sets a multiplier > 1.
        const points = Math.round(basePoints * (gameCtx.scoreMultiplier || 1));
        score += points;
        consecutiveHits++;
        consecutiveMisses = 0;
        const newBonus = Math.floor(consecutiveHits / 3);

        const streakImproved = consecutiveHits > bestStreaks[gameMode];
        const scoreImproved = score > highScores[gameMode];
        if (streakImproved) bestStreaks[gameMode] = consecutiveHits;
        if (scoreImproved) highScores[gameMode] = score;
        // Test-user scores are kept off the leaderboard.
        if ((streakImproved || scoreImproved) && !gameCtx.tester) {
            saveHighScore(gameMode, highScores[gameMode], bestStreaks[gameMode]);
        }

        // Flash score box
        const box = document.getElementById('score-area');
        if (box) {
            box.classList.remove('flash-score', 'flash-bonus-up');
            void box.offsetWidth;
            box.classList.add(newBonus > prevBonus ? 'flash-bonus-up' : 'flash-score');
            setTimeout(() => box.classList.remove('flash-score', 'flash-bonus-up'), 600);
        }

        if (newBonus > prevBonus) {
            showToast(`+${newBonus + 1} BONUS UNLOCKED!`, 'bonus-up');
        } else if (prevBonus > 0) {
            showToast(`+${points} 🔥`, 'bonus-score');
        } else {
            // Show the actual awarded points (reflects an active multiplier).
            showToast(`+${points}`, 'score');
        }

        updateLives();   // a successful shot restores any lost chance
        updateStreakFire();
        updateScoreDisplay();
        syncContext();
        modifiers.emit('score', gameCtx);
        director.notify('score', gameCtx, modifiers);
    }

    function handleMiss() {
        wasThrown = false;
        const hadBonus = consecutiveHits >= 3;
        consecutiveHits = 0;
        updateStreakFire();   // streak broken — put the hearts out

        const box = document.getElementById('score-area');

        if (hadBonus) {
            // Bonus-loss miss doesn't count toward the reset counter — full 2 chances from scratch
            consecutiveMisses = 0;
            showToast('💔 Bonus Lost', 'bonus-lost');
            if (box) {
                box.classList.remove('flash-bonus-lost');
                void box.offsetWidth;
                box.classList.add('flash-bonus-lost');
                setTimeout(() => box.classList.remove('flash-bonus-lost'), 600);
            }
            updateScoreDisplay();
            syncContext();
            modifiers.emit('miss', gameCtx);
            director.notify('miss', gameCtx, modifiers);
            return;
        }

        consecutiveMisses++;

        if (consecutiveMisses >= 2) {
            const wasZero = score === 0;
            score = 0;
            consecutiveMisses = 0;
            if (!wasZero) showToast('💥 RESET!', 'reset');
            if (!wasZero && box) {
                box.classList.remove('flash-reset');
                void box.offsetWidth;
                box.classList.add('flash-reset');
                setTimeout(() => box.classList.remove('flash-reset'), 800);
            }
            // Last life lost: dim the final heart, then flare both back to full.
            getHearts().forEach(h => h.classList.add('heart-dim'));
            setTimeout(refillLives, 280);
        } else {
            updateLives();   // first miss: dim one heart
        }

        updateScoreDisplay();
        syncContext();
        modifiers.emit('miss', gameCtx);
        director.notify('miss', gameCtx, modifiers);
    }

    function animate() {
        // Fast-forward physics simulation when space is held down
        const steps = ((isSpaceDown || isTouchHeld) && !isResting && !isAiming) ? 15 : 1;
        
        for (let i = 0; i < steps; i++) {
            updatePhysics();
            // If the ball becomes stationary mid-frame, stop fast-forwarding to prevent skipping the resting frame
            if (isResting) break; 
        }
        
        draw();
        requestAnimationFrame(animate);
    }
    
    

    document.getElementById('mode-pingpong')?.addEventListener('click', () => setMode('pingpong'));
    document.getElementById('mode-basketball')?.addEventListener('click', () => setMode('basketball'));

    // Mobile HUD toggles
    const topLeft     = document.getElementById('top-left');
    const scoreArea   = document.getElementById('score-area');
    const menuToggle  = document.getElementById('menu-toggle');

    menuToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        topLeft?.classList.toggle('menu-open');
        scoreArea?.classList.remove('score-open');
        menuToggle.classList.toggle('selected', topLeft?.classList.contains('menu-open'));
    });

    scoreArea?.addEventListener('click', (e) => {
        e.stopPropagation();
        topLeft?.classList.remove('menu-open');
        menuToggle?.classList.remove('selected');
        scoreArea.classList.toggle('score-open');
    });
    
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const toggleFullscreen = () => {
        const docElm = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (docElm.requestFullscreen) docElm.requestFullscreen().catch(e => console.log(e));
            else if (docElm.webkitRequestFullscreen) docElm.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    };
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

    window.addEventListener('resize', resizeCanvas);
    
    const handleKeyDown = (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            isSpaceDown = true;
        }
    };
    
    const handleKeyUp = (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            isSpaceDown = false;
        }
    };
    
    let touchHoldTimer = null;
    const handleTouchStart = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        touchHoldTimer = setTimeout(() => { isTouchHeld = true; }, 500);
        handlePointerDown(e);
    };
    
    const handleTouchMove = (e) => { 
        if (e.target.closest('button')) return;
        e.preventDefault(); 
        handlePointerMove(e); 
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    // Fixed-timestep loop. Physics always advances in fixed `dt` increments —
    // as many as needed to match the real time elapsed since the last frame —
    // so the game runs at the same speed on any display, regardless of its
    // refresh rate. The rendered ball is interpolated between the last two
    // physics ticks so motion stays smooth on high-refresh (90/120Hz) screens.
    let accumulator = 0;
    let lastTime = 0;
    let lastScoreMultiplier = 1;
    const prevBall = { x: ball.x, y: ball.y };

    animate = function(timestamp) {
        syncContext();
        if (!lastTime) lastTime = timestamp;
        let frameTime = (timestamp - lastTime) / 1000;   // real seconds elapsed
        lastTime = timestamp;
        // A hitch or a backgrounded tab must not fast-forward the simulation.
        if (frameTime > 0.25) frameTime = 0.25;

        // Refresh the score box whenever a modifier flips the multiplier
        // (challenge activates / ends) so the "per shot · 2X" label is live
        // without waiting for the next score event.
        if (gameCtx.scoreMultiplier !== lastScoreMultiplier) {
            lastScoreMultiplier = gameCtx.scoreMultiplier;
            updateScoreDisplay();
        }

        // Holding space / touch fast-forwards by feeding the accumulator faster.
        const fastForward = (isSpaceDown || isTouchHeld) && !isResting && !isAiming;
        const speedMul = fastForward ? 15 : 1;
        accumulator += frameTime * speedMul;

        const wasResting = isResting;
        const maxSteps = 8 * speedMul;   // catch-up cap — guards against a spiral
        let stepsRan = 0;
        while (accumulator >= dt && stepsRan < maxSteps) {
            prevBall.x = ball.x;
            prevBall.y = ball.y;
            updatePhysics();
            modifiers.update(gameCtx, dt);
            accumulator -= dt;
            stepsRan++;
            if (isResting) { accumulator = 0; break; }
        }
        // Too far behind to catch up (very low FPS) — drop the backlog.
        if (accumulator > dt) accumulator = 0;

        // Ball just came to rest after a throw without scoring = miss
        if (!wasResting && isResting && wasThrown && !scoredThisThrow) {
            handleMiss();
        }

        if (!isResting && !isAiming) {
            // Draw the ball interpolated between its last two physics ticks.
            const alpha = accumulator / dt;
            const tx = ball.x, ty = ball.y;
            ball.x = prevBall.x + (ball.x - prevBall.x) * alpha;
            ball.y = prevBall.y + (ball.y - prevBall.y) * alpha;
            draw();
            ball.x = tx;
            ball.y = ty;
        } else {
            draw();
        }

        director.tick(gameCtx, modifiers);
        animationId = requestAnimationFrame(animate);
    }

    // Set initial background
    const screen = document.getElementById('game-screen');
    if (screen) screen.classList.add('bg-pingpong');

    resizeCanvas();
    updateScoreDisplay();

    // start loop
    animationId = requestAnimationFrame(animate);

    return function destroyGame() {
        cancelAnimationFrame(animationId);
        modifiers.clear(gameCtx);
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('touchend', handlePointerUp);
    };
}
