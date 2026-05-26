// Game context — the controlled surface that modifiers are allowed to see and
// touch. It is the firewall between the engine and the modifiers: a modifier
// must never reach past this object into the engine.
//
// Read fields are refreshed by the engine every frame (engine: syncContext()).
// Reference fields are stable for the whole game lifetime.
// Writable fields are owned by modifiers and read by the engine.
// Action methods are filled in by the engine when the context is constructed.

export function createGameContext({ ball, ctx2d, tester = null }) {
    return {
        // --- read-only game state (refreshed by the engine each frame) ---
        score: 0,
        streak: 0,        // consecutive hits
        misses: 0,        // consecutive misses
        lives: 2,         // 2 - misses
        gameMode: 'pingpong',
        width: 0,         // playfield width  (virtual coordinate space)
        height: 0,        // playfield height (virtual coordinate space)
        scale: 1,         // visual scale factor used for cup/ball/hoop sizes
        dt: 1 / 60,       // fixed physics timestep
        floorY: 0,        // y of the floor line
        target: null,     // active cup/hoop as { x, y, r } — r is a keep-clear radius

        // --- stable references ---
        ball,             // the live ball object { x, y, vx, vy, radius }
        ctx2d,            // the canvas 2D rendering context (for onDraw)
        tester,           // tester_config object when the test user is logged in, else null

        // --- modifier-writable fields (engine reads these) ---
        targetOffset: { x: 0, y: 0 }, // added to cup X / hoop Y for moving-target challenge
        targetScale: 1,               // multiplied into cup/hoop dimensions; 1 = normal size
        scoreMultiplier: 1,           // points are multiplied by this in handleScore
        extraLives: 0,                // extra lives granted by a challenge (added on top of the base 2)
        blackHoleConsumed: false,     // black hole sets this when the ball is absorbed;
                                      // director consumes it to spawn a challenge

        // --- action methods (engine wires real implementations in initGame) ---
        absorbBall: () => {},
        resetBallToStart: () => {},
        showChallengeBadge: (_title, _reward, _sub) => {},
        hideChallengeBadge: () => {},
        drawBall: (_x, _y, _radius) => {},
        addExtraLife: () => {},
        removeExtraLife: () => {},
    };
}
