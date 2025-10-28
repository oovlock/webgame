const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const appleCountEl = document.getElementById('appleCount');
const dragonHealthEl = document.getElementById('dragonHealth');
const statusTextEl = document.getElementById('statusText');
const announcementEl = document.getElementById('announcement');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const GROUND_HEIGHT = 70;
const GROUND_Y = CANVAS_HEIGHT - GROUND_HEIGHT;
const GRAVITY = 0.75;
const APPLES_TO_POWER = 5;
const MAX_APPLES_ON_FIELD = 6;

const input = { left: false, right: false };
let gameState = 'running'; // running | won | lost
let statusTimer = 0;
let lastTime = performance.now();
let appleSpawnTimer = 150;

const clouds = [
  { x: 120, y: 80, scale: 1.2 },
  { x: 380, y: 55, scale: 1.05 },
  { x: 640, y: 90, scale: 1.4 },
  { x: 800, y: 65, scale: 0.9 }
];

const apples = [];

class Player {
  constructor() {
    this.baseWidth = 44;
    this.baseHeight = 60;
    this.poweredWidth = 70;
    this.poweredHeight = 96;
    this.maxSpeed = 6;
    this.poweredMaxSpeed = 7.2;
    this.jumpStrength = 13.5;
    this.attackDuration = 8;
    this.attackCooldownTime = 24;
    this.reset();
  }

  reset() {
    this.width = this.baseWidth;
    this.height = this.baseHeight;
    this.x = 140;
    this.y = GROUND_Y - this.height;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.powered = false;
    this.apples = 0;
    this.attackActive = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.flashTimer = 0;
  }

  get currentMaxSpeed() {
    return this.powered ? this.poweredMaxSpeed : this.maxSpeed;
  }

  update(dt) {
    if (gameState !== 'running') {
      return;
    }

    const accel = this.onGround ? 0.65 : 0.4;
    if (input.left) {
      this.vx = Math.max(this.vx - accel * dt, -this.currentMaxSpeed);
      this.facing = -1;
    }
    if (input.right) {
      this.vx = Math.min(this.vx + accel * dt, this.currentMaxSpeed);
      this.facing = 1;
    }

    if (!input.left && !input.right) {
      const friction = this.onGround ? 0.8 : 0.98;
      this.vx *= Math.pow(friction, dt);
      if (Math.abs(this.vx) < 0.05) {
        this.vx = 0;
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.attackActive) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackActive = false;
      }
    }

    this.vy += GRAVITY * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y + this.height >= GROUND_Y) {
      this.y = GROUND_Y - this.height;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }

    const margin = 10;
    if (this.x < margin) {
      this.x = margin;
      this.vx = Math.max(0, this.vx);
    }
    if (this.x + this.width > CANVAS_WIDTH - margin) {
      this.x = CANVAS_WIDTH - margin - this.width;
      this.vx = Math.min(0, this.vx);
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  jump() {
    if (gameState !== 'running') {
      return;
    }
    if (this.onGround) {
      this.vy = -this.jumpStrength;
      this.onGround = false;
    }
  }

  tryAttack() {
    if (gameState !== 'running') {
      return;
    }
    if (!this.powered || this.attackCooldown > 0 || this.attackActive) {
      return;
    }
    this.attackActive = true;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = this.attackCooldownTime;
    setStatus('Attack! Hit the dragon!', 120);
  }

  collectApple() {
    this.apples += 1;
    appleCountEl.textContent = this.apples;
    if (!this.powered && this.apples >= APPLES_TO_POWER) {
      this.powerUp();
    } else {
      setStatus('Apple collected!', 100);
    }
  }

  powerUp() {
    this.powered = true;
    const oldHeight = this.height;
    const oldWidth = this.width;
    this.width = this.poweredWidth;
    this.height = this.poweredHeight;
    this.x -= (this.width - oldWidth) / 2;
    this.y -= (this.height - oldHeight);
    if (this.y + this.height > GROUND_Y) {
      this.y = GROUND_Y - this.height;
    }
    if (this.x < 10) {
      this.x = 10;
    }
    if (this.x + this.width > CANVAS_WIDTH - 10) {
      this.x = CANVAS_WIDTH - 10 - this.width;
    }
    this.attackCooldown = 12;
    this.flashTimer = 16;
    setStatus('Powered up! Attack unlocked!', 200);
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  getAttackBounds() {
    if (!this.attackActive) {
      return null;
    }
    const range = this.powered ? 68 : 48;
    const height = this.height * 0.55;
    const offsetY = this.height * 0.25;
    if (this.facing === 1) {
      return {
        x: this.x + this.width - 6,
        y: this.y + offsetY,
        width: range,
        height
      };
    }
    return {
      x: this.x - range + 6,
      y: this.y + offsetY,
      width: range,
      height
    };
  }

  draw(ctx) {
    ctx.save();
    const attackBounds = this.getAttackBounds();
    if (attackBounds) {
      const grad = ctx.createLinearGradient(
        attackBounds.x,
        attackBounds.y,
        attackBounds.x + attackBounds.width,
        attackBounds.y + attackBounds.height
      );
      grad.addColorStop(0, 'rgba(255, 230, 0, 0.2)');
      grad.addColorStop(0.6, 'rgba(255, 90, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 0, 0, 0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(
        attackBounds.x,
        attackBounds.y,
        attackBounds.width,
        attackBounds.height
      );
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width / 2,
      GROUND_Y + 6,
      this.width * 0.4,
      10,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.translate(this.x + this.width / 2, this.y);
    ctx.scale(this.facing, 1);
    ctx.translate(-this.width / 2, 0);

    const flash = this.flashTimer > 0 ? 1 : 0;

    // Hat
    ctx.fillStyle = flash ? '#ffe066' : '#d62828';
    ctx.fillRect(this.width * 0.15, 0, this.width * 0.7, this.height * 0.18);
    ctx.fillRect(this.width * 0.25, this.height * 0.18, this.width * 0.48, this.height * 0.08);

    // Face
    ctx.fillStyle = '#ffe0b2';
    ctx.fillRect(this.width * 0.2, this.height * 0.2, this.width * 0.6, this.height * 0.3);

    // Hair
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(this.width * 0.18, this.height * 0.18, this.width * 0.64, this.height * 0.07);

    // Moustache
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(this.width * 0.25, this.height * 0.35, this.width * 0.5, this.height * 0.06);

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(this.width * 0.33, this.height * 0.26, this.width * 0.08, this.height * 0.08);
    ctx.fillRect(this.width * 0.59, this.height * 0.26, this.width * 0.08, this.height * 0.08);

    // Body - shirt
    ctx.fillStyle = flash ? '#ffdd57' : '#d62828';
    ctx.fillRect(this.width * 0.18, this.height * 0.46, this.width * 0.64, this.height * 0.22);

    // Overalls
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(this.width * 0.18, this.height * 0.53, this.width * 0.64, this.height * 0.34);

    // Overall straps
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(this.width * 0.18, this.height * 0.46, this.width * 0.14, this.height * 0.2);
    ctx.fillRect(this.width * 0.68, this.height * 0.46, this.width * 0.14, this.height * 0.2);

    // Buttons
    ctx.fillStyle = '#ffde59';
    ctx.beginPath();
    ctx.arc(this.width * 0.26, this.height * 0.58, this.width * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.width * 0.74, this.height * 0.58, this.width * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Gloves
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(this.width * 0.05, this.height * 0.58, this.width * 0.18, this.height * 0.12);
    ctx.fillRect(this.width * 0.77, this.height * 0.58, this.width * 0.18, this.height * 0.12);

    // Boots
    ctx.fillStyle = '#4b2e19';
    ctx.fillRect(this.width * 0.18, this.height * 0.84, this.width * 0.22, this.height * 0.16);
    ctx.fillRect(this.width * 0.6, this.height * 0.84, this.width * 0.22, this.height * 0.16);

    ctx.restore();
  }
}

class Dragon {
  constructor() {
    this.maxHealth = 3;
    this.reset();
  }

  reset() {
    this.width = 170;
    this.height = 110;
    this.x = CANVAS_WIDTH - this.width - 160;
    this.baseY = 120;
    this.y = this.baseY;
    this.speed = 2.2;
    this.direction = -1;
    this.wavePhase = 0;
    this.swoopCooldown = 240;
    this.isSwooping = false;
    this.swoopDirection = 1;
    this.swoopSpeed = 5.2;
    this.health = this.maxHealth;
    this.hitFlash = 0;
  }

  update(dt, target) {
    if (gameState !== 'running') {
      return;
    }

    this.x += this.speed * this.direction * dt;
    if (this.x < 280) {
      this.x = 280;
      this.direction = 1;
    }
    if (this.x + this.width > CANVAS_WIDTH - 40) {
      this.x = CANVAS_WIDTH - 40 - this.width;
      this.direction = -1;
    }

    if (this.isSwooping) {
      this.y += this.swoopDirection * this.swoopSpeed * dt;
      if (this.swoopDirection === 1 && this.y >= GROUND_Y - this.height - 50) {
        this.swoopDirection = -1;
      }
      if (this.swoopDirection === -1 && this.y <= this.baseY) {
        this.y = this.baseY;
        this.isSwooping = false;
        this.swoopCooldown = 260 + Math.random() * 160;
      }
    } else {
      this.wavePhase += 0.03 * dt;
      this.y = this.baseY + Math.sin(this.wavePhase) * 22;
      this.swoopCooldown -= dt;
      if (this.swoopCooldown <= 0) {
        this.isSwooping = true;
        this.swoopDirection = 1;
      }
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
    }
  }

  takeHit() {
    if (this.hitFlash > 0) {
      return;
    }
    this.health -= 1;
    dragonHealthEl.textContent = Math.max(0, this.health);
    this.hitFlash = 10;
    setStatus('Great hit!', 160);
    if (this.health <= 0) {
      onVictory();
    }
  }

  getBounds() {
    return {
      x: this.x + 10,
      y: this.y + 10,
      width: this.width - 20,
      height: this.height - 20
    };
  }

  draw(ctx) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width / 2,
      GROUND_Y + 12,
      this.width * 0.45,
      16,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.translate(this.x, this.y);
    const flash = this.hitFlash > 0;

    // Wings
    ctx.fillStyle = flash ? '#ffadad' : '#7bc043';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.2, this.height * 0.55);
    ctx.lineTo(-this.width * 0.2, this.height * 0.2);
    ctx.lineTo(this.width * 0.1, this.height * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(this.width * 0.8, this.height * 0.55);
    ctx.lineTo(this.width * 1.1, this.height * 0.25);
    ctx.lineTo(this.width * 0.9, this.height * 0.1);
    ctx.closePath();
    ctx.fill();

    // Tail
    ctx.fillStyle = flash ? '#ffadad' : '#5a9c2e';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.05, this.height * 0.6);
    ctx.lineTo(-this.width * 0.25, this.height * 0.8);
    ctx.lineTo(this.width * 0.12, this.height * 0.76);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = flash ? '#ffe066' : '#4caf50';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.5, this.height * 0.58, this.width * 0.45, this.height * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = flash ? '#fff3b0' : '#a8e063';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.5, this.height * 0.63, this.width * 0.25, this.height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = flash ? '#ffe066' : '#4caf50';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.58, this.height * 0.42);
    ctx.lineTo(this.width * 0.8, this.height * 0.2);
    ctx.lineTo(this.width * 0.68, this.height * 0.6);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = flash ? '#ffe066' : '#4caf50';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.78, this.height * 0.2, this.width * 0.2, this.height * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.86, this.height * 0.18, this.width * 0.07, this.height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.width * 0.88, this.height * 0.18, this.width * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = '#fff5ba';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.72, this.height * 0.05);
    ctx.lineTo(this.width * 0.76, -this.height * 0.2);
    ctx.lineTo(this.width * 0.84, this.height * 0.07);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(this.width * 0.88, this.height * 0.04);
    ctx.lineTo(this.width * 0.92, -this.height * 0.2);
    ctx.lineTo(this.width * 0.98, this.height * 0.06);
    ctx.closePath();
    ctx.fill();

    // Mouth / Fire hint
    ctx.fillStyle = flash ? '#ff6b6b' : '#d84315';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.94, this.height * 0.26, this.width * 0.07, this.height * 0.04, 0, 0, Math.PI);
    ctx.fill();

    ctx.restore();
  }
}

class Apple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 26;
    this.floatPhase = Math.random() * Math.PI * 2;
    this.floatOffset = 0;
  }

  update(dt) {
    this.floatPhase += 0.09 * dt;
    this.floatOffset = Math.sin(this.floatPhase) * 6;
  }

  getBounds() {
    const half = this.size * 0.5;
    return {
      x: this.x - half,
      y: this.y - half + this.floatOffset,
      width: this.size,
      height: this.size
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + this.floatOffset);

    ctx.fillStyle = '#00000022';
    ctx.beginPath();
    ctx.ellipse(0, this.size * 0.55, this.size * 0.45, this.size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f44336';
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.45);
    ctx.bezierCurveTo(
      this.size * 0.6,
      -this.size * 0.5,
      this.size * 0.7,
      this.size * 0.5,
      0,
      this.size * 0.5
    );
    ctx.bezierCurveTo(
      -this.size * 0.7,
      this.size * 0.5,
      -this.size * 0.6,
      -this.size * 0.5,
      0,
      -this.size * 0.45
    );
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#ffb3a7';
    ctx.beginPath();
    ctx.ellipse(-this.size * 0.2, -this.size * 0.1, this.size * 0.18, this.size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -this.size * 0.45);
    ctx.lineTo(this.size * 0.05, -this.size * 0.7);
    ctx.stroke();

    // Leaf
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath();
    ctx.moveTo(this.size * 0.05, -this.size * 0.62);
    ctx.quadraticCurveTo(this.size * 0.4, -this.size * 0.8, this.size * 0.45, -this.size * 0.45);
    ctx.quadraticCurveTo(this.size * 0.2, -this.size * 0.55, this.size * 0.05, -this.size * 0.62);
    ctx.fill();

    ctx.restore();
  }
}

const player = new Player();
const dragon = new Dragon();

function spawnApple() {
  if (apples.length >= MAX_APPLES_ON_FIELD) {
    return;
  }
  const margin = 70;
  const x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
  const y = GROUND_Y - 30;
  apples.push(new Apple(x, y));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resetGame() {
  gameState = 'running';
  player.reset();
  dragon.reset();
  apples.length = 0;
  for (let i = 0; i < 3; i += 1) {
    spawnApple();
  }
  appleCountEl.textContent = player.apples;
  dragonHealthEl.textContent = dragon.health;
  appleSpawnTimer = 150;
  statusTimer = 0;
  showAnnouncement('');
  statusTextEl.textContent = 'Collect apples to power up!';
}

function onVictory() {
  if (gameState !== 'running') {
    return;
  }
  gameState = 'won';
  showAnnouncement('You defeated the dragon! Press Enter to play again.', 'win');
  setStatus('Heroic victory!', 9999);
}

function onDefeat() {
  if (gameState !== 'running') {
    return;
  }
  gameState = 'lost';
  showAnnouncement('The dragon scorched you! Press Enter to retry.', 'lose');
  setStatus('Ouch! Avoid the dragon and gather apples.', 9999);
}

function showAnnouncement(text, type) {
  if (!text) {
    announcementEl.classList.add('hidden');
    announcementEl.textContent = '';
    announcementEl.classList.remove('win');
    announcementEl.classList.remove('lose');
    return;
  }
  announcementEl.textContent = text;
  announcementEl.classList.remove('hidden');
  announcementEl.classList.remove('win');
  announcementEl.classList.remove('lose');
  if (type === 'win') {
    announcementEl.classList.add('win');
  }
  if (type === 'lose') {
    announcementEl.classList.add('lose');
  }
}

function setStatus(message, duration = 150) {
  statusTextEl.textContent = message;
  statusTimer = duration;
}

function updateStatus(dt) {
  if (statusTimer > 0) {
    statusTimer -= dt;
    if (statusTimer <= 0 && gameState === 'running') {
      statusTextEl.textContent = player.powered
        ? 'Attack with K or Ctrl!'
        : 'Collect apples to power up!';
    }
  }
}

function handleCollisions() {
  for (let i = apples.length - 1; i >= 0; i -= 1) {
    const apple = apples[i];
    if (rectsOverlap(player.getBounds(), apple.getBounds())) {
      apples.splice(i, 1);
      player.collectApple();
      appleSpawnTimer = Math.min(appleSpawnTimer, 80);
    }
  }

  const dragonBounds = dragon.getBounds();
  const attackBounds = player.getAttackBounds();

  let landedHit = false;
  if (attackBounds && rectsOverlap(attackBounds, dragonBounds)) {
    dragon.takeHit();
    player.attackActive = false;
    landedHit = true;
  }

  if (!landedHit && rectsOverlap(player.getBounds(), dragonBounds)) {
    onDefeat();
  }
}

function drawBackground() {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGradient.addColorStop(0, '#6cc9ff');
  skyGradient.addColorStop(1, '#a8ddff');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

  const groundGradient = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
  groundGradient.addColorStop(0, '#c76b2b');
  groundGradient.addColorStop(0.65, '#8b4513');
  groundGradient.addColorStop(1, '#5b2a0b');
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, GROUND_HEIGHT);

  // Grass fringe
  ctx.fillStyle = '#2f8f31';
  ctx.fillRect(0, GROUND_Y - 6, CANVAS_WIDTH, 12);

  // Bricks decoration
  ctx.fillStyle = '#a4501e';
  const brickHeight = 14;
  const brickWidth = 36;
  for (let y = GROUND_Y; y < CANVAS_HEIGHT; y += brickHeight) {
    for (let x = (y / brickHeight) % 2 === 0 ? 0 : brickWidth / 2; x < CANVAS_WIDTH; x += brickWidth) {
      ctx.fillRect(x, y, brickWidth - 4, brickHeight - 2);
    }
  }

  // Hills
  const hillGradient = ctx.createLinearGradient(0, GROUND_Y - 40, 0, GROUND_Y - 200);
  hillGradient.addColorStop(0, '#2e9136');
  hillGradient.addColorStop(1, '#57c84d');
  ctx.fillStyle = hillGradient;
  ctx.beginPath();
  ctx.moveTo(-100, GROUND_Y);
  ctx.quadraticCurveTo(120, GROUND_Y - 180, 360, GROUND_Y);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(400, GROUND_Y);
  ctx.quadraticCurveTo(640, GROUND_Y - 160, 940, GROUND_Y);
  ctx.fill();

  // Clouds
  clouds.forEach((cloud) => {
    drawCloud(cloud.x, cloud.y, cloud.scale);
  });

  // Floating blocks
  drawBlock(260, GROUND_Y - 120, '#f3b500');
  drawBlock(320, GROUND_Y - 160, '#f3b500');
  drawBlock(380, GROUND_Y - 120, '#f3b500');
  drawBlock(620, GROUND_Y - 140, '#f3b500');
}

function drawCloud(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 28, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(24, -20, 34, Math.PI * 1, Math.PI * 1.9);
  ctx.arc(60, 0, 28, Math.PI * 1.1, Math.PI * 0.1);
  ctx.arc(28, 16, 26, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBlock(x, y, color) {
  const size = 48;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#a56700';
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
  ctx.fillStyle = '#ffe082';
  ctx.fillRect(x + 16, y + 16, size - 32, size - 32);
}

function updateGame(dt) {
  if (gameState === 'running') {
    player.update(dt);
    dragon.update(dt, player);

    appleSpawnTimer -= dt;
    if (appleSpawnTimer <= 0) {
      spawnApple();
      appleSpawnTimer = 140 + Math.random() * 120;
    }

    handleCollisions();
  }

  apples.forEach((apple) => apple.update(dt));
  updateStatus(dt);
}

function drawGame() {
  drawBackground();
  apples.forEach((apple) => apple.draw(ctx));
  player.draw(ctx);
  dragon.draw(ctx);
}

function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  const dt = Math.min(delta / (1000 / 60), 2);

  updateGame(dt);
  drawGame();

  requestAnimationFrame(gameLoop);
}

function handleKeyDown(e) {
  const controllableCodes = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'Space',
    'KeyA',
    'KeyD',
    'KeyW',
    'KeyK',
    'ControlLeft',
    'ControlRight'
  ]);
  if (controllableCodes.has(e.code)) {
    e.preventDefault();
  }

  if (e.code === 'Enter' && gameState !== 'running') {
    resetGame();
    return;
  }
  if (gameState !== 'running') {
    return;
  }

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      input.left = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      input.right = true;
      break;
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      player.jump();
      break;
    case 'KeyK':
    case 'ControlLeft':
    case 'ControlRight':
      player.tryAttack();
      break;
    default:
      break;
  }
}

function handleKeyUp(e) {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      input.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      input.right = false;
      break;
    default:
      break;
  }
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

resetGame();
requestAnimationFrame(gameLoop);
