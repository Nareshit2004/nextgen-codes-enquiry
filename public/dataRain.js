/**
 * DataRain Component Implementation — Exact Physics Simulation & Rendering Engine
 * Features:
 * 1. Dense animated particles with adaptive particle count based on canvas area.
 * 2. Multicolour particle trails using original palette (--dr-calm #22e6ff, --dr-mid #8a5cff, --dr-hot #ff3d9a, --dr-core #eafcff).
 * 3. Particle depth (z-layers), variable mass, speed, and colour classification.
 * 4. Bright particle heads and white-hot highlights (#eafcff).
 * 5. Dual canvas rendering: Main simulation canvas (.dr-main) + Bloom glow canvas (.dr-bloom).
 * 6. Interactive cursor obstacle-avoidance physics: particles repelled by cursor.
 * 7. Fluid movement & wake effects: vortex-puff displacement impulse.
 * 8. Cursor halo element positioning & radial gradient tracking.
 * 9. Autopilot cursor movement when user is idle or out of viewport.
 * 10. Vignette (.dr-vignette) and film grain (.dr-grain) overlays.
 * 11. Lifecycle cleanup and reduced-motion handling.
 */

(function () {
  'use strict';

  // Constants
  const PALETTE = {
    bg0: '#020308',
    bg1: '#05070d',
    bg2: '#0a1020',
    calm: '#22e6ff', // Cyan
    mid: '#8a5cff',  // Purple
    hot: '#ff3d9a',  // Pink
    core: '#eafcff'  // Light highlight
  };

  const CHARS = '010101NEXTGENCODES<>/{};:=+*#ABCDEF2026';

  class Particle {
    constructor(w, h, depth) {
      this.depth = depth !== undefined ? depth : Math.random(); // 0 (far) to 1 (near)
      this.reset(w, h, true);
    }

    reset(w, h, initial = false) {
      this.x = Math.random() * w;
      this.y = initial ? Math.random() * h : -20 - Math.random() * 50;
      
      // Speed scales with depth
      this.baseSpeed = (1.2 + this.depth * 2.4);
      this.vy = this.baseSpeed;
      this.vx = (Math.random() - 0.5) * 0.4;
      
      // Length & scale
      this.length = Math.floor(6 + this.depth * 10);
      this.size = 11 + this.depth * 6;
      
      // Character choice
      this.char = CHARS[Math.floor(Math.random() * CHARS.length)];
      this.switchTimer = Math.floor(Math.random() * 20);

      // Color classification based on depth & random probability
      const rand = Math.random();
      if (rand < 0.65) {
        this.color = PALETTE.calm; // Calm Cyan
        this.tier = 'calm';
      } else if (rand < 0.88) {
        this.color = PALETTE.mid;  // Mid Purple
        this.tier = 'mid';
      } else {
        this.color = PALETTE.hot;  // Hot Pink
        this.tier = 'hot';
      }

      this.opacity = 0.35 + this.depth * 0.6;
    }

    update(w, h, cursor, vortexPuffs) {
      // Step character scramble
      this.switchTimer--;
      if (this.switchTimer <= 0) {
        this.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        this.switchTimer = Math.floor(10 + Math.random() * 30);
      }

      // Cursor obstacle-avoidance & deflection
      if (cursor && cursor.active) {
        const dx = this.x - cursor.x;
        const dy = this.y - cursor.y;
        const distSq = dx * dx + dy * dy;
        const radius = cursor.radius || 150;
        const radiusSq = radius * radius;

        if (distSq < radiusSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / radius) * 6.5;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push particles away (obstacle avoidance)
          this.vx += nx * force * (0.8 + this.depth * 0.4);
          this.vy += ny * force * 0.4;
        }
      }

      // Vortex-puff displacement impulse from rapid cursor motions
      if (vortexPuffs && vortexPuffs.length > 0) {
        for (let i = 0; i < vortexPuffs.length; i++) {
          const p = vortexPuffs[i];
          const pdx = this.x - p.x;
          const pdy = this.y - p.y;
          const pdistSq = pdx * pdx + pdy * pdy;
          const pRadSq = p.radius * p.radius;

          if (pdistSq < pRadSq && pdistSq > 1) {
            const pdist = Math.sqrt(pdistSq);
            const pforce = (1 - pdist / p.radius) * p.strength;
            this.vx += (pdx / pdist) * pforce;
            this.vy += (pdy / pdist) * pforce;
          }
        }
      }

      // Physics damping & terminal fall speed
      this.x += this.vx;
      this.y += this.vy;

      this.vx *= 0.92; // lateral friction
      // Return gently toward base speed
      this.vy += (this.baseSpeed - this.vy) * 0.05;

      // Wrap or reset at bottom
      if (this.y - this.length * this.size > h) {
        this.reset(w, h, false);
      }
      if (this.x < -50) this.x = w + 40;
      if (this.x > w + 50) this.x = -40;
    }

    render(ctx) {
      const x = this.x;
      const y = this.y;
      const step = this.size;
      const len = this.length;

      ctx.font = `600 ${Math.round(this.size)}px monospace`;

      for (let s = 0; s < len; s++) {
        const charY = y - s * step;
        if (charY < -step) break;

        const ratio = 1 - (s / len);
        
        if (s === 0) {
          // Bright particle head & white-hot highlight
          ctx.fillStyle = PALETTE.core;
          ctx.globalAlpha = Math.min(1.0, this.opacity * 1.3);
        } else if (s === 1) {
          ctx.fillStyle = this.color;
          ctx.globalAlpha = this.opacity * 0.9;
        } else {
          // Fading trail
          ctx.fillStyle = this.color;
          ctx.globalAlpha = this.opacity * ratio * 0.55;
        }

        ctx.fillText(this.char, x, charY);
      }
    }
  }

  class DataRainSimulation {
    constructor(container) {
      this.container = container;
      this.mainCanvas = container.querySelector('.dr-main');
      this.bloomCanvas = container.querySelector('.dr-bloom');
      this.cursorHalo = container.querySelector('.dr-cursor-halo');

      if (!this.mainCanvas) return;

      this.mainCtx = this.mainCanvas.getContext('2d', { alpha: true });
      this.bloomCtx = this.bloomCanvas ? this.bloomCanvas.getContext('2d', { alpha: true }) : null;

      this.particles = [];
      this.vortexPuffs = [];
      this.animationFrameId = null;
      this.isDestroyed = false;

      // Cursor state
      this.cursor = {
        x: -999,
        y: -999,
        lastX: -999,
        lastY: -999,
        speed: 0,
        active: false,
        radius: 175
      };

      // Autopilot cursor state
      this.autopilot = {
        enabled: true,
        angle: 0,
        cx: 0,
        cy: 0,
        lastUserInteraction: Date.now()
      };

      // Reduced motion
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mediaQuery.matches;

      // Bindings
      this.onResize = this.onResize.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.animate = this.animate.bind(this);

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener('resize', this.onResize);
      window.addEventListener('orientationchange', this.onResize);
      window.addEventListener('mousemove', this.onMouseMove, { passive: true });
      window.addEventListener('touchmove', this.onTouchMove, { passive: true });
      window.addEventListener('touchend', this.onTouchEnd, { passive: true });
      window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
      document.addEventListener('mouseleave', this.onMouseLeave);

      if (this.reducedMotion) {
        this.renderStatic();
        return;
      }

      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.animate);
    }

    resize() {
      const parent = this.container;
      const w = parent.clientWidth || window.innerWidth;
      const h = Math.max(parent.clientHeight || 0, document.documentElement.scrollHeight || 0, window.innerHeight);

      const isMobileDevice = w <= 768;
      // Cap DPR at 1.5 on mobile to optimize GPU fill rate while keeping crisp rendering
      const dpr = Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.5 : 2);

      this.width = w;
      this.height = h;

      [this.mainCanvas, this.bloomCanvas].forEach(c => {
        if (!c) return;
        c.width = w * dpr;
        c.height = h * dpr;
        const ctx = c.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      });

      // Adaptive particle density (smooth scaling from small mobile ~50-60 up to desktop ~240-260)
      const targetCount = isMobileDevice 
        ? Math.min(110, Math.max(50, Math.floor(w / 6.5)))
        : Math.min(260, Math.max(120, Math.floor(w / 7.5)));

      this.particles = [];
      for (let i = 0; i < targetCount; i++) {
        const depth = (i / targetCount);
        this.particles.push(new Particle(w, h, depth));
      }

      // Sort particles by depth for correct back-to-front rendering
      this.particles.sort((a, b) => a.depth - b.depth);

      this.autopilot.cx = w * 0.5;
      this.autopilot.cy = Math.min(h * 0.25, 400);
    }

    onResize() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.resize(), 120);
    }

    onMouseMove(e) {
      const rect = this.container.getBoundingClientRect();
      const pageX = e.clientX - rect.left;
      const pageY = e.clientY - rect.top;

      const dx = pageX - this.cursor.x;
      const dy = pageY - this.cursor.y;
      const speed = Math.sqrt(dx * dx + dy * dy);

      this.cursor.lastX = this.cursor.x;
      this.cursor.lastY = this.cursor.y;
      this.cursor.x = pageX;
      this.cursor.y = pageY;
      this.cursor.speed = speed;
      this.cursor.active = true;

      this.autopilot.lastUserInteraction = Date.now();

      // Trigger vortex-puff if moving fast
      if (speed > 18) {
        this.vortexPuffs.push({
          x: pageX,
          y: pageY,
          radius: 120,
          strength: Math.min(speed * 0.35, 12),
          life: 1.0
        });
      }

      // Update cursor halo position
      if (this.cursorHalo) {
        this.cursorHalo.style.transform = `translate3d(${pageX}px, ${pageY}px, 0)`;
        this.cursorHalo.style.opacity = '1';
      }
    }

    onTouchMove(e) {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = this.container.getBoundingClientRect();
      const pageX = touch.clientX - rect.left;
      const pageY = touch.clientY - rect.top;

      const dx = pageX - this.cursor.x;
      const dy = pageY - this.cursor.y;
      const speed = Math.sqrt(dx * dx + dy * dy);

      this.cursor.lastX = this.cursor.x;
      this.cursor.lastY = this.cursor.y;
      this.cursor.x = pageX;
      this.cursor.y = pageY;
      this.cursor.speed = speed;
      this.cursor.active = true;

      this.autopilot.lastUserInteraction = Date.now();

      // Trigger vortex puff on touch gesture if moving
      if (speed > 14) {
        this.vortexPuffs.push({
          x: pageX,
          y: pageY,
          radius: 110,
          strength: Math.min(speed * 0.35, 10),
          life: 1.0
        });
      }

      if (this.cursorHalo) {
        this.cursorHalo.style.transform = `translate3d(${pageX}px, ${pageY}px, 0)`;
        this.cursorHalo.style.opacity = '0.9';
      }
    }

    onTouchEnd() {
      // Disengage manual cursor shortly after touch lift so autopilot can resume smoothly
      this.cursor.active = false;
      if (this.cursorHalo) {
        this.cursorHalo.style.opacity = '0';
      }
    }

    onMouseLeave() {
      this.cursor.active = false;
      if (this.cursorHalo) {
        this.cursorHalo.style.opacity = '0';
      }
    }

    updateAutopilot() {
      // If idle for > 3.5s, engage elegant circular autopilot vortex
      const now = Date.now();
      if (now - this.autopilot.lastUserInteraction > 3500) {
        this.autopilot.angle += 0.025;
        const radiusX = Math.min(this.width * 0.25, 220);
        const radiusY = 90;
        const autoX = this.autopilot.cx + Math.cos(this.autopilot.angle) * radiusX;
        const autoY = this.autopilot.cy + Math.sin(this.autopilot.angle * 1.5) * radiusY;

        this.cursor.x = autoX;
        this.cursor.y = autoY;
        this.cursor.active = true;

        if (this.cursorHalo) {
          this.cursorHalo.style.transform = `translate3d(${autoX}px, ${autoY}px, 0)`;
          this.cursorHalo.style.opacity = '0.6';
        }

        // Emit gentle wake puffs periodically
        if (Math.random() < 0.12) {
          this.vortexPuffs.push({
            x: autoX,
            y: autoY,
            radius: 100,
            strength: 4.5,
            life: 1.0
          });
        }
      }
    }

    renderStatic() {
      if (!this.mainCtx) return;
      this.mainCtx.clearRect(0, 0, this.width, this.height);
      for (const p of this.particles) {
        p.render(this.mainCtx);
      }
    }

    animate(now) {
      if (this.isDestroyed) return;

      this.animationFrameId = requestAnimationFrame(this.animate);

      // Autopilot check
      this.updateAutopilot();

      // Age vortex puffs
      for (let i = this.vortexPuffs.length - 1; i >= 0; i--) {
        const vp = this.vortexPuffs[i];
        vp.life -= 0.045;
        vp.radius += 2.5;
        vp.strength *= 0.94;
        if (vp.life <= 0) {
          this.vortexPuffs.splice(i, 1);
        }
      }

      // Clear main canvas
      this.mainCtx.clearRect(0, 0, this.width, this.height);

      // Clear bloom canvas if available
      if (this.bloomCtx) {
        this.bloomCtx.clearRect(0, 0, this.width, this.height);
      }

      // Update and draw particles
      const count = this.particles.length;
      for (let i = 0; i < count; i++) {
        const p = this.particles[i];
        p.update(this.width, this.height, this.cursor, this.vortexPuffs);
        p.render(this.mainCtx);

        // Render hot / core particles to bloom canvas for intense glow
        if (this.bloomCtx && (p.tier === 'hot' || p.tier === 'calm') && p.depth > 0.45) {
          p.render(this.bloomCtx);
        }
      }

      // Reset global alpha
      this.mainCtx.globalAlpha = 1.0;
      if (this.bloomCtx) this.bloomCtx.globalAlpha = 1.0;
    }

    destroy() {
      this.isDestroyed = true;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('orientationchange', this.onResize);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
      window.removeEventListener('touchcancel', this.onTouchEnd);
      document.removeEventListener('mouseleave', this.onMouseLeave);
    }
  }

  // Global mounting helper
  window.initDataRain = function () {
    const container = document.getElementById('dataRainContainer') || document.getElementById('pageBackgroundWrapper');
    if (!container) return null;
    return new DataRainSimulation(container);
  };
})();
