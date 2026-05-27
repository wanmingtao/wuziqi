(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 480, H = 480;
  canvas.width = W; canvas.height = H;

  const scoreEl = document.getElementById('scoreDisplay');
  const timeEl = document.getElementById('timeDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const startBtn = document.getElementById('startBtn');

  const COLS = 3, ROWS = 3;
  const CELL_W = W / COLS, CELL_H = H / ROWS;
  const HOLE_R = CELL_W * 0.3;

  let moles, score, bestScore, timeLeft, gameRunning;
  let timer, spawnInterval, animFrameId;
  let hitEffects = [];
  let popAnims = [];
  let particles = [];

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestWhack') || '0');
    bestEl.textContent = bestScore;
  }

  function init() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    moles = Array.from({length: ROWS * COLS}, () => ({active: false, timer: 0, popProgress: 0}));
    score = 0;
    timeLeft = 30;
    gameRunning = false;
    hitEffects = [];
    popAnims = [];
    particles = [];
    scoreEl.textContent = '0';
    timeEl.textContent = '30';
    loadBest();
    draw();
  }

  function startGame() {
    // 清除旧定时器防止泄漏
    if (timer) clearInterval(timer);
    if (spawnInterval) clearInterval(spawnInterval);
    timer = null;
    spawnInterval = null;
    init();
    overlay.classList.add('hidden');
    gameRunning = true;
    // spawn timer
    spawnInterval = setInterval(() => {
      if (!gameRunning) { clearInterval(spawnInterval); return; }
      spawnMole();
    }, 600);
    // countdown
    timer = setInterval(() => {
      if (!gameRunning) return;
      timeLeft--;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        gameRunning = false;
        clearInterval(timer);
        clearInterval(spawnInterval);
        endGame();
      }
    }, 1000);
  }

  function spawnMole() {
    const inactiveMoles = moles.map((m, i) => ({m, i})).filter(x => !x.m.active);
    if (inactiveMoles.length === 0) return;
    const choice = inactiveMoles[Math.floor(Math.random() * inactiveMoles.length)];
    const mole = choice.m;
    mole.active = true;
    mole.popProgress = 0;
    mole.timer = setTimeout(() => {
      mole.active = false;
    }, 1000 + Math.random() * 1000);
  }

  function hitMole(index) {
    if (!gameRunning) return;
    const mole = moles[index];
    if (!mole.active) return;
    mole.active = false;
    clearTimeout(mole.timer);
    score += 10;
    scoreEl.textContent = score;
    // effects
    const cx = (index % COLS) * CELL_W + CELL_W / 2;
    const cy = Math.floor(index / COLS) * CELL_H + CELL_H / 2;
    hitEffects.push({x: cx, y: cy, r: 0, maxR: 40, alpha: 1});
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particles.push({x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 2, r: Math.random()*4+2, life: 1, color: `hsl(${Math.random()*60+30},100%,60%)`});
    }
    // combo text
    hitEffects.push({x: cx, y: cy - 30, text: '+10', alpha: 1, vy: -1.5});
  }

  function endGame() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestWhack', bestScore);
      bestEl.textContent = bestScore;
      resultTitle.textContent = '🎉 新纪录！';
    } else {
      resultTitle.textContent = '⏱️ 时间到！';
    }
    resultText.textContent = `得分: ${score}`;
    startBtn.textContent = '再来一局';
    overlay.classList.remove('hidden');
  }

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);
    // background - grass
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2d5a1e');
    grad.addColorStop(1, '#1a3a10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // holes and moles
    for (let i = 0; i < ROWS * COLS; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = col * CELL_W + CELL_W / 2;
      const cy = row * CELL_H + CELL_H / 2 + 20;
      const mole = moles[i];

      // hole shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + HOLE_R * 0.3, HOLE_R * 1.2, HOLE_R * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // hole
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, HOLE_R * 1.1, HOLE_R * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (mole.active) {
        // update pop progress
        if (mole.popProgress < 1) mole.popProgress = Math.min(1, mole.popProgress + 0.08);
        const pop = easeOutBack(mole.popProgress);

        // mole body
        const moleY = cy - HOLE_R * pop;
        // body
        ctx.fillStyle = '#8B6914';
        ctx.beginPath();
        ctx.ellipse(cx, moleY, HOLE_R * 0.6 * pop, HOLE_R * 0.7 * pop, 0, 0, Math.PI * 2);
        ctx.fill();
        // head
        ctx.fillStyle = '#A0782C';
        ctx.beginPath();
        ctx.arc(cx, moleY - HOLE_R * 0.3 * pop, HOLE_R * 0.5 * pop, 0, Math.PI * 2);
        ctx.fill();
        // eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 8 * pop, moleY - HOLE_R * 0.35 * pop, 5 * pop, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 8 * pop, moleY - HOLE_R * 0.35 * pop, 5 * pop, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - 7 * pop, moleY - HOLE_R * 0.35 * pop, 2.5 * pop, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 9 * pop, moleY - HOLE_R * 0.35 * pop, 2.5 * pop, 0, Math.PI * 2);
        ctx.fill();
        // nose
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(cx, moleY - HOLE_R * 0.15 * pop, 4 * pop, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // hit effects
    for (let i = hitEffects.length - 1; i >= 0; i--) {
      const e = hitEffects[i];
      if (e.text) {
        ctx.globalAlpha = e.alpha;
        ctx.fillStyle = '#ffe040';
        ctx.font = `bold ${20}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(e.text, e.x, e.y);
        ctx.globalAlpha = 1;
        e.y += e.vy;
        e.alpha -= 0.02;
        if (e.alpha <= 0) hitEffects.splice(i, 1);
      } else {
        ctx.globalAlpha = e.alpha;
        ctx.strokeStyle = '#ffe040';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        e.r += 3;
        e.alpha -= 0.04;
        if (e.alpha <= 0) hitEffects.splice(i, 1);
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.025;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function getClickIndex(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) return row * COLS + col;
    return -1;
  }

  canvas.addEventListener('click', e => {
    const idx = getClickIndex(e.clientX, e.clientY);
    if (idx >= 0) hitMole(idx);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const idx = getClickIndex(touch.clientX, touch.clientY);
    if (idx >= 0) hitMole(idx);
  }, {passive: false});

  startBtn.addEventListener('click', startGame);

  // background
  const bgCanvas = document.getElementById('bgCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  let bgParticles = [];
  function bgResize() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
  window.addEventListener('resize', bgResize); bgResize();
  class BgP {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * bgCanvas.width;
      this.y = Math.random() * bgCanvas.height;
      this.r = Math.random() * 2 + 0.5;
      this.dx = Math.random() * 0.3 - 0.15;
      this.dy = Math.random() * 0.3 - 0.15;
      this.a = Math.random() * 0.3 + 0.1;
      this.h = Math.random() * 60 + 280;
    }
    update() { this.x += this.dx; this.y += this.dy; if (this.x<-10||this.x>bgCanvas.width+10||this.y<-10||this.y>bgCanvas.height+10) this.reset(); }
    draw(c) { c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2); c.fillStyle = `hsla(${this.h},60%,50%,${this.a})`; c.fill(); }
  }
  for (let i = 0; i < 40; i++) bgParticles.push(new BgP());
  function bgAnim() { bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height); for (const p of bgParticles) { p.update(); p.draw(bgCtx); } requestAnimationFrame(bgAnim); }
  bgAnim();

  init();
})();
