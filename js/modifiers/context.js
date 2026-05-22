// Game context — the controlled surface that modifiers are allowed to see and
// touch. It is the firewall between the engine and the modifiers: a modifier
// must never reach past this object into the engine.
//
// Read fields are refreshed by the engine every frame (engine: syncContext()).
// Reference fields are stable for the whole game lifetime.
//
// Action methods (grantLife, addMultiplier, spawnTarget, …) will be added here
// as the modifiers that need them are built.

export function createGameContext({ ball, ctx2d }) {
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
    };
}
