(function() {
  'use strict';

  // ── Canvas Setup ──────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const W = 300, H = 400;
  canvas.width = W;
  canvas.height = H;

  // ── DOM refs ──────────────────────────────────
  const scoreEl = document.getElementById('scoreDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlayContent');
  const finalScoreEl = document.getElementById('finalScore');

  // ── Constants ─────────────────────────────────
  const GRAVITY = 0.5;
  const JUMP_VEL = -10;
  const MOVE_SPEED = 3.5;
  const PLATFORM_W = 48;
  const PLATFORM_H = 10;
  const PLAYER_W = 20;
  const PLAYER_H = 24;
  const PLATFORM_GAP = { min: 50, max: 75 };
  const MAX_PLATFORMS = 30;

  // ── Game State ────────────────────────────────
  let player, platforms, particles, bgStars;
  let score, bestScore;
  let gameOver, paused;
  let cameraY, maxHeight;
  let keys = {};
  let animFrameId;
  let touchLeft = false, touchRight = false;
  let bgOffset = 0;

  // ── Load best ─────────────────────────────────
  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestDoodle') || '0');
    bestEl.textContent = bestScore;
  }
  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestDoodle', bestScore);
      bestEl.textContent = bestScore;
    }
  }

  // ── Init ──────────────────────────────────────
  function init() {
    initBg();
    loadBest();
    resetGame();
    bindInput();
    requestAnimationFrame(loop);
  }

  function resetGame() {
    score = 0;
    gameOver = false;
    paused = false;
    maxHeight = 0;
    cameraY = 0;
    particles = [];

    player = {
      x: W / 2 - PLAYER_W / 2,
      y: H - 100,
      vy: 0,
      w: PLAYER_W,
      h: PLAYER_H,
      onPlatform: false,
      dir: 1,
      anim: 0,
      animTimer: 0,
    };

    platforms = [];
    // Starting platform
    platforms.push({
      x: player.x - 14,
      y: player.y + PLAYER_H,
      w: PLATFORM_W,
      h: PLATFORM_H,
      type: 'normal',
      broken: false,
      origX: 0,
      moveRange: 0,
      moveSpeed: 0,
    });

    // Generate platforms upward
    let py = player.y - 40;
    while (py > cameraY - H) {
      generatePlatform(py);
      py -= PLATFORM_GAP.min + Math.random() * (PLATFORM_GAP.max - PLATFORM_GAP.min);
    }

    overlay.classList.add('hidden');
    updateScore();
    updateBest();
  }

  function generatePlatform(y) {
    const typeRoll = Math.random();
    let type = 'normal';
    if (maxHeight > 200 && typeRoll < 0.12) type = 'moving';
    else if (maxHeight > 100 && typeRoll < 0.2) type = 'breakable';

    const x = 10 + Math.random() * (W - PLATFORM_W - 20);
    const plat = {
      x, y,
      w: PLATFORM_W,
      h: PLATFORM_H,
      type,
      broken: false,
      origX: x,
      moveRange: type === 'moving' ? (20 + Math.random() * 40) : 0,
      moveSpeed: type === 'moving' ? (0.5 + Math.random() * 1) : 0,
    };
    // Ensure platforms don't overlap horizontally too much
    for (const p of platforms) {
      if (Math.abs(p.y - y) < 20 && Math.abs(p.x - x) < PLATFORM_W) {
        plat.x = Math.max(10, Math.min(W - PLATFORM_W - 10, x + (Math.random() > 0.5 ? 50 : -50)));
        break;
      }
    }
    platforms.push(plat);
  }

  // ── Input ─────────────────────────────────────
  function bindInput() {
    document.addEventListener('keydown', e => {
      keys[e.key] = true;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    });
    document.addEventListener('keyup', e => {
      keys[e.key] = false;
    });

    document.getElementById('touchLeft').addEventListener('pointerdown', e => {
      e.preventDefault(); touchLeft = true;
    });
    document.getElementById('touchLeft').addEventListener('pointerup', e => {
      e.preventDefault(); touchLeft = false;
    });
    document.getElementById('touchLeft').addEventListener('pointerleave', () => { touchLeft = false; });
    document.getElementById('touchRight').addEventListener('pointerdown', e => {
      e.preventDefault(); touchRight = true;
    });
    document.getElementById('touchRight').addEventListener('pointerup', e => {
      e.preventDefault(); touchRight = false;
    });
    document.getElementById('touchRight').addEventListener('pointerleave', () => { touchRight = false; });

    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('newGameBtn').addEventListener('click', () => { resetGame(); });
    document.getElementById('restartBtn').addEventListener('click', () => { resetGame(); });
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    document.getElementById('pauseBtn').textContent = paused ? '继续' : '暂停';
  }

  // ── Background ────────────────────────────────
  function initBg() {
    bgStars = [];
    for (let i = 0; i < 80; i++) {
      bgStars.push({
        x: Math.random() * W,
        y: Math.random() * H * 3,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.5 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  // ── Update ────────────────────────────────────
  function update() {
    if (gameOver || paused) return;

    // Player horizontal movement
    let moveX = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A'] || touchLeft) moveX = -MOVE_SPEED;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || touchRight) moveX = MOVE_SPEED;
    if (moveX !== 0) player.dir = moveX > 0 ? 1 : -1;

    player.x += moveX;

    // Wrap around screen
    if (player.x + player.w < 0) player.x = W;
    if (player.x > W) player.x = -player.w;

    // Gravity
    player.vy += GRAVITY;
    player.y += player.vy;

    // Platform collision
    player.onPlatform = false;
    for (const p of platforms) {
      if (p.broken) continue;
      // Check if player is falling and landing on platform
      if (player.vy > 0 &&
          player.y + player.h >= p.y &&
          player.y + player.h <= p.y + p.h + Math.abs(player.vy) + 2 &&
          player.x + player.w > p.x + 4 &&
          player.x < p.x + p.w - 4) {
        player.y = p.y - player.h;
        player.vy = JUMP_VEL;
        player.onPlatform = true;

        // Breakable platform
        if (p.type === 'breakable') {
          p.broken = true;
          spawnParticles(p.x + p.w / 2, p.y, '#ff1744', 6);
        }

        // Score
        const pScore = Math.floor(p.y);
        if (pScore > maxHeight) {
          maxHeight = pScore;
          score = Math.floor(maxHeight / 3);
          updateScore();
        }
        break;
      }
    }

    // Update moving platforms
    for (const p of platforms) {
      if (p.type === 'moving' && !p.broken) {
        p.x = p.origX + Math.sin(Date.now() / 1000 * p.moveSpeed) * p.moveRange;
      }
    }

    // Fall off screen
    if (player.y > H + 50) {
      gameOver = true;
      saveBest();
      finalScoreEl.textContent = '得分: ' + score;
      overlay.classList.remove('hidden');
      spawnParticles(W / 2, H / 2, '#f5a623', 20);
      return;
    }

    // Camera follow (only scroll up)
    if (player.y < H * 0.4) {
      const diff = H * 0.4 - player.y;
      cameraY += diff;
      player.y += diff;
      for (const p of platforms) {
        p.y += diff;
      }
    }

    // Remove off-screen platforms and generate new ones
    platforms = platforms.filter(p => p.y < H + 50);

    // Generate new platforms above
    let highestY = Math.min(...platforms.map(p => p.y));
    while (highestY > -50) {
      const newY = highestY - (PLATFORM_GAP.min + Math.random() * (PLATFORM_GAP.max - PLATFORM_GAP.min));
      generatePlatform(newY);
      highestY = newY;
    }

    // Limit platform count
    if (platforms.length > MAX_PLATFORMS) {
      platforms = platforms.slice(platforms.length - MAX_PLATFORMS);
    }

    // Particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);

    // Player animation
    if (player.onPlatform || Math.abs(player.vy) < 1) {
      player.animTimer++;
      if (player.animTimer > 5) {
        player.animTimer = 0;
        player.anim = (player.anim + 1) % 4;
      }
    }

    bgOffset += 0.3;
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 2,
        life: 20 + Math.random() * 20,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  // ── Render ────────────────────────────────────
  function render() {
    // Background gradient
    const heightRatio = Math.min(1, maxHeight / 2000);
    const r = Math.floor(10 + heightRatio * 20);
    const g = Math.floor(10 + heightRatio * 5);
    const b = Math.floor(42 - heightRatio * 20);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
    grad.addColorStop(0.5, `rgb(${r + 5}, ${g + 5}, ${b + 5})`);
    grad.addColorStop(1, `rgb(${r + 3}, ${g + 8}, ${b + 3})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const star of bgStars) {
      const sy = ((star.y + bgOffset * 0.2) % (H * 3));
      ctx.globalAlpha = star.a + Math.sin(star.twinkle + Date.now() / 1000) * 0.15;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(star.x, sy, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Platforms (only visible ones)
    for (const p of platforms) {
      if (p.broken) continue;
      if (p.y < -20 || p.y > H + 20) continue;

      const px = p.x, py = p.y, pw = p.w, ph = p.h;

      // Platform shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + ph, pw * 0.7, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Platform body
      let color, glow;
      if (p.type === 'normal') {
        color = '#76ff03';
        glow = 'rgba(118,255,3,0.3)';
      } else if (p.type === 'moving') {
        color = '#2979ff';
        glow = 'rgba(41,121,255,0.3)';
      } else if (p.type === 'breakable') {
        color = '#ff1744';
        glow = 'rgba(255,23,68,0.3)';
      }

      // Glow
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;

      // Rounded rect
      const rad = 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(px + rad, py);
      ctx.lineTo(px + pw - rad, py);
      ctx.quadraticCurveTo(px + pw, py, px + pw, py + rad);
      ctx.lineTo(px + pw, py + ph - rad);
      ctx.quadraticCurveTo(px + pw, py + ph, px + pw - rad, py + ph);
      ctx.lineTo(px + rad, py + ph);
      ctx.quadraticCurveTo(px, py + ph, px, py + ph - rad);
      ctx.lineTo(px, py + rad);
      ctx.quadraticCurveTo(px, py, px + rad, py);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(px + 4, py + 2, pw - 8, ph / 3);

      // Breakable crack mark
      if (p.type === 'breakable') {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 10, py + 3);
        ctx.lineTo(px + 18, py + ph - 3);
        ctx.lineTo(px + 24, py + 5);
        ctx.lineTo(px + 30, py + ph - 4);
        ctx.lineTo(px + 38, py + 4);
        ctx.stroke();
      }
    }

    // Player
    const px = player.x, py = player.y;
    const bobY = player.onPlatform ? Math.sin(player.anim * Math.PI / 2) * 1.5 : 0;

    // Player shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(px + PLAYER_W / 2, py + PLAYER_H + 2, PLAYER_W * 0.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.shadowColor = 'rgba(118,255,3,0.2)';
    ctx.shadowBlur = 8;

    // Circle body
    const cx = px + PLAYER_W / 2;
    const cy = py + PLAYER_H / 2 + bobY;
    const rad = PLAYER_W / 2;

    // Gradient body
    const bodyGrad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, rad);
    bodyGrad.addColorStop(0, '#76ff03');
    bodyGrad.addColorStop(0.7, '#64dd17');
    bodyGrad.addColorStop(1, '#33691e');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes
    const eyeOff = player.dir * 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 5 + eyeOff, cy - 4, 4, 0, Math.PI * 2);
    ctx.arc(cx + 5 + eyeOff, cy - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx - 4 + eyeOff, cy - 4, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6 + eyeOff, cy - 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + eyeOff * 0.5, cy + 4, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function updateScore() {
    scoreEl.textContent = score;
  }
  function updateBest() {
    bestEl.textContent = bestScore;
  }

  // ── Loop ──────────────────────────────────────
  function loop() {
    update();
    render();
    animFrameId = requestAnimationFrame(loop);
  }

  // ── Start ─────────────────────────────────────
  init();

})();
