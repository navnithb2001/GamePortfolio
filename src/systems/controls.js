// Unifies keyboard, touch buttons, and scroll wheel into a single throttle.
export function createControls({ onFirstInput }) {
  let fwd = false;
  let back = false;
  let wheelImpulse = 0;
  let manualFlag = false;
  let announced = false;

  const announce = () => {
    manualFlag = true;
    if (!announced) {
      announced = true;
      onFirstInput?.();
    }
  };

  const keyMap = (code) =>
    code === 'ArrowUp' || code === 'KeyW' ? 'fwd' : code === 'ArrowDown' || code === 'KeyS' ? 'back' : null;

  window.addEventListener('keydown', (e) => {
    const dir = keyMap(e.code);
    if (!dir) return;
    e.preventDefault();
    if (dir === 'fwd') fwd = true;
    else back = true;
    announce();
  });
  window.addEventListener('keyup', (e) => {
    const dir = keyMap(e.code);
    if (dir === 'fwd') fwd = false;
    else if (dir === 'back') back = false;
  });
  window.addEventListener('blur', () => {
    fwd = back = false;
  });

  const bindButton = (id, set) => {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      set(true);
      announce();
    };
    const release = () => set(false);
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  bindButton('btn-fwd', (v) => (fwd = v));
  bindButton('btn-back', (v) => (back = v));

  window.addEventListener(
    'wheel',
    (e) => {
      wheelImpulse += e.deltaY * 0.012;
      announce();
    },
    { passive: true }
  );

  return {
    getThrottle: () => (fwd ? 1 : 0) - (back ? 1 : 0),
    consumeWheelImpulse: () => {
      const i = wheelImpulse;
      wheelImpulse = 0;
      return i;
    },
    // True once per check when the user gave any direct input (cancels autopilot).
    consumeManualFlag: () => {
      const f = manualFlag;
      manualFlag = false;
      return f;
    }
  };
}
