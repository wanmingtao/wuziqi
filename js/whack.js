(function() {
  'use strict';

  // GSAP fallback - if not loaded, create a minimal shim
  if (typeof gsap === 'undefined') {
    window.gsap = {
      to: (el, opts) => { if (opts && opts.onComplete) setTimeout(opts.onComplete, (opts.duration||0.5)*1000); return { kill: ()=>{} }; },
      fromTo: (el, from, opts) => { if (opts && opts.onComplete) setTimeout(opts.onComplete, (opts.duration||0.5)*1000); return { kill: ()=>{} }; },
      set: () => {},
      delayedCall: (d, fn) => setTimeout(fn, d*1000),
      killTweensOf: () => {},
      registerPlugin: () => {},
      timeline: () => ({ to: function(){ return this; }, fromTo: function(){ return this; } })
    };
    window.TextPlugin = {};
  } else {
    gsap.registerPlugin(TextPlugin);
  }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 480, H = 480;
  canvas.width = W; canvas.height = H;

  const scoreEl = document.getElementById('scoreDisplay');
  const timeEl = document.getElementById('timeDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlayContent');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const startBtn = document.getElementById('startBtn');
  const comboDisplay = document.getElementById('comboDisplay');
  const comboText = document.getElementById('comboText');
  const comboBarFill = document.getElementById('comboBarFill');
  const gameContainer = document.getElementById('gameContainer');
  const screenFlash = document.getElementById('screenFlash');
  const borderGlow = document.getElementById('borderGlow');
  const hintText = document.getElementById('hintText');
  const scoreHud = document.getElementById('scoreHud');
  const timeHud = document.getElementById('timeHud');

  const COLS = 3, ROWS = 3;
  const CELL_W = W / COLS, CELL_H = H / ROWS;
  const HOLE_R = CELL_W * 0.3;

  let moles, score, bestScore, timeLeft, gameRunning;
  let timer, spawnInterval, animFrameId;
  let combo = 0, comboTimer = null;
  let hitEffects = [];
  let particles = [];
  let shockwaves = [];

  // GSAP tweens to kill on reset
  let activeTweens = [];

  // SVG mole images (reused from original)
  const moleImg = new Image();
  moleImg.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">
    <ellipse cx="60" cy="95" rx="42" ry="32" fill="#8B6914"/>
    <ellipse cx="60" cy="90" rx="38" ry="28" fill="#A0782C"/>
    <circle cx="60" cy="55" r="32" fill="#A0782C"/>
    <circle cx="60" cy="52" r="30" fill="#B8923C"/>
    <ellipse cx="32" cy="32" rx="10" ry="12" fill="#A0782C"/>
    <ellipse cx="32" cy="32" rx="6" ry="8" fill="#D4A84C"/>
    <ellipse cx="88" cy="32" rx="10" ry="12" fill="#A0782C"/>
    <ellipse cx="88" cy="32" rx="6" ry="8" fill="#D4A84C"/>
    <ellipse cx="60" cy="62" rx="20" ry="16" fill="#D4B86C"/>
    <ellipse cx="45" cy="48" rx="8" ry="9" fill="white"/>
    <ellipse cx="75" cy="48" rx="8" ry="9" fill="white"/>
    <circle cx="47" cy="49" r="5" fill="#2c1810"/>
    <circle cx="77" cy="49" r="5" fill="#2c1810"/>
    <circle cx="48.5" cy="47" r="2" fill="white"/>
    <circle cx="78.5" cy="47" r="2" fill="white"/>
    <ellipse cx="60" cy="60" rx="6" ry="4.5" fill="#E85D75"/>
    <ellipse cx="60" cy="59" rx="4" ry="2.5" fill="#FF7B93" opacity="0.6"/>
    <path d="M54 66 Q60 72 66 66" stroke="#7a4a1a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <line x1="30" y1="58" x2="42" y2="60" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <line x1="28" y1="63" x2="42" y2="63" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="60" x2="90" y2="58" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="63" x2="92" y2="63" stroke="#7a4a1a" stroke-width="1" stroke-linecap="round"/>
    <circle cx="38" cy="60" r="5" fill="#FF9999" opacity="0.35"/>
    <circle cx="82" cy="60" r="5" fill="#FF9999" opacity="0.35"/>
  </svg>`);

  const moleHitImg = new Image();
  moleHitImg.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">
    <ellipse cx="60" cy="95" rx="42" ry="32" fill="#7a5a10"/>
    <ellipse cx="60" cy="90" rx="38" ry="28" fill="#907020"/>
    <circle cx="60" cy="55" r="32" fill="#907020"/>
    <circle cx="60" cy="52" r="30" fill="#A8883A"/>
    <ellipse cx="32" cy="32" rx="10" ry="12" fill="#907020"/>
    <ellipse cx="32" cy="32" rx="6" ry="8" fill="#C09040"/>
    <ellipse cx="88" cy="32" rx="10" ry="12" fill="#907020"/>
    <ellipse cx="88" cy="32" rx="6" ry="8" fill="#C09040"/>
    <ellipse cx="60" cy="62" rx="20" ry="16" fill="#C0A060"/>
    <g stroke="#3a2010" stroke-width="2.5" stroke-linecap="round">
      <line x1="40" y1="43" x2="50" y2="53"/>
      <line x1="50" y1="43" x2="40" y2="53"/>
      <line x1="70" y1="43" x2="80" y2="53"/>
      <line x1="80" y1="43" x2="70" y2="53"/>
    </g>
    <ellipse cx="60" cy="60" rx="6" ry="4.5" fill="#D04060"/>
    <ellipse cx="60" cy="68" rx="5" ry="3.5" fill="#7a4a1a"/>
    <line x1="30" y1="58" x2="42" y2="60" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <line x1="28" y1="63" x2="42" y2="63" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="60" x2="90" y2="58" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <line x1="78" y1="63" x2="92" y2="63" stroke="#6a3a10" stroke-width="1" stroke-linecap="round"/>
    <text x="20" y="30" font-size="14" fill="#FFD700">✦</text>
    <text x="88" y="25" font-size="12" fill="#FFD700">✦</text>
    <text x="55" y="20" font-size="10" fill="#FFD700">★</text>
  </svg>`);

  // ========== GSAP UTILITY FUNCTIONS ==========

  function killAllTweens() {
    activeTweens.forEach(t => t && t.kill && t.kill());
    activeTweens = [];
    gsap.killTweensOf(gameContainer);
    gsap.killTweensOf(screenFlash);
    gsap.killTweensOf(borderGlow);
    gsap.killTweensOf(comboDisplay);
    gsap.killTweensOf(canvas);
    gsap.killTweensOf(scoreHud);
    gsap.killTweensOf(timeHud);
    gsap.killTweensOf(overlayContent);
    gsap.killTweensOf(resultTitle);
    gsap.killTweensOf(startBtn);
    gsap.killTweensOf(hintText);
  }

  // GSAP Screen Shake
  function gsapShake() {
    gsap.fromTo(gameContainer,
      { x: 0, y: 0, rotation: 0 },
      {
        x: 'random(-8, 8)',
        y: 'random(-6, 6)',
        rotation: 'random(-2, 2)',
        duration: 0.08,
        repeat: 4,
        yoyo: true,
        ease: 'power2.out',
        onComplete: () => gsap.set(gameContainer, { x: 0, y: 0, rotation: 0 })
      }
    );
  }

  // GSAP Screen Flash
  function gsapFlash(color) {
    if (color) {
      screenFlash.style.background = `radial-gradient(circle, ${color}, transparent 70%)`;
    }
    gsap.fromTo(screenFlash,
      { opacity: 0.7 },
      { opacity: 0, duration: 0.4, ease: 'power3.out' }
    );
  }

  // GSAP Border Glow
  function gsapBorderGlow(duration) {
    gsap.fromTo(borderGlow,
      { opacity: 0 },
      { opacity: 1, duration: 0.15, ease: 'power2.in',
        onComplete: () => gsap.to(borderGlow, { opacity: 0, duration: duration || 0.8, ease: 'power2.out' })
      }
    );
  }

  // GSAP Canvas Glow Class
  function gsapCanvasGlow() {
    canvas.classList.add('glow-hit');
    gsap.delayedCall(0.3, () => canvas.classList.remove('glow-hit'));
  }

  // GSAP HUD Pulse
  function gsapHudPulse(el) {
    gsap.fromTo(el,
      { scale: 1, boxShadow: '0 0 0 rgba(255,200,50,0)' },
      {
        scale: 1.15,
        boxShadow: '0 0 25px rgba(255,200,50,0.6)',
        duration: 0.15,
        ease: 'back.out(3)',
        onComplete: () => gsap.to(el, { scale: 1, boxShadow: '0 0 0 rgba(255,200,50,0)', duration: 0.3, ease: 'power2.out' })
      }
    );
  }

  // GSAP Score Bump
  function gsapScoreBump() {
    gsap.fromTo(scoreEl,
      { scale: 1 },
      { scale: 1.5, duration: 0.12, ease: 'back.out(4)',
        onComplete: () => gsap.to(scoreEl, { scale: 1, duration: 0.25, ease: 'elastic.out(1, 0.3)' })
      }
    );
  }

  // GSAP Combo Display
  function gsapShowCombo(count) {
    comboText.textContent = `🔥 x${count}`;
    gsap.killTweensOf(comboDisplay);
    gsap.killTweensOf(comboText);

    const tl = gsap.timeline();
    tl.to(comboDisplay, { opacity: 1, duration: 0.2, ease: 'power2.out' })
      .fromTo(comboText,
        { scale: 2, rotation: -15 },
        { scale: 1, rotation: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.4)' },
        '<'
      )
      .fromTo(comboText,
        { scale: 1 },
        { scale: 1.08, rotation: 2, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' },
        '>'
      );

    // Combo bar animation
    gsap.fromTo(comboBarFill, { scaleX: 1 }, { scaleX: 0, duration: 2, ease: 'none',
      onComplete: () => {
        combo = 0;
        gsap.to(comboDisplay, { opacity: 0, duration: 0.3 });
        gsap.killTweensOf(comboText);
      }
    });

    activeTweens.push(tl);
  }

  // GSAP Combo Disappear
  function gsapHideCombo() {
    gsap.killTweensOf(comboDisplay);
    gsap.killTweensOf(comboText);
    gsap.to(comboDisplay, { opacity: 0, duration: 0.3, ease: 'power2.in' });
    gsap.to(comboBarFill, { scaleX: 0, duration: 0.2 });
    combo = 0;
  }

  // ========== GAME LOGIC ==========

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestWhack') || '0');
    bestEl.textContent = bestScore;
  }

  function init() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    killAllTweens();
    moles = Array.from({length: ROWS * COLS}, () => ({
      active: false, hit: false, timer: null,
      popProgress: 0, hitTimer: 0,
      squish: { scaleX: 1, scaleY: 1 },
      bounce: 0
    }));
    score = 0;
    timeLeft = 30;
    gameRunning = false;
    combo = 0;
    hitEffects = [];
    particles = [];
    shockwaves = [];
    scoreEl.textContent = '0';
    timeEl.textContent = '30';
    timeEl.style.color = '';
    timeHud.classList.remove('timer-warning');
    gsap.set(comboDisplay, { opacity: 0 });
    gsap.set(screenFlash, { opacity: 0 });
    gsap.set(borderGlow, { opacity: 0 });
    gsap.set(gameContainer, { x: 0, y: 0, rotation: 0 });
    gsap.set(canvas, { scale: 1 });
    gsap.set(overlayContent, { scale: 1, opacity: 1 });
    gsap.set(resultTitle, { scale: 1, rotation: 0 });
    gsap.set(startBtn, { scale: 1, opacity: 1, boxShadow: 'none' });
    loadBest();
    draw();
  }

  function startGame() {
    if (timer) clearInterval(timer);
    if (spawnInterval) clearInterval(spawnInterval);
    timer = null;
    spawnInterval = null;
    // Clear old mole timers
    if (moles) {
      moles.forEach(m => { if (m.timer) clearTimeout(m.timer); });
    }
    init();

    // GSAP: animate overlay out
    const tl = gsap.timeline({
      onComplete: () => {
        overlay.classList.add('hidden');
        gameRunning = true;

        // Hint text fade out
        gsap.to(hintText, { opacity: 0.2, duration: 0.5, delay: 1 });

        // Start spawning
        spawnInterval = setInterval(() => {
          if (!gameRunning) { clearInterval(spawnInterval); return; }
          spawnMole();
        }, 600);

        // Countdown
        timer = setInterval(() => {
          if (!gameRunning) return;
          timeLeft--;
          timeEl.textContent = timeLeft;

          // GSAP: timer pulse when low
          if (timeLeft <= 10) {
            timeHud.classList.add('timer-warning');
            gsap.fromTo(timeEl, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
            if (timeLeft <= 5) {
              gsapFlash('rgba(255, 50, 50, 0.3)');
            }
          }

          if (timeLeft <= 0) {
            gameRunning = false;
            clearInterval(timer);
            clearInterval(spawnInterval);
            endGame();
          }
        }, 1000);
      }
    });

    // Overlay exit animation
    tl.to(overlayContent, { scale: 0.8, opacity: 0, duration: 0.3, ease: 'back.in(2)' })
      .to(overlay, { opacity: 0, duration: 0.2 }, '-=0.1');

    // GSAP: Canvas entrance
    gsap.fromTo(canvas, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });

    activeTweens.push(tl);
  }

  function spawnMole() {
    const inactiveMoles = moles.map((m, i) => ({m, i})).filter(x => !x.m.active && !x.m.hit);
    if (inactiveMoles.length === 0) return;
    const choice = inactiveMoles[Math.floor(Math.random() * inactiveMoles.length)];
    const mole = choice.m;
    mole.active = true;
    mole.hit = false;
    mole.popProgress = 0;

    // GSAP: elastic pop-up with squish
    const popTl = gsap.timeline();
    popTl.to(mole.squish, {
      scaleX: 1.2, scaleY: 0.8,
      duration: 0.1, ease: 'power2.in'
    })
    .to(mole.squish, {
      scaleX: 0.9, scaleY: 1.15,
      duration: 0.15, ease: 'power2.out'
    })
    .to(mole.squish, {
      scaleX: 1, scaleY: 1,
      duration: 0.2, ease: 'elastic.out(1, 0.4)'
    });

    activeTweens.push(popTl);

    mole.timer = setTimeout(() => {
      if (mole.active) {
        // GSAP: mole retreat animation
        gsap.to(mole.squish, {
          scaleX: 0.8, scaleY: 0.6, duration: 0.2, ease: 'power2.in',
          onComplete: () => {
            mole.active = false;
            mole.squish.scaleX = 1;
            mole.squish.scaleY = 1;
          }
        });
      }
    }, 1200 + Math.random() * 1200);
  }

  function hitMole(index) {
    if (!gameRunning) return;
    const mole = moles[index];
    if (!mole.active || mole.hit) return;
    mole.active = false;
    mole.hit = true;
    mole.hitTimer = 20;
    clearTimeout(mole.timer);

    // Score
    score += 10;
    scoreEl.textContent = score;

    // GSAP: score number counting effect
    gsapScoreBump();
    gsapHudPulse(scoreHud);

    // Combo system
    combo++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      if (combo > 0) gsapHideCombo();
    }, 2500);
    if (combo >= 2) {
      gsapShowCombo(combo);
    }

    // Hit position
    const cx = (index % COLS) * CELL_W + CELL_W / 2;
    const cy = Math.floor(index / COLS) * CELL_H + CELL_H / 2;

    // GSAP: screen effects based on combo
    gsapShake();
    gsapFlash('rgba(255, 255, 200, 0.6)');
    gsapCanvasGlow();

    if (combo >= 5) {
      gsapBorderGlow(1.2);
    }

    // GSAP: hit squish effect on mole
    gsap.to(mole.squish, {
      scaleX: 1.4, scaleY: 0.6,
      duration: 0.08, ease: 'power3.in',
      onComplete: () => {
        gsap.to(mole.squish, {
          scaleX: 0.5, scaleY: 1.3,
          duration: 0.12, ease: 'back.out(2)',
          onComplete: () => {
            gsap.to(mole.squish, {
              scaleX: 1, scaleY: 1,
              duration: 0.15, ease: 'power2.out'
            });
          }
        });
      }
    });

    // Shockwave rings (GSAP-driven canvas objects)
    for (let r = 0; r < (combo >= 3 ? 3 : 2); r++) {
      const sw = { x: cx, y: cy, radius: 5, alpha: 1, lineWidth: 4 - r, maxRadius: 50 + r * 25 };
      shockwaves.push(sw);
      gsap.to(sw, {
        radius: sw.maxRadius,
        alpha: 0,
        duration: 0.5 + r * 0.15,
        delay: r * 0.08,
        ease: 'power2.out',
        onComplete: () => {
          const idx = shockwaves.indexOf(sw);
          if (idx >= 0) shockwaves.splice(idx, 1);
        }
      });
    }

    // GSAP: particle explosion
    const particleCount = combo >= 3 ? 20 : 12;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i / particleCount) + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 80;
      const p = {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        r: Math.random() * 4 + 2,
        life: 1,
        color: `hsl(${Math.random() * 60 + 30}, 100%, 60%)`
      };
      particles.push(p);

      gsap.to(p, {
        life: 0,
        duration: 0.8 + Math.random() * 0.4,
        ease: 'power2.in',
        onComplete: () => {
          const idx = particles.indexOf(p);
          if (idx >= 0) particles.splice(idx, 1);
        }
      });
    }

    // Score floating text (GSAP)
    const scoreFloat = {
      x: cx, y: cy - 30,
      text: combo >= 2 ? `+${10 * combo}` : '+10',
      alpha: 1, vy: -2, scale: 1.5
    };
    hitEffects.push(scoreFloat);
    gsap.to(scoreFloat, {
      alpha: 0, vy: -3, scale: 0.8,
      y: '-=40',
      duration: 1,
      ease: 'power2.out',
      onComplete: () => {
        const idx = hitEffects.indexOf(scoreFloat);
        if (idx >= 0) hitEffects.splice(idx, 1);
      }
    });

    // Combo hit text effect
    if (combo >= 3) {
      const comboHitText = {
        x: cx + (Math.random() - 0.5) * 30,
        y: cy - 60,
        text: combo >= 7 ? '💀 LEGENDARY!' : combo >= 5 ? '🔥 AMAZING!' : '⚡ GREAT!',
        alpha: 1, scale: 2,
        color: combo >= 7 ? '#ff00ff' : combo >= 5 ? '#ff4060' : '#ffaa00'
      };
      hitEffects.push(comboHitText);

      gsap.fromTo(comboHitText,
        { scale: 2.5, alpha: 0 },
        { scale: 1, alpha: 1, duration: 0.3, ease: 'back.out(2)',
          onComplete: () => {
            gsap.to(comboHitText, {
              alpha: 0, y: '-=30', scale: 0.5,
              duration: 0.6, delay: 0.3, ease: 'power2.in',
              onComplete: () => {
                const idx = hitEffects.indexOf(comboHitText);
                if (idx >= 0) hitEffects.splice(idx, 1);
              }
            });
          }
        }
      );
    }
  }

  function endGame() {
    gsapHideCombo();

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestWhack', bestScore);
      bestEl.textContent = bestScore;
      resultTitle.textContent = '🎉 新纪录！';

      // GSAP: celebration effects
      gsapFlash('rgba(255, 215, 0, 0.5)');
      gsapBorderGlow(2);

      // Celebration particles
      for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i / 30);
        const speed = 100 + Math.random() * 150;
        const p = {
          x: W / 2, y: H / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 50,
          r: Math.random() * 5 + 3,
          life: 1,
          color: `hsl(${Math.random() * 360}, 100%, 60%)`
        };
        particles.push(p);
        gsap.to(p, { life: 0, duration: 1.5, ease: 'power2.in',
          onComplete: () => {
            const idx = particles.indexOf(p);
            if (idx >= 0) particles.splice(idx, 1);
          }
        });
      }
    } else {
      resultTitle.textContent = '⏱️ 时间到！';
    }
    resultText.textContent = `得分: ${score}`;
    startBtn.textContent = '再来一局';

    // GSAP: overlay entrance
    overlay.classList.remove('hidden');
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo(overlayContent,
      { scale: 0.3, opacity: 0, rotation: -10 },
      { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)', delay: 0.1 }
    );
    gsap.fromTo(resultTitle,
      { scale: 0 },
      { scale: 1, duration: 0.5, ease: 'back.out(3)', delay: 0.3 }
    );
  }

  // ========== RENDER LOOP ==========

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3a7a28');
    grad.addColorStop(0.5, '#2d5a1e');
    grad.addColorStop(1, '#1a3a10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Grass texture
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

    // Holes and moles
    const IMG_SIZE = CELL_W * 0.9;
    for (let i = 0; i < ROWS * COLS; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = col * CELL_W + CELL_W / 2;
      const cy = row * CELL_H + CELL_H / 2 + 20;
      const mole = moles[i];

      // Hole shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + HOLE_R * 0.3, HOLE_R * 1.2, HOLE_R * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hole
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, HOLE_R * 1.1, HOLE_R * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dirt mound
      ctx.fillStyle = '#5a4020';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, HOLE_R * 1.15, HOLE_R * 0.25, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // Hit mole (dizzy animation)
      if (mole.hit && mole.hitTimer > 0) {
        mole.hitTimer--;
        const alpha = mole.hitTimer / 20;
        const shake = Math.sin(mole.hitTimer * 3) * 4 * alpha;
        const imgY = cy - IMG_SIZE * 0.6;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(shake, Math.sin(mole.hitTimer * 5) * 2);
        ctx.beginPath();
        ctx.rect(cx - IMG_SIZE, imgY, IMG_SIZE * 2, cy - imgY + 4);
        ctx.clip();
        // Apply squish from GSAP
        ctx.translate(cx, imgY + IMG_SIZE / 2);
        ctx.scale(mole.squish.scaleX, mole.squish.scaleY);
        ctx.translate(-cx, -(imgY + IMG_SIZE / 2));
        ctx.drawImage(moleHitImg, cx - IMG_SIZE / 2, imgY, IMG_SIZE, IMG_SIZE);
        ctx.restore();
        if (mole.hitTimer <= 0) mole.hit = false;
      }

      // Active mole with GSAP squish
      if (mole.active) {
        if (mole.popProgress < 1) mole.popProgress = Math.min(1, mole.popProgress + 0.08);
        const pop = easeOutBack(mole.popProgress);
        const imgY = cy - IMG_SIZE * pop * 0.6;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - IMG_SIZE, imgY, IMG_SIZE * 2, cy - imgY + 4);
        ctx.clip();
        ctx.globalAlpha = pop;
        // Apply GSAP squish transform
        ctx.translate(cx, imgY + IMG_SIZE / 2);
        ctx.scale(mole.squish.scaleX, mole.squish.scaleY);
        ctx.translate(-cx, -(imgY + IMG_SIZE / 2));
        ctx.drawImage(moleImg, cx - IMG_SIZE / 2, imgY, IMG_SIZE, IMG_SIZE);
        ctx.restore();
      }
    }

    // GSAP-driven shockwaves
    for (const sw of shockwaves) {
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = '#ffe040';
      ctx.lineWidth = sw.lineWidth;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // GSAP-driven floating score text
    for (const e of hitEffects) {
      ctx.save();
      ctx.globalAlpha = e.alpha;
      ctx.fillStyle = e.color || '#ffe040';
      ctx.font = `bold ${Math.round(20 * (e.scale || 1))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = e.color || '#ffe040';
      ctx.shadowBlur = 10 * (e.alpha || 1);
      ctx.fillText(e.text, e.x, e.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // GSAP-driven particles
    for (const p of particles) {
      if (p.life <= 0) continue;
      // Update position using velocity (gravity)
      p.x += p.vx * 0.016;
      p.vy += 120 * 0.016; // gravity
      p.y += p.vy * 0.016;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ========== INPUT HANDLING ==========

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

  // GSAP: button hover animation
  startBtn.addEventListener('mouseenter', () => {
    gsap.to(startBtn, { scale: 1.08, boxShadow: '0 4px 25px rgba(200,50,200,0.7)', duration: 0.3, ease: 'back.out(2)' });
  });
  startBtn.addEventListener('mouseleave', () => {
    gsap.to(startBtn, { scale: 1, boxShadow: 'none', duration: 0.2, ease: 'power2.out' });
  });

  startBtn.addEventListener('click', startGame);

  // ========== BACKGROUND PARTICLES ==========

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
    update() {
      this.x += this.dx; this.y += this.dy;
      if (this.x<-10||this.x>bgCanvas.width+10||this.y<-10||this.y>bgCanvas.height+10) this.reset();
    }
    draw(c) {
      c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2);
      c.fillStyle = `hsla(${this.h},60%,50%,${this.a})`; c.fill();
    }
  }
  for (let i = 0; i < 40; i++) bgParticles.push(new BgP());
  function bgAnim() {
    bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
    for (const p of bgParticles) { p.update(); p.draw(bgCtx); }
    requestAnimationFrame(bgAnim);
  }
  bgAnim();

  // GSAP: initial overlay entrance animation
  gsap.fromTo(overlayContent,
    { scale: 0.5, opacity: 0, y: 30 },
    { scale: 1, opacity: 1, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.6)', delay: 0.2 }
  );
  gsap.fromTo(resultTitle,
    { scale: 0, rotation: -20 },
    { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(3)', delay: 0.5 }
  );
  gsap.fromTo(startBtn,
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.7 }
  );

  init();
})();
