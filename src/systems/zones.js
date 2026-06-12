const ZONE_RADIUS = 17;

// Tracks which station zone the train occupies; fires enter/leave callbacks.
export function createZones(stations, { onEnter, onLeave }) {
  let activeIndex = -1;

  function update(distance) {
    let next = -1;
    let best = Infinity;
    stations.forEach((s, i) => {
      const d = Math.abs(distance - s.distance);
      if (d < ZONE_RADIUS && d < best) {
        best = d;
        next = i;
      }
    });
    if (next !== activeIndex) {
      if (activeIndex !== -1) onLeave(activeIndex);
      if (next !== -1) onEnter(next);
      activeIndex = next;
    }
  }

  return { update, get activeIndex() { return activeIndex; } };
}
