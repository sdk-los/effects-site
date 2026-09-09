/* ── Configuration ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, COLOR_PALETTES, CURSOR_MODES } } = window;

  ParticleSystem.DEFAULT_CONFIG = Object.freeze({
    particleCount: 250,
    particleSize: 4,
    particleSizeVariance: true,
    particleShape: 'circle',
    speedMultiplier: 1.0,
    velocityStretchEnabled: false,
    velocityStretchStrength: 1.5,
    particleRepulsionEnabled: false,
    particleRepulsionStrength: 0.3,
    particleRepulsionRadius: 36,
    selfDriftEnabled: false,
    selfDriftIntensity: 0.08,
    selfDriftSpeed: 0.5,
    selfDriftOrbitRadius: 0,
    selfDriftOrbitRepulsionEnabled: false,
    selfDriftOrbitRepulsionStrength: 0.35,
    selfDriftMode: 'random',
    selfDriftDirection: 0,
    hue: 130,
    colorPalette: 'mono',
    customColor1: '#0acf83',
    customColor2: '#38bdf8',
    customColor3: '#f97316',
    cursorInteractionEnabled: true,
    attractionForce: 0.3,
    cursorMode: 'attract',
    attractionRadius: 200,
    pointerTrailLifetime: 700,
    pointerTrailSize: 26,
    pointerTrailMinDistance: 8,
    pointerTrailMaxPoints: 120,
    pointerTrailShape: 'circle',
    shadowBlur: 0,
    bloom: 0,
    chromaticAberration: 0,
    depthEnabled: false,
    depthStrength: 0.65,
    parallaxStrength: 24,
    depthSpeed: 0.35,
    pulsate: true,
    bounce: true,
    showFps: true,
    showParticleCount: true,
    backgroundMode: 'gradient',
    backgroundColor: '#1a1a2e',
    backgroundGradientStrength: 0.35,
    auroraEnabled: false,
    auroraIntensity: 0.3,
    auroraSpeed: 0.8,
    showConnections: false,
    connectionDistance: 120,
    connectionWidth: 1,
    connectionOpacity: 0.3,
    connectionColor: '#ffffff',
    /* ── Взрывы по клику ── */
    explosionEnabled: false,
    explosionCount: 30,
    explosionSpeed: 6,
    explosionLifetime: 1000,
    explosionSize: 4,
    explosionMode: 'burst',
    /* ── Тропы частиц ── */
    trailEnabled: false,
    trailLength: 10,
    trailOpacity: 0.3,
    trailColor: '#ffffff',
    adaptiveQualityEnabled: true,
    prioritizeLastChangedSetting: true,
    performanceProfile: 'balanced',
  });

  // Профиль ограничивает наиболее дорогие параметры, не меняя художественные
  // настройки сцены. На устройствах с грубым указателем лимиты ниже: обычно
  // это телефон или планшет, для которых особенно важны батарея и плавность.
  ParticleSystem.PERFORMANCE_PROFILES = Object.freeze({
    unlimited: Object.freeze({
      label: 'Без ограничений',
      // Исходные максимумы контролов до появления профилей. DPR намеренно не
      // ограничивается, чтобы сохранить прежнее поведение canvas.
      desktop: Object.freeze({ particleCount: 10000, pixelRatio: Infinity, connectionDistance: 300, connectionWidth: 5, connectionOpacity: 1, trailLength: 30, shadowBlur: 50, bloom: 1 }),
      mobile: Object.freeze({ particleCount: 10000, pixelRatio: Infinity, connectionDistance: 300, connectionWidth: 5, connectionOpacity: 1, trailLength: 30, shadowBlur: 50, bloom: 1 }),
    }),
    economy: Object.freeze({
      label: 'Экономный',
      desktop: Object.freeze({ particleCount: 120, pixelRatio: 1, connectionDistance: 90, connectionWidth: 1, connectionOpacity: 0.25, trailLength: 8, shadowBlur: 8, bloom: 0.35 }),
      mobile: Object.freeze({ particleCount: 80, pixelRatio: 1, connectionDistance: 75, connectionWidth: 1, connectionOpacity: 0.2, trailLength: 6, shadowBlur: 6, bloom: 0.25 }),
    }),
    balanced: Object.freeze({
      label: 'Сбалансированный',
      desktop: Object.freeze({ particleCount: 500, pixelRatio: 1.5, connectionDistance: 120, connectionWidth: 1.5, connectionOpacity: 0.35, trailLength: 14, shadowBlur: 20, bloom: 0.65 }),
      mobile: Object.freeze({ particleCount: 250, pixelRatio: 1.25, connectionDistance: 105, connectionWidth: 1.25, connectionOpacity: 0.3, trailLength: 10, shadowBlur: 14, bloom: 0.5 }),
    }),
    maximum: Object.freeze({
      label: 'Максимальный',
      desktop: Object.freeze({ particleCount: 1500, pixelRatio: 2, connectionDistance: 180, connectionWidth: 2, connectionOpacity: 0.5, trailLength: 24, shadowBlur: 40, bloom: 0.85 }),
      mobile: Object.freeze({ particleCount: 750, pixelRatio: 1.5, connectionDistance: 150, connectionWidth: 1.75, connectionOpacity: 0.45, trailLength: 18, shadowBlur: 28, bloom: 0.65 }),
    }),
  });

  ParticleSystem.isMobilePerformanceTarget = function isMobilePerformanceTarget() {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || window.innerWidth <= 768;
  };

  ParticleSystem.getPerformanceLimits = function getPerformanceLimits(profileKey = ParticleSystem.config?.performanceProfile) {
    const profile = ParticleSystem.PERFORMANCE_PROFILES[profileKey]
      || ParticleSystem.PERFORMANCE_PROFILES.balanced;
    return profile[ParticleSystem.isMobilePerformanceTarget() ? 'mobile' : 'desktop'];
  };

  ParticleSystem.clampConfigToPerformanceProfile = function clampConfigToPerformanceProfile() {
    const limits = ParticleSystem.getPerformanceLimits();
    const limitedKeys = Object.keys(limits).filter((key) => key !== 'pixelRatio');
    let changed = false;
    limitedKeys.forEach((key) => {
      if (ParticleSystem.config[key] > limits[key]) {
        ParticleSystem.config[key] = limits[key];
        changed = true;
      }
    });
    return changed;
  };

  // Каждый пресет начинается с полной конфигурации. Это исключает случайное
  // сохранение тяжёлых эффектов от ранее выбранного режима.
  const createPreset = (label, settings) => Object.freeze({
    label,
    settings: Object.freeze({ ...ParticleSystem.DEFAULT_CONFIG, ...settings }),
  });

  ParticleSystem.SETTINGS_PRESETS = Object.freeze({
    calm: createPreset('Calm', {
        particleCount: 110,
        particleSize: 3,
        speedMultiplier: 0.4,
        selfDriftEnabled: false,
        selfDriftIntensity: 0.04,
        selfDriftSpeed: 0.3,
        hue: 205,
        colorPalette: 'cool',
        attractionForce: 0.15,
        cursorMode: 'attract',
        attractionRadius: 140,
        shadowBlur: 10,
        pulsate: true,
        bounce: true,
        backgroundMode: 'gradient',
        backgroundColor: '#14213d',
        backgroundGradientStrength: 0.2,
        auroraEnabled: false,
        auroraIntensity: 0.25,
        auroraSpeed: 0.6,
        connectionDistance: 100,
        connectionWidth: 0.8,
        connectionOpacity: 0.2,
    }),
    neon: createPreset('Neon', {
        particleCount: 240,
        particleSize: 4,
        speedMultiplier: 1.4,
        selfDriftEnabled: true,
        selfDriftIntensity: 0.15,
        selfDriftSpeed: 1.1,
        selfDriftMode: 'random',
        selfDriftDirection: 0,
        hue: 130,
        colorPalette: 'neon',
        attractionForce: 0.35,
        cursorMode: 'orbit',
        attractionRadius: 250,
        shadowBlur: 40,
        pulsate: true,
        bounce: true,
        backgroundMode: 'gradient',
        backgroundColor: '#060b1f',
        backgroundGradientStrength: 0.7,
        auroraEnabled: true,
        auroraIntensity: 0.65,
        auroraSpeed: 1.2,
        connectionDistance: 150,
        connectionWidth: 1.5,
        connectionOpacity: 0.4,
    }),
    storm: createPreset('Storm', {
        particleCount: 220,
        particleSize: 5,
        speedMultiplier: 2.2,
        selfDriftEnabled: true,
        selfDriftIntensity: 0.2,
        selfDriftSpeed: 1.6,
        selfDriftMode: 'random',
        selfDriftDirection: 0,
        hue: 265,
        colorPalette: 'rainbow',
        attractionForce: 0.75,
        cursorMode: 'orbit',
        attractionRadius: 360,
        shadowBlur: 30,
        pulsate: true,
        bounce: true,
        backgroundMode: 'solid',
        backgroundColor: '#030711',
        backgroundGradientStrength: 0.25,
        auroraEnabled: false,
        auroraIntensity: 0.2,
        auroraSpeed: 0.7,
        connectionDistance: 180,
        connectionWidth: 2.0,
        connectionOpacity: 0.5,
    }),
    minimal: createPreset('Minimal', {
        particleCount: 55,
        particleSize: 2,
        speedMultiplier: 0.5,
        selfDriftEnabled: false,
        selfDriftIntensity: 0.03,
        selfDriftSpeed: 0.2,
        hue: 160,
        colorPalette: 'mono',
        attractionForce: 0.1,
        cursorMode: 'trail',
        attractionRadius: 120,
        shadowBlur: 0,
        pulsate: false,
        bounce: false,
        backgroundMode: 'transparent',
        backgroundColor: '#111827',
        backgroundGradientStrength: 0.1,
        auroraEnabled: false,
        auroraIntensity: 0.15,
        auroraSpeed: 0.5,
        connectionDistance: 80,
        connectionWidth: 0.5,
        connectionOpacity: 0.1,
    }),
    constellation: createPreset('Constellation', {
      particleCount: 120,
      particleSize: 2,
      particleShape: 'ring',
      speedMultiplier: 0.35,
      selfDriftEnabled: true,
      selfDriftIntensity: 0.12,
      selfDriftSpeed: 0.65,
      selfDriftMode: 'orbit',
      selfDriftOrbitRadius: 10,
      hue: 215,
      colorPalette: 'cool',
      cursorMode: 'orbit',
      attractionForce: 0.75,
      attractionRadius: 160,
      pulsate: true,
      backgroundMode: 'gradient',
      backgroundColor: '#091427',
      backgroundGradientStrength: 0.45,
      showConnections: true,
      connectionDistance: 115,
      connectionWidth: 0.6,
      connectionOpacity: 0.28,
    }),
    comet: createPreset('Comet', {
      particleCount: 75,
      particleSize: 3,
      particleShape: 'drop',
      speedMultiplier: 1.7,
      selfDriftEnabled: true,
      selfDriftIntensity: 0.12,
      selfDriftSpeed: 1.2,
      selfDriftMode: 'directional',
      selfDriftDirection: 25,
      hue: 190,
      colorPalette: 'cool',
      cursorMode: 'repel',
      attractionForce: 0.28,
      attractionRadius: 170,
      pulsate: true,
      bounce: false,
      backgroundMode: 'solid',
      backgroundColor: '#020817',
      trailEnabled: true,
      trailLength: 18,
      trailOpacity: 0.38,
    }),
    aurora: createPreset('Aurora', {
      particleCount: 55,
      particleSize: 2,
      particleShape: 'circle',
      speedMultiplier: 0.65,
      selfDriftEnabled: true,
      selfDriftIntensity: 0.14,
      selfDriftSpeed: 0.7,
      selfDriftMode: 'wave',
      hue: 155,
      colorPalette: 'neon',
      cursorMode: 'orbit',
      attractionForce: 0.22,
      attractionRadius: 180,
      shadowBlur: 0,
      pulsate: false,
      backgroundMode: 'gradient',
      backgroundColor: '#061a22',
      backgroundGradientStrength: 0.6,
      auroraEnabled: true,
      auroraIntensity: 0.48,
      auroraSpeed: 0.7,
    }),
    fireworks: createPreset('Fireworks', {
      particleCount: 65,
      particleSize: 3,
      particleShape: 'star',
      speedMultiplier: 0.65,
      selfDriftEnabled: true,
      selfDriftIntensity: 0.12,
      selfDriftSpeed: 0.55,
      selfDriftMode: 'spiralIndividual',
      colorPalette: 'custom',
      customColor1: '#fbbf24',
      customColor2: '#fb7185',
      customColor3: '#a78bfa',
      cursorMode: 'repel',
      attractionForce: 0.86,
      attractionRadius: 150,
      pulsate: true,
      backgroundMode: 'solid',
      backgroundColor: '#10051d',
      explosionEnabled: true,
      explosionCount: 150,
      explosionSpeed: 15,
      explosionLifetime: 1200,
      explosionSize: 4,
      explosionMode: 'spawn',
      trailEnabled: true,
      trailLength: 15,
    }),
  });

  ParticleSystem.userConfig = { ...ParticleSystem.DEFAULT_CONFIG };
  ParticleSystem.runtimeOverrides = {};
  ParticleSystem.config = new Proxy(ParticleSystem.userConfig, {
    get(target, key) {
      if (Object.prototype.hasOwnProperty.call(ParticleSystem.runtimeOverrides, key)) {
        return ParticleSystem.runtimeOverrides[key];
      }
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(ParticleSystem.runtimeOverrides, key)) {
        delete ParticleSystem.runtimeOverrides[key];
      }
      return Reflect.set(target, key, value);
    },
    deleteProperty(target, key) {
      if (typeof key === 'string') {
        delete ParticleSystem.runtimeOverrides[key];
      }
      return Reflect.deleteProperty(target, key);
    },
  });

  ParticleSystem.getSerializableConfig = function getSerializableConfig() {
    return Object.keys(ParticleSystem.DEFAULT_CONFIG).reduce((result, key) => {
      result[key] = ParticleSystem.userConfig[key];
      return result;
    }, {});
  };

  ParticleSystem.clearRuntimeOverrides = function clearRuntimeOverrides() {
    ParticleSystem.runtimeOverrides = {};
  };

  ParticleSystem.clearRuntimeOverrideForKey = function clearRuntimeOverrideForKey(key) {
    if (!key || typeof key !== 'string') return;
    delete ParticleSystem.runtimeOverrides[key];
  };

  /* ── Settings persistence ── */

  ParticleSystem.getSceneSettings = function getSceneSettings() {
    return Object.keys(ParticleSystem.DEFAULT_CONFIG).map((key) => ParticleSystem.getSerializableConfig()[key]);
  };

  ParticleSystem.encodeScene = function encodeScene() {
    try {
      const payload = JSON.stringify([
        CONSTANTS.SCENE_VERSION,
        ParticleSystem.getSceneSettings(),
      ]);
      return window.btoa(payload)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch (error) {
      console.warn('Не удалось подготовить ссылку на сцену:', error);
      return null;
    }
  };

  ParticleSystem.getSceneUrl = function getSceneUrl() {
    const encodedScene = ParticleSystem.encodeScene();
    if (!encodedScene || !window.location) return null;

    const url = new URL(window.location.href);
    url.hash = `${CONSTANTS.SCENE_HASH_PARAM}=${encodedScene}`;
    return url.href;
  };

  ParticleSystem.readNumberSetting = function readNumberSetting(key, value) {
    const input = ParticleSystem.getSettingControl
      ? ParticleSystem.getSettingControl(key)
      : null;
    const number = Number(value);
    if (!Number.isFinite(number)) return ParticleSystem.DEFAULT_CONFIG[key];

    const min = input ? Number(input.min) : NaN;
    const max = input ? Number(input.max) : NaN;
    return ParticleSystem.clamp(
      number,
      Number.isFinite(min) ? min : number,
      Number.isFinite(max) ? max : number
    );
  };

  ParticleSystem.readStoredSetting = function readStoredSetting(key, value) {
    const defaultValue = ParticleSystem.DEFAULT_CONFIG[key];
    if (typeof defaultValue === 'boolean') {
      return typeof value === 'boolean' ? value : defaultValue;
    }
    if (key === 'colorPalette') {
      return Object.prototype.hasOwnProperty.call(COLOR_PALETTES, value)
        ? value
        : defaultValue;
    }
    if (key === 'performanceProfile') {
      return Object.prototype.hasOwnProperty.call(ParticleSystem.PERFORMANCE_PROFILES, value)
        ? value
        : defaultValue;
    }
    if (key === 'cursorMode') {
      return Object.prototype.hasOwnProperty.call(CURSOR_MODES, value)
        ? value
        : defaultValue;
    }
    if (key === 'selfDriftMode') {
      return ['random', 'horizontal', 'vertical', 'upDown', 'leftRight', 'up', 'down', 'left', 'right', 'directional', 'orbit', 'orbitGlobal', 'wave', 'flow', 'lissajous', 'vortex', 'spiral', 'spiralIndividual', 'snake'].includes(value)
        ? value
        : defaultValue;
    }
    if (key === 'pointerTrailShape') {
      return ['circle', 'square', 'triangle', 'diamond', 'star', 'ring', 'heart', 'drop', 'cross'].includes(value)
        ? value
        : defaultValue;
    }
    if (key === 'backgroundMode') {
      return ['solid', 'gradient', 'transparent'].includes(value) ? value : defaultValue;
    }
    if (key === 'backgroundColor' || key === 'trailColor' || key === 'connectionColor') {
      return ParticleSystem.isValidHexColor(value) ? value : defaultValue;
    }
    if (key.startsWith('customColor')) {
      return ParticleSystem.isValidHexColor(value) ? value : defaultValue;
    }
    if (typeof defaultValue === 'string') {
      return typeof value === 'string' ? value : defaultValue;
    }
    return ParticleSystem.readNumberSetting(key, value);
  };

  ParticleSystem.decodeScene = function decodeScene(encodedScene) {
    if (typeof encodedScene !== 'string'
      || !encodedScene
      || encodedScene.length > CONSTANTS.SCENE_MAX_LENGTH
      || !/^[A-Za-z0-9_-]+$/.test(encodedScene)) return null;

    try {
      const base64 = encodedScene.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decoded = JSON.parse(window.atob(padded));
      const keys = Object.keys(ParticleSystem.DEFAULT_CONFIG);
      const missingSettings = keys.length - decoded[1]?.length;
      if (!Array.isArray(decoded) || decoded.length !== 2
        || decoded[0] !== CONSTANTS.SCENE_VERSION || !Array.isArray(decoded[1])
        || missingSettings < 0 || missingSettings > 2) return null;

      const settings = {};
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        const value = index < decoded[1].length
          ? decoded[1][index]
          : ParticleSystem.DEFAULT_CONFIG[key];
        const defaultValue = ParticleSystem.DEFAULT_CONFIG[key];
        const input = ParticleSystem.getSettingControl ? ParticleSystem.getSettingControl(key) : null;
        const isNumberInRange = typeof defaultValue !== 'number' || (typeof value === 'number'
          && Number.isFinite(value)
          && (!input || value >= Number(input.min))
          && (!input || value <= Number(input.max)));
        if (!isNumberInRange || ParticleSystem.readStoredSetting(key, value) !== value) return null;
        settings[key] = value;
      }
      return settings;
    } catch (error) {
      return null;
    }
  };

  ParticleSystem.loadSceneFromUrl = function loadSceneFromUrl() {
    if (!window.location) return false;
    const hash = window.location.hash.replace(/^#/, '');
    const encodedScene = new URLSearchParams(hash).get(CONSTANTS.SCENE_HASH_PARAM);
    const settings = ParticleSystem.decodeScene(encodedScene);
    if (!settings) {
      if (encodedScene) console.warn('Ссылка на сцену имеет некорректный формат.');
      return false;
    }
Object.assign(ParticleSystem.userConfig, settings);
      ParticleSystem.clearRuntimeOverrides();
      return true;
    };

  ParticleSystem.loadSavedSettings = function loadSavedSettings() {
    try {
      const savedSettings = window.localStorage.getItem(CONSTANTS.STORAGE_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings && typeof parsedSettings === 'object') {
          Object.keys(ParticleSystem.DEFAULT_CONFIG).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(parsedSettings, key)) {
              ParticleSystem.userConfig[key] = ParticleSystem.readStoredSetting(key, parsedSettings[key]);
            }
          });
        }
      }

      // Восстанавливаем «последнюю изменённую тяжёлую настройку», чтобы после
      // перезагрузки система снова приоритетно снижала именно её, а не переходила
      // к particleCount по порядку списка.
      ParticleSystem.restoreAdaptivePriorityKey();

      ParticleSystem.clearRuntimeOverrides();
    } catch (error) {
      console.warn('Не удалось загрузить настройки:', error);
    }
  };

  ParticleSystem.saveSettings = function saveSettings() {
    try {
      window.localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(ParticleSystem.getSerializableConfig()));
      ParticleSystem.persistAdaptivePriorityKey();
    } catch (error) {
      console.warn('Не удалось сохранить настройки:', error);
    }
  };

  ParticleSystem.persistAdaptivePriorityKey = function persistAdaptivePriorityKey() {
    try {
      const key = ParticleSystem.adaptiveQualityState
        ? ParticleSystem.adaptiveQualityState.lastHeavySettingKey
        : null;
      if (key && ParticleSystem.ADAPTIVE_QUALITY_ORDER && ParticleSystem.ADAPTIVE_QUALITY_ORDER.includes(key)) {
        window.localStorage.setItem(CONSTANTS.STORAGE_KEY_PRIORITY, key);
      } else {
        window.localStorage.removeItem(CONSTANTS.STORAGE_KEY_PRIORITY);
      }
    } catch (error) {
      console.warn('Не удалось сохранить приоритет адаптивного качества:', error);
    }
  };

  ParticleSystem.restoreAdaptivePriorityKey = function restoreAdaptivePriorityKey() {
    try {
      const stored = window.localStorage.getItem(CONSTANTS.STORAGE_KEY_PRIORITY);
      if (
        stored &&
        ParticleSystem.ADAPTIVE_QUALITY_ORDER &&
        ParticleSystem.ADAPTIVE_QUALITY_ORDER.includes(stored)
      ) {
        if (!ParticleSystem.adaptiveQualityState) {
          if (typeof ParticleSystem.resetAdaptiveQualityState === 'function') {
            ParticleSystem.resetAdaptiveQualityState();
          } else {
            ParticleSystem.adaptiveQualityState = {};
          }
        }
        ParticleSystem.adaptiveQualityState.lastHeavySettingKey = stored;
      }
    } catch (error) {
      console.warn('Не удалось восстановить приоритет адативного качества:', error);
    }
  };

  ParticleSystem.clearSavedSettings = function clearSavedSettings() {
    try {
      window.localStorage.removeItem(CONSTANTS.STORAGE_KEY);
      window.localStorage.removeItem(CONSTANTS.STORAGE_KEY_PRIORITY);
    } catch (error) {
      console.warn('Не удалось сбросить сохранённые настройки:', error);
    }
  };
})();
