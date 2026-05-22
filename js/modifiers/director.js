// Director — decides WHEN to activate challenges and offer powerups, based on
// game state. It is deliberately separate from the modifiers themselves:
// modifiers define WHAT happens, the director defines WHEN.
//
// No trigger logic yet — tick() is a no-op until triggers are added. When a
// trigger fires it will instantiate a modifier factory and hand it to the
// manager via manager.add(...).

export function createDirector() {
    return {
        // Called once per frame from the engine loop.
        tick(/* ctx, manager */) {
            // trigger logic goes here
        },

        // Reset any director state (e.g. on a new run / game reset).
        reset() {
            // director state goes here
        },
    };
}
