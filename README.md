# TossBoss

**TossBoss** is a 2D physics-based arcade web game built with Vanilla JavaScript and HTML5 Canvas — no physics libraries, no frameworks. All kinematics, collision detection, bounce restitution, and friction are hand-coded.

## Play

**[tossboss.artinmajd.com](https://tossboss.artinmajd.com)** — works in any modern browser. On iOS, use *Add to Home Screen* in Safari for a fullscreen native-app experience.

---

## Features

### Two game modes
- **Ping Pong** — throw a lightweight ball into a red solo cup. The rim is unforgiving; only clean drops score.
- **Basketball** — toss a heavier ball through a wall-mounted hoop. Includes custom net-drag physics as the ball passes through.

### Physics engine (hand-coded)
- Euler integration with gravity, air resistance, and surface friction
- Per-mode ball weight, bounce restitution, and drag coefficients
- Accurate rim collision on both modes

### Scoring & streaks
- Consecutive makes increase a multiplier: +2/shot at 3 in a row, +3 at 6, climbing forever
- Two consecutive misses reset your score
- Missing on a bonus round drops the multiplier but keeps your base score

### Leaderboard (Supabase)
- Sign up / sign in to save scores
- Global leaderboard for each mode, sortable by **Best Score** or **Best Streak**
- Accessible from the home screen and as an in-game overlay (no game state lost)

### Mobile-first design
- Landscape-only gameplay with orientation warning in portrait
- Collapsible HUD on mobile: hamburger button hides nav/mode controls; score area collapses to just the current number
- Swipe-style drag-to-aim with minimum drag threshold to prevent accidental throws on double-tap
- Safe-area insets for notched devices
- Fullscreen button (hidden automatically when already in fullscreen)

### Smooth ball return
- After scoring, the ball arcs back to a random starting position via a quadratic Bézier ease-out animation instead of snapping

---

## Tech stack

| Layer | Technology |
|---|---|
| Rendering | HTML5 Canvas API |
| Language | Vanilla JavaScript (ES modules) |
| Routing | Hash-based SPA (`#home`, `#game`, `#auth`, `#leaderboard`) |
| Auth & DB | Supabase (email/password auth, PostgreSQL) |
| Fonts | Inter, Orbitron (Google Fonts) |
| Styling | CSS3 — glassmorphism, CSS custom properties, media queries |

---

## Run locally

No build step or package manager required.

```bash
git clone https://github.com/artinmajd/TossBoss.git
cd TossBoss
open index.html   # macOS — or just drag index.html into any browser
```

---

## How to play

1. **Aim** — tap/click anywhere and drag backward from the ball
2. **Throw** — release to launch
3. **Score** — land it cleanly in the cup or through the hoop
4. **Switch modes** — use the mode icons in the top-left menu
5. **Leaderboard** — tap the bar-chart icon to see global rankings mid-game
