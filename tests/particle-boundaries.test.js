const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const particleSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'particle.js'), 'utf8');

function loadParticleSystem(bounce) {
  const context = {
    window: {},
    performance: { now: () => 1000 },
    Date,
  };
  context.window = context;
  context.window.ParticleSystem = {
    CONSTANTS: {
      SIZE_VARIANCE: 0,
      HUE_VARIANCE: 0,
      SPEED_VARIANCE: 0,
      TAU: Math.PI * 2,
      FRICTION: 1,
      PULSATION_SPEED: 0,
      PULSATION_AMPLITUDE: 0,
      ORBIT_TANGENTIAL_FORCE: 1,
      ORBIT_RADIAL_BALANCE: 1,
    },
    config: {
      particleSize: 4,
      particleShape: 'circle',
      hue: 0,
      speedMultiplier: 1,
      velocityStretchEnabled: false,
      velocityStretchStrength: 1.5,
      shadowBlur: 0,
      trailLength: 10,
      trailEnabled: true,
      trailOpacity: 0.4,
      trailColor: '#123456',
      bounce,
      selfDriftEnabled: false,
      cursorInteractionEnabled: false,
      pulsate: false,
    },
    canvasBounds: { width: 100, height: 80 },
    randomBetween: () => 0,
    getParticleColor: () => '#fff',
    hexToRgb: (hex) => [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ],
    distance: () => 0,
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    isPointerActive: () => false,
  };

  vm.createContext(context);
  vm.runInContext(particleSource, context);
  return context.window.ParticleSystem;
}

test('wrapping a particle clears its trail to prevent a line across the canvas', () => {
  const ParticleSystem = loadParticleSystem(false);
  const particle = new ParticleSystem.Particle(99, 40);
  particle.trail = [{ x: 92, y: 40 }, { x: 99, y: 40 }];
  particle.x = 101;

  particle.handleBoundaries();

  assert.equal(particle.x, 0);
  assert.equal(particle.trail.length, 0);
});

test('bouncing a particle preserves its continuous trail', () => {
  const ParticleSystem = loadParticleSystem(true);
  const particle = new ParticleSystem.Particle(99, 40);
  particle.trail = [{ x: 92, y: 40 }, { x: 99, y: 40 }];
  particle.x = 101;

  particle.handleBoundaries();

  assert.equal(particle.x, 100);
  assert.deepEqual(particle.trail, [{ x: 92, y: 40 }, { x: 99, y: 40 }]);
});

test('particle trails use their configured color and opacity', () => {
  const ParticleSystem = loadParticleSystem(true);
  const strokeStyles = [];
  ParticleSystem.ctx = {
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    arc: () => {}, fill: () => {},
    set strokeStyle(value) { strokeStyles.push(value); },
  };
  const particle = new ParticleSystem.Particle(50, 40);
  particle.trail = [{ x: 45, y: 40 }, { x: 50, y: 40 }];

  particle.draw();

  assert.deepEqual(strokeStyles, ['rgba(18, 52, 86, 0.4)']);
});

test('enabled particle repulsion pushes a nearby particle away', () => {
  const ParticleSystem = loadParticleSystem(true);
  ParticleSystem.config.particleRepulsionEnabled = true;
  ParticleSystem.config.particleRepulsionStrength = 0.6;
  ParticleSystem.config.particleRepulsionRadius = 20;

  const particle = new ParticleSystem.Particle(50, 40);
  const neighbor = new ParticleSystem.Particle(55, 40);
  ParticleSystem.particles = [particle, neighbor];

  particle.applyParticleRepulsion();

  assert.ok(particle.vx < 0);
  assert.equal(particle.vy, 0);
});

test('disabled particle repulsion leaves velocity unchanged', () => {
  const ParticleSystem = loadParticleSystem(true);
  const particle = new ParticleSystem.Particle(50, 40);
  const neighbor = new ParticleSystem.Particle(55, 40);
  ParticleSystem.particles = [particle, neighbor];

  particle.applyParticleRepulsion();

  assert.equal(particle.vx, 0);
  assert.equal(particle.vy, 0);
});

test('velocity stretch aligns the particle with its velocity and restores the canvas', () => {
  const ParticleSystem = loadParticleSystem(true);
  ParticleSystem.config.velocityStretchEnabled = true;
  const calls = [];
  ParticleSystem.ctx = {
    save: () => calls.push('save'),
    translate: (...values) => calls.push(['translate', ...values]),
    rotate: (value) => calls.push(['rotate', value]),
    scale: (...values) => calls.push(['scale', ...values]),
    restore: () => calls.push('restore'),
    beginPath: () => {}, arc: () => {}, fill: () => {},
  };
  const particle = new ParticleSystem.Particle(50, 40);
  particle.vx = 2;
  particle.vy = 2;

  particle.draw();

  assert.deepEqual(calls, [
    'save',
    ['translate', 50, 40],
    ['rotate', Math.PI / 4],
    ['scale', 4, 0.5],
    'restore',
  ]);
});

test('velocity stretch falls back to the normal shape for a stopped particle', () => {
  const ParticleSystem = loadParticleSystem(true);
  ParticleSystem.config.velocityStretchEnabled = true;
  const calls = [];
  ParticleSystem.drawShape = (...args) => calls.push(args);
  ParticleSystem.ctx = {};
  const particle = new ParticleSystem.Particle(50, 40);

  particle.draw();

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1), [50, 40, 4, 'circle']);
});
