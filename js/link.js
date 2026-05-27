(function() {

/* ===========================================
 *  Background Particles
 * =========================================== */
(function initBg() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.r = Math.random() * 3 + 0.5;
      this.dx = Math.random() * 0.4 - 0.2;
      this.dy = Math.random() * 0.4 - 0.2;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.pulse = Math.random() * Math.PI * 2;
      this.hue = Math.random() * 60 + 30;
    }
    update() {
      this.pulse += 0.006;
      this.x += this.dx + Math.sin(this.pulse * 0.4) * 0.08;
      this.y += this.dy + Math.cos(this.pulse * 0.3) * 0.08;
      if (this.x < -20 || this.x > canvas.width + 20 ||
          this.y < -20 || this.y > canvas.height + 20) this.reset();
    }
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      const a = this.alpha + Math.sin(this.pulse) * 0.08;
      ctx.fillStyle = `hsla(${this.hue}, 60%, 70%, ${a})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 50; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) { p.update(); p.draw(ctx); }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${(1 - dist / 200) * 0.05})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ===========================================
 *  Link Game Engine
 * =========================================== */
const LinkGame = (() => {
  const ROWS = 10;
  const COLS = 8;
  const TOTAL_PAIRS = 40;

  const SYMBOLS = [
    '🍎', '🍊', '🍋', '🍇', '🍓',
    '🍑', '🍒', '🥝',
    '🌺', '🌸', '🌻', '🌹',
    '🍀', '🎄', '🎃', '🎈',
    '⚽', '🏀', '🎾', '🏈'
  ];

  /* ---- DOM Elements ---- */
  let gridEl, lineCanvas, lineCtx;
  let scoreEl, timerEl, pairsEl;
  let hintBtn, shuffleBtn, newBtn;
  let winOverlay, overlayScore, overlayTime, overlayRetry;

  /* ---- State ---- */
  let grid = [];           // ROWS x COLS, null = empty
  let tiles = [];          // 2D array of DOM elements
  let selected = null;     // { row, col } or null
  let score = 0;
  let pairsRemaining = TOTAL_PAIRS;
  let seconds = 0;
  let timerInterval = null;
  let timerStarted = false;
  let animating = false;
  let hintTimeout = null;

  /* ---- Init ---- */
  function init() {
    cacheDOM();
    startGame();
    bindEvents();
  }

  function cacheDOM() {
    gridEl = document.getElementById('tileGrid');
    lineCanvas = document.getElementById('lineCanvas');
    lineCtx = lineCanvas.getContext('2d');
    scoreEl = document.getElementById('scoreDisplay');
    timerEl = document.getElementById('timerDisplay');
    pairsEl = document.getElementById('pairsDisplay');
    hintBtn = document.getElementById('hintBtn');
    shuffleBtn = document.getElementById('shuffleBtn');
    newBtn = document.getElementById('newGameBtn');
    winOverlay = document.getElementById('winOverlay');
    overlayScore = document.getElementById('overlayScore');
    overlayTime = document.getElementById('overlayTime');
    overlayRetry = document.getElementById('overlayRetry');
  }

  /* ---- Game Lifecycle ---- */
  function startGame() {
    grid = [];
    tiles = [];
    selected = null;
    score = 0;
    pairsRemaining = TOTAL_PAIRS;
    seconds = 0;
    timerStarted = false;
    animating = false;
    if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    winOverlay.classList.remove('show');
    timerEl.textContent = '00:00';
    document.querySelector('.board-wrapper').classList.remove('flash');

    generateBoard();
    renderGrid();
    updateStats();

    // Ensure at least one valid pair on start
    if (!findAnyMatch()) {
      doShuffle(true);
    }
  }

  function generateBoard() {
    const pool = [];
    for (const sym of SYMBOLS) {
      for (let i = 0; i < 4; i++) pool.push(sym);
    }
    shuffleArray(pool);

    let idx = 0;
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = pool[idx++];
      }
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    tiles = [];

    for (let r = 0; r < ROWS; r++) {
      tiles[r] = [];
      for (let c = 0; c < COLS; c++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        if (grid[r][c] === null) {
          tile.classList.add('empty');
        } else {
          tile.textContent = grid[r][c];
        }
        tile.addEventListener('click', () => onTileClick(r, c));
        gridEl.appendChild(tile);
        tiles[r][c] = tile;
      }
    }

    syncCanvasSize();
  }

  /* ---- Canvas Sizing ---- */
  function syncCanvasSize() {
    const rect = gridEl.getBoundingClientRect();
    lineCanvas.width = rect.width;
    lineCanvas.height = rect.height;
  }

  /* ---- Tile Selection ---- */
  function onTileClick(row, col) {
    if (animating || grid[row][col] === null) return;

    if (selected === null) {
      selectTile(row, col);
    } else if (selected.row === row && selected.col === col) {
      deselectTile();
    } else {
      const prev = selected;
      deselectTile();

      if (grid[prev.row][prev.col] === grid[row][col]) {
        const path = findPath(prev.row, prev.col, row, col);
        if (path) {
          matchTiles(prev.row, prev.col, row, col, path);
          return;
        }
      }

      selectTile(row, col);
    }
  }

  function selectTile(row, col) {
    selected = { row, col };
    tiles[row][col].classList.add('selected');
    /* GSAP: scale pulse on select */
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(tiles[row][col], { scale: 1 }, {
        scale: 1.2,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: 'back.out(3)',
        clearProps: 'transform',
      });
    }
  }

  function deselectTile() {
    if (selected) {
      tiles[selected.row][selected.col].classList.remove('selected');
      selected = null;
    }
  }

  /* ---- Matching ---- */
  function matchTiles(r1, c1, r2, c2, path) {
    startTimer();
    animating = true;
    deselectTile();

    // Draw connection line
    drawConnectionLine(path, () => {
      // Remove tiles
      grid[r1][c1] = null;
      grid[r2][c2] = null;
      tiles[r1][c1].classList.remove('empty');
      tiles[r1][c1].classList.add('matched');
      tiles[r2][c2].classList.remove('empty');
      tiles[r2][c2].classList.add('matched');

      /* GSAP: elastic scale bounce then fade on matched tiles */
      if (typeof gsap !== 'undefined') {
        [tiles[r1][c1], tiles[r2][c2]].forEach(el => {
          gsap.fromTo(el, { scale: 1 }, {
            scale: 1.3,
            duration: 0.2,
            ease: 'elastic.out(1.2, 0.4)',
            onComplete() {
              gsap.to(el, {
                scale: 0,
                opacity: 0,
                duration: 0.25,
                ease: 'power2.in',
                clearProps: 'transform,opacity',
              });
            },
          });
        });
      }

      score += 10;
      pairsRemaining--;
      popValue(scoreEl);
      pairsEl.textContent = pairsRemaining;

      setTimeout(() => {
        tiles[r1][c1].classList.remove('matched');
        tiles[r1][c1].classList.add('empty');
        tiles[r1][c1].textContent = '';
        tiles[r2][c2].classList.remove('matched');
        tiles[r2][c2].classList.add('empty');
        tiles[r2][c2].textContent = '';

        animating = false;

        if (pairsRemaining === 0) {
          endGame(true);
        } else if (!findAnyMatch()) {
          autoShuffle();
        }
      }, 350);
    });
  }

  function popValue(el) {
    /* GSAP: elastic bounce on score update */
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(el, { scale: 1 }, {
        scale: 1.35,
        duration: 0.35,
        ease: 'elastic.out(1, 0.35)',
        clearProps: 'transform',
      });
    }
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /* ---- Connection Line ---- */
  function drawConnectionLine(path, callback) {
    const ctx = lineCtx;
    const canvasRect = gridEl.getBoundingClientRect();
    const points = path.map(p => getLinePoint(p.r, p.c, canvasRect));

    let progress = 0;
    const duration = 280;

    function getSegLength(a, b) {
      return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }

    // Precompute segment distances and total
    const segs = [];
    let totalDist = 0;
    for (let i = 1; i < points.length; i++) {
      const d = getSegLength(points[i - 1], points[i]);
      segs.push(d);
      totalDist += d;
    }

    function drawFrame(now) {
      progress = Math.min(1, (now - startTime) / duration);
      ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

      const targetDist = progress * totalDist;
      let drawn = 0;

      // Glow layer
      ctx.save();
      ctx.shadowColor = 'rgba(245, 166, 35, 0.6)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 6]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        if (drawn + segs[i - 1] <= targetDist) {
          ctx.lineTo(points[i].x, points[i].y);
          drawn += segs[i - 1];
        } else {
          const remain = targetDist - drawn;
          const ratio = segs[i - 1] > 0 ? remain / segs[i - 1] : 1;
          const x = points[i - 1].x + (points[i].x - points[i - 1].x) * ratio;
          const y = points[i - 1].y + (points[i].y - points[i - 1].y) * ratio;
          ctx.lineTo(x, y);
          drawn += remain;
          break;
        }
      }
      ctx.stroke();

      // Inner bright line
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 224, 140, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      drawn = 0;
      for (let i = 1; i < points.length; i++) {
        if (drawn + segs[i - 1] <= targetDist) {
          ctx.lineTo(points[i].x, points[i].y);
          drawn += segs[i - 1];
        } else {
          const remain = targetDist - drawn;
          const ratio = segs[i - 1] > 0 ? remain / segs[i - 1] : 1;
          const x = points[i - 1].x + (points[i].x - points[i - 1].x) * ratio;
          const y = points[i - 1].y + (points[i].y - points[i - 1].y) * ratio;
          ctx.lineTo(x, y);
          break;
        }
      }
      ctx.stroke();
      ctx.restore();

      if (progress < 1) {
        requestAnimationFrame(drawFrame);
      } else {
        setTimeout(() => {
          ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
          callback();
        }, 150);
      }
    }

    const startTime = performance.now();
    requestAnimationFrame(drawFrame);
  }

  function getLinePoint(r, c, canvasRect) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      const el = tiles[r][c];
      if (el) {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left - canvasRect.left + rect.width / 2,
          y: rect.top - canvasRect.top + rect.height / 2
        };
      }
    }

    // Border point - extrapolate from nearest tile
    const refR = Math.max(0, Math.min(ROWS - 1, r));
    const refC = Math.max(0, Math.min(COLS - 1, c));
    const ref = tiles[refR][refC];
    if (!ref) return { x: 0, y: 0 };

    const rect = ref.getBoundingClientRect();
    const tileW = rect.width;
    const tileH = rect.height;
    const gap = 4;

    let x = rect.left - canvasRect.left + tileW / 2;
    let y = rect.top - canvasRect.top + tileH / 2;

    if (c < 0) x -= (tileW + gap) / 2 + 8;
    if (c >= COLS) x += (tileW + gap) / 2 + 8;
    if (r < 0) y -= (tileH + gap) / 2 + 8;
    if (r >= ROWS) y += (tileH + gap) / 2 + 8;

    return { x, y };
  }

  /* ===========================================
   *  Pathfinding
   * =========================================== */
  function isEmpty(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
    return grid[row][col] === null;
  }

  function isLineClear(r1, c1, r2, c2) {
    if (r1 === r2) {
      const lo = Math.min(c1, c2);
      const hi = Math.max(c1, c2);
      for (let c = lo + 1; c < hi; c++) {
        if (!isEmpty(r1, c)) return false;
      }
      return true;
    }
    if (c1 === c2) {
      const lo = Math.min(r1, r2);
      const hi = Math.max(r1, r2);
      for (let r = lo + 1; r < hi; r++) {
        if (!isEmpty(r, c1)) return false;
      }
      return true;
    }
    return false;
  }

  function findPath(r1, c1, r2, c2) {
    // 0 turns: direct line
    if (r1 === r2 || c1 === c2) {
      if (isLineClear(r1, c1, r2, c2)) {
        return [{ r: r1, c: c1 }, { r: r2, c: c2 }];
      }
    }

    // 1 turn: L-shape
    const corners = [
      { r: r1, c: c2 },
      { r: r2, c: c1 }
    ];
    for (const cp of corners) {
      if (isEmpty(cp.r, cp.c) &&
          isLineClear(r1, c1, cp.r, cp.c) &&
          isLineClear(cp.r, cp.c, r2, c2)) {
        return [{ r: r1, c: c1 }, { r: cp.r, c: cp.c }, { r: r2, c: c2 }];
      }
    }

    // 2 turns: scan all possible mid rows (including -1 and ROWS for border)
    for (let r = -1; r <= ROWS; r++) {
      if (r === r1 || r === r2) continue;
      if (isEmpty(r, c1) && isEmpty(r, c2) &&
          isLineClear(r1, c1, r, c1) &&
          isLineClear(r, c1, r, c2) &&
          isLineClear(r, c2, r2, c2)) {
        return [{ r: r1, c: c1 }, { r, c: c1 }, { r, c: c2 }, { r: r2, c: c2 }];
      }
    }

    // 2 turns: scan all possible mid cols (including -1 and COLS for border)
    for (let c = -1; c <= COLS; c++) {
      if (c === c1 || c === c2) continue;
      if (isEmpty(r1, c) && isEmpty(r2, c) &&
          isLineClear(r1, c1, r1, c) &&
          isLineClear(r1, c, r2, c) &&
          isLineClear(r2, c, r2, c2)) {
        return [{ r: r1, c: c1 }, { r: r1, c }, { r: r2, c }, { r: r2, c: c2 }];
      }
    }

    return null;
  }

  /* ---- Hint System ---- */
  function findAnyMatch() {
    for (let r1 = 0; r1 < ROWS; r1++) {
      for (let c1 = 0; c1 < COLS; c1++) {
        if (grid[r1][c1] === null) continue;
        const sym = grid[r1][c1];
        for (let r2 = r1; r2 < ROWS; r2++) {
          const cStart = (r2 === r1) ? c1 + 1 : 0;
          for (let c2 = cStart; c2 < COLS; c2++) {
            if (grid[r2][c2] === null || grid[r2][c2] !== sym) continue;
            if (findPath(r1, c1, r2, c2)) {
              return [{ r: r1, c: c1 }, { r: r2, c: c2 }];
            }
          }
        }
      }
    }
    return null;
  }

  function showHint() {
    if (animating) return;
    deselectTile();

    const match = findAnyMatch();
    if (!match) {
      autoShuffle();
      return;
    }

    const [a, b] = match;
    tiles[a.r][a.c].classList.add('hint');
    tiles[b.r][b.c].classList.add('hint');

    /* GSAP: subtle glow pulse on hint tiles */
    if (typeof gsap !== 'undefined') {
      [tiles[a.r][a.c], tiles[b.r][b.c]].forEach(el => {
        gsap.fromTo(el, { boxShadow: '0 0 0px rgba(255,215,0,0)' }, {
          boxShadow: '0 0 16px rgba(255,215,0,0.7)',
          duration: 0.4,
          yoyo: true,
          repeat: 2,
          ease: 'power2.inOut',
          clearProps: 'boxShadow',
        });
      });
    }

    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
      tiles[a.r][a.c].classList.remove('hint');
      tiles[b.r][b.c].classList.remove('hint');
      hintTimeout = null;
    }, 1500);
  }

  function autoShuffle() {
    const wrapper = document.querySelector('.board-wrapper');
    wrapper.classList.remove('flash');
    void wrapper.offsetWidth;
    wrapper.classList.add('flash');

    doShuffle(false);
  }

  /* ---- Shuffle ---- */
  function doShuffle(silent) {
    if (animating) return;
    deselectTile();

    // Collect remaining tile values
    const remaining = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) remaining.push(grid[r][c]);
      }
    }

    shuffleArray(remaining);

    // Redistribute
    let idx = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) {
          grid[r][c] = remaining[idx++];
          tiles[r][c].textContent = grid[r][c];
        }
      }
    }

    if (!silent) {
      /* GSAP: stagger animation on shuffle */
      if (typeof gsap !== 'undefined') {
        const allTiles = gridEl.querySelectorAll('.tile:not(.empty)');
        gsap.fromTo(allTiles, { scale: 0.6, opacity: 0.4 }, {
          scale: 1,
          opacity: 1,
          duration: 0.35,
          ease: 'back.out(2)',
          stagger: 0.015,
          clearProps: 'transform,opacity',
        });
      }
      gridEl.classList.remove('shuffling');
      void gridEl.offsetWidth;
      gridEl.classList.add('shuffling');
      setTimeout(() => gridEl.classList.remove('shuffling'), 500);
    }

    // Ensure match exists after shuffle
    if (!findAnyMatch() && pairsRemaining > 1) {
      doShuffle(true);
    }
  }

  function shuffle() {
    if (animating) return;
    doShuffle(false);
  }

  /* ---- Timer ---- */
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = formatTime(seconds);
    }, 1000);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  /* ---- Stats ---- */
  function updateStats() {
    scoreEl.textContent = score;
    pairsEl.textContent = pairsRemaining;
    timerEl.textContent = formatTime(seconds);
  }

  /* ---- End Game ---- */
  function endGame(won) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    overlayScore.textContent = `最终得分: ${score}`;
    overlayTime.textContent = `用时: ${formatTime(seconds)}`;
    winOverlay.classList.add('show');
    /* GSAP: elastic entrance on win overlay */
    if (typeof gsap !== 'undefined') {
      const overlayContent = winOverlay.querySelector('.overlay-icon, h2, p, button');
      gsap.fromTo(winOverlay, { opacity: 0 }, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
      const children = winOverlay.children;
      gsap.fromTo(children, { scale: 0.3, opacity: 0 }, {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)',
        stagger: 0.1,
        clearProps: 'transform,opacity',
      });
    }
  }

  /* ---- Events ---- */
  function bindEvents() {
    hintBtn.addEventListener('click', showHint);
    shuffleBtn.addEventListener('click', shuffle);
    newBtn.addEventListener('click', startGame);
    overlayRetry.addEventListener('click', startGame);

    window.addEventListener('resize', () => {
      syncCanvasSize();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); showHint(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); shuffle(); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); startGame(); }
    });
  }

  /* ---- Utility ---- */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  return Object.freeze({ init });
})();

document.addEventListener('DOMContentLoaded', () => LinkGame.init());

})();
