/* ── Particle class and lifecycle ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, config } } = window;

  ParticleSystem.particles = [];

  class Particle {
    constructor(x, y) {
      const { SIZE_VARIANCE, HUE_VARIANCE, SPEED_VARIANCE } = CONSTANTS;
      this.x = x;
      this.y = y;
      this.size = config.particleSize + (config.particleSizeVariance
        ? ParticleSystem.randomBetween(-SIZE_VARIANCE, SIZE_VARIANCE)
        : 0);
      this.baseSize = this.size;
      this.hue = config.hue + ParticleSystem.randomBetween(-HUE_VARIANCE, HUE_VARIANCE);
      this.color = ParticleSystem.getParticleColor();
      this.shadowBlur = config.shadowBlur;
      this.vx = ParticleSystem.randomBetween(-SPEED_VARIANCE, SPEED_VARIANCE) * config.speedMultiplier;
      this.vy = ParticleSystem.randomBetween(-SPEED_VARIANCE, SPEED_VARIANCE) * config.speedMultiplier;
      this.driftPhase = ParticleSystem.randomBetween(0, CONSTANTS.TAU);
      this.anchorX = x;
      this.anchorY = y;
      const cx = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.width / 2 : 0;
      const cy = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.height / 2 : 0;
      this.anchorRadius = ParticleSystem.distance(this.anchorX, this.anchorY, cx, cy);
      this.trail = [];
      this.maxTrailLength = config.trailLength;
    }

    draw() {
      const ctx = ParticleSystem.ctx;
      
      // Draw trail if enabled (optimized with lineWidth gradient)
      if (config.trailEnabled && this.trail.length > 1) {
        const [red, green, blue] = ParticleSystem.hexToRgb(config.trailColor);
        ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${config.trailOpacity})`;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
          ctx.lineWidth = Math.abs(this.size) * (i / this.trail.length);
          ctx.lineTo(this.trail[i].x, this.trail[i].y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(this.trail[i].x, this.trail[i].y);
        }
      }
      
      // Draw particle
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.shadowBlur;
      ParticleSystem.drawShape(ctx, this.x, this.y, this.size, config.particleShape);
    }

    applySelfDrift() {
      if (!config.selfDriftEnabled) return;

      const drift = ParticleSystem.calculateSelfDrift(
        this,
        performance.now(),
        config.selfDriftIntensity,
        config.selfDriftSpeed
      );

      this.vx += drift.vx;
      this.vy += drift.vy;
    }

    applyParticleRepulsion() {
      if (!config.particleRepulsionEnabled || ParticleSystem.particles.length < 2) return;

      const radius = Math.max(1, config.particleRepulsionRadius);
      const strength = Math.max(0, config.particleRepulsionStrength);
      let pushX = 0;
      let pushY = 0;

      ParticleSystem.particles.forEach((other) => {
        if (other === this) return;

        let dx = this.x - other.x;
        let dy = this.y - other.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= radius) return;

        if (distance === 0) {
          const angle = this.driftPhase || 0;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const force = ((radius - distance) / radius) * strength;
        pushX += (dx / distance) * force;
        pushY += (dy / distance) * force;
      });

      this.vx += pushX;
      this.vy += pushY;
    }

    applyCursorInteraction() {
      if (!config.cursorInteractionEnabled || config.cursorMode === 'trail' || !ParticleSystem.isPointerActive()) return;

      const dist = ParticleSystem.distance(this.x, this.y, ParticleSystem.mouseX, ParticleSystem.mouseY);
      if (dist >= config.attractionRadius || dist === 0) return;

      const force =
        ((config.attractionRadius - dist) / config.attractionRadius) *
        config.attractionForce;
      const dx = ParticleSystem.mouseX - this.x;
      const dy = ParticleSystem.mouseY - this.y;
      const nx = dx / dist;
      const ny = dy / dist;

      if (config.cursorMode === 'repel') {
        this.vx -= nx * force;
        this.vy -= ny * force;
        return;
      }

      if (config.cursorMode === 'orbit') {
        const tangentForce = force * CONSTANTS.ORBIT_TANGENTIAL_FORCE;
        const radialForce = force * CONSTANTS.ORBIT_RADIAL_BALANCE;
        this.vx += -ny * tangentForce + nx * radialForce;
        this.vy += nx * tangentForce + ny * radialForce;
        return;
      }

      this.vx += nx * force;
      this.vy += ny * force;
    }

    applyFriction() {
      this.vx *= CONSTANTS.FRICTION;
      this.vy *= CONSTANTS.FRICTION;
    }

    handleBoundaries() {
      const canvasBounds = ParticleSystem.canvasBounds;
      if (config.bounce) {
        if (this.x < 0 || this.x > canvasBounds.width) {
          this.vx *= -1;
          this.x = ParticleSystem.clamp(this.x, 0, canvasBounds.width);
        }
        if (this.y < 0 || this.y > canvasBounds.height) {
          this.vy *= -1;
          this.y = ParticleSystem.clamp(this.y, 0, canvasBounds.height);
        }
      } else {
        let wrapped = false;
        if (this.x < 0) {
          this.x = canvasBounds.width;
          wrapped = true;
        } else if (this.x > canvasBounds.width) {
          this.x = 0;
          wrapped = true;
        }
        if (this.y < 0) {
          this.y = canvasBounds.height;
          wrapped = true;
        } else if (this.y > canvasBounds.height) {
          this.y = 0;
          wrapped = true;
        }

        // A wrapped particle has discontinuous coordinates. Drop its old trail
        // so the renderer does not join opposite canvas edges with a long line.
        if (wrapped) this.trail = [];
      }
    }

    updateSize() {
      if (!config.particleSizeVariance) {
        this.size = config.particleSize;
        return;
      }

      this.size = config.pulsate
        ? this.baseSize +
          Math.sin(Date.now() * CONSTANTS.PULSATION_SPEED + this.x + this.y) *
            CONSTANTS.PULSATION_AMPLITUDE
        : this.baseSize;
    }

    update() {
      // Add current position to trail
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
      this.applySelfDrift();
      this.applyParticleRepulsion();
      this.applyCursorInteraction();

      this.x += this.vx;
      this.y += this.vy;
      this.applyFriction();
      this.handleBoundaries();
      this.updateSize();
    }
  }

  ParticleSystem.Particle = Particle;

  /* ── Particle lifecycle ── */

  ParticleSystem.createParticles = function createParticles() {
    const count = config.particleCount;
    ParticleSystem.particles = Array.from({ length: count }, () => {
      const x = Math.random() * ParticleSystem.canvasBounds.width;
      const y = Math.random() * ParticleSystem.canvasBounds.height;
      return new Particle(x, y);
    });
  };

  ParticleSystem.updateParticleSpeed = function updateParticleSpeed() {
    const speed = config.speedMultiplier;
    ParticleSystem.particles.forEach((p) => {
      const angle = Math.atan2(p.vy, p.vx);
      const mag = ParticleSystem.distance(0, 0, p.vx, p.vy);
      if (mag > 0) {
        const baseMag = mag / speed;
        p.vx = Math.cos(angle) * baseMag * speed;
        p.vy = Math.sin(angle) * baseMag * speed;
      }
    });
  };

  ParticleSystem.updateParticleSizes = function updateParticleSizes() {
    const { SIZE_VARIANCE } = CONSTANTS;
    ParticleSystem.particles.forEach((p) => {
      p.baseSize = config.particleSize + (config.particleSizeVariance
        ? ParticleSystem.randomBetween(-SIZE_VARIANCE, SIZE_VARIANCE)
        : 0);
    });
  };

  ParticleSystem.updateParticleHues = function updateParticleHues() {
    const { HUE_VARIANCE } = CONSTANTS;
    ParticleSystem.particles.forEach((p) => {
      p.hue = config.hue + ParticleSystem.randomBetween(-HUE_VARIANCE, HUE_VARIANCE);
      p.color = ParticleSystem.getParticleColor();
    });
  };

  ParticleSystem.updateParticleColors = function updateParticleColors() {
    ParticleSystem.particles.forEach((p) => {
      p.color = ParticleSystem.getParticleColor();
    });
  };

  ParticleSystem.updateParticleShadowBlur = function updateParticleShadowBlur() {
    ParticleSystem.particles.forEach((p) => {
      p.shadowBlur = config.shadowBlur;
    });
  };

  ParticleSystem.syncCursorMode = function syncCursorMode() {
    if (config.cursorMode !== 'trail' || !config.cursorInteractionEnabled) {
      ParticleSystem.pointerTrails = [];
    }
  };

  /* ── Взрывы по клику ── */

  ParticleSystem.explosionParticles = [];

  class ExplosionParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * CONSTANTS.TAU;
      const speed = config.explosionSpeed * (0.5 + Math.random() * 0.8);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = config.explosionSize * (0.5 + Math.random());
      this.baseSize = this.size;
      this.color = ParticleSystem.getParticleColor();
      this.createdAt = performance.now();
      this.alpha = 1;
    }

    update() {
      const age = performance.now() - this.createdAt;
      const life = 1 - age / config.explosionLifetime;
      if (life <= 0) return false;

      this.x += this.vx;
      this.y += this.vy;
      this.vx *= CONSTANTS.EXPLOSION_FADE_OUT;
      this.vy *= CONSTANTS.EXPLOSION_FADE_OUT;
      this.alpha = life;
      this.size = this.baseSize * life;
      return true;
    }

    draw() {
      const ctx = ParticleSystem.ctx;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = config.shadowBlur;
      ParticleSystem.drawShape(ctx, this.x, this.y, this.size, config.particleShape);
      ctx.restore();
    }
  }

  ParticleSystem.createExplosion = function createExplosion(x, y) {
    if (!config.explosionEnabled) return;
    const count = config.explosionCount;

    if (config.explosionMode === 'spawn') {
      for (let i = 0; i < count; i++) {
        const particle = new ParticleSystem.Particle(x, y);
        const angle = Math.random() * CONSTANTS.TAU;
        const speed = config.explosionSpeed * (0.5 + Math.random() * 0.8);
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed;
        ParticleSystem.particles.push(particle);
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      ParticleSystem.explosionParticles.push(new ExplosionParticle(x, y));
    }
  };

  /* ── Отрисовка разных форм ── */

  ParticleSystem.drawShape = function drawShape(ctx, x, y, size, shape) {
    const s = Math.abs(size);
    if (s < 0.5) return;

    ctx.beginPath();

    switch (shape) {
      case 'circle':
        ctx.arc(x, y, s, 0, Math.PI * 2);
        break;

      case 'square':
        ctx.rect(x - s, y - s, s * 2, s * 2);
        break;

      case 'triangle':
        ctx.moveTo(x, y - s);
        ctx.lineTo(x - s * 0.866, y + s * 0.5);
        ctx.lineTo(x + s * 0.866, y + s * 0.5);
        ctx.closePath();
        break;

      case 'diamond':
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        break;

      case 'star': {
        const spikes = 5;
        const outerR = s;
        const innerR = s * 0.4;
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const px = x + Math.cos(angle) * r;
          const py = y + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }

      case 'drop':
        ctx.moveTo(x, y - s);
        ctx.bezierCurveTo(x + s, y - s * 0.2, x + s, y + s * 0.6, x, y + s);
        ctx.bezierCurveTo(x - s, y + s * 0.6, x - s, y - s * 0.2, x, y - s);
        ctx.closePath();
        break;

      case 'polygon': {
        const sides = 6;
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
          const px = x + Math.cos(angle) * s;
          const py = y + Math.sin(angle) * s;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }

      case 'cross': {
        const w = s * 0.35;
        ctx.rect(x - w, y - s, w * 2, s * 2);
        ctx.rect(x - s, y - w, s * 2, w * 2);
        break;
      }

      case 'ring':
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, s * 0.25);
        ctx.stroke();
        return;

      case 'heart': {
        const b = s * 0.3;
        ctx.moveTo(x, y + s * 0.8);
        ctx.bezierCurveTo(x - s, y - b, x - s * 0.5, y - s, x, y - s * 0.3);
        ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - b, x, y + s * 0.8);
        ctx.closePath();
        break;
      }

      case 'arrow':
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.6, y + s * 0.2);
        ctx.lineTo(x + s * 0.25, y + s * 0.2);
        ctx.lineTo(x + s * 0.25, y + s);
        ctx.lineTo(x - s * 0.25, y + s);
        ctx.lineTo(x - s * 0.25, y + s * 0.2);
        ctx.lineTo(x - s * 0.6, y + s * 0.2);
        ctx.closePath();
        break;

      case 'crescent': {
        // Внешняя дуга: правая половина (от 3π/2 до π/2 по часовой)
        ctx.arc(x, y, s, Math.PI * 1.5, Math.PI * 0.5);
        // Внутренняя дуга: обратно (от π/2 до 3π/2 против часовой) со смещением влево
        ctx.arc(x - s * 0.35, y, s * 0.7, Math.PI * 0.5, Math.PI * 1.5, true);
        ctx.closePath();
        break;
      }

      case 'bolt':
        ctx.moveTo(x + s * 0.5, y - s);
        ctx.lineTo(x - s * 0.35, y + s * 0.15);
        ctx.lineTo(x + s * 0.15, y + s * 0.15);
        ctx.lineTo(x - s * 0.5, y + s);
        ctx.lineTo(x + s * 0.65, y - s * 0.15);
        ctx.lineTo(x + s * 0.1, y - s * 0.15);
        ctx.closePath();
        break;

      case 'spiral': {
        const turns = 3;
        const segments = 60;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = t * turns * Math.PI * 2;
          const r = s * t;
          const px = x + Math.cos(angle) * r;
          const py = y + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, s * 0.2);
        ctx.stroke();
        return;
      }

      case 'infinity': {
        const segs = 40;
        for (let i = 0; i <= segs; i++) {
          const t = (i / segs) * Math.PI * 2;
          const r = s;
          const denom = 1 + Math.sin(t) ** 2;
          const px = x + r * Math.cos(t) / denom;
          const py = y + r * Math.sin(t) * Math.cos(t) / denom;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, s * 0.2);
        ctx.stroke();
        return;
      }

      default:
        ctx.arc(x, y, s, 0, Math.PI * 2);
    }

    ctx.fill();
  };
})();
