(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const SIZE = 480;
  canvas.width = SIZE; canvas.height = SIZE;
  const CELL = SIZE / 8;

  const blackCountEl = document.getElementById('blackCount');
  const whiteCountEl = document.getElementById('whiteCount');
  const turnDisplay = document.getElementById('turnDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const modeSelect = document.getElementById('modeSelect');

  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

  let board, current, gameOver, isAI, animating;
  let flipAnim = [];
  let particles = [];
  let validMoves = [];
  let animFrameId;

  // GSAP animation state
  const gsapDropScale = {};
  const gsapFlipProgress = {};
  let gsapHintPulse = 0;

  function init() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    board = Array.from({length: 8}, () => Array(8).fill(0));
    board[3][3] = board[4][4] = 2; // white
    board[3][4] = board[4][3] = 1; // black
    current = 1;
    gameOver = false;
    animating = false;
    flipAnim = [];
    particles = [];
    isAI = modeSelect.value === 'ai';
    overlay.classList.add('hidden');
    updateValidMoves();
    updateHUD();
    draw();
  }

  function updateValidMoves() {
    validMoves = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] === 0 && getFlips(r, c, current).length > 0)
          validMoves.push([r, c]);
  }

  function getFlips(r, c, player) {
    const opp = 3 - player;
    let flips = [];
    for (const [dr, dc] of DIRS) {
      let cr = r + dr, cc = c + dc, line = [];
      while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && board[cr][cc] === opp) {
        line.push([cr, cc]);
        cr += dr; cc += dc;
      }
      if (line.length > 0 && cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && board[cr][cc] === player)
        flips.push(...line);
    }
    return flips;
  }

  function place(r, c) {
    if (gameOver || animating) return;
    if (board[r][c] !== 0 || getFlips(r, c, current).length === 0) return;
    board[r][c] = current;
    const flips = getFlips(r, c, current);
    spawnParticles(c * CELL + CELL / 2, r * CELL + CELL / 2, current === 1 ? '#444' : '#fff');
    // GSAP piece drop animation
    if (typeof gsap !== 'undefined') {
      const dropKey = r + ',' + c;
      gsapDropScale[dropKey] = 0;
      gsap.to(gsapDropScale, { [dropKey]: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    }
    // animate flips
    animating = true;
    flipAnim = flips.map(([fr, fc]) => ({r: fr, c: fc, progress: 0}));
    // GSAP flip animations with stagger
    if (typeof gsap !== 'undefined') {
      flips.forEach(([fr, fc], i) => {
        const flipKey = fr + ',' + fc;
        gsapFlipProgress[flipKey] = { scaleX: 1 };
        gsap.to(gsapFlipProgress[flipKey], {
          scaleX: 0, duration: 0.15, delay: i * 0.08,
          onComplete: () => {
            gsap.to(gsapFlipProgress[flipKey], { scaleX: 1, duration: 0.25, ease: 'elastic.out(1, 0.5)' });
          }
        });
      });
    }
    let idx = 0;
    const flipInterval = setInterval(() => {
      if (idx < flipAnim.length) {
        flipAnim[idx].progress = 1;
        board[flips[idx][0]][flips[idx][1]] = current;
        spawnParticles(flips[idx][1] * CELL + CELL / 2, flips[idx][0] * CELL + CELL / 2, current === 1 ? '#555' : '#eee');
        idx++;
      }
      if (idx >= flipAnim.length) {
        clearInterval(flipInterval);
        flipAnim = [];
        animating = false;
        current = 3 - current;
        updateValidMoves();
        if (validMoves.length === 0) {
          current = 3 - current;
          updateValidMoves();
          if (validMoves.length === 0) {
            endGame();
            return;
          }
        }
        updateHUD();
        if (isAI && current === 2) setTimeout(aiMove, 400);
      }
    }, 80);
  }

  function aiMove() {
    if (gameOver || current !== 2) return;
    let best = null, bestScore = -Infinity;
    for (const [r, c] of validMoves) {
      const flips = getFlips(r, c, 2);
      let score = flips.length;
      // corner bonus
      if ((r === 0 || r === 7) && (c === 0 || c === 7)) score += 50;
      // edge bonus
      else if (r === 0 || r === 7 || c === 0 || c === 7) score += 5;
      // avoid next to corner
      if (Math.abs(r-0)<=1 && Math.abs(c-0)<=1 && !(r===0&&c===0)) score -= 10;
      if (Math.abs(r-0)<=1 && Math.abs(c-7)<=1 && !(r===0&&c===7)) score -= 10;
      if (Math.abs(r-7)<=1 && Math.abs(c-0)<=1 && !(r===7&&c===0)) score -= 10;
      if (Math.abs(r-7)<=1 && Math.abs(c-7)<=1 && !(r===7&&c===7)) score -= 10;
      if (score > bestScore) { bestScore = score; best = [r, c]; }
    }
    if (best) place(best[0], best[1]);
  }

  function endGame() {
    gameOver = true;
    let black = 0, white = 0;
    for (const row of board) for (const v of row) { if (v === 1) black++; else if (v === 2) white++; }
    resultTitle.textContent = black > white ? '⚫ 黑棋获胜！' : white > black ? '⚪ 白棋获胜！' : '🤝 平局！';
    resultText.textContent = `黑棋 ${black} : ${white} 白棋`;
    overlay.classList.remove('hidden');
    // GSAP overlay entrance
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(overlay.querySelector('.overlay-content'),
        { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
    }
  }

  function updateHUD() {
    let black = 0, white = 0;
    for (const row of board) for (const v of row) { if (v === 1) black++; else if (v === 2) white++; }
    blackCountEl.textContent = black;
    whiteCountEl.textContent = white;
    turnDisplay.textContent = current === 1 ? '黑棋' : '白棋';
    // GSAP score bounce
    if (typeof gsap !== 'undefined') {
      const targetEl = current === 1 ? blackCountEl : whiteCountEl;
      gsap.fromTo(targetEl, { scale: 1.4 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, r: Math.random()*3+1, life: 1, color});
    }
  }

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // board background
    ctx.fillStyle = '#1a5c2a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // grid lines
    ctx.strokeStyle = '#0d3d18';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
    }
    // star points
    ctx.fillStyle = '#0d3d18';
    for (const [sr, sc] of [[2,2],[2,6],[6,2],[6,6]]) {
      ctx.beginPath(); ctx.arc(sc*CELL, sr*CELL, 4, 0, Math.PI*2); ctx.fill();
    }
    // valid moves highlight with GSAP pulse
    if (typeof gsap !== 'undefined') {
      gsapHintPulse += 0.03;
    }
    for (const [r, c] of validMoves) {
      const pulseAlpha = 0.15 + Math.sin(gsapHintPulse) * 0.1;
      ctx.fillStyle = `rgba(${current===1?'80,200,80':'200,200,80'},${pulseAlpha})`;
      ctx.fillRect(c*CELL+2, r*CELL+2, CELL-4, CELL-4);
    }
    // pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === 0) continue;
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        const rad = CELL * 0.4;
        const isBlack = board[r][c] === 1;
        // GSAP drop and flip animation
        const dropKey = r + ',' + c;
        const dropScale = gsapDropScale[dropKey] !== undefined ? gsapDropScale[dropKey] : 1;
        const flipKey = r + ',' + c;
        const flipScaleX = gsapFlipProgress[flipKey] ? gsapFlipProgress[flipKey].scaleX : 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(dropScale * flipScaleX, dropScale);
        ctx.translate(-cx, -cy);
        // shadow
        ctx.beginPath();
        ctx.arc(cx+2, cy+2, rad, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        // piece
        const grad = ctx.createRadialGradient(cx-rad*0.3, cy-rad*0.3, rad*0.1, cx, cy, rad);
        if (isBlack) {
          grad.addColorStop(0, '#888');
          grad.addColorStop(1, '#222');
        } else {
          grad.addColorStop(0, '#fff');
          grad.addColorStop(1, '#ccc');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI*2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }
    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.03;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width, scaleY = SIZE / rect.height;
    const c = Math.floor((e.clientX - rect.left) * scaleX / CELL);
    const r = Math.floor((e.clientY - rect.top) * scaleY / CELL);
    if (r >= 0 && r < 8 && c >= 0 && c < 8) place(r, c);
  });

  // touch support
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width, scaleY = SIZE / rect.height;
    const c = Math.floor((touch.clientX - rect.left) * scaleX / CELL);
    const r = Math.floor((touch.clientY - rect.top) * scaleY / CELL);
    if (r >= 0 && r < 8 && c >= 0 && c < 8) place(r, c);
  }, {passive: false});

  restartBtn.addEventListener('click', init);
  newGameBtn.addEventListener('click', init);

  // background particles
  const bgCanvas = document.getElementById('bgCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  let bgParticles = [];
  function bgResize() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
  window.addEventListener('resize', bgResize); bgResize();
  class BgParticle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * bgCanvas.width;
      this.y = Math.random() * bgCanvas.height;
      this.r = Math.random() * 2 + 0.5;
      this.dx = Math.random() * 0.3 - 0.15;
      this.dy = Math.random() * 0.3 - 0.15;
      this.alpha = Math.random() * 0.3 + 0.1;
      this.hue = Math.random() * 60 + 100;
    }
    update() {
      this.x += this.dx; this.y += this.dy;
      if (this.x < -10 || this.x > bgCanvas.width+10 || this.y < -10 || this.y > bgCanvas.height+10) this.reset();
    }
    draw(c) {
      c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2);
      c.fillStyle = `hsla(${this.hue},60%,50%,${this.alpha})`; c.fill();
    }
  }
  for (let i = 0; i < 40; i++) bgParticles.push(new BgParticle());
  function bgAnimate() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    for (const p of bgParticles) { p.update(); p.draw(bgCtx); }
    requestAnimationFrame(bgAnimate);
  }
  bgAnimate();

  init();
})();
