# Flappy Elon

Flappy Elon is a tongue-in-cheek, pixelated Flappy Bird clone where Elon Musk rockets through procedurally generated pipes. The entire game runs in the browser – just open `index.html` and start flapping.

## Quick Start

| Step | Action |
| --- | --- |
| 1 | Download or clone this repository |
| 2 | Open `flappy-elon/index.html` in Chrome, Edge, or Firefox |
| 3 | Click/tap or press **Space** to flap |

No servers, build tools, or installations required.

## Controls

- **Tap / Click / Space** – Flap upward
- **Tap / Click** while on the start screen – begin a run
- **R** on the keyboard – restart quickly after a crash

## Gameplay Features

- Smooth physics tuned for a gentle-but-silly hovercraft feel
- Responsive click/tap/space controls
- Parallax starfield, drifting clouds, and scrolling ground
- Procedurally generated pipe pairs with adaptive difficulty
- On-screen score plus persistent local high score (stored in `localStorage`)
- Screen shake, fade transitions, and a rotation animation for crashes
- Crash quotes because Elon's ego demands narration

## Customising the Game

### Replace the Art

All art lives in `assets/sprites/`:

| File | Purpose | Notes |
| --- | --- | --- |
| `elon.png` | Player sprite | 64×64 placeholder face | 
| `pipe.png` | Pipe/rocket body | Drawn twice – once flipped for the top pipe |
| `background.png` | Starry backdrop | Tiled horizontally for parallax |
| `ground.png` | Scrolling terrain strip | Anchored to the bottom of the canvas |

> Drop in new PNGs with the same filenames to reskin the game. Stretching is handled by the renderer, so any size ≥ the current dimensions works.

### Swap the Sounds

Audio clips live in `assets/audio/` (`flap.wav`, `hit.wav`, `score.wav`). Provide your own WAV files (short and punchy), or keep the placeholders.

### Tune the Physics & Difficulty

Open `game.js` and look for the constant blocks near the top:

```js
const PHYSICS = {
  GRAVITY: 800,
  FLAP_STRENGTH: 250,
  MAX_DROP_SPEED: 520
};

const PIPE = {
  BASE_SPEED: 150,
  GAP: 140,
  SPAWN_INTERVAL: 1.85
};

const DIFFICULTY = {
  SPEED_INCREMENT: 9,
  GAP_REDUCTION: 2.5
};
```

Adjust these values to change gravity, flap strength, pipe spacing, or how quickly the game ramps up. Each block is heavily commented in the source.

### Add More Personality

- Edit the `QUOTES` array in `game.js` to change the crash taunts.
- Sprinkle in power-ups, backgrounds, or even SpaceX rocket pipes – the code is vanilla JS and intentionally lightweight.
- The UI uses Google Font **Press Start 2P**; change the font link in `index.html` to swap the typeface.

## Project Structure

```
flappy-elon/
├── assets/
│   ├── audio/
│   │   ├── flap.wav
│   │   ├── hit.wav
│   │   └── score.wav
│   └── sprites/
│       ├── background.png
│       ├── elon.png
│       ├── ground.png
│       └── pipe.png
├── game.js
├── index.html
├── style.css
└── README.md
```

## Browser Support

Tested in the latest versions of Chrome, Firefox, and Edge. Safari also works but may defer audio playback until the first user interaction.

## License

This mini-game is delivered as-is for educational and entertainment purposes. Swap out assets to meet your licensing requirements.
