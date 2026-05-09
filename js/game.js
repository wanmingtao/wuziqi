/**
 * game.js — 五子棋核心游戏逻辑
 * 管理棋盘状态、落子验证、胜负判定
 */

const Game = (() => {
    const BOARD_SIZE = 15;
    const EMPTY = 0;
    const BLACK = 1;
    const WHITE = 2;

    /* 四个检测方向：水平、垂直、正斜、反斜 */
    const DIRECTIONS = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
    ];

    function createBoard() {
        return Array.from({ length: BOARD_SIZE }, () =>
            Array.from({ length: BOARD_SIZE }, () => EMPTY)
        );
    }

    function cloneBoard(board) {
        return board.map((row) => [...row]);
    }

    function isValid(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    function isEmpty(board, row, col) {
        return isValid(row, col) && board[row][col] === EMPTY;
    }

    /**
     * 检查落子后是否形成五子连珠
     * 返回获胜的坐标数组，或 null
     */
    function checkWin(board, row, col) {
        const player = board[row][col];
        if (player === EMPTY) return null;

        for (const [dr, dc] of DIRECTIONS) {
            const cells = [[row, col]];

            // 正方向延伸
            let r = row + dr,
                c = col + dc;
            while (isValid(r, c) && board[r][c] === player) {
                cells.push([r, c]);
                r += dr;
                c += dc;
            }

            // 反方向延伸
            r = row - dr;
            c = col - dc;
            while (isValid(r, c) && board[r][c] === player) {
                cells.push([r, c]);
                r -= dr;
                c -= dc;
            }

            if (cells.length >= 5) return cells;
        }

        return null;
    }

    /**
     * 检查棋盘是否已满（平局）
     */
    function isBoardFull(board) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) return false;
            }
        }
        return true;
    }

    /**
     * 获取对手棋子颜色
     */
    function opponent(player) {
        return player === BLACK ? WHITE : BLACK;
    }

    /**
     * 获取所有空位
     */
    function getEmptyCells(board) {
        const cells = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) cells.push([r, c]);
            }
        }
        return cells;
    }

    return Object.freeze({
        BOARD_SIZE,
        EMPTY,
        BLACK,
        WHITE,
        DIRECTIONS,
        createBoard,
        cloneBoard,
        isValid,
        isEmpty,
        checkWin,
        isBoardFull,
        opponent,
        getEmptyCells,
    });
})();
