const Tetris = (() => {
  'use strict';

  // ========== Constants ==========
  const COLS = 10;
  const ROWS = 20;
  const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
  };

  const COLORS = {
    I: '#00e5ff', O: '#ffd600', T: '#d500f9',
    S: '#76ff03', Z: '#ff1744', J: '#2979ff', L: '#ff9100',
  };

  const GLOW_COLORS = {
    I: 'rgba(0,229,255,0.6)', O: 'rgba(255,214,0,0.6)',
    T: 'rgba(213,0,249,0.6)', S: 'rgba(118,255,3,0.6)',
    Z: 'rgba(255,23,68,0.6)', J: 'rgba(41,121,255,0.6)',
    L: 'rgba(255,145,0,0.6)',
  };

  // ========== State ==========
  let board, blockSize;
  let currentType, currentShape, currentX, currentY, currentRot;
  let nextTypes, holdType, canHold;
  let score, level, lines, combo, bestScore;
  let gameOver, paused;
  let dropInterval, dropTimer, lastTime, animFrameId;
  let clearingRows, clearAnimTimer;
  let particles, shakeTimer;
  let bag;

  // ========== DOM Refs ==========
  let boardCanvas, boardCtx;
  let nextCanvas, nextCtx;
  let holdCanvas, holdCtx;
  let scoreDisplay, levelDisplay, linesDisplay, bestDisplay;
  let gameOverlay, overlayScore, overlayRetry;
  let pauseBtn, newGameBtn;
  let boardWrapper;
  let bgCanvas, bgCtx, bgParticles;

  // ========== Init ==========
  function init() {
    cacheDOM();
    sizePreviews();
    calcBlockSize();
    initBgParticles();
    bindInput();
    loadBest();
    resetGame();
    gameLoop(0);
  }

  function sizePreviews() {
    const holdW = Math.min(80, holdCanvas.parentElement.clientWidth - 12);
    holdCanvas.width = holdW;
    holdCanvas.height = Math.floor(holdW * 0.88);

    const nextW = Math.min(80, nextCanvas.parentElement.clientWidth - 12);
    nextCanvas.width = nextW;
    nextCanvas.height = Math.floor(nextW * 1.25);
  }

  function cacheDOM() {
    boardCanvas = document.getElementById('boardCanvas');
    boardCtx = boardCanvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');
    holdCanvas = document.getElementById('holdCanvas');
    holdCtx = holdCanvas.getContext('2d');
    scoreDisplay = document.getElementById('scoreDisplay');
    levelDisplay = document.getElementById('levelDisplay');
    linesDisplay = document.getElementById('linesDisplay');
    bestDisplay = document.getElementById('bestDisplay');
    gameOverlay = document.getElementById('gameOverlay');
    overlayScore = document.getElementById('overlayScore');
    overlayRetry = document.getElementById('overlayRetry');
    pauseBtn = document.getElementById('pauseBtn');
    newGameBtn = document.getElementById('newGameBtn');
    boardWrapper = document.getElementById('boardWrapper');
    bgCanvas = document.getElementById('bgCanvas');
    bgCtx = bgCanvas.getContext('2d');
  }

  function calcBlockSize() {
    const wrapperWidth = boardWrapper.clientWidth - 4; // account for border
    blockSize = Math.floor(wrapperWidth / COLS);
    blockSize = Math.max(18, Math.min(32, blockSize));
    boardCanvas.width = COLS * blockSize;
    boardCanvas.height = ROWS * blockSize;
  }

  function previewBlockSize(canvas) {
    const w = canvas.clientWidth || canvas.width;
    return Math.max(10, Math.floor((w - 8) / 5));
  }

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestTetris') || '0');
    bestDisplay.textContent = bestScore;
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestTetris', bestScore);
      bestDisplay.textContent = bestScore;
    }
  }

  function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = [];
    nextTypes = [];
    holdType = null;
    canHold = true;
    score = 0;
    level = 1;
    lines = 0;
    combo = -1;
    gameOver = false;
    paused = false;
    dropTimer = 0;
    lastTime = 0;
    clearingRows = null;
    clearAnimTimer = 0;
    particles = [];
    shakeTimer = 0;
    dropInterval = 800;

    gameOverlay.classList.remove('show');
    boardWrapper.classList.remove('shake', 'combo-glow');
    pauseBtn.textContent = '暂停';
    updateScore();
    updateLevel();

    // Fill next queue
    for (let i = 0; i < 2; i++) nextTypes.push(pullFromBag());
    spawnPiece();
    while (nextTypes.length < 2) nextTypes.push(pullFromBag());
  }

  // ========== Bag Randomizer ==========
  function refillBag() {
    const shuffled = [...PIECE_TYPES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    bag.push(...shuffled);
  }

  function pullFromBag() {
    if (bag.length === 0) refillBag();
    return bag.shift();
  }

  // ========== Piece Management ==========
  function spawnPiece() {
    currentType = nextTypes.shift();
    nextTypes.push(pullFromBag());
    currentShape = SHAPES[currentType].map(r => [...r]);
    currentRot = 0;
    // Center horizontally, spawn above visible area
    currentX = Math.floor((COLS - currentShape[0].length) / 2);
    currentY = currentType === 'I' ? -1 : -2;

    if (!isValidPosition(currentShape, currentX, currentY)) {
      gameOver = true;
      saveBest();
      overlayScore.textContent = '得分: ' + score + '  等级: ' + level;
      gameOverlay.classList.add('show');
      if (animFrameId) cancelAnimationFrame(animFrameId);
    }
    canHold = true;
    renderNext();
    renderHold();
  }

  function holdCurrentPiece() {
    if (!canHold || gameOver || paused || clearingRows) return;
    canHold = false;
    const prevHold = holdType;
    holdType = currentType;
    if (prevHold) {
      currentType = prevHold;
      currentShape = SHAPES[currentType].map(r => [...r]);
      currentRot = 0;
      currentX = Math.floor((COLS - currentShape[0].length) / 2);
      currentY = currentType === 'I' ? -1 : -2;
    } else {
      currentType = nextTypes.shift();
      nextTypes.push(pullFromBag());
      currentShape = SHAPES[currentType].map(r => [...r]);
      currentRot = 0;
      currentX = Math.floor((COLS - currentShape[0].length) / 2);
      currentY = currentType === 'I' ? -1 : -2;
    }
    renderHold();
  }

  // ========== Rotation ==========
  function rotateMatrixCW(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        result[c][N - 1 - r] = matrix[r][c];
    return result;
  }

  function rotatePiece() {
    if (gameOver || paused || clearingRows) return;
    if (currentType === 'O') return;

    const rotated = rotateMatrixCW(currentShape);
    // Try wall kicks: [0, -1, 1, -2, 2]
    const kicks = [0, -1, 1, -2, 2];
    for (const dx of kicks) {
      if (isValidPosition(rotated, currentX + dx, currentY)) {
        currentShape = rotated;
        currentX += dx;
        currentRot = (currentRot + 1) % 4;
        return;
      }
      // Also try with a y-offset for I piece
      if (currentType === 'I') {
        if (isValidPosition(rotated, currentX + dx, currentY - 1)) {
          currentShape = rotated;
          currentX += dx;
          currentY -= 1;
          currentRot = (currentRot + 1) % 4;
          return;
        }
        if (isValidPosition(rotated, currentX + dx, currentY + 1)) {
          currentShape = rotated;
          currentX += dx;
          currentY += 1;
          currentRot = (currentRot + 1) % 4;
          return;
        }
      }
    }
  }

  // ========== Movement ==========
  function movePiece(dx, dy) {
    if (gameOver || paused || clearingRows) return false;
    if (isValidPosition(currentShape, currentX + dx, currentY + dy)) {
      currentX += dx;
      currentY += dy;
      return true;
    }
    return false;
  }

  function hardDrop() {
    if (gameOver || paused || clearingRows) return;
    let dist = 0;
    while (isValidPosition(currentShape, currentX, currentY + 1)) {
      currentY++;
      dist++;
    }
    score += dist * 2;
    updateScore();
    lockPiece();
  }

  function softDrop() {
    if (movePiece(0, 1)) {
      score += 1;
      updateScore();
      dropTimer = 0;
      return true;
    }
    return false;
  }

  function getGhostY() {
    let gy = currentY;
    while (isValidPosition(currentShape, currentX, gy + 1)) gy++;
    return gy;
  }

  function isValidPosition(shape, px, py) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const bx = px + c, by = py + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return false;
        if (by < 0) continue;
        if (board[by][bx] !== null) return false;
      }
    }
    return true;
  }

  // ========== Lock & Clear ==========
  function lockPiece() {
    for (let r = 0; r < currentShape.length; r++) {
      for (let c = 0; c < currentShape[r].length; c++) {
        if (!currentShape[r][c]) continue;
        const by = currentY + r;
        if (by < 0) { gameOver = true; break; }
        board[by][currentX + c] = currentType;
      }
    }
    if (gameOver) {
      saveBest();
      overlayScore.textContent = '得分: ' + score + '  等级: ' + level;
      gameOverlay.classList.add('show');
      if (animFrameId) cancelAnimationFrame(animFrameId);
      return;
    }

    // Check for line clears
    const fullRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(cell => cell !== null)) fullRows.push(r);
    }

    if (fullRows.length > 0) {
      clearingRows = fullRows;
      clearAnimTimer = 250; // flash animation duration
    } else {
      combo = -1;
      spawnPiece();
    }
    render();
  }

  function finishClearLines() {
    if (!clearingRows || clearingRows.length === 0) return;

    const count = clearingRows.length;
    combo++;

    // Scoring
    const basePoints = [0, 100, 300, 500, 800];
    const points = (basePoints[count] || count * 200) * level;
    const comboBonus = combo > 0 ? 50 * combo * level : 0;
    score += points + comboBonus;
    updateScore();
    saveBest();

    // Level
    lines += count;
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      dropInterval = Math.max(40, 800 - (level - 1) * 60);
      updateLevel();
    }

    // Effects
    if (count === 4) {
      boardWrapper.classList.add('shake');
      shakeTimer = 500;
    }
    if (combo > 1) {
      showComboToast(count, combo);
      boardWrapper.classList.add('combo-glow');
      setTimeout(() => boardWrapper.classList.remove('combo-glow'), 600);
    }
    spawnClearParticles(clearingRows);

    // Remove rows
    clearingRows.sort((a, b) => b - a);
    for (const r of clearingRows) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
    }
    clearingRows = null;
    clearAnimTimer = 0;
    spawnPiece();
    render();
  }

  // ========== Scoring ==========
  function updateScore() {
    scoreDisplay.textContent = score;
    scoreDisplay.classList.remove('pop');
    void scoreDisplay.offsetWidth;
    scoreDisplay.classList.add('pop');
  }

  function updateLevel() {
    levelDisplay.textContent = level;
    linesDisplay.textContent = lines;
    levelDisplay.classList.remove('pop');
    void levelDisplay.offsetWidth;
    levelDisplay.classList.add('pop');
  }

  // ========== Effects ==========
  function showComboToast(count, comboCount) {
    const texts = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
    const el = document.createElement('div');
    el.className = 'combo-toast';
    el.textContent = texts[count] || '';
    if (comboCount > 1) el.textContent += ' x' + comboCount;
    boardWrapper.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function spawnClearParticles(rows) {
    for (const r of rows) {
      for (let c = 0; c < COLS; c++) {
        const type = board[r][c];
        if (!type) continue;
        const color = COLORS[type];
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: c * blockSize + blockSize / 2,
            y: r * blockSize + blockSize / 2,
            vx: (Math.random() - 0.5) * 6,
            vy: Math.random() * -6 - 2,
            life: 1,
            decay: 0.02 + Math.random() * 0.03,
            size: blockSize * 0.25,
            color,
          });
        }
      }
    }
  }

  function updateParticles() {
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= p.decay;
      return p.life > 0;
    });
  }

  function renderParticles(ctx) {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // ========== Game Loop ==========
  function gameLoop(timestamp) {
    if (gameOver) {
      render();
      return;
    }

    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    if (shakeTimer > 0) {
      shakeTimer -= delta;
      if (shakeTimer <= 0) boardWrapper.classList.remove('shake');
    }

    if (!paused && !clearingRows) {
      dropTimer += delta;
      if (dropTimer >= dropInterval) {
        dropTimer = 0;
        if (!movePiece(0, 1)) {
          lockPiece();
        }
      }
    }

    if (clearingRows) {
      clearAnimTimer -= delta;
      if (clearAnimTimer <= 0) {
        finishClearLines();
      }
    }

    updateParticles();
    render();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ========== Rendering ==========
  function render() {
    const w = boardCanvas.width, h = boardCanvas.height;

    // Clear board
    boardCtx.fillStyle = 'rgba(0,0,0,0.4)';
    boardCtx.fillRect(0, 0, w, h);

    // Grid lines
    boardCtx.strokeStyle = 'rgba(255,255,255,0.03)';
    boardCtx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, r * blockSize);
      boardCtx.lineTo(w, r * blockSize);
      boardCtx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      boardCtx.beginPath();
      boardCtx.moveTo(c * blockSize, 0);
      boardCtx.lineTo(c * blockSize, h);
      boardCtx.stroke();
    }

    // Locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          drawBlock(boardCtx, c, r, COLORS[board[r][c]], GLOW_COLORS[board[r][c]], 1);
        }
      }
    }

    // Clearing rows flash
    if (clearingRows) {
      const progress = 1 - clearAnimTimer / 250;
      const alpha = Math.abs(Math.sin(progress * Math.PI * 4));
      for (const r of clearingRows) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c]) {
            boardCtx.fillStyle = `rgba(255,255,255,${alpha})`;
            boardCtx.fillRect(c * blockSize + 1, r * blockSize + 1, blockSize - 2, blockSize - 2);
          }
        }
      }
    }

    // Ghost piece
    if (!gameOver && !clearingRows) {
      const gy = getGhostY();
      if (gy !== currentY) {
        for (let r = 0; r < currentShape.length; r++) {
          for (let c = 0; c < currentShape[r].length; c++) {
            if (!currentShape[r][c]) continue;
            const px = currentX + c, py = gy + r;
            if (py < 0) continue;
            boardCtx.strokeStyle = 'rgba(255,255,255,0.25)';
            boardCtx.lineWidth = 1.5;
            boardCtx.setLineDash([3, 3]);
            boardCtx.strokeRect(px * blockSize + 2, py * blockSize + 2, blockSize - 4, blockSize - 4);
            boardCtx.setLineDash([]);
          }
        }
      }
    }

    // Current piece
    if (!gameOver && !clearingRows) {
      for (let r = 0; r < currentShape.length; r++) {
        for (let c = 0; c < currentShape[r].length; c++) {
          if (!currentShape[r][c]) continue;
          const px = currentX + c, py = currentY + r;
          if (py < 0) continue;
          drawBlock(boardCtx, px, py, COLORS[currentType], GLOW_COLORS[currentType], 1);
        }
      }
    }

    // Particles
    renderParticles(boardCtx);

    // Render next queue
    renderNext();
    renderHold();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawBlock(ctx, col, row, color, glow, alpha) {
    const x = col * blockSize, y = row * blockSize;
    const s = blockSize;

    ctx.globalAlpha = alpha;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 4;

    // Main fill
    const grad = ctx.createLinearGradient(x, y, x + s, y + s);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    roundRect(ctx, x + 1, y + 1, s - 2, s - 2, 3);
    ctx.fill();

    // Remove shadow for highlight
    ctx.shadowBlur = 0;

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(ctx, x + 3, y + 3, s - 6, s / 2 - 2, 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8;
    roundRect(ctx, x + 1.5, y + 1.5, s - 3, s - 3, 3);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function renderPreview(ctx, canvas, typeList, blockSz) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!typeList || (Array.isArray(typeList) && typeList.length === 0)) return;
    const types = Array.isArray(typeList) ? typeList : [typeList];

    let yOff = 4;
    for (const type of types.slice(0, 2)) {
      const shape = SHAPES[type];
      const color = COLORS[type];
      const shapeW = shape[0].length * blockSz;
      const ox = (canvas.width - shapeW) / 2;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const x = ox + c * blockSz, y = yOff + r * blockSz;
          const grad = ctx.createLinearGradient(x, y, x + blockSz, y + blockSz);
          grad.addColorStop(0, color);
          grad.addColorStop(1, 'rgba(0,0,0,0.15)');
          ctx.fillStyle = grad;
          roundRect(ctx, x + 1, y + 1, blockSz - 2, blockSz - 2, 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          roundRect(ctx, x + 2, y + 2, blockSz - 4, blockSz / 2 - 2, 1.5);
          ctx.fill();
        }
      }
      yOff += shape.length * blockSz + 8;
    }
  }

  function renderNext() {
    renderPreview(nextCtx, nextCanvas, nextTypes, previewBlockSize(nextCanvas));
  }

  function renderHold() {
    renderPreview(holdCtx, holdCanvas, holdType ? [holdType] : [], previewBlockSize(holdCanvas));
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
        this.r = Math.random() * 2 + 0.4;
        this.dx = Math.random() * 0.2 - 0.1;
        this.dy = Math.random() * 0.2 - 0.1;
        this.alpha = Math.random() * 0.3 + 0.05;
        this.pulse = Math.random() * Math.PI * 2;
        this.hue = Math.random() * 60 + 200;
      }
      update() {
        this.pulse += 0.005;
        this.x += this.dx;
        this.y += this.dy;
        if (this.x < -10 || this.x > bgCanvas.width + 10 ||
            this.y < -10 || this.y > bgCanvas.height + 10) this.reset();
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 50%, 70%, ${this.alpha})`;
        ctx.fill();
      }
    }
    bgParticles = Array.from({ length: 30 }, () => new Particle());

    function animate() {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      for (const p of bgParticles) { p.update(); p.draw(bgCtx); }
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ========== Input ==========
  function bindInput() {
    document.addEventListener('keydown', e => {
      if (gameOver) return;

      if (e.key === 'p' || e.key === 'P') { togglePause(); return; }

      if (paused) return;

      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); movePiece(-1, 0); break;
        case 'ArrowRight': e.preventDefault(); movePiece(1, 0); break;
        case 'ArrowDown':  e.preventDefault(); softDrop(); break;
        case 'ArrowUp':    e.preventDefault(); rotatePiece(); break;
        case ' ':          e.preventDefault(); hardDrop(); break;
        case 'c': case 'C': holdCurrentPiece(); break;
      }
    });

    // Touch
    let tsX = 0, tsY = 0, tsTime = 0;
    boardCanvas.addEventListener('touchstart', e => {
      tsX = e.touches[0].clientX;
      tsY = e.touches[0].clientY;
      tsTime = Date.now();
    }, { passive: true });

    boardCanvas.addEventListener('touchend', e => {
      if (gameOver || paused) return;
      const dx = e.changedTouches[0].clientX - tsX;
      const dy = e.changedTouches[0].clientY - tsY;
      const dt = Date.now() - tsTime;
      const ax = Math.abs(dx), ay = Math.abs(dy);

      if (ax < 10 && ay < 10 && dt < 300) {
        // Tap = rotate
        rotatePiece();
      } else if (ay > ax && dy > 40 && dt < 200) {
        // Fast swipe down = hard drop
        hardDrop();
      } else if (ay > ax && dy > 40) {
        // Slow swipe down = soft drop
        softDrop();
      } else if (ax > ay && ax > 20) {
        movePiece(dx > 0 ? 1 : -1, 0);
      }
    }, { passive: true });

    newGameBtn.addEventListener('click', () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      resetGame();
      lastTime = 0;
      gameLoop(0);
    });
    overlayRetry.addEventListener('click', () => {
      gameOverlay.classList.remove('show');
      resetGame();
      lastTime = 0;
      gameLoop(0);
    });
    pauseBtn.addEventListener('click', togglePause);

    // Touch control buttons
    function bindTouchBtn(id, action) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        if (!gameOver && !paused && !clearingRows) action();
      }, { passive: false });
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        if (!gameOver && !paused && !clearingRows) action();
      });
    }
    bindTouchBtn('touchLeft', () => movePiece(-1, 0));
    bindTouchBtn('touchRight', () => movePiece(1, 0));
    bindTouchBtn('touchDown', () => softDrop());
    bindTouchBtn('touchRotate', () => rotatePiece());
    bindTouchBtn('touchDrop', () => hardDrop());
    bindTouchBtn('touchHold', () => holdCurrentPiece());

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sizePreviews();
        calcBlockSize();
        render();
      }, 150);
    });
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '继续' : '暂停';
    if (!paused) lastTime = 0;
  }

  return Object.freeze({ init });
})();

document.addEventListener('DOMContentLoaded', () => Tetris.init());
