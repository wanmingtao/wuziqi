(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 400, H = 600;
  canvas.width = W; canvas.height = H;

  const scoreEl = document.getElementById('scoreDisplay');
  const bestEl = document.getElementById('bestDisplay');
  const comboEl = document.getElementById('comboDisplay');
  const overlay = document.getElementById('overlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultScore = document.getElementById('resultScore');
  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');

  const COLS = 10;
  const ROWS = 14;
  const BUBBLE_R = 18;
  const COLORS = ['#ff1744','#ff9100','#ffd600','#76ff03','#00e5ff','#d500f9'];
  const SHOOTER_Y = H - 50;
  const DANGER_Y = H - 90;
  const PUSH_INTERVAL = 8;
  const SPEED = 8;

  let grid, currentBubble, nextColor, aimAngle;
  let score = 0, bestScore = 0, combo = 0, shotsFired = 0;
  let gameOver = false, shooting = false, particles = [];
  let mouseX = 0, mouseY = 0, isAiming = false;

  function loadBest() {
    bestScore = parseInt(localStorage.getItem('bestBubblePop') || '0');
    bestEl.textContent = bestScore;
  }
  function saveBest() {
    if (score > bestScore) { bestScore = score; localStorage.setItem('bestBubblePop', bestScore); bestEl.textContent = bestScore; }
  }

  // Hex grid: grid[row][col] = color index or null
  // Even rows: 0..COLS-1, odd rows: 0..COLS-2 (staggered)
  function colCount(row) { return row % 2 === 0 ? COLS : COLS - 1; }

  function hexX(row, col) {
    const offset = row % 2 === 0 ? BUBBLE_R : BUBBLE_R * 2;
    return offset + col * BUBBLE_R * 2;
  }
  function hexY(row) { return BUBBLE_R + row * BUBBLE_R * Math.sqrt(3); }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      const cc = colCount(r);
      for (let c = 0; c < cc; c++) grid[r][c] = null;
    }
  }

  function getNeighbors(r, c) {
    const even = r % 2 === 0;
    const offsets = even
      ? [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]]
      : [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
    const result = [];
    for (const [dr, dc] of offsets) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < colCount(nr)) result.push([nr, nc]);
    }
    return result;
  }

  function spawnInitialRows() {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < colCount(r); c++) {
        grid[r][c] = Math.floor(Math.random() * COLORS.length);
      }
    }
  }

  function pushNewRow() {
    // Shift all rows down
    for (let r = ROWS - 1; r >= 1; r--) {
      const cc = colCount(r);
      for (let c = 0; c < cc; c++) grid[r][c] = grid[r - 1][c];
    }
    // New top row
    for (let c = 0; c < colCount(0); c++) {
      grid[0][c] = Math.floor(Math.random() * COLORS.length);
    }
    // Check danger line
    checkDangerLine();
  }

  function checkDangerLine() {
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < colCount(r); c++) {
        if (grid[r][c] !== null && hexY(r) >= DANGER_Y) { endGame(); return; }
      }
    }
  }

  function pixelToGrid(x, y) {
    let bestR = -1, bestC = -1, bestDist = Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < colCount(r); c++) {
        const hx = hexX(r, c), hy = hexY(r, c);
        const dist = Math.sqrt((x - hx) ** 2 + (y - hy) ** 2);
        if (dist < BUBBLE_R + 2 && dist < bestDist) { bestDist = dist; bestR = r; bestC = c; }
      }
    }
    return { r: bestR, c: bestC };
  }

  function findConnected(r, c, color) {
    const group = [];
    const visited = new Set();
    const queue = [[r, c]];
    visited.add(r + ',' + c);
    while (queue.length > 0) {
      const [cr, cc] = queue.shift();
      group.push([cr, cc]);
      for (const [nr, nc] of getNeighbors(cr, cc)) {
        if (visited.has(nr + ',' + nc)) continue;
        if (grid[nr][nc] === color) {
          visited.add(nr + ',' + nc);
          queue.push([nr, nc]);
        }
      }
    }
    return group;
  }

  function findFloating() {
    // BFS from top row to find all connected bubbles
    const connected = new Set();
    const queue = [];
    for (let c = 0; c < colCount(0); c++) {
      if (grid[0][c] !== null) {
        connected.add('0,' + c);
        queue.push([0, c]);
      }
    }
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of getNeighbors(r, c)) {
        if (connected.has(nr + ',' + nc)) continue;
        if (grid[nr][nc] !== null) {
          connected.add(nr + ',' + nc);
          queue.push([nr, nc]);
        }
      }
    }
    // Collect floating bubbles
    const floating = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < colCount(r); c++) {
        if (grid[r][c] !== null && !connected.has(r + ',' + c)) floating.push([r, c]);
      }
    }
    return floating;
  }

  function removeBubbles(group) {
    combo++;
    for (const [r, c] of group) {
      spawnBubbleParticles(hexX(r, c), hexY(r, c), grid[r][c]);
      grid[r][c] = null;
    }
    score += group.length * 10 * combo;
    scoreEl.textContent = score;
    comboEl.textContent = combo;
    saveBest();
  }

  function dropFloating(floating) {
    for (const [r, c] of floating) {
      spawnBubbleParticles(hexX(r, c), hexY(r, c), grid[r][c]);
      grid[r][c] = null;
    }
    score += floating.length * 20;
    scoreEl.textContent = score;
    saveBest();
  }

  function spawnBubbleParticles(x, y, colorIdx) {
    const color = COLORS[colorIdx];
    for (let i = 0; i < 8; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 3,
        life: 15 + Math.random() * 20,
        color, size: 2 + Math.random() * 4
      });
    }
  }

  function snapBubble(x, y) {
    const { r, c } = pixelToGrid(x, y);
    if (r === -1 || grid[r][c] !== null) {
      // Find nearest empty position
      let bestR = -1, bestC = -1, bestDist = Infinity;
      for (let rr = 0; rr < ROWS; rr++) {
        for (let cc = 0; cc < colCount(rr); cc++) {
          if (grid[rr][cc] !== null) continue;
          const hx = hexX(rr, cc), hy = hexY(rr, cc);
          const d = Math.sqrt((x - hx) ** 2 + (y - hy) ** 2);
          if (d < bestDist) { bestDist = d; bestR = rr; bestC = cc; }
        }
      }
      if (bestR === -1) return false;
      grid[bestR][bestC] = currentBubble.color;
      onBubblePlaced(bestR, bestC);
      return true;
    }
    grid[r][c] = currentBubble.color;
    onBubblePlaced(r, c);
    return true;
  }

  function onBubblePlaced(r, c) {
    const color = grid[r][c];
    const group = findConnected(r, c, color);
    if (group.length >= 3) {
      removeBubbles(group);
      const floating = findFloating();
      if (floating.length > 0) dropFloating(floating);
    } else {
      combo = 0;
      comboEl.textContent = '0';
    }

    shotsFired++;
    if (shotsFired % PUSH_INTERVAL === 0) pushNewRow();

    // Check if any bubble reached danger line
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < colCount(rr); cc++) {
        if (grid[rr][cc] !== null && hexY(rr) >= DANGER_Y) { endGame(); return; }
      }
    }

    // Check if all bubbles cleared
    let allEmpty = true;
    for (let rr = 0; rr < ROWS; rr++)
      for (let cc = 0; cc < colCount(rr); cc++)
        if (grid[rr][cc] !== null) { allEmpty = false; break; }
    if (allEmpty) { endGame(true); return; }

    nextColor = Math.floor(Math.random() * COLORS.length);
  }

  function endGame(won = false) {
    gameOver = true;
    saveBest();
    resultTitle.textContent = won ? '恭喜通关！' : '游戏结束';
    resultScore.textContent = '得分: ' + score;
    overlay.classList.remove('hidden');
  }

  function shoot() {
    if (gameOver || shooting) return;
    shooting = true;
    combo = 0;
    comboEl.textContent = '0';

    const angle = aimAngle;
    const color = nextColor;
    nextColor = Math.floor(Math.random() * COLORS.length);

    currentBubble = {
      x: W / 2,
      y: SHOOTER_Y,
      vx: Math.sin(angle) * SPEED,
      vy: -Math.cos(angle) * SPEED,
      color
    };
  }

  function update() {
    if (gameOver) return;

    // Move current bubble
    if (shooting && currentBubble) {
      currentBubble.x += currentBubble.vx;
      currentBubble.y += currentBubble.vy;

      // Wall bounce
      if (currentBubble.x - BUBBLE_R < 0) {
        currentBubble.x = BUBBLE_R;
        currentBubble.vx = Math.abs(currentBubble.vx);
      }
      if (currentBubble.x + BUBBLE_R > W) {
        currentBubble.x = W - BUBBLE_R;
        currentBubble.vx = -Math.abs(currentBubble.vx);
      }

      // Top ceiling
      if (currentBubble.y - BUBBLE_R < 0) {
        currentBubble.y = BUBBLE_R;
        currentBubble.vy = 0;
        currentBubble.vx = 0;
        if (snapBubble(currentBubble.x, currentBubble.y)) {
          currentBubble = null;
          shooting = false;
        }
      }

      // Check collision with existing bubbles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < colCount(r); c++) {
          if (grid[r][c] === null) continue;
          const hx = hexX(r, c), hy = hexY(r, c);
          const dist = Math.sqrt((currentBubble.x - hx) ** 2 + (currentBubble.y - hy) ** 2);
          if (dist < BUBBLE_R * 2 - 2) {
            // Snap to nearest empty adjacent position
            currentBubble.vx = 0; currentBubble.vy = 0;
            if (snapBubble(currentBubble.x, currentBubble.y)) {
              currentBubble = null;
              shooting = false;
            }
            return;
          }
        }
      }
    }

    // Update particles
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
    particles = particles.filter(p => p.life > 0);
  }

  function render() {
    // Background
    ctx.fillStyle = '#060612';
    ctx.fillRect(0, 0, W, H);

    // Subtle gradient at top
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a0a20');
    bgGrad.addColorStop(1, '#060612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Grid bubbles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < colCount(r); c++) {
        if (grid[r][c] === null) continue;
        drawBubble(hexX(r, c), hexY(r, c), grid[r][c]);
      }
    }

    // Danger line
    ctx.strokeStyle = 'rgba(255,23,68,0.2)';
    ctx.setLineDash([6, 10]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y); ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Aim line
    if (!shooting && !gameOver && isAiming) {
      drawAimLine();
    }

    // Shooter
    const sx = W / 2, sy = SHOOTER_Y;
    // Shooter base
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(sx, sy, BUBBLE_R + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Current bubble (already shot)
    if (currentBubble) {
      drawBubble(currentBubble.x, currentBubble.y, currentBubble.color);
    }

    // Ready bubble at shooter
    if (!shooting && !gameOver) {
      drawBubble(sx, sy, nextColor);
    }

    // Next color preview
    if (!gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(W - 50, SHOOTER_Y - 22, 38, 38);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(W - 50, SHOOTER_Y - 22, 38, 38);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('next', W - 31, SHOOTER_Y - 26);
      drawBubble(W - 31, SHOOTER_Y - 1, nextColor, 12);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 35;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBubble(x, y, colorIdx, r = BUBBLE_R) {
    const color = COLORS[colorIdx];

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    // Sphere gradient
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, color);
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAimLine() {
    if (!isAiming) return;
    const sx = W / 2, sy = SHOOTER_Y;
    const angle = aimAngle;
    let x = sx, y = sy;
    const dx = Math.sin(angle), dy = -Math.cos(angle);

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Trace aim line with wall bounces
    for (let i = 0; i < 300; i++) {
      x += dx * 4; y += dy * 4;
      if (x < BUBBLE_R) { x = BUBBLE_R; break; }
      if (x > W - BUBBLE_R) { x = W - BUBBLE_R; break; }
      if (y < BUBBLE_R) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Aim dot at end
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function getAimAngle(mx, my) {
    const sx = W / 2, sy = SHOOTER_Y;
    let angle = Math.atan2(mx - sx, -(my - sy));
    angle = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, angle));
    return angle;
  }

  function bindInput() {
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width * W;
      mouseY = (e.clientY - rect.top) / rect.height * H;
      aimAngle = getAimAngle(mouseX, mouseY);
      isAiming = true;
    });
    canvas.addEventListener('mouseleave', () => { isAiming = false; });
    canvas.addEventListener('click', () => { if (!shooting) shoot(); });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      mouseX = (t.clientX - rect.left) / rect.width * W;
      mouseY = (t.clientY - rect.top) / rect.height * H;
      aimAngle = getAimAngle(mouseX, mouseY);
      isAiming = true;
    }, { passive: false });
    canvas.addEventListener('touchstart', e => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      mouseX = (t.clientX - rect.left) / rect.width * W;
      mouseY = (t.clientY - rect.top) / rect.height * H;
      aimAngle = getAimAngle(mouseX, mouseY);
      isAiming = true;
    }, { passive: true });
    canvas.addEventListener('touchend', () => { if (!shooting) shoot(); });

    newGameBtn.addEventListener('click', resetGame);
    restartBtn.addEventListener('click', resetGame);
  }

  function resetGame() {
    score = 0;
    combo = 0;
    shotsFired = 0;
    gameOver = false;
    shooting = false;
    currentBubble = null;
    particles = [];
    isAiming = false;
    aimAngle = 0;
    nextColor = Math.floor(Math.random() * COLORS.length);

    initGrid();
    spawnInitialRows();
    updateUI();
    overlay.classList.add('hidden');
    loadBest();
  }

  function updateUI() {
    scoreEl.textContent = score;
    comboEl.textContent = combo;
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  loadBest();
  initGrid();
  spawnInitialRows();
  nextColor = Math.floor(Math.random() * COLORS.length);
  bindInput();
  loop();

  // Background particles
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
        this.pulse = Math.random() * Math.PI * 2; this.hue = Math.random() * 40 + 180;
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
