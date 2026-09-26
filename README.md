# Rainmai

A mobile-first React app for rain planning across Thailand. The home screen leads with an hourly rain probability and an animated raindrop mascot. Real radar observations, experimental motion forecasts, and independently sourced hourly weather probabilities are explicitly distinguished.

## The daily rain check

- On each visit, the app requests the current browser location. It does not fetch Bangkok weather as a substitute. If GPS is unavailable, it offers manual selection or explicitly labels a previously saved location.
- Location requests have a 25-second recovery deadline even if the browser never calls back. Retry buttons request location directly from the tap; manual choices and new requests cancel stale callbacks. Permission errors include expandable iPhone/Safari instructions. Weather and radar requests use AbortController with a timeout, without requiring newer AbortSignal static helpers.
- The main percentage comes directly from Open-Meteo for the displayed hour. Both start and end times are shown. A missing probability displays `—`; a real zero displays `0%`.
- The four mascots use the owner's original hand-drawn character sheet, unchanged in `public/mascots/original-characters.png`. SVG viewports display each drawing, left to right: the smiling character below 30%, a folded umbrella from 30–59%, an open umbrella from 60–79%, and a raincoat from 80%. Classification follows the rounded percentage visible in the interface, including exact 30/60/80 boundaries. These are presentation choices, not intensity classes or calibrated confidence thresholds. Missing data uses a neutral placeholder. Animation respects reduced-motion preferences.
- The ⓘ button beside the character opens a guide showing all four original drawings and their ranges, with the currently displayed category highlighted. Opening the guide does not change the selected forecast.
- Decorative rain starts at 60–79% with sparse, slower drops and cool daylight. At 80% the page becomes overcast with denser, faster rain, frosted dark surfaces, and light text. These effects express the selected model probability, **not observed rain intensity**; the mascot guide explains this. Original line art is inverted only for display against the dark background; the source image remains unchanged.
- The rain uses a single 2D canvas above the frosted cards, capped at 30 fps, 300 drops, and 1.5× pixel density. It stops while a dialog is open, the page is hidden, or reduced motion is enabled, retaining a still rain scene. Resizing paints immediately so the scene does not disappear when motion is paused. A pause/resume control beside the forecast lets the user keep the atmosphere without moving rain. No Three.js or extra animation library is required.
- Selecting one of the six hourly cards changes the main probability, time range, and mascot together. The first card represents the current model hour; subsequent card labels show the beginning of each hour. The full 24-hour table explicitly labels hour-ending times.
- The radar opens in a separate dialog, full-screen on mobile. Its map bundle, radar imagery, and motion computation are loaded on demand rather than blocking the home screen.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. No API keys or backend are required for the configured public endpoints. GPS needs HTTPS or localhost and browser permission. Choose a city or click the radar map without granting location access. Only the last location is stored locally.

```sh
npm run build       # TypeScript checks and production build
npm run preview     # Serve dist locally
npm test            # Motion algorithm and data-integrity tests
```

Deploy `dist/` to a static host over HTTPS. The runtime connects directly to its data providers and refreshes every five minutes. Individual requests time out after 18 seconds; radar and weather can fail independently. Provider failures are shown explicitly with retry actions. The production app contains no mock weather or fabricated radar.

## Data and licensing

- **Radar:** [RainViewer Weather Maps API](https://www.rainviewer.com/api/weather-maps-api.html), observed history and coverage mask. Radar tiles use the supported Universal Blue palette at native zoom 7, overzoomed for display. The public API is intended for personal, educational, and small community use; check [RainViewer terms](https://www.rainviewer.com/api.html) before commercial deployment.
- **Forecast:** [Open-Meteo](https://open-meteo.com/en/docs), hourly precipitation probability, accumulation, temperature, and WMO weather code; current model temperature, apparent temperature, humidity, and wind. Public service use is subject to [Open-Meteo terms](https://open-meteo.com/en/terms); commercial deployments need the appropriate plan.
- **Locations:** [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api), based on GeoNames, restricted to Thailand. Common cities are available even when search is offline.
- **Map:** [OpenStreetMap](https://www.openstreetmap.org/copyright). Browser caching and normal viewport tile loading are preserved. Follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and use a suitable dedicated map provider for large deployments. The base map URL is in `src/RadarMap.tsx`.

All displayed times use Asia/Bangkok (UTC+7), regardless of the viewer's device timezone. RainViewer frame timestamps are generation times, not necessarily the exact observation time of every radar within a composite. Open-Meteo precipitation values and probabilities refer to the hour **ending** at the API timestamp. The home screen converts that timestamp to an explicit start–end interval; hourly cards show interval starts and the full table shows interval ends.

## Motion estimation

`src/motion.ts` contains the pure computation, tested with synthetic translating echoes. `src/motion.worker.ts` runs it away from the UI thread.

1. Fetch the last three 256 × 256 radar images centered on the selected point, plus the coverage mask, at native zoom 7.
2. Decode opaque Universal Blue pixels at approximately 15 dBZ or higher into rain-echo weights. This is an echo-detection heuristic, not calibrated rain intensity at ground level.
3. Search pixel translations across each adjacent pair, using weighted overlap only in covered regions.
4. Require enough echoes, adequate overlap, consistent vectors, realistic speed, local coverage, suitable frame spacing, and a latest frame younger than 35 minutes.
5. Advect the latest echo field with the averaged vector and sample the upstream path for the next 60 minutes, accounting for the observation's age.
6. Show a rough arrival window around a detected intersection. That window is a heuristic buffer, **not** a calibrated confidence interval. No probability or confidence percentage is generated.

The forecast image is a bounded, locally translated radar raster. It does not predict storm growth, decay, splitting, formation, or rotation. Blank/missing coverage is not interpreted as no rain. Stationary, inconsistent, stale, and insufficient patterns suppress extrapolation. Observed rain near the selected point is identified as an observation, not a prediction. The public coverage mask reflects typical coverage; it cannot confirm that every radar is currently operating.

Open-Meteo rain percentages are shown directly from the provider. Null probabilities display `—`, never `0%`. These percentages are independent of the radar algorithm and have regional, rather than street-level, meaning.

## Browser verification

With the dev server running on port 5173 and Chrome installed:

```sh
node scripts/browser-check.mjs
node scripts/state-check.mjs
node scripts/mascot-check.mjs
node scripts/atmosphere-check.mjs
node scripts/safari-check.mjs
```

The first runs `scripts/redesign-check.mjs`: live GPS-based weather, on-demand radar, all mascot poses, hourly selection, missing probabilities, location denial, saved-location labeling, late GPS responses, and mobile rendering. The second tests radar coverage, projection, and failure states with isolated browser-network fixtures. Test fixtures are never bundled into the app. Screenshots and results are saved in ignored `artifacts/`.

The mascot check verifies the original artwork checksum, exact 30/60/80% transitions, the guide's four images and current-category highlight, keyboard close/focus restoration, and mobile layouts. Its screenshots use controlled test probabilities rather than live weather.

The atmosphere check verifies the light/heavy visual boundaries, animated canvas pixels and particle budgets, pause/resume, modal pausing, reduced-motion behavior, mobile sizing, and removal of effects when data is missing.

The Safari check requires `npx playwright install webkit`. It uses WebKit with an iPhone viewport and tests native browser geolocation with supplied test coordinates, older API compatibility, permission recovery, stalled callbacks, and manual-choice races. It does not replace testing location permissions on a physical iPhone. Set `RAINMAI_TEST_URL` to check a deployed build instead of localhost; forecast fixtures remain confined to the test browser.

## Stack

React 19, TypeScript, Vite, Leaflet, Lucide, Vitest, Playwright. The interface uses CSS and small SVG illustrations; 3D rendering would add overhead without improving this map-driven experience.
