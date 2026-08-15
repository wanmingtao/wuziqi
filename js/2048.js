const Game2048 = (() => {
  'use strict';

  const SIZE = 4;

  const DIR = {
    up:    { rows: [0,1,2,3], cols: [0,1,2,3], dr: -1, dc: 0 },
    down:  { rows: [3,2,1,0], cols: [0,1,2,3], dr:  1, dc: 0 },
    left:  { rows: [0,1,2,3], cols: [0,1,2,3], dr:  0, dc: -1 },
    right: { rows: [0,1,2,3], cols: [3,2,1,0], dr:  0, dc:  1 },
  };

  let grid, tiles, score, bestScore;
  let over, won, keepPlaying;
  let history;
  let idCounter, animating, animTimer;

  let gridContainer, tileLayer, gridBg;
  let scoreDisplay, bestDisplay;
  let undoBtn, newBtn, retryBtn, keepGoingBtn;
  let overlay, resultTitle, resultScore;
  let bgCanvas, bgCtx, particles;
  let confCanvas, confCtx, confetti, confettiRunning;

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
    if (animTimer) { clearTimeout(animTimer); animTimer = null; }

    overlay.classList.remove('show');

    bestScore = parseInt(localStorage.getItem('best2048') || '0');
    updateScore();
    addRandomTile();
    addRandomTile();
    render();
    undoBtn.disabled = true;
  }

  function getTileParams() {
    const size = gridContainer.clientWidth;
    const pad = size * 0.024;
    const gap = pad;
    const cell = (size - 2 * pad - 3 * gap) / 4;
    return { size, pad, gap, cell };
  }

  function makeTile(value, row, col, opts = {}) {
    return { id: ++idCounter, value, row, col, isNew: !!opts.isNew, isMerged: false, mergedInto: null };
  }

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) empty.push({ r, c });
    if (empty.length === 0) return null;

    const pos = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = makeTile(value, pos.r, pos.c, { isNew: true });
    grid[pos.r][pos.c] = tile;
    tiles.push(tile);
    return tile;
  }

  function saveState() {
    history = {
      grid: grid.map(row => row.map(t => t ? { ...t, isNew: false, isMerged: false, mergedInto: null } : null)),
      tiles: tiles.map(t => ({ ...t, isNew: false, isMerged: false, mergedInto: null })),
      score,
    };
  }

  function undo() {
    if (!history || animating) return;
    grid = history.grid;
    tiles = history.tiles;
    score = history.score;
    over = false;
    won = false;
    keepPlaying = false;
    history = null;
    undoBtn.disabled = true;
    overlay.classList.remove('show');
    updateScore();
    render();
  }

  function slide(direction) {
    if (over || animating) return false;

    saveState();
    undoBtn.disabled = false;

    for (const t of tiles) { t.isNew = false; t.isMerged = false; t.mergedInto = null; }

    const cfg = DIR[direction];
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
            const newVal = mergeTarget.value * 2;
            mergeTarget.value = newVal;
            mergeTarget.isMerged = true;
            score += newVal;

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
      animating = true;
      render();

      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('best2048', bestScore);
      }
      updateScore();

      animTimer = setTimeout(() => {
        for (const t of absorbed) {
          const idx = tiles.indexOf(t);
          if (idx >= 0) tiles.splice(idx, 1);
        }

        addRandomTile();
        render();
        animating = false;

        if (!won && !keepPlaying && tiles.some(t => t.value >= 2048)) {
          won = true;
          startConfetti();
          showOverlay(true);
        } else if (!over && tiles.length >= 16 && !canMove()) {
          over = true;
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

  function showOverlay(isWin) {
    if (isWin) {
      resultTitle.textContent = '你赢了！';
      resultTitle.className = 'win-title';
      resultScore.textContent = '得分: ' + score;
    } else {
      resultTitle.textContent = '游戏结束';
      resultTitle.className = 'lose-title';
      resultScore.textContent = '得分: ' + score;
    }
    keepGoingBtn.style.display = isWin ? '' : 'none';
    overlay.classList.add('show');
    // GSAP overlay entrance
    if (typeof gsap !== 'undefined') {
      const content = overlay.querySelector('.overlay-content');
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(content, { scale: 0.7, y: 30 }, { scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.5)' });
    }
  }

  function render() {
    const existingIds = new Set(tiles.map(t => t.id));
    tileLayer.querySelectorAll('.tile').forEach(el => {
      if (!existingIds.has(parseInt(el.dataset.id))) el.remove();
    });

    const { pad, gap, cell } = getTileParams();

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
      el.textContent = tile.value;

      el.dataset.digits = tile.value.toString().length;

      let cls = 'tile tile-' + Math.min(tile.value, 2048);
      if (tile.value > 2048) cls += ' tile-super';
      if (tile.isMerged) cls += ' tile-merged';
      if (tile.isNew) cls += ' tile-new';
      el.className = cls;

      // GSAP tile animations
      if (typeof gsap !== 'undefined') {
        if (tile.isNew) {
          gsap.fromTo(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
        }
        if (tile.isMerged) {
          gsap.fromTo(el, { scale: 0.7 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1.2, 0.5)' });
        }
      }
    }
  }

  function updateScore() {
    scoreDisplay.textContent = score;
    bestDisplay.textContent = bestScore;
    // GSAP score pop
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(scoreDisplay, { scale: 1.4 }, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.4)' });
    }
  }

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

  function bindInput() {
    document.addEventListener('keydown', e => {
      const map = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); slide(dir); }
    });

    // ---- 滑动输入：Pointer Events 优先（微信 WKWebView / X5 / 现代浏览器通用） ----
    // 不用 touch 事件的原因：微信等 webview 会自行拦截/取消触摸手势，touchend 常收不到；
    // pointer 事件配合 touch-action:none 可将滑动手势稳定交给页面。
    if (window.PointerEvent) {
      const ptr = new Map(); // pointerId -> 按下坐标
      document.addEventListener('pointerdown', e => {
        if (!ptr.has(e.pointerId)) ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      });
      document.addEventListener('pointerup', e => {
        const p = ptr.get(e.pointerId);
        if (!p) return;
        ptr.delete(e.pointerId);
        handleSwipe(e.clientX - p.x, e.clientY - p.y);
      });
      document.addEventListener('pointercancel', e => ptr.delete(e.pointerId));
    } else {
      // 极旧内核回退：touch + mouse
      let tsX = 0, tsY = 0;
      document.addEventListener('touchstart', e => {
        tsX = e.touches[0].clientX; tsY = e.touches[0].clientY;
      }, { passive: true });
      document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tsX;
        const dy = e.changedTouches[0].clientY - tsY;
        handleSwipe(dx, dy);
      }, { passive: true });
      document.addEventListener('touchcancel', () => { tsX = 0; tsY = 0; });

      let msX = 0, msY = 0, msDown = false;
      document.addEventListener('mousedown', e => {
        msX = e.clientX; msY = e.clientY; msDown = true;
      });
      document.addEventListener('mouseup', e => {
        if (!msDown) return;
        msDown = false;
        handleSwipe(e.clientX - msX, e.clientY - msY);
      });
    }

    // 兜底：阻止浏览器用滚动/刷新吞掉滑动手势（即使 touch-action 被 webview 忽略）
    document.addEventListener('touchmove', e => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    newBtn.addEventListener('click', resetGame);
    retryBtn.addEventListener('click', resetGame);
    keepGoingBtn.addEventListener('click', () => {
      keepPlaying = true;
      overlay.classList.remove('show');
    });
    undoBtn.addEventListener('click', undo);

    overlay.addEventListener('click', e => {
      if (e.target.closest('.overlay-content')) return;
      if (won && !keepPlaying) {
        keepPlaying = true;
        overlay.classList.remove('show');
      }
    });

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

  return Object.freeze({ init });
})();

document.addEventListener('DOMContentLoaded', () => Game2048.init());
