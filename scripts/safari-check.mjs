import { webkit, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await webkit.launch({ headless: true });
const base = process.env.RAINMAI_TEST_URL || 'http://localhost:5173';
const errors = [];
const now = Math.floor(Date.now() / 1000), end = Math.ceil(now / 3600) * 3600;
const forecast = {
  current: { time: now, temperature_2m: 29, apparent_temperature: 32, relative_humidity_2m: 73, weather_code: 3, wind_speed_10m: 12, is_day: 1 },
  hourly: { time: Array.from({ length: 24 }, (_, i) => end + i * 3600), precipitation_probability: Array(24).fill(65), precipitation: Array(24).fill(0.3), temperature_2m: Array(24).fill(29), weather_code: Array(24).fill(3) },
};
async function setup(mode) {
  const context = await browser.newContext({ ...devices['iPhone 13'], geolocation: { latitude: 13.7563, longitude: 100.5018 }, permissions: ['geolocation'] });
  await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: forecast }));
  await context.addInitScript(mode => {
    // Reproduce older Safari's absent helpers without changing production data.
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true });
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true });
    window.locationMode = mode;
    window.locationCalls = [];
    const nativeLocate = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    Object.defineProperty(navigator, 'geolocation', { value: {
      getCurrentPosition(ok, fail) {
        window.locationCalls.push(navigator.userActivation?.isActive ?? null);
        if (mode === 'native') { nativeLocate(ok, fail); return; }
        window.lateLocation = () => ok({ coords: { latitude: 13.7563, longitude: 100.5018 } });
        if (window.locationMode === 'permission') fail({ code: 1, message: 'Origin does not have permission to use Geolocation service' });
        if (window.locationMode === 'success') window.lateLocation();
      },
    } });
  }, mode);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}

try {
  const { context, page } = await setup('native');
  await page.goto(base);
  await expect(page.getByRole('button', { name: 'Use my current location', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.locationCalls)).toEqual([]);
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(page.locator('.day-location strong')).toHaveText('Current location');
  await expect(page.locator('.chance-number')).toHaveText('65%');
  await expect(page.locator('.day-hour')).toHaveCount(6);
  expect(await page.evaluate(() => window.locationCalls)).toEqual([true]);
  console.log('PASS WebKit: no automatic iPhone request; one native geolocation request within a user tap; weather without AbortSignal.any/timeout.');
  await context.close();

  const denied = await setup('permission');
  await denied.page.goto(base);
  await denied.page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(denied.page.locator('.location-notice')).toContainText('browser did not grant location access');
  await denied.page.getByText('Browser response', { exact: true }).click();
  await expect(denied.page.locator('.location-notice')).toContainText('Origin does not have permission');
  await denied.page.getByText('Location help for iPhone / Safari', { exact: true }).click();
  await expect(denied.page.locator('.location-permission-help').filter({ hasText: 'Location help for iPhone / Safari' })).toContainText('Safari Websites');
  expect(await denied.page.locator('.location-notice-copy').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(200);
  expect(await denied.page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await denied.page.screenshot({ path: 'artifacts/safari-location-help.png', fullPage: true });
  await denied.page.evaluate(() => { window.locationMode = 'success'; });
  await denied.page.getByRole('button', { name: 'Try my location', exact: true }).click();
  await expect(denied.page.locator('.day-location small')).toHaveText('RIGHT WHERE YOU ARE');
  await expect(denied.page.locator('.chance-number')).toHaveText('65%');
  console.log('PASS WebKit: denied permission help and direct retry after permission restored.');
  await denied.context.close();

  const stalled = await setup('silent');
  await stalled.page.clock.install();
  await stalled.page.goto(base);
  await stalled.page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(stalled.page.locator('.day-location small')).toHaveText('FINDING YOU');
  await expect(stalled.page.getByRole('button', { name: 'Choose my area', exact: true })).toBeVisible();
  await stalled.page.clock.runFor(100);
  await expect.poll(() => stalled.page.evaluate(() => typeof window.lateLocation)).toBe('function');
  await stalled.page.clock.fastForward(25100);
  await expect(stalled.page.locator('.location-notice')).toContainText('took too long');
  await stalled.page.evaluate(() => window.lateLocation());
  await expect(stalled.page.locator('.chance-number')).toHaveText('—');
  await stalled.page.getByRole('button', { name: 'Choose my area', exact: true }).click();
  await stalled.page.evaluate(() => { window.locationMode = 'success'; });
  await stalled.page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(stalled.page.getByRole('dialog')).toHaveCount(0);
  await expect(stalled.page.locator('.day-location small')).toHaveText('RIGHT WHERE YOU ARE');
  await expect(stalled.page.locator('.chance-number')).toHaveText('65%');
  console.log('PASS WebKit: stalled GPS resolves to recovery UI; late fix ignored; dialog GPS uses shared retry.');
  await stalled.context.close();

  const manual = await setup('silent');
  await manual.page.goto(base);
  await manual.page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await manual.page.getByRole('button', { name: 'Choose my area', exact: true }).click();
  await manual.page.getByRole('button', { name: /Chiang Mai/ }).click();
  await manual.page.evaluate(() => window.lateLocation());
  await expect(manual.page.locator('.day-location strong')).toHaveText('Chiang Mai');
  await expect(manual.page.locator('.chance-number')).toHaveText('65%');
  await manual.context.close();
  expect(errors).toEqual([]);
  console.log('PASS WebKit: manual choice survives late GPS; no browser exceptions.');
} finally { await browser.close(); }
