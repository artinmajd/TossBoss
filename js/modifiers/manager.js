// Modifier manager — holds the set of active modifiers (challenges + powerups)
// and fans the engine's lifecycle calls out to them. The engine talks only to
// this manager; it never references an individual challenge or powerup.
//
// Stacking is supported: any number of modifiers can be active at once. The
// manager simply iterates all of them for every hook.

export function createModifierManager() {
    let active = [];

    return {
        // The list of currently-active modifier instances (read-only use).
        get active() { return active; },

        // Activate a modifier instance and run its onActivate hook.
        add(modifier, ctx) {
            if (active.includes(modifier)) return;
            active.push(modifier);
            modifier.onActivate?.(ctx);
        },

        // Deactivate a modifier instance and run its onDeactivate hook.
        remove(modifier, ctx) {
            const i = active.indexOf(modifier);
            if (i === -1) return;
            active.splice(i, 1);
            modifier.onDeactivate?.(ctx);
        },

        // Per-physics-tick update — called once per fixed timestep.
        update(ctx, dt) {
            for (const m of active) m.onUpdate?.(ctx, dt);
        },

        // Per-frame draw — called once per rendered frame.
        draw(ctx) {
            for (const m of active) m.onDraw?.(ctx);
        },

        // A game event: 'score' | 'miss' | 'throw'. Maps to onScore/onMiss/etc.
        emit(event, ctx) {
            const hook = 'on' + event[0].toUpperCase() + event.slice(1);
            // Iterate a copy — a hook may remove its own modifier.
            for (const m of [...active]) m[hook]?.(ctx);
        },

        // Deactivate everything (game reset / teardown).
        clear(ctx) {
            for (const m of [...active]) m.onDeactivate?.(ctx);
            active = [];
        },
    };
}
