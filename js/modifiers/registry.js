// Registry — the single inventory of every challenge and powerup.
//
// Each entry is a factory function that returns a fresh modifier instance
// (see the modifier interface below). To add a new modifier: create its file
// under challenges/, powerups/ or elements/, import its factory here, and
// list it. ('element' = a neutral game element — neither help nor hindrance.)
//
// Modifier interface (all hooks optional):
//   {
//     id, type: 'challenge' | 'powerup' | 'element', name, icon, weight,
//     onActivate(ctx), onDeactivate(ctx),
//     onUpdate(ctx, dt), onDraw(ctx),
//     onScore(ctx), onMiss(ctx), onThrow(ctx),
//     isExpired(): boolean   — manager removes the modifier when this is true
//   }
//
// Note: scripted triggers in director.js may import a modifier factory
// directly; this list is the complete inventory (and the future source for
// weighted/random selection).

import blackHole    from './elements/blackHole.js';
import movingTarget from './challenges/movingTarget.js';
import smallTarget  from './challenges/smallTarget.js';

export const modifierRegistry = [
    blackHole,
    movingTarget,
    smallTarget,
];
