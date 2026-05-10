const Game2048 = (() => {
  'use strict';

  // ========== Constants ==========
  const SIZE = 4;
  const STAR_CHANCE = 0.08;
  const MILESTONES = [500, 2000, 5000, 10000, 20000];
  const POWERUP_MAX = 3;

  const COMBO_TABLE = [
    { min: 6, mult: 3, label: 'COMBO x3' },
    { min: 4, mult: 2, label: 'COMBO x2' },
    { min: 2, mult: 1.5, label: 'COMBO x1.5' },
  ];

  const DIRECTION_VECTORS = {
    up:    { rows: [0,1,2,3], cols: [0,1,2,3], dr: -1, dc: 0 },
    down:  { rows: [3,2,1,0], cols: [0,1,2,3], dr: 1, dc: 0 },
    left:  { rows: [0,1,2,3], cols: [0,1,2,3], dr: 0, dc: -1 },
    right: { rows: [0,1,2,3], cols: [3,2,1,0], dr: 0, dc: 1 },
  };

  // ========== State ==========
  let grid, tiles, score, bestScore;
  let over, won, keepPlaying;
  let history;
  let idCounter, animating, animTimer;
  let mode = 'classic';
  let blitzTime, blitzTimer;
  let powerUps;
  let lastMilestone;
  let mergeCount;
  let hintCells;

  // ========== DOM Refs ==========
  let gridContainer, tileLayer, gridBg;
  let scoreDisplay, bestDisplay;
  let undoBtn, newBtn, retryBtn, keepGoingBtn;
  let overlay, resultTitle, resultScore;
  let modeClassicBtn, modeBlitzBtn;
  let blitzTimerEl;
  let powerClearBtn, powerHintBtn, powerShuffleBtn;
  let bgCanvas, bgCtx, particles;
  let confCanvas, confCtx, confetti, confettiRunning;

  // ========== Initialization ==========
  function init() {
    cacheDOM();
    buildGridBg();
    initBgParticles();
    initConfetti();
    bindInput();
    resetGame();
  }

  function cacheDOM() {
    gridContainer = document.getElementById('gridContainer');
    tileLayer = document.getElementById('tileLayer');
    gridBg = document.getElementById('gridBg');
    scoreDisplay = document.getElementById('scoreDisplay');
    bestDisplay = document.getElementById('bestDisplay');
    undoBtn = document.getElementById('undoBtn');
    newBtn = document.getElementById('newBtn');
    retryBtn = document.getElementById('retryBtn');
    keepGoingBtn = document.getElementById('keepGoingBtn');
    overlay = document.getElementById('gameOverOverlay');
    resultTitle = document.getElementById('resultTitle');
    resultScore = document.getElementById('resultScore');
    modeClassicBtn = document.getElementById('modeClassic');
    modeBlitzBtn = document.getElementById('modeBlitz');
    blitzTimerEl = document.getElementById('blitzTimer');
    powerClearBtn = document.getElementById('powerClear');
    powerHintBtn = document.getElementById('powerHint');
    powerShuffleBtn = document.getElementById('powerShuffle');
    bgCanvas = document.getElementById('bgCanvas');
    confCanvas = document.getElementById('confettiCanvas');
    bgCtx = bgCanvas.getContext('2d');
    confCtx = confCanvas.getContext('2d');
  }

  function buildGridBg() {
    gridBg.innerHTML = '';
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      gridBg.appendChild(cell);
    }
  }

  function resetGame() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles = [];
    score = 0;
    over = false;
    won = false;
    keepPlaying = false;
    history = null;
    idCounter = 0;
    animating = false;
    animTimer = null;
    mergeCount = 0;
    hintCells = [];
    powerUps = { clear: 0, hint: 0, shuffle: 0 };
    lastMilestone = 0;

    if (blitzTimer) { clearInterval(blitzTimer); blitzTimer = null; }

    overlay.classList.remove('show');
    gridContainer.classList.remove('combo-active');

    bestScore = parseInt(localStorage.getItem('best2048') || '0');
    updateScore();
    updatePowerUpButtons();
    updateBlitzUI();

    addRandomTile();
    addRandomTile();
    render();
    undoBtn.disabled = true;
  }

  // ========== Grid Math ==========
  function getTileParams() {
    const size = gridContainer.clientWidth;
    const pad = size * 0.024;
    const gap = pad;
    const cell = (size - 2 * pad - 3 * gap) / 4;
    return { size, pad, gap, cell };
  }

  // ========== Tile Factory ==========
  function makeTile(value, row, col, opts = {}) {
    return {
      id: ++idCounter,
      value,
      row,
      col,
      isNew: !!opts.isNew,
      isMerged: false,
      isStar: !!opts.isStar,
      mergedInto: null,
    };
  }

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) empty.push({ r, c });
    if (empty.length === 0) return null;

    const pos = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const isStar = Math.random() < STAR_CHANCE;
    const tile = makeTile(value, pos.r, pos.c, { isNew: true, isStar });
    grid[pos.r][pos.c] = tile;
    tiles.push(tile);
    return tile;
  }

  // ========== State Save / Undo ==========
  function saveState() {
    history = {
      grid: grid.map(row => row.map(t => t ? { ...t, isNew: false, isMerged: false, mergedInto: null } : null)),
      tiles: tiles.map(t => ({ ...t, isNew: false, isMerged: false, mergedInto: null })),
      score,
      powerUps: { ...powerUps },
      lastMilestone,
    };
  }

  function undo() {
    if (!history || animating) return;
    grid = history.grid;
    tiles = history.tiles;
    score = history.score;
    powerUps = history.powerUps;
    lastMilestone = history.lastMilestone;
    over = false;
    won = false;
    keepPlaying = false;
    history = null;
    hintCells = [];
    undoBtn.disabled = true;
    overlay.classList.remove('show');
    updateScore();
    updatePowerUpButtons();
    render();
  }

  // ========== Combo ==========
  function getComboInfo(count) {
    for (const entry of COMBO_TABLE) {
      if (count >= entry.min) return entry;
    }
    return { mult: 1, label: '' };
  }

  function showComboToast(label) {
    const el = document.createElement('div');
    el.className = 'combo-toast';
    el.textContent = label;
    gridContainer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ========== Milestones ==========
  function checkMilestone() {
    for (const ms of MILESTONES) {
      if (score >= ms && lastMilestone < ms) {
        lastMilestone = ms;
        return ms;
      }
    }
    return null;
  }

  function awardPowerUp() {
    const types = ['clear', 'hint', 'shuffle'];
    // Prioritize the type with fewest
    types.sort((a, b) => (powerUps[a] || 0) - (powerUps[b] || 0));
    const chosen = types[0];
    if ((powerUps[chosen] || 0) < POWERUP_MAX) {
      powerUps[chosen] = (powerUps[chosen] || 0) + 1;
    }
  }

  function showMilestoneToast(ms) {
    const el = document.createElement('div');
    el.className = 'milestone-toast';
    el.textContent = ms + ' 分！获得新道具 ✨';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ========== Power-ups ==========
  function useClear() {
    if (animating || over || !powerUps.clear) return;
    powerUps.clear--;
    const toRemove = [];
    for (const t of tiles) {
      if (t.value === 2 || t.value === 4) {
        grid[t.row][t.col] = null;
        toRemove.push(t);
      }
    }
    tiles = tiles.filter(t => !toRemove.includes(t));
    // Respawn one tile to keep game going
    if (tiles.length < 16) addRandomTile();
    updatePowerUpButtons();
    render();
    // Re-check game over
    if (tiles.length >= 16 && !canMove()) {
      over = true;
      showOverlay(false);
    }
  }

  function useHint() {
    if (animating || over || !powerUps.hint) return;
    powerUps.hint--;

    // Simulate each direction, find best
    let bestDir = null, bestScore = -1, bestCells = [];
    for (const dir of ['up', 'down', 'left', 'right']) {
      const result = simulateSlide(dir);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestDir = dir;
        bestCells = result.cells;
      }
    }

    if (bestDir && bestCells.length > 0) {
      hintCells = bestCells;
      render();
      setTimeout(() => { hintCells = []; render(); }, 1500);
    }
    updatePowerUpButtons();
  }

  function simulateSlide(direction) {
    const simGrid = grid.map(row => row.map(t => t ? { value: t.value, row: t.row, col: t.col, merged: false } : null));
    const cfg = DIRECTION_VECTORS[direction];
    let simScore = 0;
    const cells = [];

    for (const r of cfg.rows) {
      for (const c of cfg.cols) {
        const tile = simGrid[r][c];
        if (!tile) continue;
        let nr = r, nc = c;
        let didMerge = false;
        while (true) {
          const tr = nr + cfg.dr, tc = nc + cfg.dc;
          if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;
          const next = simGrid[tr][tc];
          if (!next) { nr = tr; nc = tc; }
          else if (next.value === tile.value && !next.merged) {
            next.value *= 2;
            simScore += next.value;
            next.merged = true;
            simGrid[r][c] = null;
            cells.push({ r: tr, c: tc });
            didMerge = true;
            break;
          } else break;
        }
        if (!didMerge && (nr !== r || nc !== c)) {
          simGrid[nr][nc] = tile;
          simGrid[r][c] = null;
          tile.row = nr; tile.col = nc;
        }
      }
    }
    return { score: simScore, cells };
  }

  function useShuffle() {
    if (animating || over || !powerUps.shuffle) return;
    powerUps.shuffle--;

    const values = tiles.map(t => ({ value: t.value, isStar: t.isStar }));
    const positions = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        positions.push({ r, c });

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Reassign
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      t.row = positions[i].r;
      t.col = positions[i].c;
      t.isNew = false;
      t.isMerged = false;
      grid[t.row][t.col] = t;
    }

    updatePowerUpButtons();
    render();
  }

  function updatePowerUpButtons() {
    if (powerClearBtn) {
      powerClearBtn.disabled = !powerUps.clear;
      const badge = powerClearBtn.querySelector('.badge');
      if (badge) badge.textContent = powerUps.clear || 0;
    }
    if (powerHintBtn) {
      powerHintBtn.disabled = !powerUps.hint;
      const badge = powerHintBtn.querySelector('.badge');
      if (badge) badge.textContent = powerUps.hint || 0;
    }
    if (powerShuffleBtn) {
      powerShuffleBtn.disabled = !powerUps.shuffle;
      const badge = powerShuffleBtn.querySelector('.badge');
      if (badge) badge.textContent = powerUps.shuffle || 0;
    }
  }

  // ========== Game Modes ==========
  function setMode(m) {
    if (m === mode || animating) return;
    mode = m;

    if (mode === 'classic') {
      modeClassicBtn.classList.add('active');
      modeBlitzBtn.classList.remove('active');
    } else {
      modeBlitzBtn.classList.add('active');
      modeClassicBtn.classList.remove('active');
    }
    resetGame();
  }

  function updateBlitzUI() {
    if (mode === 'blitz') {
      blitzTimerEl.classList.add('visible');
      blitzTimerEl.classList.remove('urgent');
      blitzTime = 60;
      blitzTimerEl.textContent = '60s';
    } else {
      blitzTimerEl.classList.remove('visible', 'urgent');
    }
  }

  function startBlitzIfNeeded() {
    if (mode !== 'blitz') return;
    if (blitzTimer) return;
    blitzTime = 60;
    blitzTimerEl.textContent = '60s';
    blitzTimer = setInterval(() => {
      blitzTime--;
      blitzTimerEl.textContent = blitzTime + 's';
      if (blitzTime <= 10) blitzTimerEl.classList.add('urgent');
      if (blitzTime <= 0) {
        clearInterval(blitzTimer);
        blitzTimer = null;
        over = true;
        showOverlay(false, true);
      }
    }, 1000);
  }

  // ========== Core Movement ==========
  function slide(direction) {
    if (over || animating) return false;

    saveState();
    undoBtn.disabled = false;

    // Reset animation flags
    for (const t of tiles) {
      t.isNew = false;
      t.isMerged = false;
      t.mergedInto = null;
    }
    hintCells = [];
    mergeCount = 0;

    const scoreBeforeMove = score;
    const cfg = DIRECTION_VECTORS[direction];
    let moved = false;
    const absorbed = [];

    for (const r of cfg.rows) {
      for (const c of cfg.cols) {
        const tile = grid[r][c];
        if (!tile) continue;

        let nr = r, nc = c;
        let mergeTarget = null;

        while (true) {
          const tr = nr + cfg.dr, tc = nc + cfg.dc;
          if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;
          const next = grid[tr][tc];
          if (!next) { nr = tr; nc = tc; }
          else if (next.value === tile.value && !next.isMerged) {
            mergeTarget = next; nr = tr; nc = tc; break;
          } else break;
        }

        if (nr !== r || nc !== c) {
          moved = true;

          if (mergeTarget) {
            // Calculate merge value with star bonus
            let multiplier = 1;
            if (tile.isStar && mergeTarget.isStar) multiplier = 4;
            else if (tile.isStar || mergeTarget.isStar) multiplier = 2;

            const baseValue = mergeTarget.value * 2;
            const bonusValue = baseValue * (multiplier - 1);
            const finalValue = baseValue + bonusValue;

            mergeTarget.value = finalValue;
            mergeTarget.isMerged = true;
            mergeTarget.isStar = mergeTarget.isStar || tile.isStar; // inherit star
            score += finalValue;
            mergeCount++;

            grid[r][c] = null;
            tile.row = nr; tile.col = nc;
            tile.mergedInto = mergeTarget;
            absorbed.push(tile);
          } else {
            grid[nr][nc] = tile;
            grid[r][c] = null;
            tile.row = nr; tile.col = nc;
          }
        }
      }
    }

    if (moved) {
      // Apply combo multiplier (only to points gained this move)
      const combo = getComboInfo(mergeCount);
      if (combo.mult > 1) {
        const gained = score - scoreBeforeMove;
        const bonus = Math.round(gained * (combo.mult - 1));
        score += bonus;
        setTimeout(() => showComboToast(combo.label), 50);
        setTimeout(() => gridContainer.classList.add('combo-active'), 50);
        setTimeout(() => gridContainer.classList.remove('combo-active'), 800);
      }

      animating = true;
      render();

      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('best2048', bestScore);
      }
      updateScore();

      // Check milestone
      const ms = checkMilestone();
      if (ms) {
        awardPowerUp();
        updatePowerUpButtons();
        showMilestoneToast(ms);
        // Animate unlock on powerup buttons
        if (powerClearBtn) powerClearBtn.classList.add('unlock');
        if (powerHintBtn) powerHintBtn.classList.add('unlock');
        if (powerShuffleBtn) powerShuffleBtn.classList.add('unlock');
        setTimeout(() => {
          powerClearBtn.classList.remove('unlock');
          powerHintBtn.classList.remove('unlock');
          powerShuffleBtn.classList.remove('unlock');
        }, 600);
      }

      // Start blitz timer on first move
      startBlitzIfNeeded();

      animTimer = setTimeout(() => {
        for (const t of absorbed) {
          const idx = tiles.indexOf(t);
          if (idx >= 0) tiles.splice(idx, 1);
        }

        addRandomTile();
        render();
        animating = false;

        // Win check
        if (!won && !keepPlaying && tiles.some(t => t.value >= 2048)) {
          won = true;
          if (blitzTimer) { clearInterval(blitzTimer); blitzTimer = null; }
          startConfetti();
          showOverlay(true);
        } else if (!over && tiles.length >= 16 && !canMove()) {
          over = true;
          if (blitzTimer) { clearInterval(blitzTimer); blitzTimer = null; }
          showOverlay(false);
        }
      }, 130);
    } else {
      history = null;
      undoBtn.disabled = true;
    }

    return moved;
  }

  function canMove() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) return true;
        if (c + 1 < SIZE && grid[r][c + 1] && grid[r][c].value === grid[r][c + 1].value) return true;
        if (r + 1 < SIZE && grid[r + 1][c] && grid[r][c].value === grid[r + 1][c].value) return true;
      }
    return false;
  }

  // ========== Overlay ==========
  function showOverlay(isWin, isTimeUp) {
    if (isWin) {
      resultTitle.textContent = '你赢了！';
      resultTitle.className = 'win-title';
      resultScore.textContent = '得分: ' + score;
    } else if (isTimeUp) {
      resultTitle.textContent = '时间到！';
      resultTitle.className = 'timeup-title';
      resultScore.textContent = '最终得分: ' + score;
    } else {
      resultTitle.textContent = '游戏结束';
      resultTitle.className = 'lose-title';
      resultScore.textContent = '得分: ' + score;
    }
    keepGoingBtn.style.display = isWin ? '' : 'none';
    overlay.classList.add('show');
  }

  // ========== Rendering ==========
  function render() {
    const existingIds = new Set(tiles.map(t => t.id));
    tileLayer.querySelectorAll('.tile').forEach(el => {
      if (!existingIds.has(parseInt(el.dataset.id))) el.remove();
    });

    const { pad, gap, cell } = getTileParams();
    const hintSet = new Set(hintCells.map(h => h.r * 4 + h.c));

    // Update grid background hint glows
    const cells = gridBg.querySelectorAll('.grid-cell');
    cells.forEach((cel, i) => {
      const r = Math.floor(i / 4), c = i % 4;
      cel.classList.toggle('hint-glow', hintSet.has(r * 4 + c));
    });

    for (const tile of tiles) {
      let el = tileLayer.querySelector(`.tile[data-id="${tile.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.dataset.id = tile.id;
        tileLayer.appendChild(el);
      }

      const x = pad + tile.col * (cell + gap);
      const y = pad + tile.row * (cell + gap);

      el.style.width = cell + 'px';
      el.style.height = cell + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';

      let displayValue = tile.value;
      if (tile.isStar) {
        el.innerHTML = displayValue + '<span style="font-size:0.5em;margin-left:1px">✦</span>';
      } else {
        el.textContent = displayValue;
      }

      el.dataset.digits = displayValue.toString().length;

      let cls = 'tile tile-' + Math.min(tile.value, 2048);
      if (tile.value > 2048) cls += ' tile-super';
      if (tile.isStar) cls += ' tile-star';
      if (tile.isMerged) cls += ' tile-merged';
      if (tile.isNew) cls += ' tile-new';
      el.className = cls;
    }
  }

  function updateScore() {
    scoreDisplay.textContent = score;
    bestDisplay.textContent = bestScore;
    scoreDisplay.classList.remove('pop');
    void scoreDisplay.offsetWidth;
    scoreDisplay.classList.add('pop');
  }

  // ========== Background Particles ==========
  function initBgParticles() {
    function resize() {
      bgCanvas.width = window.innerWidth;
      bgCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.r = Math.random() * 2.5 + 0.5;
        this.dx = Math.random() * 0.3 - 0.15;
        this.dy = Math.random() * 0.3 - 0.15;
        this.alpha = Math.random() * 0.4 + 0.1;
        this.pulse = Math.random() * Math.PI * 2;
      }
      update() {
        this.pulse += 0.008;
        this.x += this.dx + Math.sin(this.pulse * 0.5) * 0.1;
        this.y += this.dy + Math.cos(this.pulse * 0.3) * 0.1;
        if (this.x < -10 || this.x > bgCanvas.width + 10 ||
            this.y < -10 || this.y > bgCanvas.height + 10) this.reset();
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${this.alpha + Math.sin(this.pulse) * 0.1})`;
        ctx.fill();
      }
    }
    particles = Array.from({ length: 50 }, () => new Particle());

    function animate() {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      for (const p of particles) { p.update(); p.draw(bgCtx); }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            bgCtx.beginPath();
            bgCtx.moveTo(particles[i].x, particles[i].y);
            bgCtx.lineTo(particles[j].x, particles[j].y);
            bgCtx.strokeStyle = `rgba(255,255,255,${(1 - dist / 180) * 0.06})`;
            bgCtx.lineWidth = 0.5;
            bgCtx.stroke();
          }
        }
      }
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ========== Confetti ==========
  let confettiAnimFrame;

  function makeConfettiPiece() {
    return {
      x: Math.random() * confCanvas.width,
      y: -20,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      vx: Math.random() * 3 - 1.5,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: Math.random() * 0.1 - 0.05,
      update() {
        this.x += this.vx + Math.sin(this.rot) * 0.3;
        this.y += this.vy;
        this.vy += 0.04;
        this.rot += this.rotSpeed;
        return this.y < confCanvas.height + 20;
      },
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.restore();
      },
    };
  }

  function initConfetti() {
    function resize() {
      confCanvas.width = window.innerWidth;
      confCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();
  }

  function startConfetti() {
    confetti = [];
    confettiRunning = true;
    for (let i = 0; i < 120; i++) {
      setTimeout(() => { if (confettiRunning) confetti.push(makeConfettiPiece()); }, i * 30);
    }
    function animate() {
      confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height);
      confetti = confetti.filter(c => c.update());
      for (const c of confetti) c.draw(confCtx);
      if (confetti.length > 0 || confettiRunning) {
        confettiAnimFrame = requestAnimationFrame(animate);
      }
    }
    animate();
    setTimeout(() => { confettiRunning = false; }, 8000);
  }

  // ========== Input ==========
  function bindInput() {
    document.addEventListener('keydown', e => {
      const map = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); slide(dir); }
    });

    // Touch
    let tsX = 0, tsY = 0;
    gridContainer.addEventListener('touchstart', e => {
      tsX = e.touches[0].clientX; tsY = e.touches[0].clientY;
    }, { passive: true });
    gridContainer.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tsX;
      const dy = e.changedTouches[0].clientY - tsY;
      handleSwipe(dx, dy);
    }, { passive: true });

    // Mouse drag
    let msX = 0, msY = 0, msDown = false;
    gridContainer.addEventListener('mousedown', e => {
      msX = e.clientX; msY = e.clientY; msDown = true;
    });
    document.addEventListener('mouseup', e => {
      if (!msDown) return;
      msDown = false;
      handleSwipe(e.clientX - msX, e.clientY - msY);
    });

    // Buttons
    newBtn.addEventListener('click', resetGame);
    retryBtn.addEventListener('click', resetGame);
    keepGoingBtn.addEventListener('click', () => {
      keepPlaying = true;
      overlay.classList.remove('show');
    });
    undoBtn.addEventListener('click', undo);
    modeClassicBtn.addEventListener('click', () => setMode('classic'));
    modeBlitzBtn.addEventListener('click', () => setMode('blitz'));
    powerClearBtn.addEventListener('click', useClear);
    powerHintBtn.addEventListener('click', useHint);
    powerShuffleBtn.addEventListener('click', useShuffle);

    // Overlay dismiss
    overlay.addEventListener('click', e => {
      if (e.target.closest('.overlay-content')) return;
      if (won && !keepPlaying) {
        keepPlaying = true;
        overlay.classList.remove('show');
      }
    });

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 100);
    });
  }

  function handleSwipe(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 20) return;
    if (ax > ay) slide(dx > 0 ? 'right' : 'left');
    else slide(dy > 0 ? 'down' : 'up');
  }

  // ========== Init ==========
  return Object.freeze({ init });

})();

document.addEventListener('DOMContentLoaded', () => Game2048.init());
