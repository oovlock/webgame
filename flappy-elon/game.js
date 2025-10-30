/**
 * Flappy Elon - a pixel-styled Flappy Bird homage starring a mischievous Elon Musk.
 *
 * 🔧 Customisation quick start:
 *  - Replace the PNG sprites inside assets/sprites/ with matching filenames to reskin the game.
 *  - Adjust the PHYSICS, PIPE, and DIFFICULTY constants below to change feel & difficulty.
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

const sounds = {
  flap: document.getElementById('flapSound'),
  hit: document.getElementById('hitSound'),
  score: document.getElementById('scoreSound')
}; // Swap the WAV files in assets/audio to re-theme the soundscape.

const WORLD = {
  WIDTH: canvas.width,
  HEIGHT: canvas.height,
  GROUND_HEIGHT: 112
};
const GROUND_Y = WORLD.HEIGHT - WORLD.GROUND_HEIGHT;

// Physics knobs ------------------------------------------------------------
const PHYSICS = {
  GRAVITY: 800, // px / s^2
  FLAP_STRENGTH: 250, // velocity kick when the player flaps
  MAX_DROP_SPEED: 520
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

// Difficulty pacing – tweak to ramp up faster/slower -----------------------
const DIFFICULTY = {
  SPEED_INCREMENT: 9, // additional px/s per point
  GAP_REDUCTION: 2.5, // px less gap per point
  MIN_GAP: 110,
  MAX_SPEED: 240
};

const QUOTES = [
  '“I needed more thrust!”',
  '“Back to the launch pad.”',
  '“Note to self: hire a pilot.”',
  '“Was that a no-fly zone?”',
  '“I call that rapid unscheduled disassembly.”',
  '“Gravity! Why have you forsaken me?”',
  '“Pretty sure Mars has fewer pipes.”'
];

const state = {
  current: 'boot', // boot | ready | playing | gameover
  score: 0,
  highScore: Number(localStorage.getItem('flappy-elon-high-score')) || 0,
  spawnTimer: 0,
  pipeSpeed: PIPE.BASE_SPEED,
  pipeGap: PIPE.GAP,
  pipes: [],
  shake: { time: 0, duration: 0, intensity: 0, offsetX: 0, offsetY: 0 },
  fade: { active: false, alpha: 0, direction: 0, speed: 2.8, pending: null }
};

const backgroundLayers = [];
const clouds = createClouds();
let groundScroll = 0;

const player = createPlayer();

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
  if (state.current !== 'gameover') return;
  triggerTransition(goToReadyState);
});

canvas.addEventListener('pointerdown', handlePrimaryInput);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    handlePrimaryInput();
  }
  if (event.code === 'KeyR' && state.current === 'gameover') {
    triggerTransition(goToReadyState);
  }
});

let lastFrameTime = performance.now();
requestAnimationFrame(gameLoop);

// --------------------------------------------------------------------------
// Game State Management
// --------------------------------------------------------------------------

function goToReadyState() {
  state.current = 'ready';
  state.score = 0;
  state.spawnTimer = 0;
  state.pipeSpeed = PIPE.BASE_SPEED;
  state.pipeGap = PIPE.GAP;
  state.pipes = [];
  groundScroll = 0;
  player.reset(true);
  hideOverlay(gameOverOverlay);
  showOverlay(startOverlay);
  updateScoreUI();
}

function startPlaying() {
  state.current = 'playing';
  state.score = 0;
  state.spawnTimer = 0;
  state.pipeSpeed = PIPE.BASE_SPEED;
  state.pipeGap = PIPE.GAP;
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
  bestScoreLabel.textContent = state.highScore.toString();
  crashQuoteLabel.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
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

  if (state.current === 'ready') {
    triggerTransition(() => {
      startPlaying();
      player.flap();
      safePlay(sounds.flap);
    });
    return;
  }

  if (state.current === 'playing') {
    player.flap();
    safePlay(sounds.flap);
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

  if (state.current === 'ready') {
    player.idle(dt);
    groundScroll = (groundScroll + state.pipeSpeed * 0.35 * dt) % assets.images.ground.width;
    return;
  }

  if (state.current === 'playing') {
    player.update(dt);

    state.spawnTimer += dt;
    const spawnInterval = Math.max(1.05, PIPE.SPAWN_INTERVAL - state.score * 0.02);
    if (state.spawnTimer >= spawnInterval) {
      spawnPipePair();
      state.spawnTimer = 0;
    }

    updatePipes(dt);
    updateDifficulty();
    groundScroll = (groundScroll + state.pipeSpeed * dt) % assets.images.ground.width;

    detectCollisions();
    return;
  }

  if (state.current === 'gameover') {
    player.fallIdle(dt);
    groundScroll = (groundScroll + state.pipeSpeed * 0.15 * dt) % assets.images.ground.width;
  }
}

function draw() {
  if (!assets.ready) {
    drawLoading();
    return;
  }

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
    },
    update(dt) {
      this.velocity = Math.min(this.velocity + PHYSICS.GRAVITY * dt, PHYSICS.MAX_DROP_SPEED);
      this.y += this.velocity * dt;
      this.rotation = clamp(-0.7, 0.9, (this.velocity / PHYSICS.MAX_DROP_SPEED) * 1.2);

      if (this.y < -30) {
        this.y = -30;
        this.velocity = 0;
      }

      if (this.y + this.height >= GROUND_Y - 4) {
        this.y = GROUND_Y - this.height - 4;
        triggerCrash();
        return;
      }
    },
    idle(dt) {
      this.idleTimer += dt * 2.2;
      const floatRange = 12;
      this.y = WORLD.HEIGHT * 0.45 + Math.sin(this.idleTimer) * floatRange;
      this.rotation = Math.sin(this.idleTimer * 0.6) * 0.1;
    },
    fallIdle(dt) {
      this.velocity = Math.min(this.velocity + PHYSICS.GRAVITY * dt, PHYSICS.MAX_DROP_SPEED);
      this.y = Math.min(this.y + this.velocity * dt, GROUND_Y - this.height - 4);
      this.rotation = clamp(-0.7, 1.2, this.rotation + dt * 1.2);
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
  const gapCenter = randomRange(PIPE.MIN_GAP_CENTER, PIPE.MAX_GAP_CENTER);
  const gapSize = state.pipeGap;
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
      safePlay(sounds.score);
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
      y: -WORLD.HEIGHT,
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
  const desiredSpeed = Math.min(
    PIPE.BASE_SPEED + state.score * DIFFICULTY.SPEED_INCREMENT,
    DIFFICULTY.MAX_SPEED
  );
  state.pipeSpeed += (desiredSpeed - state.pipeSpeed) * 0.25;

  const desiredGap = Math.max(PIPE.GAP - state.score * DIFFICULTY.GAP_REDUCTION, DIFFICULTY.MIN_GAP);
  state.pipeGap += (desiredGap - state.pipeGap) * 0.2;
}

function triggerCrash() {
  if (state.current !== 'playing') return;

  state.current = 'gameover';
  player.dead = true;
  startShake(0.45, 12);
  safePlay(sounds.hit);
  player.velocity = 0;
  player.rotation = 0.9;

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem('flappy-elon-high-score', state.highScore);
  }

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
  scoreDisplay.textContent = state.score.toString();
  if (state.current !== 'playing') {
    scoreDisplay.classList.add('is-hidden');
  } else {
    scoreDisplay.classList.remove('is-hidden');
  }
}
