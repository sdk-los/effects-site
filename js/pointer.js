/* ── Pointer tracking ── */
window.ParticleSystem = window.ParticleSystem || {};

(function () {
  const { ParticleSystem, ParticleSystem: { CONSTANTS, config } } = window;

  ParticleSystem.mouseX = -1000;
  ParticleSystem.mouseY = -1000;
  ParticleSystem.pointerTrails = [];
  ParticleSystem.pointerResetTimeoutId = null;

  ParticleSystem.updatePointerPosition = function updatePointerPosition(clientX, clientY) {
    const canvas = document.getElementById('particle-canvas');
    const rect = canvas.getBoundingClientRect();
    if (ParticleSystem.pointerResetTimeoutId !== null) {
      window.clearTimeout(ParticleSystem.pointerResetTimeoutId);
      ParticleSystem.pointerResetTimeoutId = null;
    }
    ParticleSystem.mouseX = clientX - rect.left;
    ParticleSystem.mouseY = clientY - rect.top;
    ParticleSystem.addPointerTrailPoint();
  };

  ParticleSystem.schedulePointerReset = function schedulePointerReset(delay = 250) {
    if (ParticleSystem.pointerResetTimeoutId !== null) {
      window.clearTimeout(ParticleSystem.pointerResetTimeoutId);
    }
    ParticleSystem.pointerResetTimeoutId = window.setTimeout(() => {
      ParticleSystem.pointerResetTimeoutId = null;
      ParticleSystem.resetPointerPosition();
    }, delay);
  };

  ParticleSystem.resetPointerPosition = function resetPointerPosition() {
    if (ParticleSystem.pointerResetTimeoutId !== null) {
      window.clearTimeout(ParticleSystem.pointerResetTimeoutId);
      ParticleSystem.pointerResetTimeoutId = null;
    }
    ParticleSystem.mouseX = CONSTANTS.MOUSE_OUT_OF_BOUNDS;
    ParticleSystem.mouseY = CONSTANTS.MOUSE_OUT_OF_BOUNDS;
  };

  ParticleSystem.isPointerActive = function isPointerActive() {
    return (
      ParticleSystem.mouseX !== CONSTANTS.MOUSE_OUT_OF_BOUNDS &&
      ParticleSystem.mouseY !== CONSTANTS.MOUSE_OUT_OF_BOUNDS
    );
  };

  ParticleSystem.addPointerTrailPoint = function addPointerTrailPoint() {
    if (
      !config.cursorInteractionEnabled ||
      config.cursorMode !== 'trail' ||
      !ParticleSystem.isPointerActive()
    ) return;

    const lastPoint = ParticleSystem.pointerTrails[ParticleSystem.pointerTrails.length - 1];
    if (lastPoint) {
      const dx = ParticleSystem.mouseX - lastPoint.x;
      const dy = ParticleSystem.mouseY - lastPoint.y;
      if (dx * dx + dy * dy < config.pointerTrailMinDistance ** 2) return;
    }

    ParticleSystem.pointerTrails.push({
      x: ParticleSystem.mouseX,
      y: ParticleSystem.mouseY,
      createdAt: performance.now(),
      color: ParticleSystem.getParticleColor(),
    });

    if (ParticleSystem.pointerTrails.length > config.pointerTrailMaxPoints) {
      ParticleSystem.pointerTrails.splice(0, ParticleSystem.pointerTrails.length - config.pointerTrailMaxPoints);
    }
  };
})();
