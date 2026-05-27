(function() {
  'use strict';

  const cardsGrid = document.getElementById('cardsGrid');
  const movesEl = document.getElementById('movesDisplay');
  const matchesEl = document.getElementById('matchesDisplay');
  const timerEl = document.getElementById('timerDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultScore = document.getElementById('resultScore');
  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');

  const EMOJIS = ['🌈','⭐','🎯','🎨','🎭','🎪','🎠','🦋','🌺','🍀','🌙','☀️','❄️','💎','🔮','🎀','🧩','🎵'];

  let cards, firstPick, secondPick;
  let moves, matchedPairs, totalPairs;
  let isChecking;
  let timer, timerInterval;
  let gameOver;
  let mode; // 'easy' | 'hard'
  let bestMoves, bestTime;

  const bgCanvas = document.getElementById('bgCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  let bgParticles = [];

  (function initBg() {
    function resize() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.r = Math.random() * 2 + 0.3;
        this.dx = Math.random() * 0.3 - 0.15;
        this.dy = Math.random() * 0.3 - 0.15;
        this.alpha = Math.random() * 0.4 + 0.08;
        this.pulse = Math.random() * Math.PI * 2;
        this.hue = Math.random() * 40 + 260;
      }
      update() {
        this.pulse += 0.005;
        this.x += this.dx + Math.sin(this.pulse * 0.4) * 0.06;
        this.y += this.dy + Math.cos(this.pulse * 0.3) * 0.06;
        if (this.x < -20 || this.x > bgCanvas.width + 20 || this.y < -20 || this.y > bgCanvas.height + 20) this.reset();
      }
      draw(ctx) {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 50%, 65%, ${this.alpha + Math.sin(this.pulse) * 0.05})`;
        ctx.fill();
      }
    }
    for (let i = 0; i < 40; i++) bgParticles.push(new Particle());
    function animate() {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      for (const p of bgParticles) { p.update(); p.draw(bgCtx); }
      requestAnimationFrame(animate);
    }
    animate();
  })();

  function loadBest() {
    const key = mode === 'easy' ? 'bestMemoryEasy' : 'bestMemoryHard';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    bestMoves = data.moves || Infinity;
    bestTime = data.time || Infinity;
    updateBestDisplay();
  }

  function saveBest() {
    const key = mode === 'easy' ? 'bestMemoryEasy' : 'bestMemoryHard';
    if (moves < bestMoves || (moves === bestMoves && timer < bestTime)) {
      bestMoves = moves;
      bestTime = timer;
      localStorage.setItem(key, JSON.stringify({ moves, time: timer }));
    }
    updateBestDisplay();
  }

  function updateBestDisplay() {
    if (bestMoves === Infinity) { bestEl.textContent = '-'; return; }
    bestEl.textContent = bestMoves + '步/' + bestTime + 's';
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildCards() {
    const pairs = mode === 'easy' ? 8 : 10;
    totalPairs = pairs;
    const picked = shuffle(EMOJIS).slice(0, pairs);
    const deck = [];
    for (let i = 0; i < pairs; i++) {
      deck.push({ pairId: i, emoji: picked[i], flipped: false, matched: false });
      deck.push({ pairId: i, emoji: picked[i], flipped: false, matched: false });
    }
    return shuffle(deck);
  }

  function renderCards() {
    cardsGrid.innerHTML = '';
    cardsGrid.className = 'cards-grid ' + (mode === 'easy' ? 'easy' : 'hard');

    cards.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      if (card.flipped || card.matched) cardEl.classList.add('flipped');
      if (card.matched) cardEl.classList.add('matched');

      cardEl.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-front"></div>
          <div class="card-face card-back">${card.emoji}</div>
        </div>`;
      cardEl.addEventListener('click', () => onCardClick(idx, cardEl));
      cardsGrid.appendChild(cardEl);
    });
  }

  function onCardClick(idx, cardEl) {
    if (gameOver) return;
    if (isChecking) return;
    const card = cards[idx];
    if (card.flipped || card.matched) return;
    if (idx === firstPick) return;

    card.flipped = true;
    // GSAP card flip animation
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(cardEl, { scaleX: 1 }, {
        scaleX: 0, duration: 0.15, ease: 'power2.in',
        onComplete() {
          cardEl.classList.add('flipped');
          gsap.fromTo(cardEl, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'back.out(1.7)' });
        }
      });
    } else {
      cardEl.classList.add('flipped');
    }

    if (!timerInterval) startTimer();

    if (firstPick === -1) {
      firstPick = idx;
      return;
    }

    secondPick = idx;
    moves++;
    movesEl.textContent = moves;
    // GSAP score bounce
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(movesEl, { scale: 1.4 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    }
    isChecking = true;

    if (cards[firstPick].pairId === cards[secondPick].pairId) {
      // Match
      setTimeout(() => {
        cards[firstPick].matched = true;
        cards[secondPick].matched = true;
        matchedPairs++;
        matchesEl.textContent = matchedPairs + '/' + totalPairs;

        // Update DOM
        const allCards = cardsGrid.children;
        allCards[firstPick].classList.add('matched');
        allCards[secondPick].classList.add('matched');
        // GSAP match bounce
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(allCards[firstPick], { scale: 1.15 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
          gsap.fromTo(allCards[secondPick], { scale: 1.15 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        }

        firstPick = -1; secondPick = -1;
        isChecking = false;

        if (matchedPairs === totalPairs) {
          gameOver = true;
          clearInterval(timerInterval);
          saveBest();
          resultTitle.textContent = '恭喜通关！';
          resultScore.textContent = '用了 ' + moves + ' 步，耗时 ' + timer + ' 秒';
          overlay.classList.remove('hidden');
          // GSAP overlay elastic entrance
          if (typeof gsap !== 'undefined') {
            const content = overlay.querySelector('.overlay-content');
            gsap.fromTo(content, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
          }
          spawnWinParticles();
        }
      }, 300);
    } else {
      // No match
      setTimeout(() => {
        cards[firstPick].flipped = false;
        cards[secondPick].flipped = false;
        const allCards = cardsGrid.children;
        // GSAP mismatch shake
        if (typeof gsap !== 'undefined') {
          gsap.to(allCards[firstPick], { x: -6, duration: 0.06, yoyo: true, repeat: 5, ease: 'power2.inOut', onComplete() {
            gsap.set(allCards[firstPick], { x: 0 });
            allCards[firstPick].classList.remove('flipped');
          }});
          gsap.to(allCards[secondPick], { x: -6, duration: 0.06, yoyo: true, repeat: 5, ease: 'power2.inOut', onComplete() {
            gsap.set(allCards[secondPick], { x: 0 });
            allCards[secondPick].classList.remove('flipped');
          }});
          setTimeout(() => { firstPick = -1; secondPick = -1; isChecking = false; }, 600);
        } else {
          allCards[firstPick].classList.add('shake');
          allCards[secondPick].classList.add('shake');
          setTimeout(() => {
            allCards[firstPick].classList.remove('flipped', 'shake');
            allCards[secondPick].classList.remove('flipped', 'shake');
            firstPick = -1; secondPick = -1; isChecking = false;
          }, 400);
        }
      }, 600);
    }
  }

  function spawnWinParticles() {
    const container = document.querySelector('.game-container');
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.style.cssText = `
        position:absolute;z-index:20;pointer-events:none;
        left:${40 + Math.random() * 60}%;top:${40 + Math.random() * 40}%;
        width:${4 + Math.random() * 6}px;height:${4 + Math.random() * 6}px;
        background:hsl(${Math.random() * 360},80%,60%);
        border-radius:50%;
        animation:confetti ${0.6 + Math.random() * 0.8}s ease-out forwards;
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  function startTimer() {
    timer = 0;
    timerEl.textContent = '0s';
    timerInterval = setInterval(() => {
      timer++;
      timerEl.textContent = timer + 's';
    }, 1000);
  }

  function resetGame() {
    clearInterval(timerInterval);
    timerInterval = null;
    timer = 0;
    moves = 0;
    matchedPairs = 0;
    firstPick = -1;
    secondPick = -1;
    isChecking = false;
    gameOver = false;

    cards = buildCards();
    movesEl.textContent = '0';
    matchesEl.textContent = '0/' + totalPairs;
    timerEl.textContent = '0s';
    overlay.classList.add('hidden');
    loadBest();
    renderCards();
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    resetGame();
  }

  function bindInput() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    newGameBtn.addEventListener('click', resetGame);
    restartBtn.addEventListener('click', resetGame);
  }

  mode = 'easy';
  resetGame();
  bindInput();

  // Inject confetti keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes confetti {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(${Math.random() * 120 - 60}px, ${Math.random() * 120 - 60}px) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();
