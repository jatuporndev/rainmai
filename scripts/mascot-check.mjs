import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await mkdir('artifacts', { recursive: true });
const asset = await readFile('public/mascots/original-characters.png');
// SHA-256 of the supplied artwork, verified against the original upload.
expect(createHash('sha256').update(asset).digest('hex')).toBe('7fe19d26ec263f9f65dcf46f99982f4f0e6574d110bd1c844ef81e07f9683fc5');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, geolocation: { latitude: 13.7563, longitude: 100.5018 }, permissions: ['geolocation'], reducedMotion: 'reduce' });
const now = Math.floor(Date.now() / 1000);
const end = Math.ceil(now / 3600) * 3600;
await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: {
  current: { time: now, temperature_2m: 29, apparent_temperature: 32, relative_humidity_2m: 73, weather_code: 3, wind_speed_10m: 12, is_day: 1 },
  hourly: { time: Array.from({ length: 24 }, (_, i) => end + i * 3600), precipitation_probability: [29,30,59,60,79,80,...Array(18).fill(90)], precipitation: Array(24).fill(0.3), temperature_2m: Array(24).fill(29), weather_code: Array(24).fill(3) }
} }));
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:5173');
await expect(page.locator('.day-hour')).toHaveCount(6);
await page.evaluate(() => document.fonts.ready);
for (const [i, probability, mood] of [[0,29,'easy'],[1,30,'prepared'],[2,59,'prepared'],[3,60,'umbrella'],[4,79,'umbrella'],[5,80,'raincoat']]) {
  await page.locator('.day-hour').nth(i).click();
  await expect(page.locator('.chance-number')).toHaveText(`${probability}%`);
  await expect(page.locator('.mascot-scene')).toHaveAttribute('data-mood', mood);
  await page.getByRole('button', { name: 'View mascot guide', exact: true }).click();
  await expect(page.locator('.mascot-guide-card')).toHaveCount(4);
  await expect(page.locator('.mascot-guide-card.is-current')).toHaveAttribute('data-pose', mood);
  await expect(page.locator('.mascot-guide-current').filter({ hasText: 'Showing now' })).toHaveText(`Showing now · ${probability}%`);
  if (probability === 80) await page.screenshot({ path: 'artifacts/original-mascots-guide-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'View mascot guide', exact: true })).toBeFocused();
  await expect(page.locator('.chance-number')).toHaveText(`${probability}%`);
}
await page.locator('.day-hour').nth(1).click();
await page.locator('.day-hero').screenshot({ path: 'artifacts/original-mascot-30.png' });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'artifacts/original-mascot-mobile.png', fullPage: true });
await page.getByRole('button', { name: 'View mascot guide', exact: true }).click();
await page.screenshot({ path: 'artifacts/original-mascots-guide-mobile.png' });
for (const width of [320,390,540,768,1280]) {
  await page.setViewportSize({ width, height: 900 });
  expect(await page.locator('.mascot-guide-dialog').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(false);
}
await page.keyboard.press('Escape');
await context.unroute('https://api.open-meteo.com/**');
await context.route('https://api.open-meteo.com/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
await page.getByRole('button', { name: 'Refresh weather data', exact: true }).click();
await expect(page.locator('.mascot-scene')).toHaveAttribute('data-mood','waiting');
await expect(page.locator('.mascot-awaiting')).toBeVisible();
await page.getByRole('button', { name: 'View mascot guide', exact: true }).click();
await expect(page.locator('.mascot-guide-card.is-current')).toHaveCount(0);
expect(errors).toEqual([]);
console.log('PASS: unchanged original image, all four drawings, exact 30/60/80 boundaries, guide highlighting, Escape/focus restoration, no forecast mutation, missing-data placeholder, mobile guide at 320–1280px, no browser exceptions.');
await browser.close();
