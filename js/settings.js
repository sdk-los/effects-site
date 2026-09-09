/* ── Settings panel ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, config, DEFAULT_CONFIG, SETTINGS_PRESETS } } = window;

  /* ── Settings application ── */
  const SETTING_APPLIERS = {
    performanceProfile: () => ParticleSystem.applyPerformanceProfile(),
    particleCount: ParticleSystem.createParticles,
    particleShape: null,
    speedMultiplier: ParticleSystem.updateParticleSpeed,
    velocityStretchEnabled: null,
    velocityStretchStrength: null,
    particleRepulsionEnabled: null,
    particleRepulsionStrength: null,
    particleRepulsionRadius: null,
    selfDriftEnabled: null,
    selfDriftIntensity: null,
    selfDriftSpeed: null,
    selfDriftMode: null,
    selfDriftDirection: null,
    particleSize: ParticleSystem.updateParticleSizes,
    particleSizeVariance: ParticleSystem.updateParticleSizes,
    hue: ParticleSystem.updateParticleHues,
    colorPalette: ParticleSystem.updateParticleColors,
    customColor1: ParticleSystem.updateParticleColors,
    customColor2: ParticleSystem.updateParticleColors,
    customColor3: ParticleSystem.updateParticleColors,
    cursorInteractionEnabled: ParticleSystem.syncCursorMode,
    cursorMode: ParticleSystem.syncCursorMode,
    pointerTrailLifetime: null,
    pointerTrailSize: null,
    pointerTrailMinDistance: null,
    pointerTrailMaxPoints: null,
    shadowBlur: ParticleSystem.updateParticleShadowBlur,
    bloom: null,
    chromaticAberration: null,
    depthEnabled: null,
    depthStrength: null,
    parallaxStrength: null,
    depthSpeed: null,
    backgroundMode: ParticleSystem.renderBackground,
    backgroundColor: ParticleSystem.renderBackground,
    backgroundGradientStrength: ParticleSystem.renderBackground,
    showConnections: null,
    connectionDistance: null,
    connectionWidth: null,
    connectionOpacity: null,
    auroraEnabled: null,
    auroraIntensity: null,
    auroraSpeed: null,
    showParticleCount: null,
    /* ── Взрывы по клику ── */
    explosionEnabled: null,
    explosionCount: null,
    explosionSpeed: null,
    explosionLifetime: null,
    explosionSize: null,
    explosionMode: null,
    /* ── Тропы частиц ── */
    trailEnabled: null,
    trailLength: null,
    trailOpacity: null,
    trailColor: null,
  };

  ParticleSystem.syncPerformanceProfileLimits = function syncPerformanceProfileLimits() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const limits = ParticleSystem.getPerformanceLimits();
    Object.entries(limits).forEach(([key, maximum]) => {
      if (key === 'pixelRatio') return;
      const input = panel.querySelector(`[${CONSTANTS.ATTR_SETTING}="${key}"]`);
      if (input && input.type === 'range') input.max = String(maximum);
    });
  };

  ParticleSystem.applyPerformanceProfile = function applyPerformanceProfile() {
    const previousParticleCount = ParticleSystem.particles?.length;
    ParticleSystem.clampConfigToPerformanceProfile();
    ParticleSystem.syncPerformanceProfileLimits();
    ParticleSystem.resizeCanvas();
    ParticleSystem.updateParticleShadowBlur();

    if (previousParticleCount !== config.particleCount) {
      ParticleSystem.createParticles();
    }
    ParticleSystem.getSettingsControls().forEach((input) => {
      if (['particleCount', 'connectionDistance', 'connectionWidth', 'connectionOpacity', 'trailLength', 'shadowBlur', 'bloom'].includes(input.getAttribute(CONSTANTS.ATTR_SETTING))) {
        ParticleSystem.syncControl(input);
      }
    });
  };

  ParticleSystem.applySettings = function applySettings(key) {
    ParticleSystem.clampConfigToPerformanceProfile();
    // Автоматически отключаем конфликтующие эффекты для оптимизации FPS
    if (key === 'trailEnabled' && config.trailEnabled) {
      config.shadowBlur = 0;
      ParticleSystem.updateParticleShadowBlur();
      const shadowBlurControl = ParticleSystem.getSettingControl('shadowBlur');
      if (shadowBlurControl) ParticleSystem.syncControl(shadowBlurControl);
    } else if (key === 'shadowBlur' && config.shadowBlur > 0) {
      config.trailEnabled = false;
      const trailControl = ParticleSystem.getSettingControl('trailEnabled');
      if (trailControl) ParticleSystem.syncControl(trailControl);
    }
    
    const applier = SETTING_APPLIERS[key];
    if (applier) applier();
  };

  /* ── Panel open/close ── */
  ParticleSystem.openSettings = function openSettings() {
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    const settingsToggle = document.getElementById('settings-toggle');
    if (!panel || !overlay) return;

    panel.classList.add(CONSTANTS.CSS_OPEN_CLASS);
    overlay.classList.add(CONSTANTS.CSS_OPEN_CLASS);
    panel.setAttribute('aria-hidden', 'false');
    panel.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'true');

    const focusInitialControl = () => {
      const closeButton = panel.querySelector('#settings-close');
      if (closeButton) closeButton.focus();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusInitialControl);
    } else {
      focusInitialControl();
    }
  };

  ParticleSystem.toggleSettings = function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel && panel.classList.contains(CONSTANTS.CSS_OPEN_CLASS)) {
      ParticleSystem.closeSettings();
    } else {
      ParticleSystem.openSettings();
    }
  };

  ParticleSystem.closeSettings = function closeSettings() {
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    const settingsToggle = document.getElementById('settings-toggle');
    if (!panel || !overlay) return;
    panel.classList.remove(CONSTANTS.CSS_OPEN_CLASS);
    overlay.classList.remove(CONSTANTS.CSS_OPEN_CLASS);
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
    overlay.setAttribute('aria-hidden', 'true');
    if (settingsToggle) {
      settingsToggle.setAttribute('aria-expanded', 'false');
      settingsToggle.focus();
    }
  };

  /* ── Display helpers ── */
  ParticleSystem.formatDisplayValue = function formatDisplayValue(key, value) {
    if (key === 'attractionForce' || key === 'trailOpacity' || key === 'selfDriftIntensity' || key === 'selfDriftOrbitRepulsionStrength' || key === 'particleRepulsionStrength' || key === 'velocityStretchStrength') return value.toFixed(2);
    if (key === 'pointerTrailLifetime') return `${Math.round(value)} мс`;
    if (key === 'pointerTrailSize' || key === 'pointerTrailMinDistance') return `${Math.round(value)} px`;
    if (key === 'chromaticAberration') return `${Math.round(value)} px`;
    if (key === 'pointerTrailMaxPoints' || key === 'particleRepulsionRadius') return `${Math.round(value)} px`;
    if (key === 'speedMultiplier' || key === 'selfDriftSpeed') return value.toFixed(1);
    if (key === 'selfDriftOrbitRadius') return Math.round(value) + '%';
    return String(value);
  };

  ParticleSystem.getToggleLabelText = function getToggleLabelText(key, checked) {
    if (key === 'bounce' || key === 'showParticleCount' || key === 'showFps' || key === 'selfDriftEnabled' || key === 'selfDriftOrbitRepulsionEnabled' || key === 'particleRepulsionEnabled' || key === 'cursorInteractionEnabled' || key === 'adaptiveQualityEnabled' || key === 'prioritizeLastChangedSetting' || key === 'particleSizeVariance' || key === 'depthEnabled') {
      return checked ? 'Включена' : 'Выключена';
    }
    if (key === 'velocityStretchEnabled') return checked ? 'Включен' : 'Выключен';
    return checked ? 'Включены' : 'Выключены';
  };

  /* ── DOM queries ── */
  ParticleSystem.getSettingsControls = function getSettingsControls() {
    return document.querySelectorAll(
      `#settings-panel [${CONSTANTS.ATTR_SETTING}]`
    );
  };

  ParticleSystem.getSettingControl = function getSettingControl(key) {
    return document.getElementById('settings-panel').querySelector(
      `[${CONSTANTS.ATTR_SETTING}="${key}"]`
    );
  };

  ParticleSystem.getPresetSelect = function getPresetSelect() {
    return document.getElementById('settings-panel').querySelector('#preset-select');
  };

  /* ── Contextual setting hints ── */
  ParticleSystem.bindSettingHelp = function bindSettingHelp() {
    const panel = document.getElementById('settings-panel');
    const tooltip = document.getElementById('settings-tooltip');
    if (!panel || !tooltip) return;

    let activeButton = null;

    function positionTooltip(button) {
      const rect = button.getBoundingClientRect();
      const padding = 12;
      const width = tooltip.offsetWidth;
      const left = Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding));
      const top = rect.top - tooltip.offsetHeight - 8 >= padding
        ? rect.top - tooltip.offsetHeight - 8
        : rect.bottom + 8;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function showTooltip(button) {
      const message = button.dataset.tooltip;
      if (!message) return;
      activeButton = button;
      tooltip.textContent = message;
      tooltip.hidden = false;
      positionTooltip(button);
      button.setAttribute('aria-expanded', 'true');
    }

    function hideTooltip(button) {
      if (button && button !== activeButton) return;
      if (activeButton) activeButton.setAttribute('aria-expanded', 'false');
      activeButton = null;
      tooltip.hidden = true;
    }

    panel.querySelectorAll('.setting-help').forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('mouseenter', () => showTooltip(button));
      button.addEventListener('mouseleave', () => hideTooltip(button));
      button.addEventListener('focus', () => showTooltip(button));
      button.addEventListener('blur', () => hideTooltip(button));
      button.addEventListener('click', () => showTooltip(button));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideTooltip();
    });
    window.addEventListener('resize', () => {
      if (activeButton && !tooltip.hidden) positionTooltip(activeButton);
    });
  };

  /* ── Mobile swipe gesture ── */
  ParticleSystem.bindSettingsSwipeToClose = function bindSettingsSwipeToClose() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const mobilePointer = window.matchMedia && window.matchMedia('(pointer: coarse)');
    let swipeStart = null;
    const interactiveSelector = 'input, select, button, label, a, summary';

    panel.addEventListener('touchstart', (event) => {
      if (!mobilePointer || !mobilePointer.matches || event.touches.length !== 1) return;
      if (event.target.closest && event.target.closest(interactiveSelector)) return;

      const touch = event.touches[0];
      swipeStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    panel.addEventListener('touchend', (event) => {
      if (!swipeStart || event.changedTouches.length !== 1) {
        swipeStart = null;
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;
      swipeStart = null;

      const isRightSwipe = deltaX >= 64 && deltaX > Math.abs(deltaY) * 1.5;
      if (isRightSwipe) ParticleSystem.closeSettings();
    }, { passive: true });

    panel.addEventListener('touchcancel', () => {
      swipeStart = null;
    }, { passive: true });
  };

  /* ── Presets ── */
  ParticleSystem.doesPresetMatchConfig = function doesPresetMatchConfig(preset) {
    return Object.entries(preset.settings).every(
      ([key, value]) => config[key] === value
    );
  };

  ParticleSystem.getActivePresetKey = function getActivePresetKey() {
    return Object.keys(SETTINGS_PRESETS).find((presetKey) =>
      ParticleSystem.doesPresetMatchConfig(SETTINGS_PRESETS[presetKey])
    );
  };

  ParticleSystem.syncPresetSelect = function syncPresetSelect() {
    const activePresetKey = ParticleSystem.getActivePresetKey();
    const presetSelect = ParticleSystem.getPresetSelect();
    if (presetSelect) {
      presetSelect.value = activePresetKey || '';
    }
  };

  ParticleSystem.syncCustomPaletteVisibility = function syncCustomPaletteVisibility() {
    const customPaletteGroup = document.getElementById('settings-panel').querySelector('[data-custom-palette]');
    if (!customPaletteGroup) return;
    const isVisible = config.colorPalette === 'custom';
    customPaletteGroup.classList.toggle(CONSTANTS.CSS_VISIBLE_CLASS, isVisible);
    customPaletteGroup.hidden = !isVisible;
  };

  ParticleSystem.syncDriftDirectionVisibility = function syncDriftDirectionVisibility() {
    const group = document.getElementById('settings-panel').querySelector('[data-drift-direction]');
    if (!group) return;
    const isVisible = config.selfDriftMode === 'directional';
    group.classList.toggle(CONSTANTS.CSS_VISIBLE_CLASS, isVisible);
    group.hidden = !isVisible;
  };

  ParticleSystem.syncDriftOrbitVisibility = function syncDriftOrbitVisibility() {
    const group = document.getElementById('settings-panel').querySelector('[data-drift-orbit]');
    if (!group) return;
    const isVisible = config.selfDriftMode === 'orbit' || config.selfDriftMode === 'orbitGlobal' || config.selfDriftMode === 'vortex' || config.selfDriftMode === 'spiral' || config.selfDriftMode === 'spiralIndividual';
    group.classList.toggle(CONSTANTS.CSS_VISIBLE_CLASS, isVisible);
    group.hidden = !isVisible;
  };

  ParticleSystem.syncDriftOrbitRepulsionVisibility = function syncDriftOrbitRepulsionVisibility() {
    const groups = document.getElementById('settings-panel').querySelectorAll('[data-drift-orbit-repel]');
    if (!groups.length) return;
    groups.forEach((group) => {
      const isVisible = config.selfDriftMode === 'orbitGlobal';
      group.classList.toggle(CONSTANTS.CSS_VISIBLE_CLASS, isVisible);
      group.hidden = !isVisible;
    });
  };

  ParticleSystem.syncExplosionSettingsVisibility = function syncExplosionSettingsVisibility() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const isEnabled = config.explosionEnabled;
    panel.querySelectorAll('[data-explosion-setting]').forEach((group) => {
      group.hidden = !isEnabled;
    });
    panel.querySelectorAll('[data-explosion-burst-only]').forEach((group) => {
      group.hidden = !isEnabled || config.explosionMode !== 'burst';
    });
  };

  ParticleSystem.syncCursorTrailSettingsVisibility = function syncCursorTrailSettingsVisibility() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const isTrailMode = config.cursorMode === 'trail';
    panel.querySelectorAll('[data-cursor-trail-setting]').forEach((group) => {
      group.hidden = !isTrailMode;
    });
    panel.querySelectorAll('[data-cursor-interaction-setting]').forEach((group) => {
      group.hidden = isTrailMode;
    });
  };

  ParticleSystem.syncDepthSettingsVisibility = function syncDepthSettingsVisibility() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    panel.querySelectorAll('[data-depth-setting]').forEach((group) => {
      group.hidden = !config.depthEnabled;
    });
  };

  ParticleSystem.syncVelocityStretchSettingsVisibility = function syncVelocityStretchSettingsVisibility() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    panel.querySelectorAll('[data-velocity-stretch-setting]').forEach((group) => {
      group.hidden = !config.velocityStretchEnabled;
    });
  };

  /* ── Input handlers ── */
  ParticleSystem.handleCheckboxInput = function handleCheckboxInput(input, key) {
    const value = input.checked;
    const wrapper = input.closest('.toggle-wrapper');
    if (wrapper) {
      const label = wrapper.querySelector(CONSTANTS.SELECTOR_TOGGLE_LABEL);
      if (label) label.textContent = ParticleSystem.getToggleLabelText(key, value);
    }
    return value;
  };

  ParticleSystem.handleRangeInput = function handleRangeInput(input, key) {
    const value = parseFloat(input.value);
    const group = input.closest(CONSTANTS.SELECTOR_CONTROL_GROUP);
    if (group) {
      const display = group.querySelector(`[${CONSTANTS.ATTR_DISPLAY}]`);
      if (display) display.textContent = ParticleSystem.formatDisplayValue(key, value);
    }
    return value;
  };

  ParticleSystem.handleSelectInput = function handleSelectInput(input) {
    return input.value;
  };

  ParticleSystem.handleColorInput = function handleColorInput(input, key) {
    return ParticleSystem.isValidHexColor(input.value) ? input.value : DEFAULT_CONFIG[key];
  };

  /* ── Sync controls ── */
  ParticleSystem.syncControl = function syncControl(input) {
    const key = input.getAttribute(CONSTANTS.ATTR_SETTING);
    if (!Object.prototype.hasOwnProperty.call(config, key)) return;

    if (input.type === 'checkbox') {
      input.checked = config[key];
      ParticleSystem.handleCheckboxInput(input, key);
    } else if (input.type === 'color' || input.tagName === 'SELECT') {
      input.value = config[key];
    } else {
      input.value = config[key];
      ParticleSystem.handleRangeInput(input, key);
    }
  };

  ParticleSystem.syncControlsFromConfig = function syncControlsFromConfig() {
    ParticleSystem.clampConfigToPerformanceProfile();
    ParticleSystem.syncPerformanceProfileLimits();
    ParticleSystem.getSettingsControls().forEach(ParticleSystem.syncControl);
    ParticleSystem.syncCustomPaletteVisibility();
    ParticleSystem.syncDriftDirectionVisibility();
    ParticleSystem.syncDriftOrbitVisibility();
    ParticleSystem.syncDriftOrbitRepulsionVisibility();
    ParticleSystem.syncExplosionSettingsVisibility();
    ParticleSystem.syncCursorTrailSettingsVisibility();
    ParticleSystem.syncDepthSettingsVisibility();
    ParticleSystem.syncVelocityStretchSettingsVisibility();
    ParticleSystem.syncPresetSelect();
    ParticleSystem.syncFpsIndicator();
  };

  /* ── Setting input handler ── */
  ParticleSystem.handleSettingInput = function handleSettingInput(input) {
    const key = input.getAttribute(CONSTANTS.ATTR_SETTING);
    let value;
    if (input.type === 'checkbox') {
      value = ParticleSystem.handleCheckboxInput(input, key);
    } else if (input.type === 'color') {
      value = ParticleSystem.handleColorInput(input, key);
    } else if (input.tagName === 'SELECT') {
      value = ParticleSystem.handleSelectInput(input);
    } else {
      value = ParticleSystem.handleRangeInput(input, key);
    }

    config[key] = value;
    if (ParticleSystem.ADAPTIVE_QUALITY_ORDER.includes(key)) {
      ParticleSystem.markHeavySettingChange(key);
    }
    if (key === 'colorPalette') ParticleSystem.syncCustomPaletteVisibility();
    if (key === 'selfDriftMode') ParticleSystem.syncDriftDirectionVisibility();
    if (key === 'selfDriftMode') ParticleSystem.syncDriftOrbitVisibility();
    if (key === 'selfDriftMode') ParticleSystem.syncDriftOrbitRepulsionVisibility();
    if (key === 'explosionEnabled' || key === 'explosionMode') ParticleSystem.syncExplosionSettingsVisibility();
    if (key === 'cursorMode') ParticleSystem.syncCursorTrailSettingsVisibility();
    if (key === 'depthEnabled') ParticleSystem.syncDepthSettingsVisibility();
    if (key === 'velocityStretchEnabled') ParticleSystem.syncVelocityStretchSettingsVisibility();
    if (key === 'showFps' || key === 'showParticleCount') ParticleSystem.syncFpsIndicator();
    ParticleSystem.applySettings(key);
    ParticleSystem.syncPresetSelect();
    ParticleSystem.saveSettings();
  };

  /* ── Reset & Presets ── */
  ParticleSystem.resetSettings = function resetSettings() {
    Object.assign(config, DEFAULT_CONFIG);
    ParticleSystem.clearRuntimeOverrides();
    ParticleSystem.resetAdaptiveQualityState();
    ParticleSystem.clearSavedSettings();
    ParticleSystem.syncControlsFromConfig();
    ParticleSystem.syncCursorMode();
    ParticleSystem.createParticles();
  };

  ParticleSystem.copySceneLink = async function copySceneLink() {
    const status = document.getElementById('scene-link-status');
    const sceneUrl = ParticleSystem.getSceneUrl();
    if (!sceneUrl) {
      if (status) status.textContent = 'Не удалось подготовить ссылку.';
      return;
    }

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API is unavailable');
      }
      await navigator.clipboard.writeText(sceneUrl);
      if (status) status.textContent = 'Ссылка скопирована.';
    } catch (error) {
      if (status) status.textContent = 'Не удалось скопировать ссылку. Скопируйте адрес из браузера.';
    }
  };

  ParticleSystem.applyPreset = function applyPreset(presetKey) {
    const preset = SETTINGS_PRESETS[presetKey];
    if (!preset) return;

    const performanceProfile = config.performanceProfile;
    Object.assign(config, preset.settings);
    config.performanceProfile = performanceProfile;
    ParticleSystem.clearRuntimeOverrides();
    ParticleSystem.resetAdaptiveQualityState();
    ParticleSystem.clampConfigToPerformanceProfile();
    
    // Разрешаем конфликты между shadowBlur и trailEnabled
    if (config.shadowBlur > 0 && config.trailEnabled) {
      config.trailEnabled = false;
    }
    
    ParticleSystem.syncControlsFromConfig();
    ParticleSystem.syncCursorMode();
    ParticleSystem.createParticles();
    ParticleSystem.saveSettings();
  };

  /* ── Bind settings ── */
  ParticleSystem.bindSettings = function bindSettings() {
    ParticleSystem.getSettingsControls().forEach((input) => {
      const eventName =
        input.type === 'checkbox' || input.type === 'color' || input.tagName === 'SELECT'
          ? 'change'
          : 'input';
      input.addEventListener(eventName, () => ParticleSystem.handleSettingInput(input));
    });

    const presetSelect = ParticleSystem.getPresetSelect();
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
          ParticleSystem.applyPreset(presetSelect.value);
        }
      });
    }

    ParticleSystem.bindSettingHelp();
    ParticleSystem.bindSettingsSwipeToClose();
  };
})();
