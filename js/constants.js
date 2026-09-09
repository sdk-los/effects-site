/* ── Constants ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem } = window;

  ParticleSystem.CONSTANTS = Object.freeze({
    MOUSE_OUT_OF_BOUNDS: -1000,
    FRICTION: 0.98,
    PULSATION_SPEED: 0.002,
    PULSATION_AMPLITUDE: 0.5,
    SIZE_VARIANCE: 2,
    HUE_VARIANCE: 30,
    SPEED_VARIANCE: 1.5,
    DENSITY_DIVISOR: 5,
    TAU: 2 * Math.PI,
    CSS_OPEN_CLASS: 'open',
    CSS_VISIBLE_CLASS: 'visible',
    ATTR_SETTING: 'data-setting',
    ATTR_DISPLAY: 'data-display',
    ATTR_PRESET: 'data-preset',
    STORAGE_KEY: 'particleSystemSettings',
    STORAGE_KEY_PRIORITY: 'particleSystemAdaptivePriority',
    SCENE_HASH_PARAM: 'scene',
    SCENE_VERSION: 1,
    SCENE_MAX_LENGTH: 2048,
    SELECTOR_TOGGLE_LABEL: '.toggle-label',
    SELECTOR_CONTROL_GROUP: '.control-group',
    HSL_SATURATION: '100%',
    HSL_LIGHTNESS: '50%',
    PALETTE_HUE_VARIANCE: 10,
    HEX_COLOR_PATTERN: /^#[0-9a-f]{6}$/i,
    FPS_UPDATE_INTERVAL: 500,
    ORBIT_TANGENTIAL_FORCE: 0.85,
    ORBIT_RADIAL_BALANCE: 0.2,
    /* ── Взрывы по клику ── */
    EXPLOSION_COUNT: 30,
    EXPLOSION_SPEED: 6,
    EXPLOSION_LIFETIME: 1000,
    EXPLOSION_SIZE: 4,
    EXPLOSION_FADE_OUT: 0.97,
  });

  ParticleSystem.COLOR_PALETTES = Object.freeze({
    mono: { label: 'Монохромная', hues: [] },
    cool: { label: 'Холодная', hues: [185, 205, 225, 255] },
    warm: { label: 'Тёплая', hues: [18, 34, 48, 358] },
    neon: { label: 'Неоновая', hues: [130, 185, 292, 318] },
    rainbow: { label: 'Радужная', hues: [0, 45, 90, 150, 205, 265, 315] },
    speed: { label: 'Цвет от скорости', hues: [] },
    custom: { label: 'Пользовательская', hues: [] },
  });

  ParticleSystem.CURSOR_MODES = Object.freeze({
    attract: 'Притяжение',
    repel: 'Отталкивание',
    orbit: 'Орбита',
    trail: 'След',
  });
})();
