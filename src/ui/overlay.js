function hex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createOverlay(stationDefs, { onStopClick }) {
  const card = document.getElementById('card');
  const cardInner = document.getElementById('card-inner');
  const badge = document.getElementById('badge');
  const hint = document.getElementById('hint');
  const routeMap = document.getElementById('route-map');

  // Route map: a dot per station with progress-fill segments between them.
  const stops = [];
  const fills = [];
  stationDefs.forEach((def, i) => {
    if (i > 0) {
      const seg = document.createElement('div');
      seg.className = 'rm-segment';
      const fill = document.createElement('div');
      fill.className = 'rm-fill';
      seg.appendChild(fill);
      routeMap.appendChild(seg);
      fills.push(fill);
    }
    const stop = document.createElement('button');
    stop.className = 'rm-stop';
    stop.style.cssText = 'background:none;border:none;cursor:pointer;padding:2px;';
    stop.setAttribute('aria-label', `Ride to ${def.label}`);
    stop.innerHTML = `<span class="rm-label">${def.label}</span><span class="rm-dot" style="background:${hex(def.color)}"></span>`;
    stop.addEventListener('click', () => onStopClick(i));
    routeMap.appendChild(stop);
    stops.push(stop);
  });

  let hideTimer = null;

  function showCard(def) {
    clearTimeout(hideTimer);
    const accent = hex(def.color);
    cardInner.innerHTML = `<h2>${def.cardTitle}</h2><p class="subtitle">${def.cardSubtitle}</p>${def.html}`;
    cardInner.querySelectorAll('.subtitle').forEach((el) => (el.style.color = accent));
    card.style.borderLeftColor = accent;
    badge.style.borderBottomColor = accent;
    card.classList.add('visible');
    card.scrollTop = 0;
  }

  function hideCard() {
    card.classList.remove('visible');
  }

  function setActiveStop(index) {
    stops.forEach((s, i) => s.classList.toggle('active', i === index));
  }

  function updateProgress(distance, stationDistances) {
    for (let i = 0; i < fills.length; i++) {
      const a = stationDistances[i];
      const b = stationDistances[i + 1];
      const f = Math.min(Math.max((distance - a) / (b - a), 0), 1);
      fills[i].style.height = `${f * 100}%`;
    }
  }

  function hideHint() {
    hint.classList.add('hidden');
  }

  return { showCard, hideCard, setActiveStop, updateProgress, hideHint };
}
