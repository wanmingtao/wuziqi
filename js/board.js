/**
 * board.js — Canvas 棋盘渲染（高 DPI + 动画系统）
 */
const Board = (() => {
    const PADDING = 32;
    const STAR_POINTS = [
        [3, 3], [3, 7], [3, 11],
        [7, 3], [7, 7], [7, 11],
        [11, 3], [11, 7], [11, 11],
    ];

    let canvas, ctx;
    let cellSize, boardPixelSize, offset;
    let logicalSize;
    let dpr = 1;

    /* ---- 动画状态 ---- */
    let dropAnim = null;    // { row, col, player, start, duration }
    let winCells = null;    // 用于脉冲动画
    let winStart = 0;
    let animFrame = null;
    let renderState = null; // 存一份用于动画循环
    let onAnimDone = null;  // 落子动画完成回调

    const DROP_DURATION = 280;

    /* ---- 缓动函数 ---- */
    function easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /* ======== 初始化 ======== */
    function init(canvasEl, size) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        setSize(size);
    }

    function setSize(size) {
        logicalSize = size;
        const boardInner = size - PADDING * 2;
        cellSize = boardInner / (Game.BOARD_SIZE - 1);
        boardPixelSize = cellSize * (Game.BOARD_SIZE - 1);
        offset = PADDING;

        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ======== 坐标转换 ======== */
    function pixelToGrid(px, py) {
        const col = Math.round((px - offset) / cellSize);
        const row = Math.round((py - offset) / cellSize);
        if (Game.isValid(row, col)) return { row, col };
        return null;
    }

    function gridToPixel(row, col) {
        return {
            x: offset + col * cellSize,
            y: offset + row * cellSize,
        };
    }

    /* ======== 动画接口 ======== */
    function animateDrop(row, col, player, done) {
        /* GSAP: elastic drop animation */
        if (typeof gsap !== 'undefined') {
            dropAnim = { row, col, player, scale: 0, done: false };
            onAnimDone = done || null;
            gsap.to(dropAnim, {
                scale: 1,
                duration: 0.4,
                ease: 'elastic.out(1, 0.45)',
                onComplete() {
                    dropAnim.done = true;
                    dropAnim = null;
                    if (onAnimDone) {
                        const cb = onAnimDone;
                        onAnimDone = null;
                        cb();
                    }
                },
            });
            startAnimLoop();
        } else {
            dropAnim = { row, col, player, start: performance.now(), duration: DROP_DURATION };
            onAnimDone = done || null;
            startAnimLoop();
        }
    }

    function setWinCells(cells) {
        winCells = cells;
        winStart = performance.now();
        if (!animFrame) startAnimLoop();
    }

    function clearWinCells() {
        winCells = null;
    }

    function clearDropAnim() {
        dropAnim = null;
    }

    function isAnimating() {
        return !!dropAnim;
    }

    /* ======== 动画循环 ======== */
    function startAnimLoop() {
        if (animFrame) return;
        function loop(ts) {
            let hasActive = false;

            if (dropAnim) {
                if (ts - dropAnim.start >= dropAnim.duration) {
                    dropAnim = null;
                    if (onAnimDone) {
                        const cb = onAnimDone;
                        onAnimDone = null;
                        cb();
                    }
                } else {
                    hasActive = true;
                }
            }

            if (winCells) hasActive = true;
            if (renderState) draw(renderState, ts);

            if (hasActive) {
                animFrame = requestAnimationFrame(loop);
            } else {
                animFrame = null;
            }
        }
        animFrame = requestAnimationFrame(loop);
    }

    /* ======== 主渲染 ======== */
    function render(state) {
        renderState = state;
        const now = performance.now();

        if (!animFrame) {
            draw(state, now);
        }
        // 动画在跑则由动画循环驱动
    }

    function draw(state, now) {
        const { board, lastMove, hover } = state;
        const w = logicalSize;
        const h = logicalSize;

        ctx.clearRect(0, 0, w, h);

        /* ── 棋盘底色 ── */
        const baseGrad = ctx.createLinearGradient(0, 0, w, h);
        baseGrad.addColorStop(0, '#ddb87a');
        baseGrad.addColorStop(0.4, '#cfa566');
        baseGrad.addColorStop(0.7, '#c49a5a');
        baseGrad.addColorStop(1, '#b88a48');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, w, h);

        /* ── 木纹纹理 ── */
        drawWoodGrain(w, h);

        /* ── 网格线（带微弱内阴影感） ── */
        for (let i = 0; i < Game.BOARD_SIZE; i++) {
            const pos = offset + i * cellSize;

            // 暗线偏移
            ctx.strokeStyle = 'rgba(80,45,20,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pos + 0.5, offset);
            ctx.lineTo(pos + 0.5, offset + boardPixelSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(offset, pos + 0.5);
            ctx.lineTo(offset + boardPixelSize, pos + 0.5);
            ctx.stroke();

            // 亮线
            ctx.strokeStyle = 'rgba(70,40,18,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pos, offset);
            ctx.lineTo(pos, offset + boardPixelSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(offset, pos);
            ctx.lineTo(offset + boardPixelSize, pos);
            ctx.stroke();
        }

        /* ── 星位 ── */
        ctx.fillStyle = '#5d3820';
        for (const [r, c] of STAR_POINTS) {
            const { x, y } = gridToPixel(r, c);
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        /* ── 坐标 ── */
        ctx.fillStyle = '#8b6a3d';
        ctx.font = `${Math.max(10, cellSize * 0.3)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < Game.BOARD_SIZE; i++) {
            const pos = offset + i * cellSize;
            const labelX = String.fromCharCode(65 + (i < 8 ? i : i + 1));
            ctx.fillText(labelX, pos, offset - 18);
            ctx.fillText(String(i + 1), offset - 20, pos);
        }

        /* ── 棋子 ── */
        for (let r = 0; r < Game.BOARD_SIZE; r++) {
            for (let c = 0; c < Game.BOARD_SIZE; c++) {
                if (board[r][c] === Game.EMPTY) continue;

                // 跳过正在做落子动画的棋子，在动画块绘制
                if (dropAnim && dropAnim.row === r && dropAnim.col === c) continue;

                const winCell = winCells && winCells.find(([wr, wc]) => wr === r && wc === c);
                const isWin = !!winCell;
                drawPiece(r, c, board[r][c], { isWin, winStart: winStart, now, cell: winCell });
            }
        }

        /* ── 落子动画 ── */
        if (dropAnim) {
            let t;
            if (typeof gsap !== 'undefined' && dropAnim.scale !== undefined) {
                t = dropAnim.scale;
            } else if (dropAnim.start !== undefined) {
                const elapsed = now - dropAnim.start;
                const raw = Math.min(elapsed / dropAnim.duration, 1);
                t = easeOutBack(raw);
            } else {
                t = 1;
            }
            drawPiece(dropAnim.row, dropAnim.col, dropAnim.player, { scale: t });
        }

        /* ── 上一步标记 ── */
        if (lastMove) {
            const [lr, lc] = lastMove;
            if (!(dropAnim && dropAnim.row === lr && dropAnim.col === lc)) {
                const { x, y } = gridToPixel(lr, lc);
                const color = board[lr]?.[lc] === Game.BLACK ? '#ff6b6b' : '#ff4444';
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, Math.max(3, cellSize * 0.12), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        /* ── 连胜脉冲高亮 ── */
        if (winCells && !dropAnim) {
            const pulse = 0.7 + 0.3 * Math.sin((now - winStart) * 0.005);
            ctx.save();
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 18 * pulse;
            for (const [wr, wc] of winCells) {
                const { x, y } = gridToPixel(wr, wc);
                ctx.strokeStyle = `rgba(255,80,80,${0.5 + 0.5 * pulse})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(x, y, cellSize * 0.43, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        /* ── 悬停预览 ── */
        if (hover && !dropAnim) {
            const { x, y } = gridToPixel(hover.row, hover.col);
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.08 * Math.sin(now * 0.006);
            drawPiece(hover.row, hover.col, hover.player, { ghost: true });
            ctx.restore();
        }
    }

    /* ======== 木纹 ======== */
    function drawWoodGrain(w, h) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#8b5e30';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 28; i++) {
            const y = 3 + i * (h / 28) + Math.sin(i * 0.65) * 5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x < w; x += 6) {
                ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 2);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ======== 棋子绘制 ======== */
    function drawPiece(row, col, player, opts = {}) {
        const { x, y } = gridToPixel(row, col);
        const radius = cellSize * 0.44;
        const { isWin, winStart, now, scale, ghost, cell } = opts;

        ctx.save();
        const s = scale ?? 1;

        /* 外阴影 */
        if (!ghost) {
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 3 * s + 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 2 * s + 1;
        }

        /* 缩放变换 */
        if (scale !== undefined && scale < 1) {
            ctx.translate(x, y);
            ctx.scale(s, s);
            ctx.translate(-x, -y);
        }

        /* 主体渐变 */
        const grad = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, radius * 0.08,
            x, y, radius
        );

        if (player === Game.BLACK) {
            grad.addColorStop(0, '#606060');
            grad.addColorStop(0.35, '#2a2a2a');
            grad.addColorStop(0.7, '#151515');
            grad.addColorStop(1, '#0a0a0a');
        } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.35, '#f5f5f5');
            grad.addColorStop(0.7, '#e0e0e0');
            grad.addColorStop(1, '#bebebe');
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        /* 高光 */
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const hl = ctx.createRadialGradient(
            x - radius * 0.32, y - radius * 0.35, radius * 0.05,
            x - radius * 0.1, y - radius * 0.1, radius * 0.55
        );
        if (player === Game.BLACK) {
            hl.addColorStop(0, 'rgba(255,255,255,0.22)');
            hl.addColorStop(0.6, 'rgba(255,255,255,0.04)');
            hl.addColorStop(1, 'rgba(255,255,255,0)');
        } else {
            hl.addColorStop(0, 'rgba(255,255,255,0.85)');
            hl.addColorStop(0.6, 'rgba(255,255,255,0.15)');
            hl.addColorStop(1, 'rgba(255,255,255,0)');
        }
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        /* 白棋边缘 */
        if (player === Game.WHITE && !ghost) {
            ctx.strokeStyle = 'rgba(150,140,130,0.45)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        /* 获胜高亮 */
        if (isWin) {
            /* Use GSAP glow intensity if available, else fallback to sin pulse */
            const glowVal = (cell && cell.glowIntensity !== undefined) ? cell.glowIntensity : null;
            const pulse = glowVal !== null ? Math.max(0, Math.min(1, glowVal)) : (0.5 + 0.5 * Math.sin((now - winStart) * 0.005));
            const goldGrad = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.15);
            goldGrad.addColorStop(0, `rgba(255,215,0,${0.15 * pulse})`);
            goldGrad.addColorStop(1, `rgba(255,180,0,${0.5 * pulse})`);
            ctx.fillStyle = goldGrad;
            ctx.beginPath();
            ctx.arc(x, y, radius * 1.15, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /* ======== 公开 API ======== */
    return Object.freeze({
        init,
        setSize,
        pixelToGrid,
        gridToPixel,
        render,
        animateDrop,
        setWinCells,
        clearWinCells,
        clearDropAnim,
        isAnimating,
        get cellSize() { return cellSize; },
        get logicalSize() { return logicalSize; },
    });
})();
