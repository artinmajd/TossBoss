// Registry — the single inventory of every challenge and powerup.
//
// Each entry is a factory function that returns a fresh modifier instance
// (see the modifier interface below). To add a new modifier: create its file
// under challenges/ or powerups/, import its factory here, and list it.
//
// Modifier interface (all hooks optional):
//   {
//     id, type: 'challenge' | 'powerup', name, icon, weight,
//     onActivate(ctx), onDeactivate(ctx),
//     onUpdate(ctx, dt), onDraw(ctx),
//     onScore(ctx), onMiss(ctx), onThrow(ctx),
//   }
//
// Note: scripted triggers in director.js may import a modifier factory
// directly; this list is the complete inventory (and the future source for
// weighted/random selection).

import blackHole from './challenges/blackHole.js';

export const modifierRegistry = [
    blackHole,
];
