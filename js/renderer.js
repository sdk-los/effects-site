/* ── Renderer ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { config } } = window;

  ParticleSystem.ctx = null;
  ParticleSystem.canvasBounds = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  ParticleSystem.cachedGradient = null;
  ParticleSystem.lastGradientConfig = {};
  ParticleSystem.bloomCanvas = null;
  ParticleSystem.chromaticAberrationCanvas = null;
  ParticleSystem.chromaticAberrationChannels = null;

  ParticleSystem.applyBloom = function applyBloom() {
    if (!config.bloom) return;

    const canvas = document.getElementById('particle-canvas');
    if (!canvas || !ParticleSystem.ctx) return;
    if (!ParticleSystem.bloomCanvas
      || ParticleSystem.bloomCanvas.width !== canvas.width
      || ParticleSystem.bloomCanvas.height !== canvas.height) {
      ParticleSystem.bloomCanvas = document.createElement('canvas');
      ParticleSystem.bloomCanvas.width = canvas.width;
      ParticleSystem.bloomCanvas.height = canvas.height;
    }

    const bloomCtx = ParticleSystem.bloomCanvas.getContext('2d');
    const pixelRatio = canvas.width / Math.max(1, ParticleSystem.canvasBounds.width);
    bloomCtx.clearRect(0, 0, canvas.width, canvas.height);
    bloomCtx.filter = `blur(${Math.round((8 + 28 * config.bloom) * pixelRatio)}px)`;
    bloomCtx.drawImage(canvas, 0, 0);
    bloomCtx.filter = 'none';

    const ctx = ParticleSystem.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2 + config.bloom * 0.8;
    ctx.drawImage(ParticleSystem.bloomCanvas, 0, 0);
    ctx.globalAlpha = config.bloom * 0.45;
    ctx.drawImage(ParticleSystem.bloomCanvas, 0, 0);
    ctx.restore();
  };

  ParticleSystem.applyChromaticAberration = function applyChromaticAberration() {
    const offset = config.chromaticAberration;
    if (!offset) return;

    const canvas = document.getElementById('particle-canvas');
    if (!canvas || !ParticleSystem.ctx) return;
    if (!ParticleSystem.chromaticAberrationCanvas
      || ParticleSystem.chromaticAberrationCanvas.width !== canvas.width
      || ParticleSystem.chromaticAberrationCanvas.height !== canvas.height) {
      ParticleSystem.chromaticAberrationCanvas = document.createElement('canvas');
      ParticleSystem.chromaticAberrationCanvas.width = canvas.width;
      ParticleSystem.chromaticAberrationCanvas.height = canvas.height;
      ParticleSystem.chromaticAberrationChannels = ['#ff0000', '#00ff00', '#0000ff'].map(() => {
        const channelCanvas = document.createElement('canvas');
        channelCanvas.width = canvas.width;
        channelCanvas.height = canvas.height;
        return channelCanvas;
      });
    }

    const sourceCanvas = ParticleSystem.chromaticAberrationCanvas;
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.clearRect(0, 0, canvas.width, canvas.height);
    sourceCtx.drawImage(canvas, 0, 0);

    const pixelRatio = canvas.width / Math.max(1, ParticleSystem.canvasBounds.width);
    const shift = offset * pixelRatio;
    const ctx = ParticleSystem.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawChannel = (color, x, channelCanvas) => {
      const channelCtx = channelCanvas.getContext('2d');
      channelCtx.clearRect(0, 0, canvas.width, canvas.height);
      channelCtx.drawImage(sourceCanvas, 0, 0);
      channelCtx.globalCompositeOperation = 'multiply';
      channelCtx.fillStyle = color;
      channelCtx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(channelCanvas, x, 0);
    };

    drawChannel('#ff0000', -shift, ParticleSystem.chromaticAberrationChannels[0]);
    drawChannel('#00ff00', 0, ParticleSystem.chromaticAberrationChannels[1]);
    drawChannel('#0000ff', shift, ParticleSystem.chromaticAberrationChannels[2]);
    ctx.restore();
  };

  ParticleSystem.renderBackground = function renderBackground() {
    const ctx = ParticleSystem.ctx;
    ctx.clearRect(0, 0, ParticleSystem.canvasBounds.width, ParticleSystem.canvasBounds.height);

    if (config.backgroundMode === 'transparent') return;

    if (config.backgroundMode === 'gradient') {
      // Кешируем градиент, пересчитываем только при смене конфига
      const needsUpdate = 
        !ParticleSystem.cachedGradient ||
        ParticleSystem.lastGradientConfig.backgroundColor !== config.backgroundColor ||
        ParticleSystem.lastGradientConfig.accentColor !== ParticleSystem.getBackgroundAccentColor();
      
      if (needsUpdate) {
        ParticleSystem.cachedGradient = ctx.createLinearGradient(0, 0, ParticleSystem.canvasBounds.width, ParticleSystem.canvasBounds.height);
        ParticleSystem.cachedGradient.addColorStop(0, config.backgroundColor);
        ParticleSystem.cachedGradient.addColorStop(1, ParticleSystem.getBackgroundAccentColor());
        ParticleSystem.lastGradientConfig = {
          backgroundColor: config.backgroundColor,
          accentColor: ParticleSystem.getBackgroundAccentColor()
        };
      }
      ctx.fillStyle = ParticleSystem.cachedGradient;
    } else {
      ctx.fillStyle = config.backgroundColor;
    }

    ctx.fillRect(0, 0, ParticleSystem.canvasBounds.width, ParticleSystem.canvasBounds.height);
  };

  ParticleSystem.drawAurora = function drawAurora(timestamp) {
    if (!config.auroraEnabled) return;

    const ctx = ParticleSystem.ctx;
    const width = ParticleSystem.canvasBounds.width;
    const height = ParticleSystem.canvasBounds.height;
    if (!width || !height) return;

    const time = timestamp * 0.00035 * config.auroraSpeed;
    const bandCount = 6;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const baseHue = (config.hue + 55) % 360;
    const alphaBase = 0.04 + config.auroraIntensity * 0.16;

    for (let i = 0; i <= bandCount; i++) {
      const stop = i / bandCount;
      const phase = time + i * 0.8;
      const hue = (baseHue + Math.sin(phase) * 45 + i * 18) % 360;
      const bandAlpha = alphaBase + Math.sin(phase * 1.2 + i) * 0.02;
      gradient.addColorStop(
        stop,
        `hsla(${Math.round(hue)}, 85%, 60%, ${Math.max(0.03, bandAlpha)})`
      );
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  ParticleSystem.drawConnections = function drawConnections() {
    if (!config.showConnections) return;

    const ctx = ParticleSystem.ctx;
    const maxDist = config.connectionDistance;
    const maxDistSq = maxDist * maxDist;
    const lineWidth = config.connectionWidth;
    const maxOpacity = config.connectionOpacity;

    /* Пространственная сетка: разбиваем канвас на ячейки размером maxDist */
    const cols = Math.ceil(ParticleSystem.canvasBounds.width / maxDist) || 1;
    const rows = Math.ceil(ParticleSystem.canvasBounds.height / maxDist) || 1;
    const grid = new Array(cols * rows);

    for (let i = 0; i < ParticleSystem.particles.length; i++) {
      const p = ParticleSystem.particles[i];
      p._gridId = i;
      const col = Math.min(Math.floor(p.x / maxDist), cols - 1);
      const row = Math.min(Math.floor(p.y / maxDist), rows - 1);
      const idx = row * cols + col;
      if (!grid[idx]) grid[idx] = [];
      grid[idx].push(p);
    }

    /* Собираем все линии в один path для batch-отрисовки */
    let connectionCount = 0;
    ctx.beginPath();

    for (let i = 0; i < ParticleSystem.particles.length; i++) {
      const p = ParticleSystem.particles[i];
      const col = Math.min(Math.floor(p.x / maxDist), cols - 1);
      const row = Math.min(Math.floor(p.y / maxDist), rows - 1);

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

          const cell = grid[nr * cols + nc];
          if (!cell) continue;

          for (let k = 0; k < cell.length; k++) {
            const neighbor = cell[k];
            if (neighbor._gridId <= p._gridId) continue;

            const dx = neighbor.x - p.x;
            const dy = neighbor.y - p.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < maxDistSq) {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(neighbor.x, neighbor.y);
              connectionCount++;
            }
          }
        }
      }
    }

    if (connectionCount > 0) {
      const [red, green, blue] = ParticleSystem.hexToRgb(config.connectionColor);
      ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${maxOpacity})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  };

  // Кэш спрайтов формы следа. Каждая (форма, цвет) рендерится один раз в
  // offscreen canvas с учётом свечения, а затем каждый кадр просто блитится
  // через drawImage. Это превращает построение сложных векторных путей (звезда,
  // кольцо, сердце и т.п.) для каждой точки следа в один быстрый вызов blit.
  ParticleSystem.pointerTrailSprites = {};

  ParticleSystem.getPointerTrailSprite = function getPointerTrailSprite(color) {
    const shape = config.pointerTrailShape;
    const shadowBlur = config.shadowBlur + 12;
    const key = `${shape}|${color}|${config.pointerTrailSize}|${shadowBlur}`;
    if (ParticleSystem.pointerTrailSprites[key]) return ParticleSystem.pointerTrailSprites[key];

    // Базовый радиус — максимальный размер точки следа. Уменьшение масштаба при
    // затухании выполняется drawImage, поэтому пути строятся только один раз.
    const baseRadius = config.pointerTrailSize;
    const glowPad = shadowBlur;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(baseRadius * 2 + glowPad * 2);
    canvas.height = Math.ceil(baseRadius * 2 + glowPad * 2);
    const spriteCtx = canvas.getContext('2d');
    const center = canvas.width / 2;

    spriteCtx.save();
    spriteCtx.fillStyle = color;
    spriteCtx.shadowColor = color;
    spriteCtx.shadowBlur = shadowBlur;
    ParticleSystem.drawShape(spriteCtx, center, center, baseRadius, shape);
    spriteCtx.restore();

    const sprite = { canvas, baseRadius };
    ParticleSystem.pointerTrailSprites[key] = sprite;
    return sprite;
  };

  ParticleSystem.drawPointerTrails = function drawPointerTrails(timestamp) {
    if (ParticleSystem.pointerTrails.length === 0) return;

    const ctx = ParticleSystem.ctx;

    ParticleSystem.pointerTrails = ParticleSystem.pointerTrails.filter(
      (point) => timestamp - point.createdAt < config.pointerTrailLifetime
    );

    ParticleSystem.pointerTrails.forEach((point) => {
      const age = timestamp - point.createdAt;
      const life = 1 - age / config.pointerTrailLifetime;
      const radius = config.pointerTrailSize * life;
      const sprite = ParticleSystem.getPointerTrailSprite(point.color);

      const scale = radius / sprite.baseRadius;
      const drawSize = sprite.canvas.width * scale;

      ctx.save();
      ctx.globalAlpha = Math.max(0, life * 0.55);
      ctx.drawImage(
        sprite.canvas,
        point.x - drawSize / 2,
        point.y - drawSize / 2,
        drawSize,
        drawSize
      );
      ctx.restore();
    });
  };

  ParticleSystem.resizeCanvas = function resizeCanvas() {
    const canvas = document.getElementById('particle-canvas');
    const maxPixelRatio = ParticleSystem.getPerformanceLimits
      ? ParticleSystem.getPerformanceLimits().pixelRatio
      : Infinity;
    const pixelRatio = Math.min(Math.max(1, window.devicePixelRatio || 1), maxPixelRatio);
    ParticleSystem.canvasBounds = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    ParticleSystem.bloomCanvas = null;
    ParticleSystem.chromaticAberrationCanvas = null;
    ParticleSystem.chromaticAberrationChannels = null;

    canvas.width = Math.ceil(ParticleSystem.canvasBounds.width * pixelRatio);
    canvas.height = Math.ceil(ParticleSystem.canvasBounds.height * pixelRatio);
    ParticleSystem.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };
})();
