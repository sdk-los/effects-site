/* ── Animation loop ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, config } } = window;

  ParticleSystem.animationId = null;
  ParticleSystem.fpsFrameCount = 0;
  ParticleSystem.fpsLastTime = 0;
  ParticleSystem.adaptiveQualityState = {
    lowFpsStreak: 0,
    lastAdjustmentAt: 0,
    activeAdjustments: [],
    lastStatus: '',
    lastHeavySettingKey: null,
  };

  ParticleSystem.ADAPTIVE_QUALITY_ORDER = [
    'showConnections',
    'auroraEnabled',
    'depthEnabled',
    'particleCount',
    'shadowBlur',
    'bloom',
    'trailLength',
  ];

  ParticleSystem.notifyAdaptiveQualityStatus = function notifyAdaptiveQualityStatus(message) {
    if (!message) return;
    const status = document.getElementById('adaptive-quality-status');
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }

    const toast = document.getElementById('adaptive-quality-toast');
    if (toast) {
      toast.textContent = message;
      toast.hidden = false;
      toast.classList.add('visible');
      clearTimeout(ParticleSystem.adaptiveQualityState.toastTimeoutId);
      ParticleSystem.adaptiveQualityState.toastTimeoutId = window.setTimeout(() => {
        toast.classList.remove('visible');
        window.setTimeout(() => {
          toast.hidden = true;
        }, 260);
      }, 4200);
    }

    ParticleSystem.adaptiveQualityState.lastStatus = message;
  };

  ParticleSystem.clearAdaptiveQualityStatus = function clearAdaptiveQualityStatus() {
    const status = document.getElementById('adaptive-quality-status');
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
    const toast = document.getElementById('adaptive-quality-toast');
    if (toast) {
      toast.textContent = '';
      toast.hidden = true;
      toast.classList.remove('visible');
      clearTimeout(ParticleSystem.adaptiveQualityState.toastTimeoutId);
    }
    ParticleSystem.adaptiveQualityState.lastStatus = '';
  };

  ParticleSystem.getAdaptiveQualityPriorityKey = function getAdaptiveQualityPriorityKey() {
    if (!config.prioritizeLastChangedSetting) return null;
    const lastKey = ParticleSystem.adaptiveQualityState.lastHeavySettingKey;
    if (lastKey && ParticleSystem.ADAPTIVE_QUALITY_ORDER.includes(lastKey)) {
      return lastKey;
    }
    return null;
  };

  ParticleSystem.markHeavySettingChange = function markHeavySettingChange(key) {
    if (!key || !ParticleSystem.ADAPTIVE_QUALITY_ORDER.includes(key)) return;
    ParticleSystem.adaptiveQualityState.lastHeavySettingKey = key;
    delete ParticleSystem.runtimeOverrides[key];
    ParticleSystem.adaptiveQualityState.activeAdjustments = ParticleSystem.adaptiveQualityState.activeAdjustments.filter((item) => item !== key);
    // Пользователь вручную изменил «тяжёлую» настройку — начинаем новый эпизод.
    ParticleSystem.syncAdaptiveQualityControl(key);
  };

  ParticleSystem.syncAdaptiveQualityControl = function syncAdaptiveQualityControl(key) {
    if (!key || typeof key !== 'string') return;
    const control = ParticleSystem.getSettingControl ? ParticleSystem.getSettingControl(key) : null;
    if (control && ParticleSystem.syncControl) {
      ParticleSystem.syncControl(control);
    }
  };

  ParticleSystem.canReduceAdaptiveSetting = function canReduceAdaptiveSetting(key) {
    const currentValue = config[key];
    if (key === 'particleCount') return currentValue > 80;
    if (key === 'shadowBlur') return currentValue > 0;
    if (key === 'bloom') return currentValue > 0;
    if (key === 'trailLength') return currentValue > 4;
    if (key === 'showConnections') return currentValue === true;
    if (key === 'auroraEnabled') return currentValue === true;
    if (key === 'depthEnabled') return currentValue === true;
    return false;
  };

  ParticleSystem.getAdaptiveQualityCandidate = function getAdaptiveQualityCandidate() {
    const preferred = ParticleSystem.getAdaptiveQualityPriorityKey();
    // Приоритетная настройка учитывается, только если её ещё можно снизить.
    // Иначе переходим к другим «тяжёлым» настройкам, чтобы не блокировать оптимизацию.
    if (preferred && ParticleSystem.canReduceAdaptiveSetting(preferred)) return preferred;
    return ParticleSystem.ADAPTIVE_QUALITY_ORDER.find((key) =>
      ParticleSystem.canReduceAdaptiveSetting(key)
    ) || null;
  };

  // Применяет снижение сразу и сохраняет его в userConfig. Так как возврат
  // уменьшенных значений удалён, снижение становится постоянным и переживает
  // перезагрузку страницы — как если бы его задал сам пользователь.
  ParticleSystem.applyAdaptiveQualityStep = function applyAdaptiveQualityStep() {
    if (!config.adaptiveQualityEnabled) return false;

    const key = ParticleSystem.getAdaptiveQualityCandidate();
    if (!key) return false;

    const currentValue = config[key];
    let nextValue = currentValue;

    if (key === 'showConnections') nextValue = false;
    else if (key === 'auroraEnabled') nextValue = false;
    else if (key === 'depthEnabled') nextValue = false;
    else if (key === 'particleCount') nextValue = Math.max(80, Math.round(currentValue * 0.75));
    else if (key === 'shadowBlur') nextValue = Math.max(0, currentValue - 10);
    else if (key === 'bloom') nextValue = Math.max(0, currentValue - 0.2);
    else if (key === 'trailLength') nextValue = Math.max(4, currentValue - 4);

    if (nextValue === currentValue) return false;

    // Прямая запись через config: прокси очищает runtimeOverride (если был)
    // и пишет в userConfig, затем сохранение делает значение постоянным.
    config[key] = nextValue;

    if (key === 'particleCount') {
      ParticleSystem.createParticles();
    }
    if (key === 'shadowBlur') {
      ParticleSystem.updateParticleShadowBlur();
    }
    if (key === 'trailLength') {
      ParticleSystem.particles.forEach((particle) => {
        particle.maxTrailLength = config.trailLength;
      });
    }

    if (ParticleSystem.saveSettings) ParticleSystem.saveSettings();

    const state = ParticleSystem.adaptiveQualityState;
    state.activeAdjustments = [...new Set([...state.activeAdjustments, key])];
    state.lastAdjustmentAt = performance.now();
    ParticleSystem.notifyAdaptiveQualityStatus(`Оптимизация: уменьшено ${key}.`);
    ParticleSystem.syncAdaptiveQualityControl(key);
    return true;
  };

  ParticleSystem.trackAdaptiveQualityFps = function trackAdaptiveQualityFps(fps) {
    const state = ParticleSystem.adaptiveQualityState;
    if (!config.adaptiveQualityEnabled) {
      ParticleSystem.clearAdaptiveQualityStatus();
      state.lowFpsStreak = 0;
      return;
    }

    const now = performance.now();

    if (fps < 30) {
      state.lowFpsStreak += 1;
    } else {
      state.lowFpsStreak = 0;
    }

    const cooldownPassed = now - state.lastAdjustmentAt > 1500;

    // Снижение применяется и сохраняется сразу (см. applyAdaptiveQualityStep),
    // поэтому кумулятивный таймер фиксации не нужен.
    if (state.lowFpsStreak >= 3 && cooldownPassed) {
      const degraded = ParticleSystem.applyAdaptiveQualityStep();
      if (degraded) {
        state.lowFpsStreak = 0;
      }
    }
  };

  ParticleSystem.animate = function animate(timestamp) {
    ParticleSystem.renderBackground();
    ParticleSystem.drawAurora(timestamp);
    ParticleSystem.drawPointerTrails(timestamp);
    ParticleSystem.drawConnections();
    ParticleSystem.particles.slice().sort((first, second) => first.depth - second.depth).forEach((p) => {
      p.update();
      p.draw();
    });
    /* ── Взрывы по клику ── */
    ParticleSystem.explosionParticles = ParticleSystem.explosionParticles.filter((p) => p.update());
    ParticleSystem.explosionParticles.forEach((p) => p.draw());
    ParticleSystem.applyBloom();
    ParticleSystem.updateFpsIndicator(timestamp);
    ParticleSystem.updateParticleCountIndicator();
    ParticleSystem.animationId = requestAnimationFrame(ParticleSystem.animate);
  };

  ParticleSystem.startAnimation = function startAnimation() {
    if (ParticleSystem.animationId || document.hidden) return;
    ParticleSystem.resetFpsCounter();
    ParticleSystem.animationId = requestAnimationFrame(ParticleSystem.animate);
  };

  ParticleSystem.stopAnimation = function stopAnimation() {
    if (!ParticleSystem.animationId) return;
    cancelAnimationFrame(ParticleSystem.animationId);
    ParticleSystem.animationId = null;
    ParticleSystem.resetFpsCounter();
  };

  ParticleSystem.updateFpsIndicator = function updateFpsIndicator(timestamp) {
    const fpsIndicator = document.getElementById('fps-indicator');

    if (!ParticleSystem.fpsLastTime) {
      ParticleSystem.fpsLastTime = timestamp;
      ParticleSystem.fpsFrameCount = 0;
      return;
    }

    ParticleSystem.fpsFrameCount += 1;
    const elapsed = timestamp - ParticleSystem.fpsLastTime;
    if (elapsed < CONSTANTS.FPS_UPDATE_INTERVAL) return;

    const fps = Math.round((ParticleSystem.fpsFrameCount * 1000) / elapsed);
    if (fpsIndicator) {
      fpsIndicator.textContent = `FPS: ${fps}`;
      fpsIndicator.hidden = !config.showFps;
    }
    ParticleSystem.trackAdaptiveQualityFps(fps);
    ParticleSystem.fpsFrameCount = 0;
    ParticleSystem.fpsLastTime = timestamp;
  };

  ParticleSystem.resetFpsCounter = function resetFpsCounter() {
    ParticleSystem.fpsFrameCount = 0;
    ParticleSystem.fpsLastTime = 0;
    const fpsIndicator = document.getElementById('fps-indicator');
    if (fpsIndicator) fpsIndicator.textContent = 'FPS: 0';
  };

  ParticleSystem.resetAdaptiveQualityState = function resetAdaptiveQualityState() {
    ParticleSystem.adaptiveQualityState = {
      lowFpsStreak: 0,
      lastAdjustmentAt: 0,
      activeAdjustments: [],
      lastStatus: '',
      lastHeavySettingKey: null,
    };
    ParticleSystem.clearAdaptiveQualityStatus();
  };

  ParticleSystem.updateParticleCountIndicator = function updateParticleCountIndicator() {
    const countIndicator = document.getElementById('particle-count-indicator');
    if (!countIndicator) return;

    const totalCount = ParticleSystem.particles.length + (ParticleSystem.explosionParticles?.length || 0);
    countIndicator.textContent = `Particles: ${totalCount}`;
    countIndicator.hidden = !config.showParticleCount;
  };

  ParticleSystem.syncParticleCountIndicator = function syncParticleCountIndicator() {
    const countIndicator = document.getElementById('particle-count-indicator');

    if (countIndicator) {
      countIndicator.hidden = !config.showParticleCount;
      const totalCount = ParticleSystem.particles.length + (ParticleSystem.explosionParticles?.length || 0);
      countIndicator.textContent = `Particles: ${totalCount}`;
    }
  };

  ParticleSystem.syncFpsIndicator = function syncFpsIndicator() {
    const fpsIndicator = document.getElementById('fps-indicator');
    if (!fpsIndicator) return;
    fpsIndicator.hidden = !config.showFps;
    ParticleSystem.resetFpsCounter();
    ParticleSystem.syncParticleCountIndicator();
  };
})();