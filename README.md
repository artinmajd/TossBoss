# TossBoss 🏀🏓

**TossBoss** is a 2D physics-based web game built entirely from scratch using Vanilla JavaScript and HTML5 Canvas. No physics libraries were used—all kinematic equations, bounce restitutions, and friction variables were hand-coded to create a highly satisfying tossing experience!

## Features

* **Custom Physics Engine:** Realistic Euler integration handling gravity, air resistance, bounce factors, and friction.
* **Virtual Joystick Aiming:** Tap anywhere on the screen and pull back to throw. Features a dynamically calculated trajectory prediction arc to help you aim.
* **Two Play Modes:**
  * **Ping Pong:** Throw a lightweight ping pong ball into a red solo cup. Watch out for the rim—the physics are unforgiving!
  * **Basketball:** Toss a heavier, less bouncy basketball into a wall-mounted backboard and hoop. Features custom "net drag" physics when the ball passes through the net.
* **Mobile & Touch Friendly:** Fully responsive with specific mobile layout scaling. Built-in orientation detection requiring landscape play on phones, and disables native touch-scrolling for flawless slingshot controls.
* **Standalone Web App:** Safari users can use "Add to Home Screen" on iOS to play it in a completely native, fullscreen app experience.

## Tech Stack

* **HTML5** (Canvas API)
* **CSS3** (Responsive design, Glassmorphism UI, Media Queries)
* **Vanilla JavaScript** (Physics engine, Game loop, Event listeners)

## How to Play locally

There are no build steps, frameworks, or dependencies required.
Simply clone the repository and open `index.html` in your favorite web browser!

```bash
git clone https://github.com/artinmajd/TossBoss.git
cd TossBoss
open index.html # On Mac
```

## How to Play

1. **Aim:** Tap/click anywhere on the screen and drag backward.
2. **Throw:** Release to toss the ball!
3. **Wait:** The ball must come to a complete physical stop before you can grab it again.
4. **Switch Modes:** Use the circular icons at the top left to swap between Ping Pong and Basketball.
