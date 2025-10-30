/**
 * Flappy Elon - a pixel-styled Flappy Bird homage starring a mischievous Elon Musk.
 *
 * 🔧 Customisation quick start:
 *  - Replace the PNG sprites inside assets/sprites/ with matching filenames to reskin the game.
 *  - Adjust the PHYSICS, PIPE, and DIFFICULTY_PRESETS constants below to change feel & difficulty.
 *  - Update the QUOTES array to tweak the crash banter.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartButton = document.getElementById('restartButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreLabel = document.getElementById('finalScore');
const bestScoreLabel = document.getElementById('bestScore');
const crashQuoteLabel = document.getElementById('crashQuote');
const modeHighScoreList = document.getElementById('modeHighScores');
const currentScoreValue = document.getElementById('currentScoreValue');
const currentModeHighScore = document.getElementById('currentModeHighScore');
const modeLabel = document.getElementById('modeLabel');
const modeScoreElements = modeHighScoreList
  ? Array.from(modeHighScoreList.querySelectorAll('[data-mode-score]'))
  : [];

let scorePulseTimeout;

const audio = {
  hit: document.getElementById('hitSound'),
  music: document.getElementById('musicTrack')
}; // Swap the WAV files in assets/audio to re-theme the soundscape.

if (audio.music) {
  audio.music.volume = 0.35;
  audio.music.loop = true;
}

const difficultyButtons = Array.from(document.querySelectorAll('.difficulty-button'));

const WORLD = {
  WIDTH: canvas.width,
  HEIGHT: canvas.height,
  GROUND_HEIGHT: 112
};
const GROUND_Y = WORLD.HEIGHT - WORLD.GROUND_HEIGHT;

// Physics knobs ------------------------------------------------------------
const PHYSICS = {
  GRAVITY: 780, // px / s^2
  FLAP_STRENGTH: 265, // velocity kick when the player flaps
  MAX_DROP_SPEED: 540,
  DRAG: 0.08, // air resistance factor
  ROTATION_SMOOTHING: 7.5
};

// Pipe configuration -------------------------------------------------------
const PIPE = {
  WIDTH: 96,
  BASE_SPEED: 150, // px per second (≈2.5 px/frame @ 60 fps)
  GAP: 140,
  SPAWN_INTERVAL: 1.85, // seconds between pipe pairs
  MIN_GAP_CENTER: 160,
  MAX_GAP_CENTER: GROUND_Y - 120
};

// Difficulty presets -------------------------------------------------------
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
    baseSpeed: 504,
    maxSpeed: 816,
    speedIncrement: 38,
    gap: 110,
    gapReduction: 3.1,
    minGap: 72,
    spawnInterval: 0.6,
    minSpawnInterval: 0.3,
    spawnAcceleration: 0.048,
    gapVariance: 96
  }
};

const DEFAULT_DIFFICULTY = 'normal';
const initialDifficulty = DIFFICULTY_PRESETS[DEFAULT_DIFFICULTY];

const QUOTES = [
  '“I needed more thrust!”',
  '“Back to the launch pad.”',
  '“Note to self: hire a pilot.”',
  '“Was that a no-fly zone?”',
  '“I call that rapid unscheduled disassembly.”',
  '“Gravity! Why have you forsaken me?”',
  '“Pretty sure Mars has fewer pipes.”'
];

const MODE_HIGHSCORE_KEY = 'flappy-elon-mode-scores';
const DEFAULT_MODE_HIGH_SCORES = { easy: 0, normal: 0, hard: 0, elon: 0 };

function loadModeHighScores() {
  try {
    const raw = localStorage.getItem(MODE_HIGHSCORE_KEY);
    if (!raw) {
      const legacy = Number(localStorage.getItem('flappy-elon-high-score')) || 0;
      return { ...DEFAULT_MODE_HIGH_SCORES, normal: legacy };
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_MODE_HIGH_SCORES, ...parsed };
    }
  } catch (error) {
    // Ignore malformed data and fall back to defaults.
  }
  return { ...DEFAULT_MODE_HIGH_SCORES };
}

function persistModeHighScores(scores) {
  try {
    localStorage.setItem(MODE_HIGHSCORE_KEY, JSON.stringify(scores));
  } catch (error) {
    // Ignore quota or privacy mode errors in storage.
  }
}

const initialModeHighScores = loadModeHighScores();
const initialOverallHighScore = Math.max(0, ...Object.values(initialModeHighScores));

const state = {
  current: 'boot', // boot | ready | playing | gameover
  difficulty: DEFAULT_DIFFICULTY,
  score: 0,
  highScore: initialOverallHighScore,
  modeHighScores: { ...initialModeHighScores },
  spawnTimer: 0,
  pipeSpeed: initialDifficulty.baseSpeed,
  targetPipeSpeed: initialDifficulty.baseSpeed,
  pipeGap: initialDifficulty.gap,
  pipes: [],
  lastGapCenter: (PIPE.MIN_GAP_CENTER + PIPE.MAX_GAP_CENTER) / 2,
  shake: { time: 0, duration: 0, intensity: 0, offsetX: 0, offsetY: 0 },
  fade: { active: false, alpha: 0, direction: 0, speed: 2.8, pending: null },
  musicUnlocked: false
};

const backgroundLayers = [];
const clouds = createClouds();
let groundScroll = 0;

const player = createPlayer();

updateModeHighScoreUI();

const imageManifest = {
  background: 'assets/sprites/background.png',
  ground: 'assets/sprites/ground.png',
  pipe: 'assets/sprites/pipe.png',
  elon: 'assets/sprites/elon.png'
}; // Replace the PNGs (keeping the filenames) to reskin the visuals instantly.

const assets = {
  images: {},
  ready: false
};

Promise.all(
  Object.entries(imageManifest).map(([key, src]) =>
    loadImage(src)
      .then((image) => {
        assets.images[key] = image;
      })
      .catch((error) => {
        console.error(`Failed to load image ${src}`, error);
      })
  )
).then(() => {
  assets.ready = true;
  initialiseBackgroundLayers();
  goToReadyState();
});

restartButton.addEventListener('click', () => {
  ensureMusicLoop();
  if (state.current !== 'gameover') return;
  triggerTransition(goToReadyState);
});

canvas.addEventListener('pointerdown', handlePrimaryInput);
[startOverlay, gameOverOverlay].forEach((element) => {
  element.addEventListener('pointerdown', (event) => {
    const isDifficultyButton = event.target.closest('.difficulty-button');
    if (isDifficultyButton) {
      return;
    }
    if (event.target === restartButton || event.target.closest('#restartButton')) {
      return;
    }
    handlePrimaryInput();
  });
});

window.addEventListener('keydown', (event) => {
  const primaryKeys = new Set(['Space', 'ArrowUp', 'ArrowDown', 'Enter', 'NumpadEnter']);
  if (primaryKeys.has(event.code)) {
    event.preventDefault();
    handlePrimaryInput();
  }
  if (event.code === 'KeyR' && state.current === 'gameover') {
    ensureMusicLoop();
    triggerTransition(goToReadyState);
  }
});

difficultyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    ensureMusicLoop();
    const level = button.dataset.difficulty;
    const wasActive = button.classList.contains('is-active');
    setDifficulty(level);
    if (wasActive) {
      handlePrimaryInput();
    }
  });
});

updateDifficultyButtons();

let lastFrameTime = performance.now();
requestAnimationFrame(gameLoop);

// --------------------------------------------------------------------------
// Game State Management
// --------------------------------------------------------------------------

function goToReadyState() {
  state.current = 'ready';
  state.score = 0;
  syncDifficultySettings();
  state.pipes = [];
  groundScroll = 0;
  player.reset(true);
  hideOverlay(gameOverOverlay);
  showOverlay(startOverlay);
  updateDifficultyButtons();
  updateScoreUI();
}

function startPlaying() {
  state.current = 'playing';
  state.score = 0;
  syncDifficultySettings();
  state.pipes = [];
  player.reset(false);
  hideOverlay(startOverlay);
  scoreDisplay.classList.remove('is-hidden');
  updateScoreUI();
}

function endGame() {
  state.current = 'gameover';
  showOverlay(gameOverOverlay);
  scoreDisplay.classList.add('is-hidden');
  finalScoreLabel.textContent = state.score.toString();
  const modeBest = state.modeHighScores[state.difficulty] || 0;
  bestScoreLabel.textContent = modeBest.toString();
  crashQuoteLabel.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  updateModeHighScoreUI();
}

function triggerTransition(callback) {
  if (state.fade.active) return;
  state.fade = {
    active: true,
    alpha: 0,
    direction: 1,
    speed: 3.0,
    pending: callback
  };
}

function handlePrimaryInput() {
  if (!assets.ready) return;

  ensureMusicLoop();

  if (state.current === 'ready') {
    triggerTransition(() => {
      startPlaying();
      player.flap();
    });
    return;
  }

  if (state.current === 'playing') {
    player.flap();
    return;
  }

  if (state.current === 'gameover') {
    triggerTransition(goToReadyState);
  }
}

// --------------------------------------------------------------------------
// Loop
// --------------------------------------------------------------------------

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - lastFrameTime) / 1000, 1 / 24);
  lastFrameTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (!assets.ready) return;

  updateFade(dt);
  updateShake(dt);
  updateBackground(dt);
  updateClouds(dt);

  const groundTextureWidth = assets.images.ground ? assets.images.ground.width : WORLD.WIDTH;

  if (state.current === 'ready') {
    const settings = getDifficultySettings();
    state.pipeSpeed += (settings.baseSpeed * 0.75 - state.pipeSpeed) * 0.08;
    player.idle(dt);
    groundScroll = (groundScroll + state.pipeSpeed * 0.35 * dt) % groundTextureWidth;
    return;
  }

  if (state.current === 'playing') {
    player.update(dt);

    const settings = getDifficultySettings();
    state.spawnTimer += dt;
    const spawnInterval = Math.max(
      settings.minSpawnInterval,
      settings.spawnInterval - state.score * settings.spawnAcceleration
    );
    if (state.spawnTimer >= spawnInterval) {
      spawnPipePair();
      state.spawnTimer = 0;
    }

    updatePipes(dt);
    updateDifficulty();
    groundScroll = (groundScroll + state.pipeSpeed * dt) % groundTextureWidth;

    detectCollisions();
    return;
  }

  if (state.current === 'gameover') {
    state.pipeSpeed += (getDifficultySettings().baseSpeed * 0.4 - state.pipeSpeed) * 0.04;
    player.fallIdle(dt);
    groundScroll = (groundScroll + state.pipeSpeed * 0.15 * dt) % groundTextureWidth;
  }
}

function draw() {
  if (!assets.ready) {
    drawLoading();
    return;
  }

  ctx.imageSmoothingEnabled = false;

  ctx.save();
  applyShakeTransform();

  drawBackgroundLayers();
  drawClouds();
  drawPipes();
  drawGround();
  player.draw(ctx, assets.images.elon);

  ctx.restore();

  if (state.fade.alpha > 0) {
    ctx.fillStyle = `rgba(5, 8, 18, ${Math.min(state.fade.alpha, 1)})`;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }
}

// --------------------------------------------------------------------------
// Player -------------------------------------------------------------------

function createPlayer() {
  const base = {
    x: WORLD.WIDTH * 0.24,
    y: WORLD.HEIGHT * 0.5,
    width: 60,
    height: 60,
    velocity: 0,
    idleTimer: 0,
    rotation: 0,
    dead: false
  };

  return {
    ...base,
    reset(idle) {
      this.y = WORLD.HEIGHT * 0.45;
      this.velocity = 0;
      this.rotation = 0;
      this.idleTimer = 0;
      this.dead = idle;
    },
    flap() {
      if (this.dead) return;
      this.velocity = -PHYSICS.FLAP_STRENGTH;
      this.rotation = clamp(-0.8, 1.2, this.rotation - 0.25);
    },
    update(dt) {
      this.velocity += PHYSICS.GRAVITY * dt;
      this.velocity -= this.velocity * PHYSICS.DRAG * dt;
      this.velocity = Math.min(this.velocity, PHYSICS.MAX_DROP_SPEED);
      this.y += this.velocity * dt;

      const rotationTarget = clamp(
        -0.55,
        1.2,
        (this.velocity / PHYSICS.MAX_DROP_SPEED) * 1.25
      );
      this.rotation = lerp(this.rotation, rotationTarget, PHYSICS.ROTATION_SMOOTHING * dt);

      if (this.y < -32) {
        this.y = -32;
        this.velocity = 0;
      }

      if (this.y + this.height >= GROUND_Y - 4) {
        this.y = GROUND_Y - this.height - 4;
        triggerCrash();
        return;
      }
    },
    idle(dt) {
      this.idleTimer += dt * 1.8;
      const floatRange = 11;
      const bob = Math.sin(this.idleTimer) * floatRange;
      this.y = WORLD.HEIGHT * 0.45 + bob;
      const rotationTarget = Math.sin(this.idleTimer * 0.75) * 0.18;
      this.rotation = lerp(this.rotation, rotationTarget, 6 * dt);
    },
    fallIdle(dt) {
      this.velocity += PHYSICS.GRAVITY * dt;
      this.velocity -= this.velocity * PHYSICS.DRAG * 0.5 * dt;
      this.velocity = Math.min(this.velocity, PHYSICS.MAX_DROP_SPEED);
      this.y = Math.min(this.y + this.velocity * dt, GROUND_Y - this.height - 4);
      this.rotation = lerp(this.rotation, 1.05, 3 * dt);
    },
    draw(context, sprite) {
      context.save();
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      context.translate(centerX, centerY);
      context.rotate(this.rotation);
      context.drawImage(sprite, -this.width / 2, -this.height / 2, this.width, this.height);
      context.restore();
    },
    bounds() {
      return {
        x: this.x + 12,
        y: this.y + 10,
        width: this.width - 24,
        height: this.height - 20
      };
    }
  };
}

// --------------------------------------------------------------------------
// Pipes --------------------------------------------------------------------

function spawnPipePair() {
  const settings = getDifficultySettings();
  const variationFactor = 1 + randomRange(-0.18, 0.18) + Math.min(state.score / 80, 0.25);
  const gapSize = clamp(settings.minGap, settings.gap * 1.3, state.pipeGap * variationFactor);
  const minCenter = PIPE.MIN_GAP_CENTER + gapSize / 2;
  const maxCenter = PIPE.MAX_GAP_CENTER - gapSize / 2;
  const drift = randomRange(-settings.gapVariance, settings.gapVariance);
  const targetCenter = clamp(minCenter, maxCenter, state.lastGapCenter + drift);
  state.lastGapCenter = lerp(state.lastGapCenter, targetCenter, 0.65);
  const gapCenter = clamp(minCenter, maxCenter, state.lastGapCenter);
  const topHeight = gapCenter - gapSize / 2;
  const bottomY = gapCenter + gapSize / 2;

  state.pipes.push({
    x: WORLD.WIDTH + 20,
    width: PIPE.WIDTH,
    topHeight: Math.max(20, topHeight),
    bottomY,
    scored: false
  });
}

function updatePipes(dt) {
  const speed = state.pipeSpeed;
  state.pipes.forEach((pipe) => {
    pipe.x -= speed * dt;
    if (!pipe.scored && pipe.x + pipe.width < player.x) {
      pipe.scored = true;
      state.score += 1;
      updateScoreUI();
      pulseScoreboard();
    }
  });

  state.pipes = state.pipes.filter((pipe) => pipe.x + pipe.width > -120);
}

function drawPipes() {
  const pipeSprite = assets.images.pipe;
  const spriteHeight = pipeSprite.height;

  state.pipes.forEach((pipe) => {
    const scale = (pipe.topHeight + 80) / spriteHeight;
    // Top pipe (flipped)
    ctx.save();
    ctx.translate(pipe.x + pipe.width / 2, pipe.topHeight);
    ctx.scale(1, -scale);
    ctx.drawImage(pipeSprite, -pipe.width / 2, 0, pipe.width, spriteHeight);
    ctx.restore();

    // Bottom pipe
    const bottomHeight = GROUND_Y - pipe.bottomY;
    const bottomScale = bottomHeight / spriteHeight;
    ctx.save();
    ctx.translate(pipe.x + pipe.width / 2, pipe.bottomY);
    ctx.scale(1, bottomScale);
    ctx.drawImage(pipeSprite, -pipe.width / 2, 0, pipe.width, spriteHeight);
    ctx.restore();
  });
}

function detectCollisions() {
  const playerRect = player.bounds();

  if (playerRect.y < 0) {
    triggerCrash();
    return;
  }

  for (const pipe of state.pipes) {
    const topRect = {
      x: pipe.x,
      y: 0,
      width: pipe.width,
      height: pipe.topHeight
    };
    const bottomRect = {
      x: pipe.x,
      y: pipe.bottomY,
      width: pipe.width,
      height: WORLD.HEIGHT - pipe.bottomY
    };

    if (rectIntersect(playerRect, topRect) || rectIntersect(playerRect, bottomRect)) {
      triggerCrash();
      break;
    }
  }
}

function updateDifficulty() {
  const settings = getDifficultySettings();

  const difficultyMultiplier = 1 + Math.floor(state.score / 5) * 0.05;
  const desiredSpeed = Math.min(
    (settings.baseSpeed + state.score * settings.speedIncrement) * difficultyMultiplier,
    settings.maxSpeed * difficultyMultiplier
  );
  state.targetPipeSpeed += (desiredSpeed - state.targetPipeSpeed) * 0.35;
  state.pipeSpeed += (state.targetPipeSpeed - state.pipeSpeed) * 0.18;

  const desiredGap = Math.max(settings.gap - state.score * settings.gapReduction, settings.minGap);
  state.pipeGap += (desiredGap - state.pipeGap) * 0.25;
}

function triggerCrash() {
  if (state.current !== 'playing') return;

  state.current = 'gameover';
  player.dead = true;
  startShake(0.45, 12);
  safePlay(audio.hit);
  player.velocity = 0;
  player.rotation = 1.05;

  const mode = state.difficulty;
  const previousBest = state.modeHighScores[mode] || 0;
  if (state.score > previousBest) {
    state.modeHighScores[mode] = state.score;
    persistModeHighScores(state.modeHighScores);
  }
  state.highScore = Math.max(0, ...Object.values(state.modeHighScores));
  try {
    localStorage.setItem('flappy-elon-high-score', state.highScore);
  } catch (error) {
    // Ignore storage errors (private browsing, etc.).
  }

  updateModeHighScoreUI();
  triggerTransition(endGame);
}

// --------------------------------------------------------------------------
// Background & FX ----------------------------------------------------------

function initialiseBackgroundLayers() {
  backgroundLayers.length = 0;
  backgroundLayers.push({ image: assets.images.background, speed: 10, offset: 0, alpha: 1 });
  backgroundLayers.push({ image: assets.images.background, speed: 22, offset: 0, alpha: 0.45 });
}

function updateBackground(dt) {
  backgroundLayers.forEach((layer, index) => {
    const speedMultiplier = index === 0 ? 1 : 1.6;
    layer.offset = (layer.offset + layer.speed * speedMultiplier * dt) % layer.image.width;
  });
}

function drawBackgroundLayers() {
  backgroundLayers.forEach((layer) => {
    const { image, offset, alpha } = layer;
    const width = image.width;
    ctx.save();
    ctx.globalAlpha = alpha;
    let drawX = -offset;
    while (drawX < WORLD.WIDTH) {
      ctx.drawImage(image, drawX, 0, width, WORLD.HEIGHT);
      drawX += width;
    }
    ctx.restore();
  });
}

function createClouds() {
  return Array.from({ length: 8 }).map(() => ({
    x: Math.random() * WORLD.WIDTH,
    y: randomRange(60, WORLD.HEIGHT * 0.5),
    speed: randomRange(12, 28),
    scale: randomRange(0.6, 1.2),
    alpha: randomRange(0.25, 0.5)
  }));
}

function updateClouds(dt) {
  clouds.forEach((cloud) => {
    cloud.x -= cloud.speed * dt;
    if (cloud.x < -160) {
      cloud.x = WORLD.WIDTH + randomRange(10, 120);
      cloud.y = randomRange(60, WORLD.HEIGHT * 0.5);
      cloud.speed = randomRange(12, 28);
      cloud.scale = randomRange(0.6, 1.2);
      cloud.alpha = randomRange(0.25, 0.5);
    }
  });
}

function drawClouds() {
  ctx.save();
  clouds.forEach((cloud) => {
    const width = 120 * cloud.scale;
    const height = 45 * cloud.scale;
    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = '#9ad9ff';
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, width * 0.5, height * 0.4, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + width * 0.35, cloud.y + 8, width * 0.45, height * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x - width * 0.35, cloud.y + 6, width * 0.42, height * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawGround() {
  const ground = assets.images.ground;
  const width = ground.width;
  let drawX = -groundScroll;
  while (drawX < WORLD.WIDTH) {
    ctx.drawImage(ground, drawX, GROUND_Y, width, WORLD.GROUND_HEIGHT);
    drawX += width;
  }
}

function startShake(duration, intensity) {
  state.shake = {
    time: duration,
    duration,
    intensity,
    offsetX: 0,
    offsetY: 0
  };
}

function updateShake(dt) {
  if (state.shake.time <= 0) return;
  state.shake.time = Math.max(0, state.shake.time - dt);
  const progress = state.shake.time / state.shake.duration;
  const magnitude = state.shake.intensity * (progress * progress);
  state.shake.offsetX = randomRange(-magnitude, magnitude);
  state.shake.offsetY = randomRange(-magnitude, magnitude);
}

function applyShakeTransform() {
  ctx.translate(state.shake.offsetX || 0, state.shake.offsetY || 0);
}

function updateFade(dt) {
  if (!state.fade.active) return;
  state.fade.alpha += state.fade.direction * state.fade.speed * dt;
  if (state.fade.direction > 0 && state.fade.alpha >= 1) {
    state.fade.alpha = 1;
    state.fade.direction = -1;
    if (typeof state.fade.pending === 'function') {
      state.fade.pending();
      state.fade.pending = null;
    }
  }
  if (state.fade.direction < 0 && state.fade.alpha <= 0) {
    state.fade.alpha = 0;
    state.fade.active = false;
  }
}

// --------------------------------------------------------------------------
// Helpers ------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = reject;
  });
}

function safePlay(audio) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play();
  } catch (error) {
    // Most browsers block autoplay before user interaction – ignore.
  }
}

function drawLoading() {
  ctx.fillStyle = '#040b1c';
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  ctx.fillStyle = '#58f5ff';
  ctx.font = '18px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOADING...', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

function showOverlay(element) {
  element.classList.add('overlay--visible');
}

function hideOverlay(element) {
  element.classList.remove('overlay--visible');
}

function updateScoreUI() {
  if (!scoreDisplay) return;
  const label = formatDifficultyLabel(state.difficulty);
  scoreDisplay.dataset.difficulty = label;
  if (currentScoreValue) {
    currentScoreValue.textContent = state.score.toString();
  }
  updateModeHighScoreUI();

  if (state.current !== 'playing') {
    scoreDisplay.classList.add('is-hidden');
    scoreDisplay.classList.remove('scoreboard--pulse');
  } else {
    scoreDisplay.classList.remove('is-hidden');
  }
}

function pulseScoreboard() {
  if (!scoreDisplay) return;
  scoreDisplay.classList.add('scoreboard--pulse');
  clearTimeout(scorePulseTimeout);
  scorePulseTimeout = setTimeout(() => {
    scoreDisplay.classList.remove('scoreboard--pulse');
  }, 220);
}

function ensureMusicLoop() {
  if (!audio.music) return;
  if (state.musicUnlocked && !audio.music.paused) {
    return;
  }
  try {
    const playPromise = audio.music.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          state.musicUnlocked = true;
        })
        .catch(() => {
          state.musicUnlocked = false;
        });
    } else {
      state.musicUnlocked = true;
    }
  } catch (error) {
    state.musicUnlocked = false;
  }
}

function setDifficulty(level) {
  const nextDifficulty = DIFFICULTY_PRESETS[level] ? level : DEFAULT_DIFFICULTY;
  if (state.difficulty === nextDifficulty) {
    updateDifficultyButtons();
    return;
  }

  state.difficulty = nextDifficulty;
  const settings = getDifficultySettings();
  state.targetPipeSpeed = settings.baseSpeed;

  if (state.current === 'playing') {
    state.pipeGap = settings.gap;
  } else {
    syncDifficultySettings();
    state.pipes = [];
    groundScroll = 0;
    if (state.current === 'ready') {
      player.reset(true);
    }
  }

  updateDifficultyButtons();
  updateScoreUI();
}

function syncDifficultySettings() {
  const settings = getDifficultySettings();
  state.pipeSpeed = settings.baseSpeed;
  state.targetPipeSpeed = settings.baseSpeed;
  state.pipeGap = settings.gap;
  state.spawnTimer = 0;
  state.lastGapCenter = (PIPE.MIN_GAP_CENTER + PIPE.MAX_GAP_CENTER) / 2;
}

function getDifficultySettings(level = state.difficulty) {
  return DIFFICULTY_PRESETS[level] || DIFFICULTY_PRESETS[DEFAULT_DIFFICULTY];
}

function updateDifficultyButtons() {
  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === state.difficulty;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateModeHighScoreUI() {
  const label = formatDifficultyLabel(state.difficulty);
  const modeBest = state.modeHighScores[state.difficulty] || 0;

  if (modeLabel) {
    modeLabel.textContent = label;
  }

  if (currentModeHighScore) {
    currentModeHighScore.textContent = modeBest.toString();
  }

  if (modeScoreElements.length) {
    modeScoreElements.forEach((element) => {
      const mode = element.getAttribute('data-mode-score');
      if (!mode) return;
      element.textContent = (state.modeHighScores[mode] || 0).toString();
    });
  }
}

function formatDifficultyLabel(level) {
  if (level === 'elon') {
    return 'ELON MODE';
  }
  return level.toUpperCase();
}

function lerp(start, end, t) {
  return start + (end - start) * Math.min(1, Math.max(0, t));
}
