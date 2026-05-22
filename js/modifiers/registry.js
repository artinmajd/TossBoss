// Registry — the single place that lists every challenge and powerup.
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
//   import movingCup from './challenges/movingCup.js';
//   import bigCup    from './powerups/bigCup.js';

export const modifierRegistry = [
    // movingCup,
    // bigCup,
];
