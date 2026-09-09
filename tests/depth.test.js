const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const sources = ['constants.js', 'config.js', 'utils.js', 'particle.js'].map((file) =>
  fs.readFileSync(path.join(root, 'js', file === 'particle.js' ? 'particle.js' : file), 'utf8')
);

function loadSystem() {
  const context = {
    window: {
      innerWidth: 1200,
      innerHeight: 800,
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    },
    performance: { now: () => 0 },
  };
  context.window.window = context.window;
  context.window.ParticleSystem = {};
  vm.createContext(context);
  sources.forEach((source) => vm.runInContext(source, context));
  const { ParticleSystem } = context.window;
  ParticleSystem.canvasBounds = { width: 1200, height: 800 };
  ParticleSystem.isPointerActive = () => false;
  return ParticleSystem;
}

test('depth render state makes nearer particles larger and brighter', () => {
  const ParticleSystem = loadSystem();
  const { config, Particle } = ParticleSystem;
  config.depthEnabled = true;
  config.depthStrength = 1;
  config.parallaxStrength = 24;
  config.shadowBlur = 20;

  const far = new Particle(100, 100);
  const near = new Particle(100, 100);
  far.depth = 0;
  near.depth = 1;

  const farState = far.getRenderState();
  const nearState = near.getRenderState();

  assert.ok(nearState.size > farState.size);
  assert.ok(nearState.opacity > farState.opacity);
  assert.ok(nearState.shadowBlur > farState.shadowBlur);
});

test('depth settings are exposed in the default configuration and panel', () => {
  const configSource = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(configSource, /depthEnabled: false/);
  assert.match(configSource, /depthStrength: 0\.65/);
  assert.match(configSource, /bloom: 0/);
  assert.match(indexHtml, /<span>Эффекты<\/span>[\s\S]*data-setting="shadowBlur"/);
  assert.match(indexHtml, /<span>Эффекты<\/span>[\s\S]*data-setting="bloom"/);
  assert.match(indexHtml, /<span>Эффекты<\/span>[\s\S]*data-setting="depthEnabled"/);
  assert.match(indexHtml, /<span class="section-hint">Нагрузка и FPS<\/span>/);
  assert.match(indexHtml, /data-setting="depthEnabled"/);
  assert.match(indexHtml, /data-setting="parallaxStrength"/);
  assert.match(indexHtml, /data-depth-setting hidden/);
  assert.match(indexHtml, /Что такое сила глубины\?/);
  assert.match(indexHtml, /Что такое сила параллакса\?/);
  assert.match(indexHtml, /Что такое скорость глубины\?/);
});
