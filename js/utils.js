/* ── Utility functions ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, config, COLOR_PALETTES } } = window;

  ParticleSystem.randomBetween = function randomBetween(min, max) {
    return min + (Math.random() - 0.5) * (max - min);
  };

  ParticleSystem.clamp = function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  };

  ParticleSystem.distance = function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  };

  ParticleSystem.toHslString = function toHslString(hue) {
    return `hsl(${hue}, ${CONSTANTS.HSL_SATURATION}, ${CONSTANTS.HSL_LIGHTNESS})`;
  };

  ParticleSystem.normalizeHue = function normalizeHue(hue) {
    return ((hue % 360) + 360) % 360;
  };

  ParticleSystem.isValidHexColor = function isValidHexColor(value) {
    return typeof value === 'string' && CONSTANTS.HEX_COLOR_PATTERN.test(value);
  };

  ParticleSystem.hexToRgb = function hexToRgb(hex) {
    const normalized = hex.replace('#', '');
    const value = normalized.length === 3
      ? normalized.split('').map((character) => character + character).join('')
      : normalized;
    const intValue = Number.parseInt(value, 16);
    return [(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255];
  };

  ParticleSystem.calculateSelfDrift = function calculateSelfDrift(particle, time, intensity, speed) {
    if (!particle || !Number.isFinite(intensity) || !Number.isFinite(speed)) {
      return { vx: 0, vy: 0 };
    }

    const driftStrength = intensity * (0.3 + (particle.size || 0) * 0.04);
    const timeAngle = (time * 0.001 * speed) + particle.driftPhase + particle.y * 0.001;

    switch (config.selfDriftMode) {
      case 'horizontal':
        return {
          vx: Math.cos(timeAngle) * driftStrength,
          vy: 0,
        };

      case 'vertical':
        return {
          vx: 0,
          vy: Math.sin(timeAngle) * driftStrength,
        };

      case 'upDown':
        return {
          vx: 0,
          vy: Math.sin(timeAngle) * driftStrength,
        };

      case 'leftRight':
        return {
          vx: Math.cos(timeAngle) * driftStrength,
          vy: 0,
        };

      case 'up':
        return {
          vx: 0,
          vy: -driftStrength,
        };

      case 'down':
        return {
          vx: 0,
          vy: driftStrength,
        };

      case 'left':
        return {
          vx: -driftStrength,
          vy: 0,
        };

      case 'right':
        return {
          vx: driftStrength,
          vy: 0,
        };

      case 'directional': {
        const fixedAngle = config.selfDriftDirection * Math.PI / 180;
        return {
          vx: Math.cos(fixedAngle) * driftStrength,
          vy: Math.sin(fixedAngle) * driftStrength,
        };
      }

      case 'orbit': {
        let orbitRadius = Math.max(driftStrength * (1.5 + (particle.size || 0) * 0.12), 8);
        if (Number.isFinite(config.selfDriftOrbitRadius) && config.selfDriftOrbitRadius > 0) {
          const cx = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.width / 2 : 0;
          const cy = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.height / 2 : 0;
          const fraction = Math.min(Math.max(config.selfDriftOrbitRadius / 100, 0), 1);
          orbitRadius = Math.max(fraction * Math.min(cx, cy), 8);
        }
        const orbitAngle = timeAngle * 0.6 + (particle.driftPhase || 0);
        const targetX = (particle.anchorX || particle.x) + Math.cos(orbitAngle) * orbitRadius;
        const targetY = (particle.anchorY || particle.y) + Math.sin(orbitAngle) * orbitRadius;
        // Compute a desired velocity towards the target and return a small correction
        const desiredVx = (targetX - particle.x) * 0.02;
        const desiredVy = (targetY - particle.y) * 0.02;
        const smooth = 0.25;
        return {
          vx: (desiredVx - (particle.vx || 0)) * smooth,
          vy: (desiredVy - (particle.vy || 0)) * smooth,
        };
      }

      case 'orbitGlobal': {
        const cx = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.width / 2 : 0;
        const cy = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.height / 2 : 0;
        let baseRadius = Math.min(cx, cy) * 0.45 || (driftStrength * (1.5 + (particle.size || 0) * 0.12));
        if (Number.isFinite(config.selfDriftOrbitRadius) && config.selfDriftOrbitRadius > 0) {
          const fraction = Math.min(Math.max(config.selfDriftOrbitRadius / 100, 0), 1);
          baseRadius = Math.max(fraction * Math.min(cx, cy), 8);
        }
        const orbitRadius = baseRadius;
        const orbitAngle = timeAngle * 0.6 + (particle.driftPhase || 0);
        const targetX = cx + Math.cos(orbitAngle) * orbitRadius;
        const targetY = cy + Math.sin(orbitAngle) * orbitRadius;
        // Use a conservative correction to avoid runaway velocities
        const desiredVx = (targetX - particle.x) * 0.02;
        const desiredVy = (targetY - particle.y) * 0.02;
        const repulsionEnabled = config.selfDriftOrbitRepulsionEnabled === true;
        const repulsionStrength = Number.isFinite(config.selfDriftOrbitRepulsionStrength)
          ? config.selfDriftOrbitRepulsionStrength
          : 0.35;
        if (repulsionEnabled && Array.isArray(ParticleSystem.particles) && ParticleSystem.particles.length > 1) {
          const repulsionRadius = Math.max(16, 18 + (particle.size || 0) * 2.5);
          let pushVx = 0;
          let pushVy = 0;
          ParticleSystem.particles.forEach((other) => {
            if (!other || other === particle) return;
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;
            if (distance >= repulsionRadius || distance === 0) return;
            const influence = Math.max(0, 1 - distance / repulsionRadius);
            const force = influence * repulsionStrength * 0.18;
            pushVx += (dx / distance) * force;
            pushVy += (dy / distance) * force;
          });
          const smooth = 0.25;
          return {
            vx: ((desiredVx + pushVx) - (particle.vx || 0)) * smooth,
            vy: ((desiredVy + pushVy) - (particle.vy || 0)) * smooth,
          };
        }
        const smooth = 0.25;
        return {
          vx: (desiredVx - (particle.vx || 0)) * smooth,
          vy: (desiredVy - (particle.vy || 0)) * smooth,
        };
      }

      case 'wave': {
        const waveX = Math.sin(timeAngle + particle.y * 0.005) * driftStrength;
        const waveY = Math.cos(timeAngle + particle.x * 0.005) * driftStrength;
        return { vx: waveX, vy: waveY };
      }

      case 'flow': {
        // A position-dependent field makes neighbouring particles follow
        // related currents without forcing them onto one shared path.
        const flowPhase = timeAngle * 0.7;
        return {
          vx: Math.sin(particle.y * 0.012 + flowPhase) * driftStrength,
          vy: Math.cos(particle.x * 0.012 - flowPhase) * driftStrength,
        };
      }

      case 'lissajous': {
        const anchorX = particle.anchorX || particle.x;
        const anchorY = particle.anchorY || particle.y;
        const radius = Math.max(driftStrength * (2 + (particle.size || 0) * 0.2), 14);
        const curveAngle = timeAngle * 0.75 + (particle.driftPhase || 0);
        const targetX = anchorX + Math.sin(curveAngle * 2) * radius;
        const targetY = anchorY + Math.sin(curveAngle * 3 + Math.PI / 2) * radius;
        const smooth = 0.22;
        return {
          vx: ((targetX - particle.x) * 0.025 - (particle.vx || 0)) * smooth,
          vy: ((targetY - particle.y) * 0.025 - (particle.vy || 0)) * smooth,
        };
      }

      case 'vortex': {
        const cx = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.width / 2 : 0;
        const cy = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.height / 2 : 0;
        let radius = Math.min(cx, cy) * 0.34 || 60;
        if (Number.isFinite(config.selfDriftOrbitRadius) && config.selfDriftOrbitRadius > 0) {
          radius = Math.max(Math.min(cx, cy) * config.selfDriftOrbitRadius / 100, 12);
        }
        const vortexAngle = timeAngle * 0.8 + (particle.driftPhase || 0);
        // Let every orbit breathe at its own phase so it forms a living whirlpool.
        const targetRadius = radius * (0.55 + 0.3 * Math.sin(vortexAngle * 1.7));
        const targetX = cx + Math.cos(vortexAngle) * targetRadius;
        const targetY = cy + Math.sin(vortexAngle) * targetRadius;
        const smooth = 0.2;
        return {
          vx: ((targetX - particle.x) * 0.018 - (particle.vx || 0)) * smooth,
          vy: ((targetY - particle.y) * 0.018 - (particle.vy || 0)) * smooth,
        };
      }

      case 'spiral': {
        const cx = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.width / 2 : 0;
        const cy = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.height / 2 : 0;
        let baseRadius = Math.max(driftStrength * (2.5 + (particle.size || 0) * 0.12), 16);
        if (Number.isFinite(config.selfDriftOrbitRadius) && config.selfDriftOrbitRadius > 0) {
          const fraction = Math.min(Math.max(config.selfDriftOrbitRadius / 100, 0), 1);
          baseRadius = Math.max(fraction * Math.min(cx, cy), 8);
        }
        const anchorX = particle.anchorX || particle.x;
        const anchorY = particle.anchorY || particle.y;
        const spiralAngle = (timeAngle * 0.35) + (particle.driftPhase || 0) + (anchorY * 0.0008);
        const spiralRadius = baseRadius * (0.45 + 0.55 * Math.abs(Math.sin(spiralAngle * 0.6)));
        const targetX = cx + Math.cos(spiralAngle) * spiralRadius + (anchorX - cx) * 0.02;
        const targetY = cy + Math.sin(spiralAngle) * spiralRadius + (anchorY - cy) * 0.02;
        const desiredVx = (targetX - particle.x) * 0.02;
        const desiredVy = (targetY - particle.y) * 0.02;
        const smooth = 0.25;
        return {
          vx: (desiredVx - (particle.vx || 0)) * smooth,
          vy: (desiredVy - (particle.vy || 0)) * smooth,
        };
      }

      case 'spiralIndividual': {
        const anchorX = particle.anchorX || particle.x;
        const anchorY = particle.anchorY || particle.y;
        const spiralAngle = (timeAngle * 0.35) + (particle.driftPhase || 0) + (anchorY * 0.001);
        const spiralRadius = Math.max(driftStrength * (0.8 + (particle.size || 0) * 0.18), 8);
        const targetX = anchorX + Math.cos(spiralAngle) * spiralRadius;
        const targetY = anchorY + Math.sin(spiralAngle) * spiralRadius;
        const desiredVx = (targetX - particle.x) * 0.02;
        const desiredVy = (targetY - particle.y) * 0.02;
        const smooth = 0.25;
        return {
          vx: (desiredVx - (particle.vx || 0)) * smooth,
          vy: (desiredVy - (particle.vy || 0)) * smooth,
        };
      }

      case 'snake': {
        const cx = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.width / 2 : 0;
        const cy = ParticleSystem.canvasBounds ? ParticleSystem.canvasBounds.height / 2 : 0;
        // Увеличенные коэффициенты для более выраженной орбиты (режим "Змейка")
        const baseRadius = Math.max(driftStrength * (6 + (particle.size || 0) * 0.25), 40);
        const R = Math.min(baseRadius, Math.min(cx, cy) * 0.6);
        // Полуокружности делаем больше долей от R, чтобы визуально траектория была крупнее
        const halfR = R * 0.8;

        // Фаза: t ∈ [0, 4π) — полный цикл по S-подобной кривой (snake)
        const t = (timeAngle * 0.45 + (particle.driftPhase || 0)) % (Math.PI * 4);

        let targetX, targetY;

        if (t < Math.PI * 2) {
          // Верхняя полуокружность: от центра (t=0) к верхней точке (t=π) и обратно к центру (t=2π)
          const angle = t;
          targetX = cx + halfR * Math.sin(angle);
          targetY = (cy - halfR) + halfR * Math.cos(angle);
        } else {
          // Нижняя полуокружность: от центра (t=2π) к нижней точке (t=3π) и обратно к центру (t=4π)
          const angle = t - Math.PI * 2;
          targetX = cx + halfR * Math.sin(angle + Math.PI);
          targetY = (cy + halfR) + halfR * Math.cos(angle + Math.PI);
        }

        const desiredVx = (targetX - particle.x) * 0.02;
        const desiredVy = (targetY - particle.y) * 0.02;
        const smooth = 0.25;
        return {
          vx: (desiredVx - (particle.vx || 0)) * smooth,
          vy: (desiredVy - (particle.vy || 0)) * smooth,
        };
      }

      default: // 'random'
        return {
          vx: Math.cos(timeAngle) * driftStrength,
          vy: Math.sin(timeAngle) * driftStrength,
        };
    }
  };

  ParticleSystem.getBackgroundAccentColor = function getBackgroundAccentColor() {
    const [r, g, b] = ParticleSystem.hexToRgb(config.backgroundColor);
    const mix = 0.2 + config.backgroundGradientStrength * 0.45;
    const mixR = Math.round(r * (1 - mix) + 0 * mix);
    const mixG = Math.round(g * (1 - mix) + 0 * mix);
    const mixB = Math.round(b * (1 - mix) + 30 * mix);
    return `rgb(${mixR}, ${mixG}, ${mixB})`;
  };

  ParticleSystem.getCustomPaletteColors = function getCustomPaletteColors() {
    return [config.customColor1, config.customColor2, config.customColor3].filter(
      ParticleSystem.isValidHexColor
    );
  };

  ParticleSystem.getSpeedParticleColor = function getSpeedParticleColor(vx, vy) {
    const speed = Math.hypot(vx || 0, vy || 0);
    const maxSpeed = Math.max(1, config.speedMultiplier * CONSTANTS.SPEED_VARIANCE * Math.SQRT2);
    const progress = ParticleSystem.clamp(speed / maxSpeed, 0, 1);
    const hue = 220 - progress * 220;
    return `hsl(${Math.round(hue)}, 100%, 50%)`;
  };

  ParticleSystem.getParticleColor = function getParticleColor() {
    const palette = COLOR_PALETTES[config.colorPalette] || COLOR_PALETTES.mono;

    if (config.colorPalette === 'custom') {
      const colors = ParticleSystem.getCustomPaletteColors();
      return colors.length
        ? colors[Math.floor(Math.random() * colors.length)]
        : ParticleSystem.DEFAULT_CONFIG.customColor1;
    }

    if (palette.hues.length > 0) {
      const baseHue = palette.hues[Math.floor(Math.random() * palette.hues.length)];
      return ParticleSystem.toHslString(
        ParticleSystem.normalizeHue(baseHue + ParticleSystem.randomBetween(-CONSTANTS.PALETTE_HUE_VARIANCE, CONSTANTS.PALETTE_HUE_VARIANCE))
      );
    }

    return ParticleSystem.toHslString(
      ParticleSystem.normalizeHue(config.hue + ParticleSystem.randomBetween(-CONSTANTS.HUE_VARIANCE, CONSTANTS.HUE_VARIANCE))
    );
  };
})();
