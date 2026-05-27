(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const SIZE = 420;
  canvas.width = SIZE; canvas.height = SIZE;
  const CELL = SIZE / 3;

  const turnDisplay = document.getElementById('turnDisplay');
  const xWinsEl = document.getElementById('xWins');
  const oWinsEl = document.getElementById('oWins');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const modeSelect = document.getElementById('modeSelect');

  let board, current, gameOver, isAI;
  let xWins = 0, oWins = 0;
  let winLine = null;
  let winAnimProgress = 0;
  let drawAnims = []; // animation for X and O drawing
  let particles = [];
  let animFrameId;

  const WIN_COMBOS = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6]           // diags
  ];

  function init() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    board = Array(9).fill(0);
    current = 1; // 1=X, 2=O
    gameOver = false;
    isAI = modeSelect.value === 'ai';
    winLine = null;
    winAnimProgress = 0;
    drawAnims = [];
    particles = [];
    overlay.classList.add('hidden');
    updateHUD();
    draw();
  }

  function checkWin(player) {
    return WIN_COMBOS.find(combo => combo.every(i => board[i] === player)) || null;
  }

  function checkDraw() {
    return board.every(v => v !== 0);
  }

  function place(index) {
    if (gameOver || board[index] !== 0) return;
    board[index] = current;
    // spawn draw animation
    drawAnims.push({index, player: current, progress: 0});
    // particles
    const cx = (index % 3) * CELL + CELL / 2;
    const cy = Math.floor(index / 3) * CELL + CELL / 2;
    const color = current === 1 ? '#ff6060' : '#60c0ff';
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, r: Math.random()*3+1, life: 1, color});
    }

    const win = checkWin(current);
    if (win) {
      gameOver = true;
      winLine = win;
      winAnimProgress = 0;
      if (current === 1) { xWins++; xWinsEl.textContent = xWins; }
      else { oWins++; oWinsEl.textContent = oWins; }
      setTimeout(() => {
        resultTitle.textContent = current === 1 ? '✕ 获胜！' : '○ 获胜！';
        resultText.textContent = `${current === 1 ? '✕' : '○'} 连成一线`;
        overlay.classList.remove('hidden');
      }, 800);
      return;
    }
    if (checkDraw()) {
      gameOver = true;
      setTimeout(() => {
        resultTitle.textContent = '🤝 平局！';
        resultText.textContent = '势均力敌';
        overlay.classList.remove('hidden');
      }, 500);
      return;
    }

    current = 3 - current;
    updateHUD();
    if (isAI && current === 2 && !gameOver) setTimeout(aiMove, 400);
  }

  function aiMove() {
    if (gameOver) return;
    // Minimax AI
    let bestScore = -Infinity, bestMove = -1;
    for (let i = 0; i < 9; i++) {
      if (board[i] === 0) {
        board[i] = 2;
        let score = minimax(board, 0, false);
        board[i] = 0;
        if (score > bestScore) { bestScore = score; bestMove = i; }
      }
    }
    if (bestMove >= 0) place(bestMove);
  }

  function minimax(b, depth, isMax) {
    const win2 = checkWin(2);
    if (win2) return 10 - depth;
    const win1 = checkWin(1);
    if (win1) return depth - 10;
    if (b.every(v => v !== 0)) return 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === 0) {
          b[i] = 2;
          best = Math.max(best, minimax(b, depth + 1, false));
          b[i] = 0;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === 0) {
          b[i] = 1;
          best = Math.min(best, minimax(b, depth + 1, true));
          b[i] = 0;
        }
      }
      return best;
    }
  }

  function updateHUD() {
    turnDisplay.textContent = current === 1 ? '✕' : '○';
    turnDisplay.style.color = current === 1 ? '#ff6060' : '#60c0ff';
  }

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // background
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 15); ctx.lineTo(i * CELL, SIZE - 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, i * CELL); ctx.lineTo(SIZE - 15, i * CELL); ctx.stroke();
    }

    // draw X and O with animation
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = col * CELL + CELL / 2;
      const cy = row * CELL + CELL / 2;
      const pad = CELL * 0.25;

      // find animation progress
      const anim = drawAnims.find(a => a.index === i);
      let progress = anim ? anim.progress : (board[i] !== 0 ? 1 : 0);

      if (board[i] === 1 && progress > 0) {
        // draw X
        const grad = ctx.createLinearGradient(cx-pad, cy-pad, cx+pad, cy+pad);
        grad.addColorStop(0, '#ff4040');
        grad.addColorStop(1, '#ff8080');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        // line 1
        ctx.beginPath();
        const p1 = Math.min(progress * 2, 1);
        ctx.moveTo(cx - pad, cy - pad);
        ctx.lineTo(cx - pad + (pad * 2) * p1, cy - pad + (pad * 2) * p1);
        ctx.stroke();
        // line 2
        if (progress > 0.5) {
          const p2 = Math.min((progress - 0.5) * 2, 1);
          ctx.beginPath();
          ctx.moveTo(cx + pad, cy - pad);
          ctx.lineTo(cx + pad - (pad * 2) * p2, cy - pad + (pad * 2) * p2);
          ctx.stroke();
        }
        // glow
        ctx.shadowColor = 'rgba(255,80,80,0.4)';
        ctx.shadowBlur = 10 * progress;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      if (board[i] === 2 && progress > 0) {
        // draw O
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pad);
        grad.addColorStop(0, '#80d0ff');
        grad.addColorStop(1, '#4090ff');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, pad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        // glow
        ctx.shadowColor = 'rgba(80,180,255,0.4)';
        ctx.shadowBlur = 10 * progress;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    }

    // update draw animations
    for (const a of drawAnims) {
      if (a.progress < 1) a.progress = Math.min(1, a.progress + 0.05);
    }

    // win line
    if (winLine) {
      winAnimProgress = Math.min(1, winAnimProgress + 0.03);
      const [a, , c] = winLine;
      const ax = (a % 3) * CELL + CELL / 2;
      const ay = Math.floor(a / 3) * CELL + CELL / 2;
      const cx2 = (c % 3) * CELL + CELL / 2;
      const cy2 = Math.floor(c / 3) * CELL + CELL / 2;
      const mx = ax + (cx2 - ax) * winAnimProgress;
      const my = ay + (cy2 - ay) * winAnimProgress;
      ctx.strokeStyle = '#ffe040';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,220,60,0.6)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.025;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function getIndex(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width, scaleY = SIZE / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    if (col >= 0 && col < 3 && row >= 0 && row < 3) return row * 3 + col;
    return -1;
  }

  canvas.addEventListener('click', e => {
    const idx = getIndex(e.clientX, e.clientY);
    if (idx >= 0) place(idx);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const idx = getIndex(t.clientX, t.clientY);
    if (idx >= 0) place(idx);
  }, {passive: false});

  restartBtn.addEventListener('click', init);
  newGameBtn.addEventListener('click', init);

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
      this.h = Math.random() * 60 + 220;
    }
    update() { this.x += this.dx; this.y += this.dy; if (this.x<-10||this.x>bgCanvas.width+10||this.y<-10||this.y>bgCanvas.height+10) this.reset(); }
    draw(c) { c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2); c.fillStyle = `hsla(${this.h},60%,50%,${this.a})`; c.fill(); }
  }
  for (let i = 0; i < 40; i++) bgParticles.push(new BgP());
  function bgAnim() { bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height); for (const p of bgParticles) { p.update(); p.draw(bgCtx); } requestAnimationFrame(bgAnim); }
  bgAnim();

  init();
})();
