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

  // SVG 地鼠图片 (可爱卡通风格)
  const moleImg = new Image();
  moleImg.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">
    <!-- 身体 -->
    <ellipse cx="60" cy="95" rx="42" ry="32" fill="#8B6914"/>
    <ellipse cx="60" cy="90" rx="38" ry="28" fill="#A0782C"/>
    <!-- 头 -->
    <circle cx="60" cy="55" r="32" fill="#A0782C"/>
    <circle cx="60" cy="52" r="30" fill="#B8923C"/>
    <!-- 耳朵 -->
    <ellipse cx="32" cy="32" rx="10" ry="12" fill="#A0782C"/>
    <ellipse cx="32" cy="32" rx="6" ry="8" fill="#D4A84C"/>
    <ellipse cx="88" cy="32" rx="10" ry="12" fill="#A0782C"/>
    <ellipse cx="88" cy="32" rx="6" ry="8" fill="#D4A84C"/>
    <!-- 脸部浅色 -->
    <ellipse cx="60" cy="62" rx="20" ry="16" fill="#D4B86C"/>
    <!-- 眼睛 -->
    <ellipse cx="45" cy="48" rx="8" ry="9" fill="white"/>
    <ellipse cx="75" cy="48" rx="8" ry="9" fill="white"/>
    <circle cx="47" cy="49" r="5" fill="#2c1810"/>
    <circle cx="77" cy="49" r="5" fill="#2c1810"/>
    <circle cx="48.5" cy="47" r="2" fill="white"/>
    <circle cx="78.5" cy="47" r="2" fill="white"/>
    <!-- 鼻子 -->
    <ellipse cx="60" cy="60" rx="6" ry="4.5" fill="#E85D75"/>
    <ellipse cx="60" cy="59" rx="4" ry="2.5" fill="#FF7B93" opacity="0.6"/>
    <!-- 嘴巴 -->
    <path d="M54 66 Q60 72 66 66" stroke="#7a4a1a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <!-- 胡须 -->
    <line x1="30" y1="58" x2="42" y2="60" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <line x1="28" y1="63" x2="42" y2="63" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="60" x2="90" y2="58" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="63" x2="92" y2="63" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <!-- 腮红 -->
    <circle cx="38" cy="60" r="5" fill="#FF9999" opacity="0.35"/>
    <circle cx="82" cy="60" r="5" fill="#FF9999" opacity="0.35"/>
  </svg>`);

  const moleHitImg = new Image();
  moleHitImg.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">
    <!-- 身体 -->
    <ellipse cx="60" cy="95" rx="42" ry="32" fill="#7a5a10"/>
    <ellipse cx="60" cy="90" rx="38" ry="28" fill="#907020"/>
    <!-- 头 -->
    <circle cx="60" cy="55" r="32" fill="#907020"/>
    <circle cx="60" cy="52" r="30" fill="#A8883A"/>
    <!-- 耳朵 -->
    <ellipse cx="32" cy="32" rx="10" ry="12" fill="#907020"/>
    <ellipse cx="32" cy="32" rx="6" ry="8" fill="#C09040"/>
    <ellipse cx="88" cy="32" rx="10" ry="12" fill="#907020"/>
    <ellipse cx="88" cy="32" rx="6" ry="8" fill="#C09040"/>
    <!-- 脸部浅色 -->
    <ellipse cx="60" cy="62" rx="20" ry="16" fill="#C0A060"/>
    <!-- 晕眩眼睛 (X形) -->
    <g stroke="#3a2010" stroke-width="2.5" stroke-linecap="round">
      <line x1="40" y1="43" x2="50" y2="53"/>
      <line x1="50" y1="43" x2="40" y2="53"/>
      <line x1="70" y1="43" x2="80" y2="53"/>
      <line x1="80" y1="43" x2="70" y2="53"/>
    </g>
    <!-- 鼻子 -->
    <ellipse cx="60" cy="60" rx="6" ry="4.5" fill="#D04060"/>
    <!-- 晕眩嘴 -->
    <ellipse cx="60" cy="68" rx="5" ry="3.5" fill="#7a4a1a"/>
    <!-- 胡须 -->
    <line x1="30" y1="58" x2="42" y2="60" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <line x1="28" y1="63" x2="42" y2="63" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="60" x2="90" y2="58" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="63" x2="92" y2="63" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <!-- 星星 -->
    <text x="20" y="30" font-size="14" fill="#FFD700">✦</text>
    <text x="88" y="25" font-size="12" fill="#FFD700">✦</text>
    <text x="55" y="20" font-size="10" fill="#FFD700">★</text>
  </svg>`);

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestWhack') || '0');
    bestEl.textContent = bestScore;
  }

  function init() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    moles = Array.from({length: ROWS * COLS}, () => ({active: false, hit: false, timer: 0, popProgress: 0, hitTimer: 0}));
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
    const inactiveMoles = moles.map((m, i) => ({m, i})).filter(x => !x.m.active && !x.m.hit);
    if (inactiveMoles.length === 0) return;
    const choice = inactiveMoles[Math.floor(Math.random() * inactiveMoles.length)];
    const mole = choice.m;
    mole.active = true;
    mole.hit = false;
    mole.popProgress = 0;
    mole.timer = setTimeout(() => {
      mole.active = false;
    }, 1200 + Math.random() * 1200);
  }

  function hitMole(index) {
    if (!gameRunning) return;
    const mole = moles[index];
    if (!mole.active || mole.hit) return;
    mole.active = false;
    mole.hit = true;
    mole.hitTimer = 15; // 显示晕眩地鼠的帧数
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
    // background - grass gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3a7a28');
    grad.addColorStop(0.5, '#2d5a1e');
    grad.addColorStop(1, '#1a3a10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 草地纹理
    ctx.strokeStyle = 'rgba(80,180,50,0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const gx = (i * 47 + 13) % W;
      const gy = (i * 31 + 7) % H;
      const gh = 6 + (i % 5) * 3;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + (i % 2 ? 3 : -3), gy - gh, gx + (i % 2 ? 1 : -1), gy - gh - 2);
      ctx.stroke();
    }

    // holes and moles
    const IMG_SIZE = CELL_W * 0.9;
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

      // 土堆装饰
      ctx.fillStyle = '#5a4020';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, HOLE_R * 1.15, HOLE_R * 0.25, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // 被打中的晕眩地鼠
      if (mole.hit) {
        mole.hitTimer--;
        if (mole.hitTimer > 0) {
          const alpha = mole.hitTimer / 15;
          const shake = Math.sin(mole.hitTimer * 2) * 3;
          const imgY = cy - IMG_SIZE * 0.6;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(shake, 0);
          // 用 clip 裁剪到地洞上方
          ctx.beginPath();
          ctx.rect(cx - IMG_SIZE, imgY, IMG_SIZE * 2, cy - imgY + 4);
          ctx.clip();
          ctx.drawImage(moleHitImg, cx - IMG_SIZE / 2, imgY, IMG_SIZE, IMG_SIZE);
          ctx.restore();
        } else {
          mole.hit = false;
        }
      }

      // 正常地鼠
      if (mole.active) {
        if (mole.popProgress < 1) mole.popProgress = Math.min(1, mole.popProgress + 0.06);
        const pop = easeOutBack(mole.popProgress);
        const imgY = cy - IMG_SIZE * pop * 0.6;
        ctx.save();
        // 用 clip 裁剪到地洞上方，地鼠从洞里冒出来
        ctx.beginPath();
        ctx.rect(cx - IMG_SIZE, imgY, IMG_SIZE * 2, cy - imgY + 4);
        ctx.clip();
        ctx.globalAlpha = pop;
        ctx.drawImage(moleImg, cx - IMG_SIZE / 2, imgY, IMG_SIZE, IMG_SIZE);
        ctx.restore();
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
