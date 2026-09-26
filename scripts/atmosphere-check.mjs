import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, geolocation: { latitude: 13.7563, longitude: 100.5018 }, permissions: ['geolocation'] });
const now = Math.floor(Date.now() / 1000), end = Math.ceil(now / 3600) * 3600;
await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: {
  current: { time: now, temperature_2m: 29, apparent_temperature: 32, relative_humidity_2m: 73, weather_code: 3, wind_speed_10m: 12, is_day: 1 },
  hourly: { time: Array.from({ length: 24 }, (_, i) => end + i * 3600), precipitation_probability: [59,60,79,80,100,null,...Array(18).fill(20)], precipitation: Array(24).fill(0.3), temperature_2m: Array(24).fill(29), weather_code: Array(24).fill(3) }
} }));
const page = await context.newPage(), errors = [];
const rainFrame = () => page.locator('.weather-rain-canvas').evaluate(canvas => canvas.toDataURL());
const rainPixelCount = () => page.locator('.weather-rain-canvas').evaluate(canvas => {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 50) count++;
  return count;
});
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://localhost:5173');
await expect(page.locator('.day-hour')).toHaveCount(6);
await page.evaluate(() => document.fonts.ready);
await expect(page.locator('.rainmai-home')).toHaveAttribute('data-atmosphere','clear');
await expect(page.locator('.weather-rain-canvas')).toHaveCount(0);
await page.locator('.day-hour').nth(1).click();
await expect(page.locator('.rainmai-home')).toHaveAttribute('data-atmosphere','drizzle');
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','running');
const lightCount = Number(await page.locator('.weather-rain-canvas').getAttribute('data-particles'));
await page.waitForTimeout(1100);
expect(await rainPixelCount()).toBeGreaterThan(300);
const firstFrame = await rainFrame();
await page.waitForTimeout(150);
expect(await rainFrame()).not.toBe(firstFrame);
// The rain must paint over the cards, not merely exist in a concealed canvas.
expect(await page.locator('.weather-rain-canvas').evaluate(canvas => ({
  parent: canvas.parentElement.classList.contains('rainmai-home'),
  zIndex: getComputedStyle(canvas).zIndex,
  pointerEvents: getComputedStyle(canvas).pointerEvents,
}))).toEqual({ parent: true, zIndex: '4', pointerEvents: 'none' });
await page.screenshot({ path: 'artifacts/atmosphere-light-desktop.png', fullPage: true });
await page.locator('.day-hour').nth(2).click();
await expect(page.locator('.rainmai-home')).toHaveAttribute('data-atmosphere','drizzle');
await page.locator('.day-hour').nth(3).click();
await expect(page.locator('.rainmai-home')).toHaveAttribute('data-atmosphere','downpour');
const heavyCount = Number(await page.locator('.weather-rain-canvas').getAttribute('data-particles'));
expect(heavyCount).toBeGreaterThan(lightCount);
await page.waitForTimeout(1100);
await page.screenshot({ path: 'artifacts/atmosphere-heavy-viewport.png' });
await page.screenshot({ path: 'artifacts/atmosphere-heavy-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'Pause weather animation', exact: true }).click();
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','paused');
await expect(page.locator('.weather-atmosphere')).toHaveAttribute('data-paused','true');
const pausedFrame = await rainFrame();
await page.waitForTimeout(150);
expect(await rainFrame()).toBe(pausedFrame);
expect(await rainPixelCount()).toBeGreaterThan(300);
await page.getByRole('button', { name: 'Resume weather animation', exact: true }).click();
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','running');
await page.getByRole('button', { name: 'View mascot guide', exact: true }).click();
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','paused');
await expect(page.locator('.mascot-guide-atmosphere')).toContainText('ไม่ใช่ความแรงฝนที่วัดได้จริง');
await page.keyboard.press('Escape');
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','running');
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0,0));
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/atmosphere-heavy-mobile-viewport.png' });
await page.screenshot({ path: 'artifacts/atmosphere-heavy-mobile.png', fullPage: true });
expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
expect(await page.locator('.weather-rain-canvas').evaluate(canvas => canvas.width / innerWidth)).toBeLessThanOrEqual(1.5);
await page.emulateMedia({ reducedMotion: 'reduce' });
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','reduced');
await expect(page.locator('.weather-rain-canvas')).toBeVisible();
expect(await rainPixelCount()).toBeGreaterThan(300);
const reducedFrame = await rainFrame();
await page.waitForTimeout(150);
expect(await rainFrame()).toBe(reducedFrame);
await page.setViewportSize({ width: 414, height: 896 });
await expect.poll(rainPixelCount).toBeGreaterThan(300);
expect(await page.locator('.weather-cloud-front').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
await page.screenshot({ path: 'artifacts/atmosphere-reduced-motion.png' });
await page.emulateMedia({ reducedMotion: 'no-preference' });
await expect(page.locator('.weather-rain-canvas')).toHaveAttribute('data-animation','running');
await page.locator('.day-hour').nth(1).click();
await page.evaluate(() => window.scrollTo(0,0));
await page.waitForTimeout(300);
await page.screenshot({ path: 'artifacts/atmosphere-light-mobile-viewport.png' });
await page.locator('.day-hour').nth(5).click();
await expect(page.locator('.rainmai-home')).toHaveAttribute('data-atmosphere','clear');
await expect(page.locator('.weather-rain-canvas')).toHaveCount(0);
await expect(page.locator('.chance-number')).toHaveText('—');
await page.locator('.day-hour').nth(0).click();
await expect(page.locator('.chance-number')).toHaveText('59%');
await expect(page.locator('.rainmai-home')).toHaveAttribute('data-atmosphere','clear');
expect(errors).toEqual([]);
console.log(`PASS: 59/60/79/80 thresholds; actual animated canvas pixels; light ${lightCount} versus heavy ${heavyCount} drops; pause/resume; modal pause; reduced motion; mobile overflow and resolution cap; missing-data reset; no browser exceptions.`);
await browser.close();
