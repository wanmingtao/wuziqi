(function() {
  'use strict';

  // GSAP fallback - 若未加载则创建最小 shim
  if (typeof gsap === 'undefined') {
    window.gsap = {
      to: () => ({ kill: () => {} }),
      fromTo: () => ({ kill: () => {} }),
      set: () => {},
      delayedCall: (d, fn) => setTimeout(fn, d * 1000),
      killTweensOf: () => {},
    };
  }

  /* ========== DOM ========== */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gameContainer = document.getElementById('gameContainer');

  const scoreEl = document.getElementById('scoreDisplay');
  const livesEl = document.getElementById('livesDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlayContent');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const startBtn = document.getElementById('startBtn');
  const comboDisplay = document.getElementById('comboDisplay');
  const comboText = document.getElementById('comboText');
  const comboBarFill = document.getElementById('comboBarFill');
  const screenFlash = document.getElementById('screenFlash');
  const borderGlow = document.getElementById('borderGlow');
  const hintText = document.getElementById('hintText');
  const scoreHud = document.getElementById('scoreHud');
  const livesHud = document.getElementById('livesHud');

  /* ========== 常量 ========== */
  const FRUITS = ['🍉', '🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍌', '🥝'];
  const BOMB = '💣';
  const JUICE = {
    '🍉': '#ff5252', '🍎': '#ff1744', '🍊': '#ff9100', '🍋': '#ffd600',
    '🍇': '#aa00ff', '🍓': '#f50057', '🍑': '#ffab91', '🍌': '#ffee58', '🥝': '#76ff03',
  };
  const MAX_LIVES = 3;
  const COMBO_WINDOW = 2000;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const MAX_DPR = 2;          // 高分屏清晰度上限
  const TRAIL_MAX = 20;       // 单根刀光最大采样点数

  /* ========== 世界尺寸（逻辑坐标 = CSS 像素） ========== */
  let W = 0, H = 0, DPR = 1;

  /* ========== 状态 ========== */
  let fruits = [];        // 飞行的水果/炸弹
  let halves = [];        // 被切成的两半
  let particles = [];     // 果汁粒子
  let trails = [];        // 忍者刀光轨迹（每根手指一条）
  let score, bestScore, lives, gameRunning;
  let gameTimeMs, difficulty, spawnAcc, spawnInterval;
  let combo, lastSliceTime;
  let animFrameId, lastT = 0;

  const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));
  const worldSize = () => Math.min(W, H);

  /* ========== 工具 ========== */
  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestFruitNinja') || '0');
    bestEl.textContent = bestScore;
  }
  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestFruitNinja', bestScore);
      bestEl.textContent = bestScore;
    }
  }

  let activeTweens = [];
  function killAllTweens() {
    activeTweens.forEach(t => t && t.kill && t.kill());
    activeTweens = [];
    ['gameContainer', 'screenFlash', 'borderGlow', 'comboDisplay', 'comboText',
     'canvas', 'scoreHud', 'livesHud', 'overlayContent', 'resultTitle',
     'startBtn', 'hintText'].forEach(id => gsap.killTweensOf(document.getElementById(id)));
  }

  /* ========== 音效（WebAudio 合成，无外部资源） ========== */
  let audioCtx = null;
  function playSliceSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, t);
      osc.frequency.exponentialRampToValueAtTime(500, t + 0.1);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.15);
    } catch (e) { /* 忽略音频错误 */ }
  }
  function playBombSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.5);
    } catch (e) { /* 忽略音频错误 */ }
  }
  function playMissSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.2);
    } catch (e) { /* 忽略音频错误 */ }
  }

  /* ========== 画布自适应（DPR 感知，全屏玩法区） ========== */
  function resizePlayfield() {
    DPR = clampNum(window.devicePixelRatio || 1, 1, MAX_DPR);
    const w = gameContainer.clientWidth;
    const h = gameContainer.clientHeight;
    if (!w || !h) return;
    W = w;
    H = h;
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function fitAll() { resizePlayfield(); bgResize(); }
  window.addEventListener('resize', fitAll);
  window.addEventListener('orientationchange', () => setTimeout(fitAll, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitAll);

  /* ========== 生成水果（物理随屏幕高度归一化） ========== */
  function fruitRadius(isBomb) {
    // 半径按屏幕短边缩放，保证任意手机上目标都大于指尖
    const base = clampNum(worldSize() * 0.062, 24, 48);
    return isBomb ? base : base + Math.random() * worldSize() * 0.014;
  }
  function spawnIntervalFor(diff) {
    // 高屏略快、矮屏略慢，保持水果密度一致
    const base = 1100 * clampNum(540 / H, 0.7, 1.3);
    return Math.max(480, base - diff * 80);
  }
  function createItem(isBomb) {
    const r = fruitRadius(isBomb);
    const x = r + Math.random() * Math.max(1, W - r * 2);
    return {
      x,
      y: H + r + 10,
      vx: (Math.random() - 0.5) * 0.0135 * W,          // 横向漂移随宽度缩放
      // 初速与重力同比例缩放 → 任意屏幕都飞到 30%~70% 高度区域
      vy: -(0.026 * H + Math.random() * 0.0085 * H + difficulty * 0.0006 * H),
      rot: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 0.12,
      r,
      emoji: isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)],
      isBomb: !!isBomb,
      sliced: false,
    };
  }
  function spawnFruit() {
    const maxCount = Math.min(3, 1 + Math.floor(difficulty / 2));
    const count = 1 + Math.floor(Math.random() * maxCount);
    for (let i = 0; i < count; i++) {
      const isBomb = Math.random() < Math.min(0.12, 0.04 + difficulty * 0.01);
      fruits.push(createItem(isBomb));
    }
  }

  /* ========== 切割 ========== */
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function checkSlice(x, y, px, py) {
    if (!gameRunning) return;
    for (const f of fruits) {
      if (f.sliced) continue;
      const hit = Math.hypot(f.x - x, f.y - y) < f.r ||
        distToSegment(f.x, f.y, px, py, x, y) < f.r;
      if (hit) {
        f.sliced = true;
        if (f.isBomb) hitBomb(f);
        else sliceFruit(f);
      }
    }
  }

  function sliceFruit(f) {
    playSliceSound();
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    combo++;
    lastSliceTime = performance.now();

    // 连击判定
    const points = 10 + (combo > 1 ? (combo - 1) * 5 : 0);
    score += points;
    scoreEl.textContent = score;
    saveBest();

    // GSAP: 分数弹性跳动 + 画布脉冲
    gsap.fromTo(scoreEl, { scale: 1.4 }, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.4)' });
    gsap.fromTo(canvas, { scale: 1.02 }, { scale: 1, duration: 0.25, ease: 'power2.out' });

    // 果汁粒子
    const color = JUICE[f.emoji] || '#ffd600';
    const pCount = clampNum(Math.round(worldSize() / 40), 10, 16);
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x: f.x, y: f.y,
        vx: Math.cos(angle) * speed + f.vx * 0.3,
        vy: Math.sin(angle) * speed + f.vy * 0.3,
        life: 30 + Math.random() * 20,
        color,
        size: 2 + Math.random() * 4,
      });
    }

    // 切成两半：上片向上飞、下片向下落
    halves.push({
      x: f.x, y: f.y,
      vx: f.vx - 1.5, vy: f.vy - 2,
      rot: f.rot, vr: f.vr + 0.08,
      r: f.r, emoji: f.emoji, dir: -1, life: 50,
    });
    halves.push({
      x: f.x, y: f.y,
      vx: f.vx + 1.5, vy: f.vy + 1.5,
      rot: f.rot, vr: f.vr - 0.08,
      r: f.r, emoji: f.emoji, dir: 1, life: 50,
    });

    // 连击显示
    if (combo >= 2) showCombo(combo);
  }

  function hitBomb(f) {
    playBombSound();
    combo = 0;
    hideCombo();

    // 爆炸粒子（黑色 + 橙红）
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particles.push({
        x: f.x, y: f.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 25 + Math.random() * 20,
        color: i % 3 === 0 ? '#ff5722' : '#37474f',
        size: 2 + Math.random() * 4,
      });
    }
    halves.push({
      x: f.x, y: f.y,
      vx: f.vx - 2, vy: f.vy - 3, rot: f.rot, vr: 0.2,
      r: f.r, emoji: BOMB, dir: -1, life: 45,
    });
    halves.push({
      x: f.x, y: f.y,
      vx: f.vx + 2, vy: f.vy + 2, rot: f.rot, vr: -0.2,
      r: f.r, emoji: BOMB, dir: 1, life: 45,
    });

    // 屏幕红色闪屏 + 抖动 + 边框红光
    gsap.fromTo(screenFlash, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: 'power3.out' });
    gsap.fromTo(gameContainer, { x: 0, y: 0 }, {
      x: 'random(-10, 10)', y: 'random(-8, 8)',
      duration: 0.07, repeat: 5, yoyo: true, ease: 'power2.out',
      onComplete: () => gsap.set(gameContainer, { x: 0, y: 0 }),
    });
    gsap.fromTo(borderGlow, { opacity: 0 }, {
      opacity: 1, duration: 0.15,
      onComplete: () => gsap.to(borderGlow, { opacity: 0, duration: 0.9, ease: 'power2.out' }),
    });
    gsap.fromTo(canvas, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });

    loseLife();
  }

  function loseLife() {
    lives--;
    updateLives();
    if (lives <= 0) endGame();
  }

  /* ========== 连击 UI ========== */
  let comboBarTween = null;
  function showCombo(count) {
    comboText.textContent = '🔥 x' + count;
    gsap.killTweensOf(comboDisplay);
    gsap.killTweensOf(comboText);
    if (comboBarTween) { comboBarTween.kill(); comboBarTween = null; }

    gsap.to(comboDisplay, { opacity: 1, duration: 0.2 });
    gsap.fromTo(comboText,
      { scale: 1.8, rotation: -10 },
      { scale: 1, rotation: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.4)' });

    comboBarTween = gsap.fromTo(comboBarFill, { scaleX: 1 }, {
      scaleX: 0, duration: COMBO_WINDOW / 1000, ease: 'none',
      onComplete: () => { combo = 0; hideCombo(); },
    });
  }

  function hideCombo() {
    gsap.killTweensOf(comboDisplay);
    gsap.to(comboDisplay, { opacity: 0, duration: 0.3 });
    gsap.to(comboBarFill, { scaleX: 0, duration: 0.2 });
    if (comboBarTween) { comboBarTween.kill(); comboBarTween = null; }
  }

  /* ========== 生命 HUD ========== */
  function updateLives() {
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, MAX_LIVES - lives));
    livesHud.classList.toggle('lives-low', lives <= 1);
    gsap.fromTo(livesEl, { scale: 1.4 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
  }

  /* ========== 游戏生命周期 ========== */
  function resetGame() {
    fruits = [];
    halves = [];
    particles = [];
    trails = [];
    score = 0;
    lives = MAX_LIVES;
    gameRunning = false;
    combo = 0;
    gameTimeMs = 0;
    difficulty = 0;
    spawnAcc = 0;
    spawnInterval = 1100;
    lastSliceTime = 0;
    scoreEl.textContent = '0';
    updateLives();
    loadBest();
    overlay.classList.add('hidden');
    hideCombo();
    gsap.set(screenFlash, { opacity: 0 });
    gsap.set(borderGlow, { opacity: 0 });
    gsap.set(gameContainer, { x: 0, y: 0 });
    gsap.set(canvas, { scale: 1 });
  }

  function startGame() {
    resetGame();
    gameRunning = true;
    gsap.to(hintText, { opacity: 0.25, duration: 0.5, delay: 1 });
  }

  function endGame() {
    gameRunning = false;
    const isNewBest = score > 0 && score > bestScore;
    saveBest();
    hideCombo();

    if (isNewBest) {
      resultTitle.textContent = '🏆 新纪录！';
      resultText.textContent = '得分: ' + score + '，太强了！';
      gsap.fromTo(screenFlash, { opacity: 0.8 }, { opacity: 0, duration: 0.6, ease: 'power3.out' });
      gsap.fromTo(borderGlow, { opacity: 0 }, {
        opacity: 1, duration: 0.15,
        onComplete: () => gsap.to(borderGlow, { opacity: 0, duration: 1.5, ease: 'power2.out' }),
      });
      // 庆祝粒子
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const speed = 4 + Math.random() * 6;
        particles.push({
          x: W / 2, y: H / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 40 + Math.random() * 20,
          color: `hsl(${Math.random() * 360}, 100%, 65%)`,
          size: 2 + Math.random() * 4,
        });
      }
    } else {
      resultTitle.textContent = '💥 游戏结束';
      resultText.textContent = '得分: ' + score;
    }
    startBtn.textContent = '再来一局';

    overlay.classList.remove('hidden');
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo(overlayContent,
      { scale: 0.3, opacity: 0, rotation: -8 },
      { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)', delay: 0.1 });
    gsap.fromTo(resultTitle,
      { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', delay: 0.3 });
  }

  /* ========== 更新（dt 归一化到 60fps，兼容 60/120Hz 屏） ========== */
  function update(dt) {
    const k = dt * 60;
    const g = H * 0.00074 * k;   // 重力随屏高缩放：540 高时 ≈ 0.4/帧

    // 水果运动
    for (const f of fruits) {
      f.x += f.vx * k;
      f.y += f.vy * k;
      f.vy += g;
      f.rot += f.vr * k;
    }

    // 漏掉的水果：扣生命
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      if (f.y - f.r > H + 30) {
        fruits.splice(i, 1);
        if (gameRunning && !f.sliced && !f.isBomb) {
          playMissSound();
          loseLife();
          gsap.fromTo(livesHud, { scale: 1.2 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
        }
      }
    }

    // 两半运动
    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      h.x += h.vx * k;
      h.y += h.vy * k;
      h.vy += 0.35 * k;
      h.rot += h.vr * k;
      h.life -= k;
      if (h.life <= 0) halves.splice(i, 1);
    }

    // 粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.12 * k;
      p.life -= k;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // 刀光淡出（抬手后）
    for (let i = trails.length - 1; i >= 0; i--) {
      const t = trails[i];
      if (!t.active) {
        t.fade -= 0.045 * k;
        if (t.fade <= 0) trails.splice(i, 1);
      }
    }

    // 连击超时重置
    if (combo > 0 && performance.now() - lastSliceTime > COMBO_WINDOW) {
      combo = 0;
      hideCombo();
    }

    // 难度递增 + 基于时间的生成（替代 setInterval，帧率无关）
    if (gameRunning) {
      gameTimeMs += dt * 1000;
      difficulty = Math.min(8, Math.floor(gameTimeMs / 12000));
      spawnInterval = spawnIntervalFor(difficulty);
      spawnAcc += dt * 1000;
      while (spawnAcc >= spawnInterval) {
        spawnAcc -= spawnInterval;
        spawnFruit();
      }
    }
  }

  /* ========== 渲染 ========== */
  function render() {
    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1a10');
    grad.addColorStop(0.5, '#0a140c');
    grad.addColorStop(1, '#08100a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 顶部光晕
    const glow = ctx.createRadialGradient(W / 2, -60, 10, W / 2, -60, 300);
    glow.addColorStop(0, 'rgba(120,255,120,0.08)');
    glow.addColorStop(1, 'rgba(120,255,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 240);

    // 水果
    for (const f of fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.shadowColor = f.isBomb ? 'rgba(255,80,40,0.5)' : 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12 / DPR;
      ctx.font = f.r * 2 + 'px ' + EMOJI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.emoji, 0, 2);
      ctx.restore();
    }

    // 两半（用半圆裁剪绘制，上片/下片各自飞散）
    for (const h of halves) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.beginPath();
      if (h.dir < 0) {
        ctx.arc(0, 0, h.r, Math.PI, Math.PI * 2); // 上半片
      } else {
        ctx.arc(0, 0, h.r, 0, Math.PI);           // 下半片
      }
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = Math.min(1, h.life / 20);
      ctx.font = h.r * 2 + 'px ' + EMOJI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.emoji, 0, 2);
      ctx.restore();
    }

    // 果汁粒子
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 忍者刀光（最上层，从手指下"冒出来"）
    for (const t of trails) drawSword(t);
  }

  function drawSword(t) {
    const pts = t.points;
    if (pts.length < 2) return;
    const alpha = (t.active ? 1 : t.fade) * 0.9;
    if (alpha <= 0.02) return;
    const sw = clampNum(H * 0.045, 14, 42);   // 刀宽随屏幕缩放
    const n = pts.length;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 外层辉光
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i];
      const tI = i / (n - 1);
      ctx.strokeStyle = 'rgba(255,200,80,' + (alpha * 0.30).toFixed(3) + ')';
      ctx.lineWidth = sw * (0.95 - 0.55 * tI) * 1.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // 亮白刀身
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i];
      const tI = i / (n - 1);
      ctx.strokeStyle = 'rgba(255,255,225,' + (alpha * 0.85).toFixed(3) + ')';
      ctx.lineWidth = sw * (0.8 - 0.5 * tI);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // 刀头光晕
    const head = pts[n - 1];
    const rg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, sw * 0.9);
    rg.addColorStop(0, 'rgba(255,255,235,' + alpha.toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(head.x, head.y, sw * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ========== 主循环 ========== */
  function loop(now) {
    if (!lastT) lastT = now;
    const dt = Math.min(0.05, (now - lastT) / 1000);  // 切后台回来不跳帧
    lastT = now;
    update(dt);
    render();
    animFrameId = requestAnimationFrame(loop);
  }

  /* ========== 输入：Pointer Events 多点触控 ========== */
  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * W,
      y: (e.clientY - rect.top) / rect.height * H,
    };
  }

  function onPointerDown(e) {
    if (!gameRunning) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    const pos = toWorld(e);
    trails.push({ id: e.pointerId, points: [pos], active: true, fade: 1 });
  }

  function onPointerMove(e) {
    if (!gameRunning) return;
    const t = trails.find(t => t.id === e.pointerId && t.active);
    if (!t) return;
    const pos = toWorld(e);
    const prev = t.points[t.points.length - 1] || pos;
    checkSlice(pos.x, pos.y, prev.x, prev.y);
    t.points.push(pos);
    if (t.points.length > TRAIL_MAX) t.points.shift();
  }

  function onPointerEnd(e) {
    const t = trails.find(t => t.id === e.pointerId);
    if (t) t.active = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);

  /* ========== 背景粒子 ========== */
  const bgCanvas = document.getElementById('bgCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  let bgParticles = [], bgDPR = 1;
  function bgResize() {
    bgDPR = clampNum(window.devicePixelRatio || 1, 1, MAX_DPR);
    bgCanvas.width = Math.round(window.innerWidth * bgDPR);
    bgCanvas.height = Math.round(window.innerHeight * bgDPR);
    bgCtx.setTransform(bgDPR, 0, 0, bgDPR, 0, 0);
    // 粒子数按屏幕面积自适应
    const target = clampNum(Math.round(window.innerWidth * window.innerHeight / 14000), 16, 50);
    while (bgParticles.length < target) bgParticles.push(new BgP());
    if (bgParticles.length > target) bgParticles.length = target;
  }
  class BgP {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * window.innerWidth;
      this.y = Math.random() * window.innerHeight;
      this.r = Math.random() * 2 + 0.5;
      this.dx = Math.random() * 0.3 - 0.15;
      this.dy = Math.random() * 0.3 - 0.15;
      this.a = Math.random() * 0.3 + 0.1;
      this.h = Math.random() * 60 + 90;
    }
    update() {
      this.x += this.dx; this.y += this.dy;
      if (this.x < -10 || this.x > window.innerWidth + 10 ||
          this.y < -10 || this.y > window.innerHeight + 10) this.reset();
    }
    draw(c) {
      c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      c.fillStyle = 'hsla(' + this.h + ',60%,50%,' + this.a + ')'; c.fill();
    }
  }
  function bgAnim() {
    if (!document.hidden) {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      for (const p of bgParticles) { p.update(); p.draw(bgCtx); }
    }
    requestAnimationFrame(bgAnim);
  }

  /* ========== 按钮 ========== */
  startBtn.addEventListener('click', startGame);
  startBtn.addEventListener('mouseenter', () => {
    gsap.to(startBtn, { scale: 1.08, boxShadow: '0 4px 25px rgba(80,220,120,0.6)', duration: 0.3, ease: 'back.out(2)' });
  });
  startBtn.addEventListener('mouseleave', () => {
    gsap.to(startBtn, { scale: 1, boxShadow: 'none', duration: 0.2, ease: 'power2.out' });
  });

  /* ========== 启动 ========== */
  fitAll();
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    hintText.textContent = '👆 按住屏幕滑动切开水果（可双指）';
  }
  resetGame();
  requestAnimationFrame(loop);
  requestAnimationFrame(bgAnim);

  // 初始 overlay 显示开始界面
  overlay.classList.remove('hidden');
  gsap.set(overlay, { opacity: 1 });
  gsap.fromTo(overlayContent,
    { scale: 0.5, opacity: 0, y: 30 },
    { scale: 1, opacity: 1, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.6)', delay: 0.2 });
  gsap.fromTo(resultTitle,
    { scale: 0, rotation: -15 },
    { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(3)', delay: 0.5 });
  gsap.fromTo(startBtn,
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.7 });
})();