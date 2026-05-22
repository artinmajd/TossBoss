# TossBoss — Project Notes for Claude

2D physics arcade game. Vanilla JS + HTML5 Canvas, no frameworks. Hash-based
SPA (`#home`, `#game`, `#auth`, `#leaderboard`). Supabase for auth + scores.

## Toggle-button highlight convention (IMPORTANT — follow this everywhere)

In the **game view** HUD, buttons come in two kinds:

1. **Toggle buttons** — open/close a panel and have an on/off state
   (e.g. `#menu-toggle`, `#btn-help`, `#btn-leaderboard-game`).
2. **Action buttons** — just do something once (e.g. `#btn-home`,
   `#btn-lb-modal-close`). They have no selected state.

### The rule for toggle buttons

A toggle button must show a highlight **only while its panel is open**, and
the **plain default style when closed** — regardless of how it was closed
(tapped again, tapped outside, panel dismissed some other way).

### How it is implemented

The highlight is driven by a **`selected` class on the button**, never by
`:hover`. One CSS rule in `css/style.css` covers all of them:

```css
.mode-btn.selected {
    background: linear-gradient(135deg, #7dd3fc, #38bdf8);
    transform: scale(1.1);
}
```

JS adds `selected` when the panel opens and removes it when the panel closes.
The class must be kept in sync with the panel state in **every** place the
panel can open or close. Current wiring:

- **Menu toggle** (`js/engine.js`) — `selected` synced with the `menu-open`
  class: set in the menu-toggle click handler, removed in `handlePointerDown`
  (canvas tap) and the score-area click handler.
- **Help button** (`js/app.js`) — `selected` synced with the help bubble's
  `visible` class: set in the help click handler, removed in the
  document-level click handler (tap outside).
- **Leaderboard button** (`js/app.js`) — `selected` managed by the
  `setLbModal(open)` helper, called on open, close-button, and backdrop tap.

### Why it is done this way — do NOT use `:hover` for selected state

On iOS/Android, `:hover` **sticks** after a tap and only clears when another
element is touched. If the highlight came from `:hover`, a toggle button
would stay highlighted after its panel closed, and would lose the highlight
when an unrelated button was tapped. That exact bug caused several painful
revert cycles.

Because of this, `button:hover` and `.mode-btn:hover` are both scoped to
`@media (hover: hover)` so hover styling applies **only on real
hover-capable devices (desktop)** and can never stick on touch. The selected
state is therefore 100% driven by the `selected` class — a real state, not a
sticky pseudo-class.

### Adding a NEW toggle button in the game view

1. Give the button the `mode-btn` class.
2. Wherever its panel opens, call `btnEl.classList.add('selected')`
   (or `toggle('selected', isOpenBoolean)`).
3. In **every** path that closes the panel (re-tap, tap outside, close
   button, backdrop, canvas tap, etc.), call
   `btnEl.classList.remove('selected')`.
4. Do not add any `:hover`-based highlight for the selected state.

Mode buttons (`#mode-pingpong`, `#mode-basketball`) are a separate case —
they use the `active` class with a distinct green selection style. Leave
that as-is; do not give them `selected`.

## Modifier system — challenges, powerups & elements (`js/modifiers/`)

A **"modifier"** is a unit that activates, runs, hooks into game events, and
deactivates. There are three kinds, by `type`:

- **challenge** — makes the game harder.
- **powerup** — helps the player.
- **element** — a neutral game element, neither help nor hindrance
  (e.g. the black hole).

They all share one interface and one manager. `engine.js` never references a
specific modifier.

### Files

- `js/modifiers/manager.js` — `createModifierManager()`. Holds the active
  modifiers; fans engine hooks out to them. **Stacking is supported** — any
  number of modifiers can be active at once.
- `js/modifiers/context.js` — `createGameContext()`. The controlled state
  surface modifiers may read/touch — the firewall between engine and modifiers.
- `js/modifiers/director.js` — `createDirector()`. The trigger brain: decides
  *when* to activate challenges / offer powerups. Currently a no-op.
- `js/modifiers/registry.js` — `modifierRegistry`, the array of every modifier
  factory. Currently empty.
- `js/modifiers/challenges/`, `powerups/`, `elements/` — one file per
  modifier, in the folder matching its `type`.

### The golden rule — dependency direction

`engine.js → manager → context`. A modifier file imports **only** from
`context` — **never `engine.js`**. Modifiers read/change game state solely
through the `gameCtx` object. So a modifier stays isolated: adding or removing
one touches exactly two files (its own file + one line in `registry.js`).

### The modifier interface

A modifier is created by a **factory function** (each activation gets fresh
state). It returns an object; all hooks optional:

```js
export default function myModifier() {
    let state = 0;                    // per-activation state
    return {
        id: 'my-modifier',
        type: 'challenge',            // 'challenge' | 'powerup' | 'element'
        name: 'My Modifier', icon: '…', weight: 3,
        onActivate(ctx) {}, onDeactivate(ctx) {},
        onUpdate(ctx, dt) {},         // per physics tick
        onDraw(ctx) {},               // per frame, in playfield coords
        onScore(ctx) {}, onMiss(ctx) {}, onThrow(ctx) {},
        isExpired() { return false; }, // manager removes it when true
    };
}
```

Timed modifiers expose `isExpired()` (real wall-clock time, not accumulated
`dt`). The manager prunes any modifier whose `isExpired()` returns true. A
modifier also belongs to one game mode — `setMode()` calls
`modifiers.clear()` + `director.reset()`, so nothing carries across a mode
switch.

### Adding a modifier

1. Create `js/modifiers/<challenges|powerups|elements>/<name>.js`,
   default-export the factory.
2. Import it in `registry.js` and add it to `modifierRegistry`.
3. Done — `engine.js` does not change.

### `gameCtx` — the context object

**Naming warning:** in `engine.js`, `ctx` is the **canvas 2D context**;
`gameCtx` is the **modifier context**. Do not confuse them. A modifier draws
via `gameCtx.ctx2d`.

`syncContext()` in `engine.js` refreshes `gameCtx`'s read fields from live
engine state every frame: `score, streak, misses, lives, gameMode, width,
height, scale, dt, floorY`. Stable reference fields: `ball`, `ctx2d`.

When a modifier needs to *change* something or call an *action* (move the
cup, grant a life, spawn a target…), add that field/method to `context.js`
and wire it in `engine.js`. The context grows as modifiers need it.

### Engine hook points (all in `engine.js`)

- `modifiers.update(gameCtx, dt)` — in the physics step loop in `animate`.
- `modifiers.draw(gameCtx)` — in `draw()`, **before the letterbox mask**, so
  modifiers draw in the same playfield/virtual coordinate space as the cup.
- `modifiers.emit('score'|'miss'|'throw', gameCtx)` — in `handleScore`,
  `handleMiss` (both exit paths), and `handlePointerUp`.
- `director.tick(gameCtx, modifiers)` — once per frame in `animate`.
- `modifiers.clear(gameCtx)` — in `destroyGame`.

Note: `modifiers.update` runs per fixed physics tick — fewer times per frame
while the ball is resting/aiming. A modifier needing steady real-time motion
should account for that (or drive motion from `onDraw`).

### Status

One modifier exists: the **black hole** (`elements/blackHole.js`) — a timed
neutral element triggered by the director after 10 un-reset shots. No
challenges or powerups exist yet.

## Workflow

- This is a git repo; remote is `https://github.com/artinmajd/TossBoss`.
- Commit after each meaningful change. Push **only** when the user
  explicitly asks. End commit messages with the `Co-Authored-By` trailer.
