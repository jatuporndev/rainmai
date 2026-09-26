import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const gps = { latitude: 13.7563, longitude: 100.5018 };
const liveContext = await browser.newContext({ geolocation: gps, permissions: ['geolocation'], viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const live = await liveContext.newPage();
live.on('pageerror', e => errors.push(e.message));
const liveRequests = [];
live.on('request', r => { if (/weather-maps|forecast\?/.test(r.url())) liveRequests.push(r.url()); });
await live.goto('http://localhost:5173');
await expect(live.locator('.day-location strong')).toHaveText('Current location');
await expect(live.locator('.day-hour')).toHaveCount(6, { timeout: 25000 });
await live.evaluate(() => document.fonts.ready);
await live.screenshot({ path: 'artifacts/redesign-desktop.png', fullPage: true });
expect(liveRequests.some(url => url.includes('latitude=13.7563'))).toBe(true);
expect(liveRequests.some(url => url.includes('weather-maps'))).toBe(false);
await expect(live.locator('.map-container')).toHaveCount(0);
console.log('PASS live: current location is the default; hourly API loads; radar is not requested on the home screen.');
await live.setViewportSize({ width: 390, height: 844 });
await live.screenshot({ path: 'artifacts/redesign-mobile.png', fullPage: true });
await live.getByRole('button', { name: 'Radar', exact: true }).click();
await expect(live.locator('.map-container')).toBeVisible();
await expect(live.locator('.arrival-description')).not.toHaveText('Matching recent radar frames around you.', { timeout: 25000 });
await live.waitForTimeout(2500);
await live.screenshot({ path: 'artifacts/redesign-radar.png', fullPage: true });
await live.keyboard.press('Escape');
await expect(live.getByRole('dialog')).toHaveCount(0);
await live.getByRole('button', { name: 'Next 24 hours' }).click();
await expect(live.locator('.forecast-table tbody tr')).toHaveCount(24);
await live.keyboard.press('Escape');
console.log('PASS live: on-demand radar, full-screen mobile details, close with Escape, 24-hour outlook.');

// Controlled weather is only used in this browser test, never in the app.
const context = await browser.newContext({ geolocation: gps, permissions: ['geolocation'], viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
const now = Math.floor(Date.now() / 1000);
const endHour = Math.ceil(now / 3600) * 3600;
const forecast = { current: { time: now, temperature_2m: 29, apparent_temperature: 32, relative_humidity_2m: 73, weather_code: 3, wind_speed_10m: 12, is_day: 1 }, hourly: { time: Array.from({ length: 24 }, (_, i) => endHour + i * 3600), precipitation_probability: [15, 45, 70, 90, null, 0, ...Array(18).fill(20)], precipitation: Array(24).fill(0.3), temperature_2m: Array(24).fill(29), weather_code: Array(24).fill(3) } };
await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: forecast }));
await page.goto('http://localhost:5173');
await expect(page.locator('.chance-number')).toHaveText('15%');
for (const [i, mood, chance] of [[0,'easy','15%'],[1,'prepared','45%'],[2,'umbrella','70%'],[3,'raincoat','90%'],[4,'waiting','—'],[5,'easy','0%']]) {
  await page.locator('.day-hour').nth(i).click();
  await expect(page.locator('.chance-number')).toHaveText(chance);
  await expect(page.locator('.mascot-scene')).toHaveAttribute('data-mood', mood);
  await expect(page.locator('.day-hour').nth(i)).toHaveAttribute('aria-pressed','true');
  if (i < 4) await page.locator('.day-hero').screenshot({ path: `artifacts/mascot-${mood}.png` });
}
await page.getByRole('button', { name: 'Back to this hour' }).click();
await expect(page.locator('.chance-number')).toHaveText('15%');
console.log('PASS: all four mascot poses, hourly selection, zero versus null probability, return to current hour.');
for (const width of [320, 390, 540, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: 'Change location', exact: true }).click();
await page.getByRole('button', { name: /Chiang Mai/ }).click();
await expect(page.locator('.day-location strong')).toHaveText('Chiang Mai');
await expect(page.locator('.chance-number')).toHaveText('15%');
console.log('PASS: manual location switching and responsive layouts at 320–1440px.');
await context.unroute('https://api.open-meteo.com/**');
await context.route('https://api.open-meteo.com/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
await page.getByRole('button', { name: 'Refresh weather data' }).click();
await expect(page.locator('.chance-number')).toHaveText('—');
await expect(page.locator('.mascot-message h2')).toContainText('taking a moment');
await expect(page.locator('.day-hour')).toHaveCount(0);
await page.screenshot({ path: 'artifacts/redesign-weather-error.png', fullPage: true });
console.log('PASS: failed weather requests never show a probability or a dry-weather pose.');

const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await deniedContext.addInitScript(() => {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_, fail) => fail({ code: 1 }) } });
});
await deniedContext.route('https://api.open-meteo.com/**', route => route.fulfill({ json: forecast }));
const denied = await deniedContext.newPage();
denied.on('pageerror', e => errors.push(e.message));
let weatherCalls = 0;
denied.on('request', r => { if (r.url().includes('api.open-meteo.com')) weatherCalls++; });
await denied.goto('http://localhost:5173');
await expect(denied.locator('.location-notice')).toContainText('Location permission is off');
await expect(denied.locator('.chance-number')).toHaveText('—');
expect(weatherCalls).toBe(0);
await denied.screenshot({ path: 'artifacts/redesign-location-denied.png', fullPage: true });
await denied.getByRole('button', { name: 'Choose my area', exact: true }).click();
await denied.getByRole('button', { name: /Phuket/ }).click();
await expect(denied.locator('.day-location strong')).toHaveText('Phuket');
await expect(denied.locator('.chance-number')).toHaveText('15%');
await denied.reload();
await expect(denied.locator('.day-location small')).toHaveText('SAVED LOCATION · NOT LIVE GPS');
await expect(denied.locator('.day-location strong')).toHaveText('Phuket');
console.log('PASS: denied GPS does not silently use Bangkok; manual choice works; saved fallback is explicitly labeled.');

const raceContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await raceContext.addInitScript(() => {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: success => { window.finishLocation = () => success({ coords: { latitude: 13.7563, longitude: 100.5018 } }); } } });
});
await raceContext.route('https://api.open-meteo.com/**', route => route.fulfill({ json: forecast }));
const race = await raceContext.newPage();
await race.goto('http://localhost:5173');
await expect(race.locator('.day-location small')).toHaveText('FINDING YOU');
await race.getByRole('button', { name: 'Change location', exact: true }).click();
await race.getByRole('button', { name: /Chiang Mai/ }).click();
await race.evaluate(() => window.finishLocation());
await expect(race.locator('.day-location strong')).toHaveText('Chiang Mai');
console.log('PASS: a late GPS response cannot overwrite a manually selected location.');
expect(errors).toEqual([]);
console.log('PASS: no browser exceptions.');
await writeFile('artifacts/redesign-results.json', JSON.stringify({ errors, liveRequests, passed: true }, null, 2));
await browser.close();
