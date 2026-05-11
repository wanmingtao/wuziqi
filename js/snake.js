(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 400, H = 400;
  canvas.width = W; canvas.height = H;

  const scoreEl = document.getElementById('scoreDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const lenEl = document.getElementById('lengthDisplay');
  const overlay = document.getElementById('overlay');
  const resultScore = document.getElementById('resultScore');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const newGameBtn = document.getElementById('newGameBtn');

  const CELL = 20;
  const COLS = W / CELL, ROWS = H / CELL;

  let snake, food, particles;
  let dir, nextDir;
  let score, bestScore;
  let gameOver, paused;
  let gameTimer, interval;
  let bgStars = [];

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestSnake') || '0');
    bestEl.textContent = bestScore;
  }
  function saveBest() { if (score > bestScore) { bestScore = score; localStorage.setItem('bestSnake', bestScore); bestEl.textContent = bestScore; } }

  function resetGame() {
    score = 0; gameOver = false; paused = false;
    dir = 'right'; nextDir = 'right';
    interval = 140;
    overlay.classList.add('hidden');

    snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
    particles = [];
    spawnFood();
    updateUI();

    if (gameTimer) { clearInterval(gameTimer); }
    gameTimer = setInterval(tick, interval);
  }

  function spawnFood() {
    const occupied = new Set(snake.map(s => s.x + ',' + s.y));
    const empty = [];
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        if (!occupied.has(x + ',' + y)) empty.push({ x, y });
    if (empty.length === 0) return;
    food = empty[Math.floor(Math.random() * empty.length)];
    food.type = Math.random() < 0.15 ? 'bonus' : 'normal';
  }

  function tick() {
    if (gameOver || paused) return;

    dir = nextDir;
    const head = { ...snake[0] };
    switch (dir) {
      case 'up':    head.y--; break;
      case 'down':  head.y++; break;
      case 'left':  head.x--; break;
      case 'right': head.x++; break;
    }

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      die(); return;
    }

    // Self collision
    for (const seg of snake) {
      if (head.x === seg.x && head.y === seg.y) {
        die(); return;
      }
    }

    snake.unshift(head);

    // Food
    if (head.x === food.x && head.y === food.y) {
      score += food.type === 'bonus' ? 3 : 1;
      updateUI();
      saveBest();
      spawnParticles(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, food.type === 'bonus' ? '#d500f9' : '#ff1744', 8);
      spawnFood();
      // Speed up
      if (score % 5 === 0) {
        interval = Math.max(60, interval - 8);
        clearInterval(gameTimer);
        gameTimer = setInterval(tick, interval);
      }
    } else {
      snake.pop();
    }

    updateUI();
  }

  function die() {
    gameOver = true;
    saveBest();
    spawnParticles(snake[0].x * CELL + CELL / 2, snake[0].y * CELL + CELL / 2, '#ff1744', 20);
    resultScore.textContent = '得分: ' + score;
    overlay.classList.remove('hidden');
    clearInterval(gameTimer);
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 15 + Math.random() * 15, color, size: 2 + Math.random() * 2 });
    }
  }

  function updateUI() {
    scoreEl.textContent = score;
    lenEl.textContent = snake.length;
  }

  function render() {
    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
    }

    // Food
    ctx.shadowColor = food.type === 'bonus' ? '#d500f9' : '#ff1744';
    ctx.shadowBlur = 14;

    // Food glow ring
    ctx.fillStyle = food.type === 'bonus' ? 'rgba(213,0,249,0.2)' : 'rgba(255,23,68,0.2)';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Food body
    const fGrad = ctx.createRadialGradient(food.x * CELL + 5, food.y * CELL + 5, 2, food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.5);
    if (food.type === 'bonus') {
      fGrad.addColorStop(0, '#ea80fc');
      fGrad.addColorStop(1, '#d500f9');
    } else {
      fGrad.addColorStop(0, '#ff5252');
      fGrad.addColorStop(1, '#ff1744');
    }
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Snake
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const px = seg.x * CELL, py = seg.y * CELL;
      const t = 1 - i / snake.length;

      // Glow on head
      if (i === 0) {
        ctx.shadowColor = '#76ff03';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 0;
      }

      const gradient = ctx.createLinearGradient(px, py, px + CELL, py + CELL);
      const r = Math.floor(118 * t);
      const g = Math.floor(255 * t);
      const b = Math.floor(3 * t);
      gradient.addColorStop(0, `rgb(${r + 20}, ${g}, ${b})`);
      gradient.addColorStop(1, `rgb(${r}, ${Math.max(100, g - 60)}, ${b})`);

      ctx.fillStyle = gradient;

      if (i === 0) {
        // Head: rounded
        roundRect(ctx, px + 1, py + 1, CELL - 2, CELL - 2, 5);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        const eyeOff = 4;
        if (dir === 'up' || dir === 'down') {
          ctx.beginPath(); ctx.arc(px + 6, py + (dir === 'up' ? 5 : 14), 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(px + 14, py + (dir === 'up' ? 5 : 14), 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(px + (dir === 'right' ? 14 : 5), py + 6, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(px + (dir === 'right' ? 14 : 5), py + 14, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.shadowBlur = 0;
        roundRect(ctx, px + 1, py + 1, CELL - 2, CELL - 2, 4);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;

    // Particles
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.life > 0);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function loop() { render(); requestAnimationFrame(loop); }

  function bindInput() {
    document.addEventListener('keydown', e => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (map[e.key]) {
        e.preventDefault();
        const nd = map[e.key];
        const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
        if (opp[nd] !== dir) nextDir = nd;
      }
      if (e.key === 'p' || e.key === 'P') togglePause();
    });

    // Touch dpad
    document.querySelectorAll('.touch-btn').forEach(btn => {
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const nd = btn.dataset.dir;
        if (gameOver) return;
        const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
        if (opp[nd] !== dir) nextDir = nd;
      }, { passive: false });
    });

    // Swipe on canvas
    let sx = 0, sy = 0;
    canvas.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      if (gameOver) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 15 && ay < 15) return;
      let nd;
      if (ax > ay) nd = dx > 0 ? 'right' : 'left';
      else nd = dy > 0 ? 'down' : 'up';
      const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (opp[nd] !== dir) nextDir = nd;
    }, { passive: true });

    pauseBtn.addEventListener('click', togglePause);
    newGameBtn.addEventListener('click', () => { clearInterval(gameTimer); resetGame(); });
    restartBtn.addEventListener('click', () => { clearInterval(gameTimer); resetGame(); });
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '继续' : '暂停';
  }

  function init() {
    loadBest();
    resetGame();
    bindInput();
    loop();
  }
  init();
})();
