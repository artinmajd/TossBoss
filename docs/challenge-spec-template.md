# Challenge Spec Template

Use this template when defining a new challenge. All fields marked **required**
must be filled in. Optional fields can be omitted if not applicable.

---

## Challenge: [Name]

### Trigger
All challenges are triggered by the black hole (throw the ball into it).  
The director picks randomly from the challenge registry once the ball is absorbed.

### Behaviour
**Required:**
- What changes during the challenge? (target size, gravity, wind, etc.)
- Where does the target end up? (same center/position as normal, or shifted?)
- Does motion animate smoothly in and out? (yes, with ramp-in/ramp-out seconds)
- How long is the active window? (seconds — currently 20 s)

**Optional:**
- Any special physics or scoring rules while active?
- Any visual effects on the ball, target, or background?

### Reward
**Required:**
- Score multiplier (e.g. 2×, 3×)
- Extra lives granted? (0 or N)
- Any other bonus? (e.g. streak preserved, reset blocked)

### HUD Badge
**Required:**
- Title line (ALL CAPS, short — e.g. `SMALL TARGET`)
- Reward line value (e.g. `3X`)
- Sub-line (optional short description — e.g. `+ 1 extra life`)

### Wind-down / End state
**Required:**
- Does the target return to normal position/size at the end? (yes/no)
- How long is the wind-down animation? (seconds)
- When exactly does the badge disappear? (at DURATION, before wind-down completes)

---

## Implementation checklist

When building a new challenge:

1. Create `js/modifiers/challenges/<camelCaseName>.js`
   - Export a factory function (no args → returns modifier object)
   - Use `performance.now()` for wall-clock timing (`elapsed()` pattern)
   - Use `smoothstep()` for ramp-in/ramp-out transitions
   - Set/reset `ctx.scoreMultiplier`, `ctx.targetOffset`, `ctx.targetScale`,
     `ctx.extraLives` as needed
   - Call `ctx.addExtraLife()` / `ctx.removeExtraLife()` for heart DOM changes
   - Call `ctx.showChallengeBadge(title, reward, sub)` / `ctx.hideChallengeBadge()`
   - Call `ctx.resetBallToStart()` in `onActivate` to give player a fresh ball
   - Guard `onDeactivate` with flags so cleanup methods aren't called twice

2. Add the factory to `js/modifiers/registry.js`

3. If the challenge needs a new `gameCtx` field or action:
   - Declare the stub in `js/modifiers/context.js`
   - Wire the real implementation in `js/engine.js` (near the other action methods)

4. CSS: add any new animations to `css/style.css` (follow existing patterns)

5. Update `CLAUDE.md` modifier section

---

## Existing challenges

| ID             | File                              | Scale | Multiplier | Extra lives | Duration |
|----------------|-----------------------------------|-------|------------|-------------|----------|
| moving-target  | challenges/movingTarget.js        | 1×    | 2×         | 0           | 20 s     |
| small-target   | challenges/smallTarget.js         | 0.7×  | 3×         | 1           | 20 s     |
