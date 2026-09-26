import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', geolocation: { latitude: 13.7563, longitude: 100.5018 }, permissions: ['geolocation'] });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
// Deterministic fixtures are confined to this test; the app never uses sample weather.
await page.goto('about:blank');
const png = await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const clear = canvas.toDataURL().split(',')[1];
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,256,256);
  const black = canvas.toDataURL().split(',')[1];
  const clouds = [88, 92, 96].map(center => {
    ctx.clearRect(0, 0, 256, 256); ctx.fillStyle = '#00a3e0';
    for (let y = 112; y <= 144; y++) for (let x = center - 10; x <= center + 10; x++) {
      if (Math.hypot((x - center) / 10, (y - 128) / 16) <= 1) ctx.fillRect(x, y, 1, 1);
    }
    return canvas.toDataURL().split(',')[1];
  });
  return { clear, black, clouds };
});
await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png.clear, 'base64') }));
await page.route('https://tilecache.rainviewer.com/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(route.request().url().includes('coverage') ? png.black : png.clear, 'base64') }));
const now = Math.floor(Date.now() / 1000);
await page.route('https://api.rainviewer.com/**', route => route.fulfill({ json: { host: 'https://tilecache.rainviewer.com', generated: now, radar: { past: Array.from({length:7},(_,i)=>({time:now-(6-i)*600,path:`/v2/radar/test-${i}`})) } } }));
await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: {
  current: { time: now, temperature_2m: 29, apparent_temperature: 32, relative_humidity_2m: 73, weather_code: 3, wind_speed_10m: 12, is_day: 1 },
  hourly: { time: Array.from({ length: 25 }, (_,i) => now + i * 3600), precipitation_probability: Array.from({length:25},(_,i)=>i===1 ? null : 40), precipitation: Array(25).fill(0.3), temperature_2m: Array(25).fill(29), weather_code: Array(25).fill(3) }
} }));
await page.goto('http://localhost:5173');
await expect(page.locator('.day-hour').first().locator('strong')).toHaveText('—');
await page.getByRole('button', { name: 'Radar', exact: true }).click();
await expect(page.locator('.arrival-title')).toHaveText('A gap inthe radar.');
await expect(page.locator('.arrival-number')).toHaveCount(0);
await page.getByRole('button', { name: 'Prediction +60 min' }).click();
await expect(page.locator('.map-message')).toContainText('Not enough radar evidence');
await page.getByRole('button', { name: 'Observed', exact: true }).click();
await page.getByRole('button', { name: 'Play radar animation' }).click();
await expect(page.getByRole('button', { name: 'Pause radar animation' })).toBeVisible();
await page.waitForTimeout(1100);
await page.getByRole('button', { name: 'Pause radar animation' }).click();
await expect(page.locator('.map-time')).toContainText('OBSERVED RADAR');
await page.getByRole('button', { name: 'Layers', exact: true }).click();
await page.getByRole('checkbox', { name: 'Rain radar', exact: true }).uncheck();
await expect(page.getByRole('checkbox', { name: 'Rain radar', exact: true })).not.toBeChecked();
await page.getByRole('button', { name: 'Layers', exact: true }).click();
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Next 24 hours', exact: true }).click();
await expect(page.locator('.forecast-table tbody tr')).toHaveCount(24);
await page.keyboard.press('Escape');
await expect(page.getByRole('dialog')).toHaveCount(0);
await page.evaluate(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_, fail) => fail({ code: 1 }) } }); });
await page.getByRole('button', { name: 'Location', exact: true }).click();
await page.getByRole('button', { name: 'Use my current location' }).click();
await expect(page.locator('.form-error')).toContainText(/permission|could not/, { timeout: 15000 });
await page.keyboard.press('Escape');
console.log('PASS: missing coverage, unavailable probability, prediction withholding, timeline playback, layers, outlook, GPS denial, dialog keyboard access.');
await page.unroute('https://tilecache.rainviewer.com/**');
await page.route('https://tilecache.rainviewer.com/**', route => {
  const url = route.request().url();
  const frame = Number(url.match(/test-(\d)/)?.[1] ?? 6);
  const data = url.includes('coverage') ? png.clear : png.clouds[Math.max(0, Math.min(2, frame - 4))];
  return route.fulfill({ contentType: 'image/png', body: Buffer.from(data, 'base64') });
});
await page.reload();
await expect(page.locator('.day-location strong')).toHaveText('Current location');
await page.getByRole('button', { name: 'Radar', exact: true }).click();
await expect(page.locator('.arrival-number')).toBeVisible();
await expect(page.locator('.arrival-number')).toContainText('min');
await expect(page.locator('.arrival-number')).not.toContainText('%');
await expect(page.locator('.experimental-label')).toHaveText('EXPERIMENTAL ESTIMATE');
await page.getByRole('button', { name: 'Prediction +60 min' }).click();
await expect(page.locator('.prediction-image')).toBeVisible();
await expect(page.locator('.map-time')).toContainText('EXPERIMENTAL FORECAST');
await page.getByRole('slider', { name: 'Radar timeline' }).fill('12');
await expect(page.locator('.prediction-caution')).toContainText('Local projection only');
await page.screenshot({ path: 'artifacts/test-projection.png', fullPage: true });
console.log('PASS: translating radar produces an experimental arrival window and an actual projected map through +60 minutes.');
await page.unroute('https://api.rainviewer.com/**');
await page.unroute('https://api.open-meteo.com/**');
await page.route('https://api.rainviewer.com/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
await page.route('https://api.open-meteo.com/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
await page.reload();
await expect(page.locator('.day-hour-empty')).toContainText('temporarily unavailable');
await expect(page.locator('.day-hour')).toHaveCount(0);
await page.getByRole('button', { name: 'Radar', exact: true }).click();
await expect(page.locator('.map-message')).toContainText('Radar is temporarily unavailable');
await expect(page.locator('.arrival-number')).toHaveCount(0);
await page.screenshot({ path: 'artifacts/mobile-errors.png', fullPage: true });
await page.getByRole('button', { name: 'Retry map data', exact: true }).click();
await expect(page.locator('.map-message')).toContainText('Radar is temporarily unavailable');
console.log('PASS: independent API failures, retry, no fabricated values.');
for (const width of [320, 390, 540, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}
console.log('PASS: no horizontal overflow at 320, 390, 540, 768, 1024, 1440px.');
expect(errors).toEqual([]);
console.log('PASS: no browser exceptions.');
await browser.close();
