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

## Workflow

- This is a git repo; remote is `https://github.com/artinmajd/TossBoss`.
- Commit and push when the user asks. End commit messages with the
  `Co-Authored-By` trailer.
