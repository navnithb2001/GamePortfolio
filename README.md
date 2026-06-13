# 🚂 GamePortfolio — Navnith Bharadwaj

An interactive 3D train-ride portfolio inspired by [bruno-simon.com](https://bruno-simon.com/).
Drive a low-poly steam train down the line with just **↑ / ↓** — every station is a section
of the portfolio, ending at Contact.

**Stations:** Welcome → Education → Experience → Skills → Projects → Contact

## Controls

| Input | Action |
| --- | --- |
| `↑` / `W` (hold) | accelerate forward |
| `↓` / `S` (hold) | brake, then reverse |
| Scroll wheel | nudge the train |
| Route-map dots (right side) | fast-travel to that station |
| ▲ / ▼ buttons | touch devices |

Deep links: `?at=education`, `?at=contact`, … start the ride at a station.

## Tech

- [Three.js](https://threejs.org/) + [Vite](https://vite.dev/), vanilla JS — no framework
- World built from a mix of procedural geometry (track, train, stations, terrain,
  post-processing grade) and borrowed graphics (see Credits)
- Portfolio content lives in one file: [`src/content.js`](src/content.js)

## Credits

The trees, foliage, grass, bench, and lantern graphics are adapted from
**Bruno Simon's** [folio-2025](https://github.com/brunosimon/folio-2025)
(MIT licensed — see [`public/folio-assets/LICENSE.md`](public/folio-assets/LICENSE.md)).
The tree/prop models and the leaf SDF are his original assets; the foliage and
grass techniques (sphere-of-quads canopies, a camera-following billboarded
blade field) are ported from his `three/webgpu` + TSL source to classic
WebGL/three.js here. Huge thanks to Bruno — go see the real thing at
[bruno-simon.com](https://bruno-simon.com/).

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Deploy to GitHub Pages

The repo ships with a GitHub Actions workflow that builds and deploys on every
push to `main`.

1. Create a GitHub repo named **`GamePortfolio`** (the Vite `base` in
   [`vite.config.js`](vite.config.js) must match the repo name — change both
   together if you rename it).
2. Push this project to it:
   ```bash
   git remote add origin https://github.com/navnithb2001/GamePortfolio.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source → GitHub Actions**.
4. The site goes live at <https://navnithb2001.github.io/GamePortfolio/> after
   the first workflow run finishes (~1 minute).

## Editing content

All portfolio text (stations, cards, contact links) is in
[`src/content.js`](src/content.js). Station order, names, and accent colors come
from the same array — add or remove a station there and the track, route map,
and zones adapt automatically.
