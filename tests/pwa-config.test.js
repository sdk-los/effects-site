const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('manifest uses a base-relative start URL and standalone display', () => {
  assert.equal(manifest.name, 'ParticleFlow');
  assert.equal(manifest.short_name, 'ParticleFlow');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.display_override) && manifest.display_override.includes('standalone'));
  assert.equal(manifest.lang, 'ru');
  assert.equal(manifest.dir, 'ltr');
  assert.ok(manifest.theme_color);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
});

test('index.html exposes mobile PWA metadata and registers the service worker with a relative path', () => {
  assert.match(indexHtml, /<link rel="manifest" href="manifest\.json">/);
  assert.match(indexHtml, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(indexHtml, /<meta name="mobile-web-app-capable" content="yes">/);
  assert.match(indexHtml, /navigator\.serviceWorker\.register\(/);
  assert.match(indexHtml, /window\.location\.href/);
  assert.match(indexHtml, /updateViaCache:\s*'none'/);
  assert.match(indexHtml, /controllerchange/);
  assert.match(indexHtml, /visibilitychange/);
  assert.match(indexHtml, /class="app-version"[^>]*>v__APP_VERSION__<\/span>/);
});

test('deploy workflow injects the displayed application version', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy-pages.yml'), 'utf8');
  assert.match(workflow, /APP_VERSION:\s*1\.1\.0/);
  assert.match(workflow, /__APP_VERSION__/);
});

test('service worker uses a base-relative cache strategy for subpath hosting', () => {
  assert.match(serviceWorker, /const CACHE_NAME = 'particleflow-__BUILD_ID__';/);
  assert.match(serviceWorker, /new URL\(.*self\.location\.href/);
  assert.match(serviceWorker, /cache\.addAll\(/);
  assert.match(serviceWorker, /event\.request\.mode === 'navigate'/);
  assert.match(serviceWorker, /caches\.match\('\.\/index\.html'/);
});
