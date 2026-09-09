/* ── Initialization ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, config } } = window;

  /* ── Event listeners ── */
  ParticleSystem.ignoreNextCanvasClick = false;

  ParticleSystem.setupCanvasMouseTracking = function setupCanvasMouseTracking() {
    const canvas = document.getElementById('particle-canvas');
    canvas.addEventListener('mousemove', (e) => {
      ParticleSystem.updatePointerPosition(e.clientX, e.clientY);
    });

    canvas.addEventListener('mouseleave', ParticleSystem.resetPointerPosition);
  };

  ParticleSystem.setupCanvasTouchTracking = function setupCanvasTouchTracking() {
    const canvas = document.getElementById('particle-canvas');

    canvas.addEventListener(
      'touchstart',
      (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        ParticleSystem.updatePointerPosition(touch.clientX, touch.clientY);
        ParticleSystem.ignoreNextCanvasClick = true;
        ParticleSystem.createExplosion(
          touch.clientX - canvas.getBoundingClientRect().left,
          touch.clientY - canvas.getBoundingClientRect().top
        );
      },
      { passive: true }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        ParticleSystem.updatePointerPosition(touch.clientX, touch.clientY);
      },
      { passive: true }
    );

    canvas.addEventListener('touchend', () => ParticleSystem.schedulePointerReset());
    canvas.addEventListener('touchcancel', ParticleSystem.resetPointerPosition);
  };

  ParticleSystem.setupWindowResize = function setupWindowResize() {
    window.addEventListener('resize', () => {
      ParticleSystem.resizeCanvas();
      ParticleSystem.createParticles();
    });
  };

  ParticleSystem.setupVisibilityHandling = function setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        ParticleSystem.stopAnimation();
      } else {
        ParticleSystem.startAnimation();
      }
    });
  };

  ParticleSystem.setupPanelEventListeners = function setupPanelEventListeners() {
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsClose = document.getElementById('settings-close');
    const settingsReset = document.getElementById('settings-reset');
    const copySceneLink = document.getElementById('copy-scene-link');
    const settingsOverlay = document.getElementById('settings-overlay');

    settingsToggle.addEventListener('click', ParticleSystem.toggleSettings);
    settingsClose.addEventListener('click', ParticleSystem.closeSettings);
    settingsReset.addEventListener('click', ParticleSystem.resetSettings);
    if (copySceneLink) copySceneLink.addEventListener('click', ParticleSystem.copySceneLink);
    settingsOverlay.addEventListener('click', ParticleSystem.closeSettings);
    document.addEventListener('keydown', (e) => {
      const panel = document.getElementById('settings-panel');
      if (e.key === 'Escape' && panel.classList.contains(CONSTANTS.CSS_OPEN_CLASS)) {
        e.preventDefault();
        ParticleSystem.closeSettings();
      }
    });

    document.addEventListener('keydown', (e) => {
      const panel = document.getElementById('settings-panel');
      if (e.key !== 'Tab' || !panel.classList.contains(CONSTANTS.CSS_OPEN_CLASS)) return;

      const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
      const focusableElements = Array.from(panel.querySelectorAll(focusableSelector)).filter((element) => {
        if (element.closest('[hidden]')) return false;
        const closedDetails = element.closest('details:not([open])');
        return !closedDetails || element === closedDetails.querySelector('summary');
      });
      if (!focusableElements.length) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  };

  ParticleSystem.setupCanvasClickExplosion = function setupCanvasClickExplosion() {
    const canvas = document.getElementById('particle-canvas');

    canvas.addEventListener('click', (e) => {
      if (ParticleSystem.ignoreNextCanvasClick) {
        ParticleSystem.ignoreNextCanvasClick = false;
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ParticleSystem.createExplosion(x, y);
    });
  };

  /* ── Orientation lock ── */
  ParticleSystem.lockOrientation = function lockOrientation() {
    if (!screen.orientation || typeof screen.orientation.lock !== 'function') return;

    const tryLock = () => {
      screen.orientation.lock('portrait-primary').catch(() => {
        // На мобильных браузерах блокировка часто отклоняется, если страница
        // открыта не в standalone/fullscreen режиме или в момент запуска.
        // Повторяем попытку позже, когда ориентация и состояние страницы станут стабильнее.
      });
    };

    tryLock();
    window.setTimeout(tryLock, 250);
  };

  ParticleSystem.setupOrientationLock = function setupOrientationLock() {
    const handleOrientationChange = () => ParticleSystem.lockOrientation();
    const handleFirstInteraction = () => ParticleSystem.lockOrientation();

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('pageshow', handleOrientationChange);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) ParticleSystem.lockOrientation();
    });

    window.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    ParticleSystem.lockOrientation();
  };

  /* ── Init ── */
  ParticleSystem.init = function init() {
    const canvas = document.getElementById('particle-canvas');
    ParticleSystem.ctx = canvas.getContext('2d');

    ParticleSystem.loadSavedSettings();
    ParticleSystem.loadSceneFromUrl();
    ParticleSystem.syncControlsFromConfig();
    ParticleSystem.resizeCanvas();
    ParticleSystem.createParticles();
    ParticleSystem.stopAnimation();
    ParticleSystem.startAnimation();
    ParticleSystem.bindSettings();
    ParticleSystem.setupCanvasMouseTracking();
    ParticleSystem.setupCanvasTouchTracking();
    ParticleSystem.setupCanvasClickExplosion();
    ParticleSystem.setupWindowResize();
    ParticleSystem.setupVisibilityHandling();
    ParticleSystem.setupPanelEventListeners();
    ParticleSystem.setupOrientationLock();
  };

  ParticleSystem.init();
})();
