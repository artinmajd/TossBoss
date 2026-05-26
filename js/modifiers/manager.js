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
            try { modifier.onActivate?.(ctx); }
            catch (e) { console.error(`[modifier ${modifier.id}] onActivate threw:`, e); }
        },

        // Deactivate a modifier instance and run its onDeactivate hook.
        remove(modifier, ctx) {
            const i = active.indexOf(modifier);
            if (i === -1) return;
            active.splice(i, 1);
            try { modifier.onDeactivate?.(ctx); }
            catch (e) { console.error(`[modifier ${modifier.id}] onDeactivate threw:`, e); }
        },

        // Per-physics-tick update — called once per fixed timestep. Also
        // prunes modifiers that have run their course (isExpired() → true).
        // Each hook is sandboxed so one buggy modifier can't kill the loop.
        update(ctx, dt) {
            for (const m of active) {
                try { m.onUpdate?.(ctx, dt); }
                catch (e) { console.error(`[modifier ${m.id}] onUpdate threw:`, e); }
            }
            for (let i = active.length - 1; i >= 0; i--) {
                let expired = false;
                try { expired = !!active[i].isExpired?.(); }
                catch (e) { console.error(`[modifier ${active[i].id}] isExpired threw:`, e); expired = true; }
                if (expired) {
                    const m = active.splice(i, 1)[0];
                    try { m.onDeactivate?.(ctx); }
                    catch (e) { console.error(`[modifier ${m.id}] onDeactivate threw:`, e); }
                }
            }
        },

        // Per-frame draw — called once per rendered frame.
        draw(ctx) {
            for (const m of active) {
                try { m.onDraw?.(ctx); }
                catch (e) { console.error(`[modifier ${m.id}] onDraw threw:`, e); }
            }
        },

        // A game event: 'score' | 'miss' | 'throw'. Maps to onScore/onMiss/etc.
        emit(event, ctx) {
            const hook = 'on' + event[0].toUpperCase() + event.slice(1);
            // Iterate a copy — a hook may remove its own modifier.
            for (const m of [...active]) {
                try { m[hook]?.(ctx); }
                catch (e) { console.error(`[modifier ${m.id}] ${hook} threw:`, e); }
            }
        },

        // Collect aim-line blocking shapes from all active modifiers.
        // Calls optional getAimBlocker(ctx) on each modifier; returns
        // an array of { x, y, r } circles to exclude from the drawn path.
        getAimBlockers(ctx) {
            const result = [];
            for (const m of active) {
                try {
                    const b = m.getAimBlocker?.(ctx);
                    if (b) result.push(b);
                } catch (e) { console.error(`[modifier ${m.id}] getAimBlocker threw:`, e); }
            }
            return result;
        },

        // Deactivate everything (game reset / teardown).
        clear(ctx) {
            for (const m of [...active]) m.onDeactivate?.(ctx);
            active = [];
        },
    };
}
