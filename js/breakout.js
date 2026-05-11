(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 400, H = 500;
  canvas.width = W; canvas.height = H;

  const scoreEl = document.getElementById('scoreDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const livesEl = document.getElementById('livesDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultScore = document.getElementById('resultScore');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const newGameBtn = document.getElementById('newGameBtn');

  const PADDLE_W = 70, PADDLE_H = 10;
  const BALL_R = 6;
  const BALL_SPEED = 5;
  const BRICK_W = 42, BRICK_H = 14;
  const BRICK_ROWS = 8, BRICK_COLS = 8;
  const BRICK_TOP = 35;
  const BRICK_LEFT = (W - BRICK_COLS * (BRICK_W + 4)) / 2 + 2;
  const MAX_LIVES = 3;

  const BRICK_COLORS = ['#ff1744','#ff9100','#ffd600','#76ff03','#00e5ff','#2979ff','#d500f9','#ff4081'];

  let paddle, ball, bricks, particles, powerups;
  let score, bestScore, lives;
  let gameOver, paused, won;
  let keys = {}, mouseX = -1, animFrame;

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestBreakout') || '0');
    bestEl.textContent = bestScore;
  }
  function saveBest() { if (score > bestScore) { bestScore = score; localStorage.setItem('bestBreakout', bestScore); bestEl.textContent = bestScore; } }

  function resetGame() {
    score = 0; lives = MAX_LIVES; gameOver = false; paused = false; won = false;
    overlay.classList.add('hidden');

    paddle = { x: W / 2 - PADDLE_W / 2, y: H - 30, w: PADDLE_W, h: PADDLE_H };
    ball = { x: W / 2, y: H - 45, r: BALL_R, vx: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1), vy: -BALL_SPEED, stuck: true };
    particles = []; powerups = [];

    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_LEFT + c * (BRICK_W + 4),
          y: BRICK_TOP + r * (BRICK_H + 4),
          w: BRICK_W, h: BRICK_H,
          alive: true,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
          hp: r < 2 ? 2 : 1,
        });
      }
    }
    updateUI();
  }

  function updateUI() {
    scoreEl.textContent = score;
    livesEl.textContent = '♥'.repeat(Math.max(0, lives));
  }

  function update() {
    if (gameOver || paused) return;

    // Paddle movement
    if (mouseX >= 0) {
      paddle.x = mouseX - paddle.w / 2;
    }
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) paddle.x -= 5;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) paddle.x += 5;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

    // Ball stuck on paddle
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - BALL_R;
      if (keys[' '] || mouseX < -1) { ball.stuck = false; mouseX = -1; }
      return;
    }

    // Ball movement
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounce
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    // Bottom - lose life
    if (ball.y + ball.r > H) {
      lives--;
      updateUI();
      if (lives <= 0) {
        gameOver = true; saveBest();
        resultTitle.textContent = '游戏结束'; resultScore.textContent = '得分: ' + score;
        overlay.classList.remove('hidden');
        return;
      }
      ball.stuck = true;
      return;
    }

    // Paddle collision
    if (ball.vy > 0 &&
        ball.y + ball.r >= paddle.y &&
        ball.y + ball.r <= paddle.y + paddle.h + ball.vy &&
        ball.x + ball.r > paddle.x && ball.x - ball.r < paddle.x + paddle.w) {
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle = hit * 0.75;
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);
      ball.y = paddle.y - ball.r;
      // Minimum speed
      if (Math.abs(ball.vy) < 3) ball.vy = -3;
    }

    // Brick collision
    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (ball.x + ball.r > brick.x && ball.x - ball.r < brick.x + brick.w &&
          ball.y + ball.r > brick.y && ball.y - ball.r < brick.y + brick.h) {
        // Determine bounce direction
        const overlapX = ball.x < brick.x + brick.w / 2 ? brick.x - (ball.x - ball.r) : (ball.x + ball.r) - (brick.x + brick.w);
        const overlapY = ball.y < brick.y + brick.h / 2 ? brick.y - (ball.y - ball.r) : (ball.y + ball.r) - (brick.y + brick.h);
        if (overlapX < overlapY) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;

        brick.hp--;
        if (brick.hp <= 0) {
          brick.alive = false;
          score += 10 * (BRICK_ROWS - Math.floor((brick.y - BRICK_TOP) / (BRICK_H + 4)));
          updateUI();
          spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 8);

          // Powerup chance
          if (Math.random() < 0.12) {
            powerups.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: 2, type: 'wide', alive: true });
          }
        } else {
          spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, '#fff', 3);
        }
        break;
      }
    }

    // Check win
    if (bricks.every(b => !b.alive)) {
      won = true; gameOver = true; saveBest();
      resultTitle.textContent = '恭喜通关！'; resultScore.textContent = '得分: ' + score;
      overlay.classList.remove('hidden');
      spawnParticles(W / 2, H / 2, '#f5a623', 30);
      return;
    }

    // Powerups
    for (const pu of powerups) {
      if (!pu.alive) continue;
      pu.y += pu.vy;
      if (pu.y > H) { pu.alive = false; continue; }
      if (pu.y + 8 > paddle.y && pu.y < paddle.y + paddle.h &&
          pu.x > paddle.x && pu.x < paddle.x + paddle.w) {
        pu.alive = false;
        if (pu.type === 'wide') { paddle.w = Math.min(120, paddle.w + 20); }
        spawnParticles(pu.x, pu.y, '#f5a623', 6);
      }
    }
    powerups = powerups.filter(p => p.alive);

    // Particles
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--; }
    particles = particles.filter(p => p.life > 0);
  }

  function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5 - 2, life: 20 + Math.random() * 20, color, size: 2 + Math.random() * 3 });
    }
  }

  function render() {
    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Bricks
    for (const brick of bricks) {
      if (!brick.alive) continue;
      const alpha = brick.hp === 2 ? 1 : 0.7;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = brick.color;
      roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(brick.x + 3, brick.y + 2, brick.w - 6, brick.h * 0.4);
      ctx.globalAlpha = 1;
    }

    // Powerups
    for (const pu of powerups) {
      if (!pu.alive) continue;
      ctx.shadowColor = '#f5a623';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', pu.x, pu.y + 1);
    }

    // Paddle
    ctx.shadowColor = '#2979ff';
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
    grad.addColorStop(0, '#2979ff');
    grad.addColorStop(1, '#1a5bbf');
    ctx.fillStyle = grad;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(paddle.x + 4, paddle.y + 2, paddle.w - 8, 3);

    // Ball
    ctx.shadowColor = '#76ff03';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#76ff03';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function loop() {
    update(); render();
    animFrame = requestAnimationFrame(loop);
  }

  function bindInput() {
    document.addEventListener('keydown', e => {
      keys[e.key] = true;
      if (e.key === ' ' && ball.stuck) { ball.stuck = false; e.preventDefault(); }
      if (e.key === 'p' || e.key === 'P') togglePause();
    });
    document.addEventListener('keyup', e => { keys[e.key] = false; });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width * W;
    });
    canvas.addEventListener('mouseleave', () => { mouseX = -1; });

    canvas.addEventListener('touchstart', e => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouseX = (touch.clientX - rect.left) / rect.width * W;
      if (ball.stuck) { ball.stuck = false; }
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouseX = (touch.clientX - rect.left) / rect.width * W;
    }, { passive: true });

    pauseBtn.addEventListener('click', togglePause);
    newGameBtn.addEventListener('click', resetGame);
    restartBtn.addEventListener('click', resetGame);
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '继续' : '暂停';
  }

  init();
  function init() {
    loadBest();
    resetGame();
    bindInput();
    loop();
  }
})();
