/**
 * board.js — Canvas 棋盘渲染
 * 负责绘制棋盘、棋子、高亮和动画
 */

const Board = (() => {
    const PADDING = 30;
    const STAR_POINTS = [
        [3, 3], [3, 7], [3, 11],
        [7, 3], [7, 7], [7, 11],
        [11, 3], [11, 7], [11, 11],
    ];

    let canvas, ctx;
    let cellSize, boardPixelSize, offset;

    /** 初始化 Canvas 并计算尺寸 */
    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');

        const size = Math.min(
            window.innerWidth - 280,
            window.innerHeight - 120,
            560
        );
        const boardInner = size - PADDING * 2;
        cellSize = boardInner / (Game.BOARD_SIZE - 1);
        boardPixelSize = cellSize * (Game.BOARD_SIZE - 1);
        offset = PADDING;
        canvas.width = size;
        canvas.height = size;

        draw({ board: Game.createBoard(), lastMove: null, winCells: null });
    }

    /** 将像素坐标转换为棋盘行列 */
    function pixelToGrid(px, py) {
        const col = Math.round((px - offset) / cellSize);
        const row = Math.round((py - offset) / cellSize);
        if (Game.isValid(row, col)) return { row, col };
        return null;
    }

    /** 将棋盘行列转换为像素坐标 */
    function gridToPixel(row, col) {
        return {
            x: offset + col * cellSize,
            y: offset + row * cellSize,
        };
    }

    /** 主绘制函数 */
    function draw({ board, lastMove, winCells, hover }) {
        const w = canvas.width;
        const h = canvas.height;

        /* ── 木板背景 ── */
        const woodGrad = ctx.createLinearGradient(0, 0, w, h);
        woodGrad.addColorStop(0, '#d4b47a');
        woodGrad.addColorStop(0.5, '#c8a46a');
        woodGrad.addColorStop(1, '#b8945a');
        ctx.fillStyle = woodGrad;
        ctx.fillRect(0, 0, w, h);

        /* 木纹 */
        ctx.strokeStyle = 'rgba(160, 128, 80, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const y = 5 + i * (h / 20) + Math.sin(i * 0.7) * 4;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x < w; x += 4) {
                ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 1.5);
            }
            ctx.stroke();
        }

        /* ── 网格线 ── */
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 1;

        for (let i = 0; i < Game.BOARD_SIZE; i++) {
            const x = offset + i * cellSize;
            ctx.beginPath();
            ctx.moveTo(x, offset);
            ctx.lineTo(x, offset + boardPixelSize);
            ctx.stroke();

            const y = offset + i * cellSize;
            ctx.beginPath();
            ctx.moveTo(offset, y);
            ctx.lineTo(offset + boardPixelSize, y);
            ctx.stroke();
        }

        /* ── 星位（天元/小目） ── */
        ctx.fillStyle = '#5d4037';
        for (const [r, c] of STAR_POINTS) {
            const { x, y } = gridToPixel(r, c);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        /* ── 数字坐标 ── */
        ctx.fillStyle = '#8d6e50';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < Game.BOARD_SIZE; i++) {
            const x = offset + i * cellSize;
            ctx.fillText(String.fromCharCode(65 + (i < 8 ? i : i + 1)), x, offset - 18);
            ctx.fillText(i + 1, offset - 18, x);
        }

        /* ── 棋子 ── */
        for (let r = 0; r < Game.BOARD_SIZE; r++) {
            for (let c = 0; c < Game.BOARD_SIZE; c++) {
                if (board[r][c] !== Game.EMPTY) {
                    drawPiece(r, c, board[r][c], false);
                }
            }
        }

        /* ── 上一步标记 ── */
        if (lastMove) {
            const { x, y } = gridToPixel(lastMove[0], lastMove[1]);
            const player = board[lastMove[0]]?.[lastMove[1]];
            ctx.fillStyle = player === Game.BLACK ? '#ff6666' : '#ff4444';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        /* ── 连胜高亮 ── */
        if (winCells) {
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 16;
            for (const [r, c] of winCells) {
                const { x, y } = gridToPixel(r, c);
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, cellSize * 0.42, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }

        /* ── 悬停预览 ── */
        if (hover) {
            const { x, y } = gridToPixel(hover.row, hover.col);
            ctx.globalAlpha = 0.4;
            drawPiece(hover.row, hover.col, hover.player, true);
            ctx.globalAlpha = 1;
        }
    }

    /** 绘制单个棋子（带 3D 光泽效果） */
    function drawPiece(row, col, player, ghost) {
        const { x, y } = gridToPixel(row, col);
        const radius = cellSize * 0.44;

        ctx.save();

        /* 外发光 */
        if (!ghost) {
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
        }

        /* 主体 */
        const grad = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, radius * 0.1,
            x, y, radius
        );

        if (player === Game.BLACK) {
            grad.addColorStop(0, '#555');
            grad.addColorStop(0.5, '#222');
            grad.addColorStop(1, '#111');
        } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, '#f0f0f0');
            grad.addColorStop(1, '#c8c8c8');
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        /* 高光 */
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        const highlight = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.35, 0,
            x - radius * 0.3, y - radius * 0.35, radius * 0.5
        );
        highlight.addColorStop(0, player === Game.BLACK
            ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.7)');
        highlight.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = highlight;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        /* 白棋边框 */
        if (player === Game.WHITE && !ghost) {
            ctx.strokeStyle = 'rgba(160,160,160,0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /** 重新绘制整个棋盘（由外部调用） */
    function render(state) {
        draw(state);
    }

    return Object.freeze({
        init,
        pixelToGrid,
        gridToPixel,
        render,
    });
})();
