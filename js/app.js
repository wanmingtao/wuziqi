/**
 * app.js — 五子棋主控制器
 * 管理游戏流程、事件绑定、状态协调
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

        /* 用户设置 */
        mode: 'ai',       // 'ai' | 'friend'
        difficulty: 'medium',
        playerColor: Game.BLACK,
    };

    /* ---- DOM 引用 ---- */
    const els = {};

    function cacheElements() {
        els.canvas = document.getElementById('board');
        els.status = document.getElementById('status');
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
        els.colorToggle = document.getElementById('colorToggle');
    }

    /* ---- 初始化 ---- */
    function init() {
        cacheElements();

        Board.init(els.canvas);
        resetBoard();

        bindEvents();
        render();
    }

    /* ---- 重置棋盘 ---- */
    function resetBoard() {
        state.board = Game.createBoard();
        state.currentPlayer = Game.BLACK;
        state.moveHistory = [];
        state.winCells = null;
        state.gameOver = false;
        state.isAiThinking = false;

        els.modal.classList.remove('show');
        els.undoBtn.disabled = false;
    }

    /* ---- 事件绑定 ---- */
    function bindEvents() {
        /* 棋盘点击 */
        els.canvas.addEventListener('click', onCanvasClick);
        els.canvas.addEventListener('mousemove', onCanvasHover);
        els.canvas.addEventListener('mouseleave', () => {
            Board.render(makeRenderState());
        });

        /* 按钮 */
        els.newGameBtn.addEventListener('click', onNewGame);
        els.undoBtn.addEventListener('click', onUndo);
        els.modalBtn.addEventListener('click', () => {
            els.modal.classList.remove('show');
            onNewGame();
        });

        /* 模式切换 */
        document.querySelectorAll('#opponentToggle .toggle-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                setActive(btn, '#opponentToggle');
                state.mode = btn.dataset.value;
                els.difficultySection.style.display =
                    state.mode === 'ai' ? '' : 'none';
                onNewGame();
            });
        });

        /* 难度切换 */
        document.querySelectorAll('#difficultyToggle .toggle-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                setActive(btn, '#difficultyToggle');
                state.difficulty = btn.dataset.value;
                if (state.mode === 'ai' && !state.gameOver) {
                    /* 难度变更后不重置棋局，但会在下次 AI 走棋时使用新难度 */
                }
            });
        });

        /* 颜色切换 */
        document.querySelectorAll('#colorToggle .toggle-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                setActive(btn, '#colorToggle');
                state.playerColor = btn.dataset.value === 'black'
                    ? Game.BLACK : Game.WHITE;
                onNewGame();
            });
        });
    }

    function setActive(btn, groupSelector) {
        document.querySelectorAll(`${groupSelector} .toggle-btn`).forEach((b) =>
            b.classList.remove('active')
        );
        btn.classList.add('active');
    }

    /* ---- 棋盘交互 ---- */
    function onCanvasClick(e) {
        if (state.gameOver || state.isAiThinking) return;

        const rect = els.canvas.getBoundingClientRect();
        const scaleX = els.canvas.width / rect.width;
        const scaleY = els.canvas.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        const pos = Board.pixelToGrid(px, py);
        if (!pos) return;
        if (!Game.isEmpty(state.board, pos.row, pos.col)) return;

        /* 在好友模式下双方都可下；在 AI 模式下只有玩家回合可下 */
        if (state.mode === 'ai' && state.currentPlayer !== state.playerColor) return;

        makeMove(pos.row, pos.col);
    }

    function onCanvasHover(e) {
        if (state.gameOver || state.isAiThinking) return;

        const rect = els.canvas.getBoundingClientRect();
        const scaleX = els.canvas.width / rect.width;
        const scaleY = els.canvas.height / rect.height;
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

    /* ---- 落子逻辑 ---- */
    function makeMove(row, col) {
        const player = state.currentPlayer;
        state.board[row][col] = player;
        state.moveHistory.push({ row, col, player });

        /* 判定胜负 */
        const winResult = Game.checkWin(state.board, row, col);
        if (winResult) {
            state.winCells = winResult;
            state.gameOver = true;
            state.scores[player === Game.BLACK ? 'black' : 'white']++;
            Board.render(makeRenderState());

            showResult(player);
            updateStatus();
            return;
        }

        /* 平局 */
        if (Game.isBoardFull(state.board)) {
            state.gameOver = true;
            Board.render(makeRenderState());
            showDraw();
            return;
        }

        /* 切换玩家 */
        state.currentPlayer = Game.opponent(player);
        Board.render(makeRenderState());
        updateStatus();

        /* AI 走棋 */
        if (state.mode === 'ai' && state.currentPlayer !== state.playerColor) {
            scheduleAiMove();
        }
    }

    /* ---- AI 走棋（延迟模拟思考） ---- */
    function scheduleAiMove() {
        state.isAiThinking = true;
        els.undoBtn.disabled = true;

        setTimeout(() => {
            const move = AI.getMove(
                state.board,
                Game.opponent(state.playerColor),
                state.difficulty
            );

            if (move) {
                state.isAiThinking = false;
                makeMove(move.row, move.col);
            }

            els.undoBtn.disabled = state.moveHistory.length === 0;
        }, 300);
    }

    /* ---- 悔棋 ---- */
    function onUndo() {
        if (state.gameOver || state.isAiThinking) return;
        if (state.moveHistory.length === 0) return;

        if (state.mode === 'ai') {
            /* AI 模式下撤回两步（玩家 + AI） */
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
    }

    /* ---- 新游戏 ---- */
    function onNewGame() {
        resetBoard();
        Board.render(makeRenderState());
        updateStatus();

        /* AI 先手（玩家执白） */
        if (state.mode === 'ai' && state.playerColor === Game.WHITE) {
            scheduleAiMove();
        }
    }

    /* ---- 结果显示 ---- */
    function showResult(winner) {
        const isPlayer =
            state.mode === 'friend' ||
            winner === state.playerColor;

        if (state.mode === 'friend') {
            els.modalTitle.textContent = winner === Game.BLACK ? '黑棋胜' : '白棋胜';
            els.modalDesc.textContent = '精彩的棋局！';
            els.modalIcon.textContent = '🏆';
        } else if (isPlayer) {
            els.modalTitle.textContent = '你赢了！';
            els.modalDesc.textContent = '恭喜你战胜了 AI！';
            els.modalIcon.textContent = '🎉';
        } else {
            els.modalTitle.textContent = 'AI 获胜';
            els.modalDesc.textContent = '再接再厉，再来一局吧！';
            els.modalIcon.textContent = '🤖';
        }

        setTimeout(() => {
            els.modal.classList.add('show');
        }, 600);
    }

    function showDraw() {
        els.modalTitle.textContent = '平局';
        els.modalDesc.textContent = '棋逢对手，旗鼓相当！';
        els.modalIcon.textContent = '🤝';

        setTimeout(() => {
            els.modal.classList.add('show');
        }, 600);
    }

    /* ---- 状态更新 ---- */
    function updateStatus() {
        if (state.gameOver) {
            if (state.winCells) {
                els.status.textContent =
                    state.currentPlayer === Game.BLACK ? '白棋胜' : '黑棋胜';
                els.status.className = 'status win';
            } else {
                els.status.textContent = '平局';
                els.status.className = 'status draw';
            }
        } else if (state.isAiThinking) {
            els.status.textContent = 'AI 思考中…';
            els.status.className = 'status';
        } else {
            els.status.textContent =
                state.currentPlayer === Game.BLACK ? '黑棋落子' : '白棋落子';
            els.status.className =
                `status ${state.currentPlayer === Game.BLACK ? 'black-turn' : 'white-turn'}`;
        }

        els.blackScore.textContent = state.scores.black;
        els.whiteScore.textContent = state.scores.white;
    }

    /* ---- 渲染状态构建 ---- */
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

    /* ---- 渲染 ---- */
    function render() {
        Board.render(makeRenderState());
        updateStatus();

        els.difficultySection.style.display =
            state.mode === 'ai' ? '' : 'none';
    }

    return Object.freeze({ init });
})();

/* 页面加载完成后启动 */
document.addEventListener('DOMContentLoaded', () => App.init());
