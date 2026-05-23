(function() {
  'use strict';

  const DIFFICULTY = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 14, cols: 14, mines: 35 },
    hard: { rows: 16, cols: 16, mines: 60 }
  };

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 400;
  canvas.width = W;

  const minesEl = document.getElementById('minesDisplay');
  const timerEl = document.getElementById('timerDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultScore = document.getElementById('resultScore');
  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const flagBtn = document.getElementById('flagBtn');

  let grid, rows, cols, mineCount, firstClick;
  let gameOver, won, flagMode;
  let flagsPlaced, revealedCount;
  let timer, timerInterval;
  let cellSize, H;
  let difficulty;
  let bestTime;
  let particles = [];

  const NUM_COLORS = ['','#2979ff','#00c853','#ff1744','#1a237e','#880e4f','#00838f','#000','#666'];

  function loadBest() {
    const key = 'bestMinesweeper_' + difficulty;
    bestTime = parseInt(localStorage.getItem(key) || '0');
    updateBestDisplay();
  }
  function saveBest() {
    const key = 'bestMinesweeper_' + difficulty;
    if (!bestTime || timer < bestTime) {
      bestTime = timer;
      localStorage.setItem(key, bestTime);
    }
    updateBestDisplay();
  }
  function updateBestDisplay() {
    bestEl.textContent = bestTime ? bestTime + 's' : '-';
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { mine: false, revealed: false, flagged: false, adjacent: 0 };
      }
    }
    firstClick = true;
    flagsPlaced = 0;
    revealedCount = 0;
    gameOver = false;
    won = false;
    particles = [];
  }

  function placeMines(safeR, safeC) {
    const safeSet = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeR + dr, nc = safeC + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) safeSet.add(nr + ',' + nc);
      }
    }

    const candidates = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (!safeSet.has(r + ',' + c)) candidates.push({ r, c });

    // Fisher-Yates partial shuffle to pick mineCount positions
    for (let i = 0; i < mineCount; i++) {
      const j = i + Math.floor(Math.random() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      grid[candidates[i].r][candidates[i].c].mine = true;
    }

    // Calculate adjacent counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (getCell(r + dr, c + dc) && getCell(r + dr, c + dc).mine) count++;
        grid[r][c].adjacent = count;
      }
    }
  }

  function getCell(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return grid[r][c];
  }

  function reveal(r, c) {
    const cell = getCell(r, c);
    if (!cell || cell.revealed || cell.flagged) return;

    cell.revealed = true;
    revealedCount++;

    if (cell.mine) {
      gameOver = true;
      cell.exploded = true;
      revealAllMines();
      clearInterval(timerInterval);
      resultTitle.textContent = '游戏结束';
      resultScore.textContent = '踩到地雷了！';
      overlay.classList.remove('hidden');
      spawnParticles(r, c, '#ff1744', 25);
      return;
    }

    // Flood fill for empty cells
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          reveal(r + dr, c + dc);
    }

    checkWin();
  }

  function revealAllMines() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].mine) grid[r][c].revealed = true;
  }

  function toggleFlag(r, c) {
    const cell = getCell(r, c);
    if (!cell || cell.revealed || gameOver) return;
    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    minesEl.textContent = mineCount - flagsPlaced;
  }

  function chordReveal(r, c) {
    const cell = getCell(r, c);
    if (!cell || !cell.revealed || cell.adjacent === 0) return;

    let adjFlags = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const adj = getCell(r + dr, c + dc);
        if (adj && adj.flagged) adjFlags++;
      }

    if (adjFlags === cell.adjacent) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          reveal(r + dr, c + dc);
    }
  }

  function checkWin() {
    if (revealedCount === rows * cols - mineCount) {
      won = true; gameOver = true;
      clearInterval(timerInterval);
      saveBest();
      resultTitle.textContent = '恭喜通关！';
      resultScore.textContent = '用时 ' + timer + ' 秒';
      overlay.classList.remove('hidden');
      spawnParticles(rows / 2, cols / 2, '#f5a623', 30);
    }
  }

  function spawnParticles(gr, gc, color, count) {
    const cx = gc * cellSize + cellSize / 2;
    const cy = gr * cellSize + cellSize / 2;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        life: 20 + Math.random() * 20,
        color, size: 2 + Math.random() * 3
      });
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

  function updateUI() {
    minesEl.textContent = mineCount - flagsPlaced;
  }

  function render() {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellSize); ctx.lineTo(W, r * cellSize); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellSize, 0); ctx.lineTo(c * cellSize, H); ctx.stroke();
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const x = c * cellSize, y = r * cellSize;

        if (cell.revealed) {
          // Revealed cell background
          ctx.fillStyle = cell.exploded ? 'rgba(255,23,68,0.3)' : 'rgba(20,20,40,0.4)';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

          if (cell.mine) {
            // Draw mine
            ctx.fillStyle = cell.exploded ? '#ff1744' : '#888';
            ctx.shadowColor = cell.exploded ? '#ff1744' : 'transparent';
            ctx.shadowBlur = cell.exploded ? 10 : 0;
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (cell.adjacent > 0) {
            // Number
            ctx.fillStyle = NUM_COLORS[cell.adjacent] || '#fff';
            ctx.font = `bold ${cellSize * 0.55}px -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cell.adjacent, x + cellSize / 2, y + cellSize / 2 + 1);
          }
        } else {
          // Unrevealed cell - 3D raised look
          const grad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
          grad.addColorStop(0, 'rgba(60,60,80,0.35)');
          grad.addColorStop(1, 'rgba(25,25,40,0.35)');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, 1);
          ctx.fillRect(x + 1, y + 1, 1, cellSize - 2);

          // Flag
          if (cell.flagged) {
            ctx.fillStyle = '#ff6d00';
            ctx.font = `${cellSize * 0.6}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚩', x + cellSize / 2, y + cellSize / 2);
          }

          if (!cell.flagged && gameOver && cell.mine) {
            ctx.fillStyle = '#ff1744';
            ctx.font = `${cellSize * 0.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', x + cellSize / 2, y + cellSize / 2);
          }
        }
      }
    }

    // Particles
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.life > 0);
  }

  function resizeCanvas() {
    const container = document.querySelector('.game-container');
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    cellSize = W / cols;
    H = cellSize * rows;
    canvas.height = H;
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  function handleClick(e) {
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    const my = (e.clientY - rect.top) / rect.height * H;
    const c = Math.floor(mx / cellSize);
    const r = Math.floor(my / cellSize);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    if (flagMode || e.button === 2) {
      toggleFlag(r, c);
      return;
    }

    if (grid[r][c].flagged) return;

    if (firstClick) {
      firstClick = false;
      placeMines(r, c);
      startTimer();
    }

    if (grid[r][c].revealed) {
      chordReveal(r, c);
    } else {
      reveal(r, c);
    }
    updateUI();
  }

  function bindInput() {
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); handleClick(e); });

    // Touch long-press for flag
    let longPressTimer;
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      longPressTimer = setTimeout(() => {
        if (gameOver) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (t.clientX - rect.left) / rect.width * W;
        const my = (t.clientY - rect.top) / rect.height * H;
        const r = Math.floor(my / cellSize);
        const c = Math.floor(mx / cellSize);
        toggleFlag(r, c);
        updateUI();
      }, 500);
    }, { passive: true });
    canvas.addEventListener('touchend', () => clearTimeout(longPressTimer));
    canvas.addEventListener('touchmove', () => clearTimeout(longPressTimer));

    flagBtn.addEventListener('click', () => {
      flagMode = !flagMode;
      flagBtn.classList.toggle('active', flagMode);
      flagBtn.textContent = flagMode ? '🚩 翻开模式' : '🚩 标旗模式';
    });

    newGameBtn.addEventListener('click', resetGame);
    restartBtn.addEventListener('click', resetGame);

    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        difficulty = btn.dataset.mode;
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === difficulty));
        resetGame();
      });
    });

    // Keyboard number keys for chord reveal
    document.addEventListener('keydown', e => {
      if (e.key === 'f' || e.key === 'F') {
        flagMode = !flagMode;
        flagBtn.classList.toggle('active', flagMode);
        flagBtn.textContent = flagMode ? '🚩 翻开模式' : '🚩 标旗模式';
      }
    });
  }

  function resetGame() {
    clearInterval(timerInterval);
    timerInterval = null;
    timer = 0;
    const cfg = DIFFICULTY[difficulty];
    rows = cfg.rows; cols = cfg.cols; mineCount = cfg.mines;
    flagMode = false;
    flagBtn.classList.remove('active');
    flagBtn.textContent = '🚩 标旗模式';
    initGrid();
    resizeCanvas();
    updateUI();
    timerEl.textContent = '0s';
    overlay.classList.add('hidden');
    loadBest();
  }

  difficulty = 'medium';
  resetGame();
  bindInput();
  loop();

  window.addEventListener('resize', resizeCanvas);

  // Background
  (function() {
    const bgc = document.getElementById('bgCanvas');
    const bctx = bgc.getContext('2d');
    let bp = [];
    function rs() { bgc.width = window.innerWidth; bgc.height = window.innerHeight; }
    window.addEventListener('resize', rs); rs();
    class P {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * bgc.width; this.y = Math.random() * bgc.height;
        this.r = Math.random() * 2 + 0.3; this.dx = Math.random() * 0.3 - 0.15;
        this.dy = Math.random() * 0.3 - 0.15; this.alpha = Math.random() * 0.4 + 0.08;
        this.pulse = Math.random() * Math.PI * 2; this.hue = Math.random() * 40 + 30;
      }
      update() {
        this.pulse += 0.005;
        this.x += this.dx + Math.sin(this.pulse * 0.4) * 0.06;
        this.y += this.dy + Math.cos(this.pulse * 0.3) * 0.06;
        if (this.x < -20 || this.x > bgc.width + 20 || this.y < -20 || this.y > bgc.height + 20) this.reset();
      }
      draw(ctx) {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 50%, 65%, ${this.alpha + Math.sin(this.pulse) * 0.05})`;
        ctx.fill();
      }
    }
    for (let i = 0; i < 40; i++) bp.push(new P());
    function an() { bctx.clearRect(0, 0, bgc.width, bgc.height); for (const p of bp) { p.update(); p.draw(bctx); } requestAnimationFrame(an); }
    an();
  })();
})();
