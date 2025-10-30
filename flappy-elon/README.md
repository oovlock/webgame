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
- **Difficulty buttons** (Easy / Normal / Hard / Elon Mode) – choose the pipe speed profile before take-off (Elon Mode is ~4× faster than Hard)
- **R** on the keyboard – restart quickly after a crash

## Gameplay Features

- Smooth, physics-influenced motion with subtle drag and rotation smoothing
- Responsive click/tap/space controls
- Parallax starfield, drifting clouds, and scrolling ground
- Procedurally generated pipe pairs with adaptive difficulty curves
- Four difficulty presets, capped by the ludicrous 4× speed "Elon Mode"
- On-screen score plus persistent local high score (stored in `localStorage`)
- Screen shake, fade transitions, calm retro soundtrack, and rotation animation for crashes
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
>
> ### Swap in your own Elon sprite
>
> 1. Create your custom image (PNG with transparency recommended).
> 2. Name it `elon.png` and place it inside `flappy-elon/assets/sprites/`, replacing the existing file.
> 3. Reload the page. The canvas will automatically pick up the updated art on the next run.
>
> **Tip:** If your sprite is much wider/taller than the placeholder, you can tweak the player render size in `game.js` – look for the `width` and `height` values inside `createPlayer()` to adjust the on-screen size without editing the image itself.

### Swap the Sounds

Audio lives in `assets/audio/`:

| File | Purpose |
| --- | --- |
| `ambient-loop.wav` | Calm retro background loop (plays continuously) |
| `hit.wav` | Crash impact sting |

Replace these WAV files with your own tracks to alter the vibe. Keep the filenames so the HTML references continue to work. If you prefer silence, simply remove the audio elements from `index.html`.

### Tune the Physics & Difficulty

Open `game.js` and look for the constant blocks near the top:

```js
const PHYSICS = {
  GRAVITY: 780,
  FLAP_STRENGTH: 265,
  MAX_DROP_SPEED: 540,
  DRAG: 0.08,
  ROTATION_SMOOTHING: 7.5
};

const DIFFICULTY_PRESETS = {
  easy: {
    baseSpeed: 120,
    maxSpeed: 190,
    speedIncrement: 6,
    gap: 155,
    gapReduction: 1.6,
    minGap: 130,
    spawnInterval: 2.05,
    minSpawnInterval: 1.45,
    spawnAcceleration: 0.015,
    gapVariance: 65
  },
  normal: {
    baseSpeed: 150,
    maxSpeed: 240,
    speedIncrement: 9,
    gap: 140,
    gapReduction: 2.4,
    minGap: 112,
    spawnInterval: 1.85,
    minSpawnInterval: 1.25,
    spawnAcceleration: 0.02,
    gapVariance: 78
  },
  hard: {
    baseSpeed: 210,
    maxSpeed: 340,
    speedIncrement: 16,
    gap: 118,
    gapReduction: 3.8,
    minGap: 88,
    spawnInterval: 1.45,
    minSpawnInterval: 0.95,
    spawnAcceleration: 0.03,
    gapVariance: 110
  },
  elon: {
    baseSpeed: 840,
    maxSpeed: 1360,
    speedIncrement: 64,
    gap: 110,
    gapReduction: 5.2,
    minGap: 72,
    spawnInterval: 0.36,
    minSpawnInterval: 0.18,
    spawnAcceleration: 0.08,
    gapVariance: 160
  }
};
```

Tweak these values to change gravity, flap strength, gap sizes, or how quickly each preset ramps up. Each block is commented in the source describing how the numbers affect play.

### Add More Personality

- Edit the `QUOTES` array in `game.js` to change the crash taunts.
- Sprinkle in power-ups, backgrounds, or even SpaceX rocket pipes – the code is vanilla JS and intentionally lightweight.
- The UI uses Google Font **Press Start 2P**; change the font link in `index.html` to swap the typeface.

## Project Structure

```
flappy-elon/
├── assets/
│   ├── audio/
│   │   ├── ambient-loop.wav
│   │   └── hit.wav
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
