const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const constantsSource = fs.readFileSync(path.join(root, 'js', 'constants.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'js', 'renderer.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadSystem({ mobile = false } = {}) {
  const context = {
    window: {
      innerWidth: mobile ? 390 : 1440,
      matchMedia: () => ({ matches: mobile }),
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  context.window.window = context.window;
  context.window.ParticleSystem = {
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    getSettingControl: () => null,
    isValidHexColor: (value) => /^#[0-9a-f]{6}$/i.test(value),
  };
  vm.createContext(context);
  vm.runInContext(constantsSource, context);
  vm.runInContext(configSource, context);
  return { context, ParticleSystem: context.window.ParticleSystem };
}

test('performance profiles expose safe desktop and mobile limits and clamp expensive settings', () => {
  const { ParticleSystem } = loadSystem();
  const { PERFORMANCE_PROFILES, config } = ParticleSystem;

  assert.equal(PERFORMANCE_PROFILES.unlimited.label, 'Без ограничений');
  assert.equal(PERFORMANCE_PROFILES.economy.label, 'Экономный');
  assert.equal(PERFORMANCE_PROFILES.balanced.label, 'Сбалансированный');
  assert.equal(PERFORMANCE_PROFILES.maximum.label, 'Максимальный');

  config.performanceProfile = 'economy';
  config.particleCount = 5000;
  config.connectionDistance = 300;
  config.connectionWidth = 4;
  config.connectionOpacity = 1;
  config.trailLength = 30;
  config.shadowBlur = 100;
  config.bloom = 1;
  assert.equal(ParticleSystem.clampConfigToPerformanceProfile(), true);
  assert.deepEqual(
    {
      particleCount: config.particleCount,
      connectionDistance: config.connectionDistance,
      connectionWidth: config.connectionWidth,
      connectionOpacity: config.connectionOpacity,
      trailLength: config.trailLength,
      shadowBlur: config.shadowBlur,
      bloom: config.bloom,
    },
    {
      particleCount: PERFORMANCE_PROFILES.economy.desktop.particleCount,
      connectionDistance: PERFORMANCE_PROFILES.economy.desktop.connectionDistance,
      connectionWidth: PERFORMANCE_PROFILES.economy.desktop.connectionWidth,
      connectionOpacity: PERFORMANCE_PROFILES.economy.desktop.connectionOpacity,
      trailLength: PERFORMANCE_PROFILES.economy.desktop.trailLength,
      shadowBlur: PERFORMANCE_PROFILES.economy.desktop.shadowBlur,
      bloom: PERFORMANCE_PROFILES.economy.desktop.bloom,
    }
  );
  assert.equal(ParticleSystem.readStoredSetting('performanceProfile', 'invalid'), 'balanced');

  config.performanceProfile = 'unlimited';
  config.particleCount = 5000;
  config.connectionDistance = 300;
  config.connectionWidth = 5;
  config.connectionOpacity = 1;
  config.trailLength = 30;
  config.shadowBlur = 50;
  assert.equal(ParticleSystem.clampConfigToPerformanceProfile(), false);
  assert.equal(ParticleSystem.getPerformanceLimits().pixelRatio, Infinity);
});

test('mobile profiles use lower limits and canvas DPR is capped by the profile', () => {
  const { context, ParticleSystem } = loadSystem({ mobile: true });
  ParticleSystem.config.performanceProfile = 'maximum';
  assert.equal(ParticleSystem.getPerformanceLimits().particleCount, 750);
  assert.equal(ParticleSystem.getPerformanceLimits().pixelRatio, 1.5);

  const canvas = {};
  const transforms = [];
  context.window.devicePixelRatio = 3;
  context.document = { getElementById: () => canvas };
  ParticleSystem.ctx = { setTransform: (...values) => transforms.push(values) };
  vm.runInContext(rendererSource, context);
  ParticleSystem.ctx = { setTransform: (...values) => transforms.push(values) };
  ParticleSystem.resizeCanvas();

  assert.equal(canvas.width, 390 * 1.5);
  assert.deepEqual(transforms, [[1.5, 0, 0, 1.5, 0, 0]]);
});

test('performance profile control is available in the settings panel', () => {
  assert.match(indexHtml, /data-setting="performanceProfile"/);
  assert.match(indexHtml, />Без ограничений</);
  assert.match(indexHtml, />Экономный</);
  assert.match(indexHtml, />Сбалансированный</);
  assert.match(indexHtml, />Максимальный</);
});
