/**
 * app.js — 五子棋主控制器（动画协调 + 移动端适配）
 */
const App = (() => {
    /* ---- 状态 ---- */
    let state = {
        board: [],
        currentPlayer: Game.BLACK,
        moveHistory: [],
        winCells: null,
        gameOver: false,
        isAiThinking: false,
        scores: { black: 0, white: 0 },
        mode: 'ai',
        difficulty: 'medium',
        playerColor: Game.BLACK,
    };

    const els = {};
    let aiTimeoutId = null;

    /* ======== 初始化 ======== */
    function init() {
        cacheElements();
        Effects.init(document.getElementById('confetti'));
        calcAndInitBoard();
        resetBoard();
        bindEvents();
        render();
    }

    function cacheElements() {
        els.canvas = document.getElementById('board');
        els.status = document.getElementById('status');
        els.turnDot = document.getElementById('turnDot');
        els.blackScore = document.getElementById('blackScore');
        els.whiteScore = document.getElementById('whiteScore');
        els.modal = document.getElementById('resultModal');
        els.modalTitle = document.getElementById('modalTitle');
        els.modalDesc = document.getElementById('modalDesc');
        els.modalIcon = document.getElementById('modalIcon');
        els.modalBtn = document.getElementById('modalBtn');
        els.newGameBtn = document.getElementById('newGameBtn');
        els.undoBtn = document.getElementById('undoBtn');
        els.difficultySection = document.getElementById('difficultySection');
    }

    /* ======== 棋盘尺寸计算 ======== */
    function calcBoardSize() {
        const isMobile = window.innerWidth < 768;
        let size;
        if (isMobile) {
            size = Math.min(window.innerWidth - 24, window.innerHeight * 0.52);
        } else {
            size = Math.min(window.innerWidth - 310, window.innerHeight - 140, 560);
        }
        return Math.max(280, Math.floor(size));
    }

    function calcAndInitBoard() {
        const size = calcBoardSize();
        Board.init(els.canvas, size);
    }

    /* ======== 棋盘重置 ======== */
    function resetBoard() {
        state.board = Game.createBoard();
        state.currentPlayer = Game.BLACK;
        state.moveHistory = [];
        state.winCells = null;
        state.gameOver = false;
        state.isAiThinking = false;

        if (aiTimeoutId) {
            clearTimeout(aiTimeoutId);
            aiTimeoutId = null;
        }

        Board.clearWinCells();
        Board.clearDropAnim();
        Effects.clear();
        els.modal.classList.remove('show');
        els.undoBtn.disabled = false;
    }

    /* ======== 事件绑定 ======== */
    function bindEvents() {
        // 鼠标 / 触摸
        els.canvas.addEventListener('click', onBoardClick);
        els.canvas.addEventListener('touchstart', onBoardTouch, { passive: false });
        els.canvas.addEventListener('mousemove', onBoardHover);
        els.canvas.addEventListener('mouseleave', () => Board.render(makeRenderState()));

        // 按钮
        els.newGameBtn.addEventListener('click', onNewGame);
        els.undoBtn.addEventListener('click', onUndo);
        els.modalBtn.addEventListener('click', () => {
            els.modal.classList.remove('show');
            onNewGame();
        });

        // 对手切换
        bindToggle('#opponentToggle', (val) => {
            state.mode = val;
            els.difficultySection.style.display = val === 'ai' ? '' : 'none';
            onNewGame();
        });

        // 难度切换
        bindToggle('#difficultyToggle', (val) => {
            state.difficulty = val;
        });

        // 颜色切换
        bindToggle('#colorToggle', (val) => {
            state.playerColor = val === 'black' ? Game.BLACK : Game.WHITE;
            onNewGame();
        });

        // 窗口尺寸变化
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                calcAndInitBoard();
                Effects.onResize();
                Board.render(makeRenderState());
            }, 200);
        });

        // 键盘（用于关闭弹窗）
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.modal.classList.contains('show')) {
                els.modal.classList.remove('show');
                onNewGame();
            }
        });
    }

    function bindToggle(selector, onChange) {
        document.querySelectorAll(`${selector} .toggle-btn`).forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll(`${selector} .toggle-btn`).forEach((b) =>
                    b.classList.remove('active')
                );
                btn.classList.add('active');
                onChange(btn.dataset.value);
            });
        });
    }

    /* ======== 触摸事件（移动端） ======== */
    function onBoardTouch(e) {
        e.preventDefault(); // 阻止滚动 / 缩放
        if (state.gameOver || state.isAiThinking || Board.isAnimating()) return;

        const touch = e.touches[0];
        if (!touch) return;

        const rect = els.canvas.getBoundingClientRect();
        const scaleX = Board.logicalSize / rect.width;
        const scaleY = Board.logicalSize / rect.height;
        const px = (touch.clientX - rect.left) * scaleX;
        const py = (touch.clientY - rect.top) * scaleY;

        const pos = Board.pixelToGrid(px, py);
        if (!pos) return;
        if (!Game.isEmpty(state.board, pos.row, pos.col)) return;
        if (state.mode === 'ai' && state.currentPlayer !== state.playerColor) return;

        makeMove(pos.row, pos.col);
    }

    /* ======== 鼠标点击 ======== */
    function onBoardClick(e) {
        if (state.gameOver || state.isAiThinking || Board.isAnimating()) return;

        const rect = els.canvas.getBoundingClientRect();
        const scaleX = Board.logicalSize / rect.width;
        const scaleY = Board.logicalSize / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        const pos = Board.pixelToGrid(px, py);
        if (!pos) return;
        if (!Game.isEmpty(state.board, pos.row, pos.col)) return;
        if (state.mode === 'ai' && state.currentPlayer !== state.playerColor) return;

        makeMove(pos.row, pos.col);
    }

    function onBoardHover(e) {
        if (state.gameOver || state.isAiThinking || Board.isAnimating()) return;

        const rect = els.canvas.getBoundingClientRect();
        const scaleX = Board.logicalSize / rect.width;
        const scaleY = Board.logicalSize / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        const pos = Board.pixelToGrid(px, py);
        if (pos && Game.isEmpty(state.board, pos.row, pos.col)) {
            if (state.mode === 'ai' && state.currentPlayer !== state.playerColor) {
                Board.render(makeRenderState());
                return;
            }
            Board.render(makeRenderState({ hover: pos }));
        } else {
            Board.render(makeRenderState());
        }
    }

    /* ======== 落子（动画驱动） ======== */
    function makeMove(row, col) {
        const player = state.currentPlayer;
        state.board[row][col] = player;
        state.moveHistory.push({ row, col, player });
        els.undoBtn.disabled = true;

        Board.render(makeRenderState());
        Board.animateDrop(row, col, player, () => {
            afterMoveAnimation(player);
        });
    }

    function afterMoveAnimation(player) {
        // 判定胜负
        const last = state.moveHistory[state.moveHistory.length - 1];
        const winResult = Game.checkWin(state.board, last.row, last.col);

        if (winResult) {
            state.winCells = winResult;
            state.gameOver = true;
            state.scores[player === Game.BLACK ? 'black' : 'white']++;

            // 连胜动画
            Board.setWinCells(winResult);

            /* GSAP: stagger glow on winning line */
            if (typeof gsap !== 'undefined') {
                winResult.forEach((cell, i) => {
                    const [r, c] = cell;
                    gsap.fromTo(cell, { glowIntensity: 0 }, {
                        glowIntensity: 1.2,
                        duration: 0.4,
                        delay: i * 0.08,
                        ease: 'elastic.out(1, 0.5)',
                        yoyo: true,
                        repeat: 1,
                        onComplete() {
                            gsap.to(cell, { glowIntensity: 0.7, duration: 0.5, ease: 'power2.inOut' });
                        },
                    });
                });
            }

            // 庆祝特效
            const winPoints = winResult.map(([r, c]) => {
                const { x, y } = Board.gridToPixel(r, c);
                const rect = els.canvas.getBoundingClientRect();
                return [
                    rect.left + (x / Board.logicalSize) * rect.width,
                    rect.top + (y / Board.logicalSize) * rect.height,
                ];
            });
            Effects.celebrate(winPoints);

            Board.render(makeRenderState());
            updateStatus();

            setTimeout(() => showResult(player), 800);
            return;
        }

        // 平局
        if (Game.isBoardFull(state.board)) {
            state.gameOver = true;
            Board.render(makeRenderState());
            showDraw();
            return;
        }

        // 切换玩家
        state.currentPlayer = Game.opponent(player);
        Board.render(makeRenderState());
        updateStatus();
        els.undoBtn.disabled = state.moveHistory.length === 0;

        // AI 走棋
        if (state.mode === 'ai' && state.currentPlayer !== state.playerColor) {
            scheduleAiMove();
        }
    }

    /* ======== AI ======== */
    function scheduleAiMove() {
        state.isAiThinking = true;
        els.undoBtn.disabled = true;
        updateStatus();

        const delay = state.difficulty === 'hard' ? 400 : 250;
        aiTimeoutId = setTimeout(() => {
            aiTimeoutId = null;
            const move = AI.getMove(
                state.board,
                Game.opponent(state.playerColor),
                state.difficulty
            );

            state.isAiThinking = false;

            if (move && Game.isEmpty(state.board, move.row, move.col)) {
                makeMove(move.row, move.col);
            }
        }, delay);
    }

    /* ======== 悔棋 ======== */
    function onUndo() {
        if (state.gameOver || state.isAiThinking || Board.isAnimating()) return;
        if (state.moveHistory.length === 0) return;

        Board.clearWinCells();

        if (state.mode === 'ai') {
            const steps = Math.min(2, state.moveHistory.length);
            for (let i = 0; i < steps; i++) {
                const last = state.moveHistory.pop();
                state.board[last.row][last.col] = Game.EMPTY;
            }
            state.currentPlayer = state.playerColor;
        } else {
            const last = state.moveHistory.pop();
            state.board[last.row][last.col] = Game.EMPTY;
            state.currentPlayer = last.player;
        }

        state.winCells = null;
        Board.render(makeRenderState());
        updateStatus();
        els.undoBtn.disabled = state.moveHistory.length === 0;

        /* GSAP: brief undo animation on the board */
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(els.canvas, { scale: 0.97 }, {
                scale: 1,
                duration: 0.3,
                ease: 'elastic.out(1, 0.4)',
                clearProps: 'transform',
            });
        }
    }

    /* ======== 新游戏 ======== */
    function onNewGame() {
        resetBoard();
        Board.render(makeRenderState());
        updateStatus();

        if (state.mode === 'ai' && state.playerColor === Game.WHITE) {
            scheduleAiMove();
        }
    }

    /* ======== 结果弹窗 ======== */
    function showResult(winner) {
        const isPlayer =
            state.mode === 'friend' || winner === state.playerColor;

        if (state.mode === 'friend') {
            els.modalTitle.textContent = winner === Game.BLACK ? '黑棋胜' : '白棋胜';
            els.modalDesc.textContent = '精彩的棋局！';
            els.modalIcon.textContent = '🏆';
        } else if (isPlayer) {
            els.modalTitle.textContent = '你赢了！';
            els.modalDesc.textContent = '恭喜战胜 AI！';
            els.modalIcon.textContent = '🎉';
        } else {
            els.modalTitle.textContent = 'AI 获胜';
            els.modalDesc.textContent = '再接再厉，再来一局吧';
            els.modalIcon.textContent = '🤖';
        }

        els.modalIcon.classList.remove('pop');
        void els.modalIcon.offsetWidth;
        els.modalIcon.classList.add('pop');

        els.modal.classList.add('show');

        /* GSAP: elastic entrance for game over overlay */
        if (typeof gsap !== 'undefined') {
            const modalBox = els.modal.querySelector('.modal');
            gsap.fromTo(modalBox, { scale: 0.3, opacity: 0 }, {
                scale: 1,
                opacity: 1,
                duration: 0.6,
                ease: 'elastic.out(1, 0.5)',
                clearProps: 'transform,opacity',
            });
        }
    }

    function showDraw() {
        els.modalTitle.textContent = '平局';
        els.modalDesc.textContent = '棋逢对手！';
        els.modalIcon.textContent = '🤝';
        els.modalIcon.classList.remove('pop');
        void els.modalIcon.offsetWidth;
        els.modalIcon.classList.add('pop');
        els.modal.classList.add('show');

        /* GSAP: elastic entrance for draw overlay */
        if (typeof gsap !== 'undefined') {
            const modalBox = els.modal.querySelector('.modal');
            gsap.fromTo(modalBox, { scale: 0.3, opacity: 0 }, {
                scale: 1,
                opacity: 1,
                duration: 0.6,
                ease: 'elastic.out(1, 0.5)',
                clearProps: 'transform,opacity',
            });
        }
    }

    /* ======== 状态栏 ======== */
    function updateStatus() {
        if (state.gameOver) {
            if (state.winCells) {
                const winner = state.currentPlayer;
                els.status.textContent = winner === Game.BLACK ? '白棋胜' : '黑棋胜';
                els.status.className = 'turn-text';
            } else {
                els.status.textContent = '平局';
                els.status.className = 'turn-text';
            }
        } else if (state.isAiThinking) {
            els.status.textContent = 'AI 思考中…';
            els.status.className = 'turn-text thinking';
        } else {
            els.status.textContent =
                state.currentPlayer === Game.BLACK ? '黑棋落子' : '白棋落子';
            els.status.className = 'turn-text';
        }

        // 回合指示点
        els.turnDot.className = 'piece-dot ' +
            (state.currentPlayer === Game.BLACK ? 'black' : 'white');

        // 比分
        updateScore(els.blackScore, state.scores.black);
        updateScore(els.whiteScore, state.scores.white);

        // 难度可见
        els.difficultySection.style.display =
            state.mode === 'ai' ? '' : 'none';
    }

    function updateScore(el, val) {
        if (el.textContent !== String(val)) {
            el.textContent = val;
            el.classList.remove('bump');
            void el.offsetWidth;
            el.classList.add('bump');
            /* GSAP: elastic bounce on score update */
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(el, { scale: 1 }, {
                    scale: 1.4,
                    duration: 0.35,
                    ease: 'elastic.out(1, 0.35)',
                    clearProps: 'transform',
                });
            }
        }
    }

    /* ======== 渲染状态 ======== */
    function makeRenderState(extra) {
        const hover = extra?.hover
            ? { row: extra.hover.row, col: extra.hover.col, player: state.currentPlayer }
            : null;

        const last = state.moveHistory.length > 0
            ? state.moveHistory[state.moveHistory.length - 1]
            : null;

        return {
            board: state.board,
            lastMove: last ? [last.row, last.col] : null,
            winCells: state.winCells,
            hover,
        };
    }

    function render() {
        Board.render(makeRenderState());
        updateStatus();
    }

    return Object.freeze({ init });
})();

document.addEventListener('DOMContentLoaded', () => App.init());
