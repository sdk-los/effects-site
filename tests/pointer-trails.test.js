const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const pointerSource = fs.readFileSync(path.join(root, 'js', 'pointer.js'), 'utf8');
const particleSource = fs.readFileSync(path.join(root, 'js', 'particle.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'js', 'renderer.js'), 'utf8');
const constantsSource = fs.readFileSync(path.join(root, 'js', 'constants.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadPointerSystem() {
  let now = 1000;
  const context = {
    window: {},
    performance: { now: () => now },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
    },
  };
  context.window = context;
  context.window.ParticleSystem = {
    CONSTANTS: { MOUSE_OUT_OF_BOUNDS: -1000 },
    config: {
      cursorInteractionEnabled: true,
      cursorMode: 'trail',
      pointerTrailMinDistance: 8,
      pointerTrailMaxPoints: 120,
    },
    getParticleColor: () => '#abcdef',
  };
  vm.createContext(context);
  vm.runInContext(pointerSource, context);
  return { ParticleSystem: context.window.ParticleSystem, setNow: (value) => { now = value; } };
}

test('pointer trail honours density, master cursor toggle, and point cap', () => {
  const { ParticleSystem, setNow } = loadPointerSystem();
  ParticleSystem.mouseX = 0;
  ParticleSystem.mouseY = 0;
  ParticleSystem.addPointerTrailPoint();
  ParticleSystem.mouseX = 7;
  ParticleSystem.addPointerTrailPoint();
  ParticleSystem.mouseX = 8;
  ParticleSystem.addPointerTrailPoint();

  assert.equal(ParticleSystem.pointerTrails.length, 2);
  assert.equal(ParticleSystem.pointerTrails[0].createdAt, 1000);

  ParticleSystem.config.cursorInteractionEnabled = false;
  ParticleSystem.mouseX = 20;
  ParticleSystem.addPointerTrailPoint();
  assert.equal(ParticleSystem.pointerTrails.length, 2);

  ParticleSystem.config.cursorInteractionEnabled = true;
  ParticleSystem.config.pointerTrailMinDistance = 2;
  for (let index = 0; index < 125; index += 1) {
    setNow(1001 + index);
    ParticleSystem.mouseX = 30 + index * 2;
    ParticleSystem.addPointerTrailPoint();
  }
  assert.equal(ParticleSystem.pointerTrails.length, 120);
});

test('disabling cursor interaction clears the active pointer trail', () => {
  const context = { window: {}, performance: { now: () => 0 }, Date };
  context.window = context;
  context.window.ParticleSystem = {
    CONSTANTS: {},
    config: { cursorMode: 'trail', cursorInteractionEnabled: false },
    pointerTrails: [{ x: 10, y: 10, createdAt: 0 }],
  };
  vm.createContext(context);
  vm.runInContext(particleSource, context);

  context.window.ParticleSystem.syncCursorMode();
  assert.equal(context.window.ParticleSystem.pointerTrails.length, 0);
});

test('pointer trail lifetime removes expired points and draws each remaining point as a cached sprite', () => {
  const blits = [];
  const context = {
    window: { innerWidth: 100, innerHeight: 100 },
  };
  context.window.window = context.window;
  context.window.ParticleSystem = {
    config: { pointerTrailLifetime: 700, pointerTrailSize: 20, pointerTrailShape: 'star' },
    pointerTrails: [
      { x: 1, y: 2, createdAt: 100, color: '#111111' },
      { x: 3, y: 4, createdAt: 500, color: '#222222' },
    ],
    getPointerTrailSprite: (color) => ({ canvas: { width: 40 }, baseRadius: 20 }),
    ctx: {
      save: () => {}, restore: () => {},
      set globalAlpha(value) {}, set fillStyle(value) {}, set shadowColor(value) {}, set shadowBlur(value) {},
      drawImage: (canvas, x, y, width, height) => blits.push({ canvas, x, y, width, height }),
    },
  };
  vm.createContext(context);
  vm.runInContext(rendererSource, context);
  context.window.ParticleSystem.getPointerTrailSprite = () => ({ canvas: { width: 40 }, baseRadius: 20 });
  context.window.ParticleSystem.ctx = {
    save: () => {}, restore: () => {},
    set globalAlpha(value) {}, set fillStyle(value) {}, set shadowColor(value) {}, set shadowBlur(value) {},
    drawImage: (canvas, x, y, width, height) => blits.push({ canvas, x, y, width, height }),
  };

  context.window.ParticleSystem.drawPointerTrails(1000);

  const scale = (1 - 500 / 700);
  const drawSize = 40 * scale;
  assert.equal(context.window.ParticleSystem.pointerTrails.length, 1);
  assert.equal(blits.length, 1);
  assert.equal(blits[0].x, 3 - drawSize / 2);
  assert.equal(blits[0].y, 4 - drawSize / 2);
  assert.equal(blits[0].width, drawSize);
  assert.equal(blits[0].height, drawSize);
});

test('trail shape sprites are cached per shape/color and reused without rebuilding paths', () => {
  const shapes = [];
  const context = {
    window: { innerWidth: 100, innerHeight: 100 },
  };
  context.window.window = context.window;
  context.window.ParticleSystem = {
    config: { pointerTrailSize: 20, pointerTrailShape: 'star', shadowBlur: 10 },
    drawShape: (ctx, x, y, radius, shape) => shapes.push(shape),
  };
  context.document = {
    createElement: (tag) => ({
      getContext: () => ({
        save: () => {}, restore: () => {},
        set fillStyle(value) {}, set shadowColor(value) {}, set shadowBlur(value) {},
      }),
    }),
  };
  vm.createContext(context);
  vm.runInContext(rendererSource, context);
  const { ParticleSystem } = context.window;

  const first = ParticleSystem.getPointerTrailSprite('#abcdef');
  const second = ParticleSystem.getPointerTrailSprite('#abcdef');
  const otherColor = ParticleSystem.getPointerTrailSprite('#000000');

  assert.equal(first, second);
  assert.notEqual(first, otherColor);
  assert.deepEqual(shapes, ['star', 'star']);
});

test('trail settings are configurable, range-normalized, and present in every preset', () => {
  let savedSettings = null;
  const controlRanges = {
    pointerTrailLifetime: { min: '150', max: '5000' },
    pointerTrailSize: { min: '6', max: '50' },
    pointerTrailMinDistance: { min: '2', max: '30' },
    pointerTrailMaxPoints: { min: '10', max: '500' },
  };
  const context = {
    window: {},
    localStorage: {
      getItem: () => null,
      setItem: (_key, value) => { savedSettings = value; },
      removeItem: () => {},
    },
  };
  context.window = context;
  context.window.ParticleSystem = {
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    getSettingControl: (key) => controlRanges[key] || null,
    isValidHexColor: (value) => /^#[0-9a-f]{6}$/i.test(value),
  };
  vm.createContext(context);
  vm.runInContext(constantsSource, context);
  vm.runInContext(configSource, context);
  const { ParticleSystem } = context.window;

  assert.equal(ParticleSystem.readStoredSetting('pointerTrailLifetime', 50), 150);
  assert.equal(ParticleSystem.readStoredSetting('pointerTrailSize', 80), 50);
  assert.equal(ParticleSystem.readStoredSetting('pointerTrailMinDistance', 0), 2);
  assert.equal(ParticleSystem.readStoredSetting('pointerTrailMaxPoints', 600), 500);
  assert.equal(ParticleSystem.readStoredSetting('trailColor', '#12abef'), '#12abef');
  assert.equal(ParticleSystem.readStoredSetting('trailColor', 'blue'), '#ffffff');
  assert.equal(ParticleSystem.readStoredSetting('connectionColor', '#12abef'), '#12abef');
  assert.equal(ParticleSystem.readStoredSetting('connectionColor', 'blue'), '#ffffff');
  assert.equal(ParticleSystem.readStoredSetting('pointerTrailShape', 'star'), 'star');
  assert.equal(ParticleSystem.readStoredSetting('pointerTrailShape', 'arrow'), 'circle');
  ParticleSystem.config.pointerTrailLifetime = 1200;
  ParticleSystem.config.pointerTrailSize = 32;
  ParticleSystem.config.pointerTrailMinDistance = 4;
  ParticleSystem.config.pointerTrailMaxPoints = 240;
  ParticleSystem.config.trailColor = '#12abef';
  ParticleSystem.config.connectionColor = '#12abef';
  ParticleSystem.config.pointerTrailShape = 'heart';
  ParticleSystem.saveSettings();
  const persistedSettings = JSON.parse(savedSettings);
  assert.equal(persistedSettings.pointerTrailLifetime, 1200);
  assert.equal(persistedSettings.pointerTrailSize, 32);
  assert.equal(persistedSettings.pointerTrailMinDistance, 4);
  assert.equal(persistedSettings.pointerTrailMaxPoints, 240);
  assert.equal(persistedSettings.trailColor, '#12abef');
  assert.equal(persistedSettings.connectionColor, '#12abef');
  assert.equal(persistedSettings.pointerTrailShape, 'heart');
  Object.values(ParticleSystem.SETTINGS_PRESETS).forEach((preset) => {
    assert.deepEqual(Object.keys(preset.settings).sort(), Object.keys(ParticleSystem.DEFAULT_CONFIG).sort());
  });
  assert.match(indexHtml, /data-cursor-trail-setting/);
  assert.match(indexHtml, /data-setting="pointerTrailLifetime"/);
  assert.match(indexHtml, /data-setting="pointerTrailSize"/);
  assert.match(indexHtml, /data-setting="pointerTrailMinDistance"/);
  assert.match(indexHtml, /data-setting="pointerTrailMaxPoints"/);
  assert.match(indexHtml, /data-setting="trailColor"/);
  assert.match(indexHtml, /data-setting="connectionColor"/);
  assert.match(indexHtml, /data-setting="pointerTrailShape"/);
});

test('legacy scene links without trailColor load with the white default', () => {
  const context = {
    window: {},
    btoa: (value) => Buffer.from(value, 'utf8').toString('base64'),
    atob: (value) => Buffer.from(value, 'base64').toString('utf8'),
  };
  context.window = context;
  context.window.ParticleSystem = {
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    getSettingControl: () => null,
    isValidHexColor: (value) => /^#[0-9a-f]{6}$/i.test(value),
  };
  vm.createContext(context);
  vm.runInContext(constantsSource, context);
  vm.runInContext(configSource, context);
  const { ParticleSystem } = context.window;
  const legacyValues = Object.keys(ParticleSystem.DEFAULT_CONFIG)
    .slice(0, -2)
    .map((key) => ParticleSystem.DEFAULT_CONFIG[key]);
  const encoded = context.btoa(JSON.stringify([
    ParticleSystem.CONSTANTS.SCENE_VERSION,
    legacyValues,
  ])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  const settings = ParticleSystem.decodeScene(encoded);

  assert.equal(settings.trailColor, '#ffffff');
});
