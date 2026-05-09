/**
 * effects.js — 粒子特效（庆祝彩带 + 背景粒子）
 */
const Effects = (() => {
    let canvas, ctx;
    let particles = [];
    let bgParticles = [];
    let animFrame = null;
    let w, h;

    const COLORS_WIN = [
        '#ff4444', '#ff8800', '#ffcc00', '#44dd44',
        '#44aaff', '#cc44ff', '#ff66aa', '#00ddcc',
    ];

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize();
        initBgParticles();
        ensureLoop();
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---- 庆祝爆发 ---- */
    function celebrate(sourcePoints) {
        for (const [sx, sy] of sourcePoints) {
            const count = 10 + Math.floor(Math.random() * 8);
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: sx,
                    y: sy,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10 - 3,
                    life: 1,
                    decay: 0.008 + Math.random() * 0.018,
                    size: 3 + Math.random() * 6,
                    color: COLORS_WIN[Math.floor(Math.random() * COLORS_WIN.length)],
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.3,
                    shape: Math.random() > 0.5 ? 'rect' : 'circle',
                });
            }
        }
        ensureLoop();
    }

    /* ---- 背景微粒 ---- */
    function initBgParticles() {
        bgParticles = [];
        for (let i = 0; i < 25; i++) {
            bgParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3 - 0.15,
                size: 0.8 + Math.random() * 1.8,
                alpha: 0.15 + Math.random() * 0.25,
                pulse: Math.random() * Math.PI * 2,
            });
        }
    }

    function ensureLoop() {
        if (animFrame) return;
        function loop() {
            update();
            draw();
            if (particles.length > 0 || bgParticles.length > 0) {
                animFrame = requestAnimationFrame(loop);
            } else {
                animFrame = null;
            }
        }
        animFrame = requestAnimationFrame(loop);
    }

    /* ---- 更新 ---- */
    function update() {
        // 庆祝粒子
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18;  // 重力
            p.vx *= 0.995;
            p.life -= p.decay;
            p.rotation += p.rotSpeed;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // 背景粒子
        for (const p of bgParticles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -20) p.x = w + 20;
            if (p.x > w + 20) p.x = -20;
            if (p.y < -20) p.y = h + 20;
            if (p.y > h + 20) p.y = -20;
        }
    }

    /* ---- 绘制 ---- */
    function draw() {
        ctx.clearRect(0, 0, w, h);

        // 背景微粒
        for (const p of bgParticles) {
            const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.001 + p.pulse);
            ctx.save();
            ctx.globalAlpha = p.alpha * pulse;
            ctx.fillStyle = '#d4a843';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 庆祝粒子
        for (const p of particles) {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    /* ---- 窗口尺寸变化 ---- */
    function onResize() {
        resize();
        initBgParticles();
    }

    /* ---- 停止所有特效 ---- */
    function clear() {
        particles = [];
    }

    return Object.freeze({ init, celebrate, onResize, clear });
})();
