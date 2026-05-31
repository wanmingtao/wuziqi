(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 300, H = 500;
  canvas.width = W; canvas.height = H;

  const scoreEl = document.getElementById('scoreDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultScore = document.getElementById('resultScore');
  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');

  const GRAVITY = 0.45;
  const FLAP = -7;
  const PIPE_W = 34;
  const PIPE_GAP = 130;
  const PIPE_SPEED = 2.5;
  const GROUND_H = 40;
  const BIRD_R = 10;

  let bird, pipes, particles;
  let score, bestScore;
  let gameOver, started;
  let frame = 0, groundX = 0;
  let animFrame;

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestFlappy') || '0');
    bestEl.textContent = bestScore;
  }
  function saveBest() { if (score > bestScore) { bestScore = score; localStorage.setItem('bestFlappy', bestScore); bestEl.textContent = bestScore; } }

  function resetGame() {
    score = 0; gameOver = false; started = false; groundX = 0;
    overlay.classList.add('hidden');
    bird = { x: W * 0.3, y: H / 2, vy: 0, r: BIRD_R, rot: 0 };
    pipes = [];
    particles = [];
    updateScore();
  }

  function addPipe() {
    const gapY = 80 + Math.random() * (H - GROUND_H - PIPE_GAP - 160);
    pipes.push({ x: W, gapY, w: PIPE_W, gap: PIPE_GAP, scored: false });
  }

  function update() {
    frame++;

    if (!started) {
      bird.y = H / 2 + Math.sin(frame / 30) * 8;
      return;
    }

    if (gameOver) return;

    // Bird physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;
    bird.rot = Math.min(Math.PI / 3, bird.vy * 0.08);

    // Ground collision
    if (bird.y + bird.r > H - GROUND_H) {
      bird.y = H - GROUND_H - bird.r;
      gameOver = true; saveBest();
      spawnParticles(bird.x, bird.y, '#ff1744', 15);
      resultTitle.textContent = '撞到啦'; resultScore.textContent = '得分: ' + score;
      overlay.classList.remove('hidden');
      // GSAP: elastic scale entrance on game over overlay
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(overlay.querySelector('.overlay-content'),
          { scale: 0.3, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' }
        );
      }
      return;
    }
    // Ceiling
    if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }

    // Pipes
    if (frame % 80 === 0) addPipe();

    for (const p of pipes) {
      p.x -= PIPE_SPEED;

      // Score
      if (!p.scored && p.x + p.w < bird.x) {
        p.scored = true;
        score++;
        updateScore();
        spawnParticles(bird.x, bird.y - 20, '#f5a623', 5);
        // GSAP: small screen flash on pipe pass
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(canvas, { filter: 'brightness(1.4)' },
            { filter: 'brightness(1)', duration: 0.2, ease: 'power2.out' });
        }
      }

      // Collision
      if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + p.w) {
        if (bird.y - bird.r < p.gapY || bird.y + bird.r > p.gapY + p.gap) {
          gameOver = true; saveBest();
          spawnParticles(bird.x, bird.y, '#ff1744', 15);
          resultTitle.textContent = '撞到啦'; resultScore.textContent = '得分: ' + score;
          overlay.classList.remove('hidden');
          // GSAP: elastic scale entrance on game over overlay
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(overlay.querySelector('.overlay-content'),
              { scale: 0.3, opacity: 0 },
              { scale: 1, opacity: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' }
            );
          }
          return;
        }
      }
    }
    pipes = pipes.filter(p => p.x + p.w > -10);

    // Particles
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; }
    particles = particles.filter(p => p.life > 0);

    groundX = (groundX - PIPE_SPEED) % 16;

    // Spawn trail particles
    if (frame % 3 === 0) {
      particles.push({ x: bird.x - 8, y: bird.y + 2, vx: -0.5, vy: -0.3, life: 15, color: 'rgba(255,255,255,0.3)', size: 2 });
    }
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 20 + Math.random() * 15, color, size: 2 + Math.random() * 3 });
    }
  }

  function flap() {
    if (gameOver) { resetGame(); return; }
    if (!started) { started = true; }
    bird.vy = FLAP;
    spawnParticles(bird.x - 8, bird.y, '#76ff03', 4);
    // GSAP: brief canvas scale pulse on bird flap
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(canvas, { scale: 1.03 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    }
  }

  function render() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
    grad.addColorStop(0, '#0a0a2a');
    grad.addColorStop(0.5, '#1a1a3a');
    grad.addColorStop(1, '#2a1a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H - GROUND_H);

    // Stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 37 + 13) % W, sy = (i * 53 + 7) % (H * 0.6);
      const alpha = 0.2 + 0.3 * Math.sin(frame / 60 + i);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Mountains
    ctx.fillStyle = 'rgba(20,20,40,0.5)';
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_H);
    for (let x = 0; x <= W; x += 2) {
      const y = H - GROUND_H - 20 - Math.sin(x * 0.02) * 25 - Math.sin(x * 0.05) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H - GROUND_H);
    ctx.fill();

    // Pipes
    for (const p of pipes) {
      // Pipe body
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 6;
      const gradP = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
      gradP.addColorStop(0, '#00e5ff');
      gradP.addColorStop(0.3, '#00b8d4');
      gradP.addColorStop(0.7, '#0097a7');
      gradP.addColorStop(1, '#006064');

      // Top pipe
      ctx.fillStyle = gradP;
      roundRect(ctx, p.x, 0, p.w, p.gapY, 3);
      ctx.fill();

      // Top pipe cap
      ctx.fillStyle = '#00e5ff';
      roundRect(ctx, p.x - 4, p.gapY - 20, p.w + 8, 20, 3);
      ctx.fill();

      // Bottom pipe
      ctx.fillStyle = gradP;
      roundRect(ctx, p.x, p.gapY + p.gap, p.w, H - GROUND_H - p.gapY - p.gap, 3);
      ctx.fill();

      // Bottom pipe cap
      ctx.fillStyle = '#00e5ff';
      roundRect(ctx, p.x - 4, p.gapY + p.gap, p.w + 8, 20, 3);
      ctx.fill();

      // Pipe highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(p.x + 4, 0, 6, p.gapY);
      ctx.fillRect(p.x + 4, p.gapY + p.gap, 6, H - GROUND_H - p.gapY - p.gap);
    }
    ctx.shadowBlur = 0;

    // Ground
    ctx.fillStyle = '#1a1a0a';
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = '#2a2a0a';
    ctx.fillRect(0, H - GROUND_H, W, 3);

    // Ground stripe pattern
    ctx.fillStyle = '#3a3a1a';
    for (let x = groundX; x < W; x += 16) {
      ctx.fillRect(x, H - GROUND_H + 5, 8, 4);
    }

    // Bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);

    // Glow
    ctx.shadowColor = '#ffd600';
    ctx.shadowBlur = 15;

    // Body
    const bGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, bird.r);
    bGrad.addColorStop(0, '#ffd600');
    bGrad.addColorStop(0.4, '#ffab00');
    bGrad.addColorStop(1, '#ff6d00');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(6, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.moveTo(8, 1);
    ctx.lineTo(16, 3);
    ctx.lineTo(8, 6);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#ffab00';
    ctx.beginPath();
    const wingFlap = Math.sin(frame * 0.2) * 3;
    ctx.moveTo(-2, 2);
    ctx.quadraticCurveTo(-6, 4 + wingFlap, -2, 8 + wingFlap);
    ctx.fill();

    ctx.restore();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 35;
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

  function updateScore() { scoreEl.textContent = score; saveBest();
    // GSAP: elastic scale bounce on score
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(scoreEl, { scale: 1.5 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    }
  }

  function loop() { update(); render(); animFrame = requestAnimationFrame(loop); }

  function bindInput() {
    const doFlap = e => { e.preventDefault(); flap(); };
    canvas.addEventListener('mousedown', doFlap);
    canvas.addEventListener('touchstart', doFlap, { passive: false });
    document.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); }
    });
    newGameBtn.addEventListener('click', resetGame);
    restartBtn.addEventListener('click', resetGame);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !gameOver) { /* no pause in flappy */ }
    });
  }

  function init() { loadBest(); resetGame(); bindInput(); loop(); }
  init();
})();
