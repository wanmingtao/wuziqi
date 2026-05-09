/**
 * ai.js — AI 对手（基于评分）
 * 对每个空位评估进攻与防守价值，选择最优落子
 */

const AI = (() => {
    const SCORES = {
        FIVE: 1000000,
        OPEN_FOUR: 100000,
        HALF_FOUR: 10000,
        OPEN_THREE: 10000,
        HALF_THREE: 1000,
        OPEN_TWO: 1000,
        HALF_TWO: 100,
    };

    /* 不同难度的评分乘数（防守倾向） */
    const DIFFICULTY = {
        easy: { defenseFactor: 0.6, noise: 0.15 },
        medium: { defenseFactor: 1.0, noise: 0.05 },
        hard: { defenseFactor: 1.2, noise: 0 },
    };

    /**
     * 分析在 (row, col) 处放置 player 棋子后的棋型
     * 返回四个方向上的模式数组
     */
    function analyzePosition(board, row, col, player) {
        const patterns = [];

        for (const [dr, dc] of Game.DIRECTIONS) {
            let count = 1;
            let blocked = 0;

            // 正方向
            let r = row + dr,
                c = col + dc;
            while (Game.isValid(r, c) && board[r][c] === player) {
                count++;
                r += dr;
                c += dc;
            }
            if (!Game.isValid(r, c) || board[r][c] !== Game.EMPTY) blocked++;

            // 反方向
            r = row - dr;
            c = col - dc;
            while (Game.isValid(r, c) && board[r][c] === player) {
                count++;
                r -= dr;
                c -= dc;
            }
            if (!Game.isValid(r, c) || board[r][c] !== Game.EMPTY) blocked++;

            patterns.push({ count, blocked });
        }

        return patterns;
    }

    /**
     * 根据棋型计分
     */
    function scorePatterns(patterns) {
        let score = 0;

        for (const { count, blocked } of patterns) {
            if (count >= 5) {
                score += SCORES.FIVE;
            } else if (count === 4) {
                score += blocked === 0 ? SCORES.OPEN_FOUR : SCORES.HALF_FOUR;
            } else if (count === 3) {
                score += blocked === 0 ? SCORES.OPEN_THREE : SCORES.HALF_THREE;
            } else if (count === 2) {
                score += blocked === 0 ? SCORES.OPEN_TWO : SCORES.HALF_TWO;
            } else if (count === 1) {
                score += blocked === 0 ? 10 : 1;
            }
        }

        return score;
    }

    /**
     * 是否值得考虑该空位（附近有棋子才考虑，剪枝优化）
     */
    function hasNeighbor(board, row, col, range) {
        range = range || 2;
        for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr,
                    c = col + dc;
                if (Game.isValid(r, c) && board[r][c] !== Game.EMPTY) return true;
            }
        }
        return false;
    }

    /**
     * 计算 AI 最佳落子位置
     * @param {number[][]} board
     * @param {number} aiPlayer - AI 的棋子颜色
     * @param {string} difficulty - 'easy' | 'medium' | 'hard'
     * @returns {{ row: number, col: number } | null}
     */
    function getMove(board, aiPlayer, difficulty) {
        const human = Game.opponent(aiPlayer);
        const config = DIFFICULTY[difficulty] || DIFFICULTY.medium;

        let bestScore = -Infinity;
        let bestMove = null;
        const candidates = [];

        /* 收集所有候选位置 */
        for (let r = 0; r < Game.BOARD_SIZE; r++) {
            for (let c = 0; c < Game.BOARD_SIZE; c++) {
                if (board[r][c] !== Game.EMPTY) continue;
                if (!hasNeighbor(board, r, c, 2)) continue;
                candidates.push([r, c]);
            }
        }

        /* 如果棋盘为空或没有邻居，走天元 */
        if (candidates.length === 0) {
            const center = Math.floor(Game.BOARD_SIZE / 2);
            return { row: center, col: center };
        }

        for (const [r, c] of candidates) {
            /* 进攻分：AI 自己在这里落子能形成的棋型 */
            const atkPatterns = analyzePosition(board, r, c, aiPlayer);
            const atkScore = scorePatterns(atkPatterns);

            /* 防守分：人类在这里落子能形成的棋型 */
            const defPatterns = analyzePosition(board, r, c, human);
            const defScore = scorePatterns(defPatterns);

            /* 综合评分：进攻 + 防守 * 系数 */
            let total = atkScore + defScore * config.defenseFactor;

            /* 随机扰动（低难度时） */
            if (config.noise > 0) {
                total += total * (Math.random() * config.noise * 2 - config.noise);
            }

            /* 靠近中心有微弱加分 */
            const center = (Game.BOARD_SIZE - 1) / 2;
            const dist = Math.abs(r - center) + Math.abs(c - center);
            total += (Game.BOARD_SIZE - dist) * 0.1;

            if (total > bestScore) {
                bestScore = total;
                bestMove = { row: r, col: c };
            }
        }

        return bestMove;
    }

    return Object.freeze({ getMove });
})();
