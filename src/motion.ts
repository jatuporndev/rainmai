import type { MotionResult } from './types';

export const SIZE = 256;
export const WORLD = 256 * 2 ** 7;
export const metersPerPixel = (lat: number) => 40075016.686 * Math.cos(lat * Math.PI / 180) / WORLD;
export const worldPoint = (lat: number, lon: number) => ({
  x: (lon + 180) / 360 * WORLD,
  y: (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * WORLD,
});
export const fromWorld = (x: number, y: number): [number, number] => [Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI, x / WORLD * 360 - 180];

// Official Universal Blue palette anchors, interpolated at 1 dBZ intervals.
const anchors = [[15,136,221,238],[20,0,163,224],[25,0,119,170],[30,0,85,136],[34,0,71,104],[35,255,238,0],[40,255,170,0],[44,255,129,0],[45,255,68,0],[50,193,0,0],[54,93,0,0],[55,255,170,255],[60,255,119,255],[64,255,78,255],[65,255,255,255],[74,255,255,255],[75,0,255,0],[76,0,255,0]];
const palette: number[][] = [];
for (let a = 0; a < anchors.length - 1; a++) {
  const start = anchors[a], end = anchors[a + 1];
  for (let dbz = start[0]; dbz < end[0]; dbz++) {
    const t = (dbz - start[0]) / (end[0] - start[0]);
    palette.push([dbz, ...start.slice(1).map((v, i) => Math.round(v + (end[i + 1] - v) * t))]);
  }
}
export function decodeRadar(pixels: Uint8ClampedArray): Float32Array {
  const result = new Float32Array(pixels.length / 4);
  for (let i = 0; i < result.length; i++) {
    const p = i * 4;
    if (pixels[p + 3] < 240) continue;
    let distance = Infinity, value = 0;
    for (const [dbz, r, g, b] of palette) {
      const d = (pixels[p] - r) ** 2 + (pixels[p + 1] - g) ** 2 + (pixels[p + 2] - b) ** 2;
      if (d < distance) { distance = d; value = dbz; }
    }
    if (distance < 450) result[i] = 1 + (value - 15) / 25;
  }
  return result;
}

function fit(previous: Float32Array, current: Float32Array, coverage: Uint8Array) {
  let best = { x: 0, y: 0, score: 0 }, count = 0;
  for (let y = 32; y < SIZE - 32; y += 2) for (let x = 32; x < SIZE - 32; x += 2) {
    if (current[y * SIZE + x] > 0 && coverage[y * SIZE + x]) count++;
  }
  if (count < 24) return null;
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
    let intersection = 0, total = 0;
    for (let y = 32; y < SIZE - 32; y += 3) for (let x = 32; x < SIZE - 32; x += 3) {
      const at = y * SIZE + x, before = (y - dy) * SIZE + x - dx;
      if (!coverage[at] || !coverage[before]) continue;
      const a = previous[before], b = current[at];
      total += a + b;
      intersection += Math.min(a, b) * 2;
    }
    const score = total > 0 ? intersection / total : 0;
    if (score > best.score + 0.00001 || (Math.abs(score - best.score) < 0.00001 && dx * dx + dy * dy < best.x * best.x + best.y * best.y)) best = { x: dx, y: dy, score };
  }
  return best;
}

export interface MotionInput { grids: Float32Array[]; coverage: Uint8Array; times: number[]; lat: number; now: number }
export function estimateMotion({ grids, coverage, times, lat, now }: MotionInput): MotionResult {
  const base: MotionResult = { status: 'uncertain', dx: 0, dy: 0, arrival: null, speed: 0, direction: '—', reason: '' };
  const fail = (status: MotionResult['status'], reason: string) => ({ ...base, status, reason });
  if (times.length < 3 || grids.length < 3) return fail('uncertain', 'At least three recent radar frames are needed.');
  if (now - times[2] > 35 * 60 || times[2] > now + 300) return fail('stale', 'The latest radar frame is too old to estimate arrival.');
  let localCoverage = 0;
  for (let y = 124; y <= 132; y++) for (let x = 124; x <= 132; x++) localCoverage += coverage[y * SIZE + x] ? 1 : 0;
  if (localCoverage < 75) return fail('no-coverage', 'Radar coverage is unavailable or partial at this location. A blank map does not mean no rain.');
  const last = grids[2];
  let localRain = 0;
  for (let y = 127; y <= 129; y++) for (let x = 127; x <= 129; x++) if (coverage[y * SIZE + x] && last[y * SIZE + x] > 0) localRain++;
  // The threshold is an echo detection heuristic, not a calibrated rainfall measurement.
  const raining = localRain >= 3;
  if (!last.some(v => v > 0)) return fail('no-echo', 'No rain echoes detected in the available regional radar. New showers can still develop.');
  const dt1 = (times[1] - times[0]) / 60, dt2 = (times[2] - times[1]) / 60;
  if (dt1 < 5 || dt2 < 5 || dt1 > 20 || dt2 > 20) return fail('uncertain', 'Recent radar frames have gaps. A motion estimate is unavailable.');
  const a = fit(grids[0], grids[1], coverage), b = fit(grids[1], grids[2], coverage);
  if (!a || !b || a.score < 0.42 || b.score < 0.42) return fail(raining ? 'raining' : 'uncertain', raining ? 'Rain echoes are present near this point in the latest observation. Movement is not clear enough to project.' : 'Rain patterns are changing too much to estimate a useful arrival time.');
  const ax = a.x / dt1, ay = a.y / dt1, bx = b.x / dt2, by = b.y / dt2;
  if (Math.hypot(ax - bx, ay - by) > 0.25 || Math.abs(b.x) === 12 || Math.abs(b.y) === 12) return fail(raining ? 'raining' : 'uncertain', 'Rain movement is inconsistent between the last three frames.');
  const dx = (ax + bx) / 2, dy = (ay + by) / 2;
  const speed = Math.hypot(dx, dy) * metersPerPixel(lat) * 60 / 1000;
  if (speed < 3 || speed > 110) return fail(raining ? 'raining' : 'uncertain', 'Rain is stationary or movement cannot be resolved at this radar resolution.');
  const directions = ['N','NE','E','SE','S','SW','W','NW'];
  const direction = directions[Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) / 45) % 8];
  let arrival: number | null = null;
  const age = Math.max(0, (now - times[2]) / 60);
  for (let t = 0; t <= 60; t += 1) {
    const x = Math.round(128 - dx * (t + age)), y = Math.round(128 - dy * (t + age));
    if (x < 2 || y < 2 || x >= SIZE - 2 || y >= SIZE - 2 || !coverage[y * SIZE + x]) break;
    let hits = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (coverage[(y + oy) * SIZE + x + ox] && last[(y + oy) * SIZE + x + ox] > 0) hits++;
    }
    if (hits >= 3) { arrival = t; break; }
  }
  return { status: raining ? 'raining' : 'ready', dx, dy, speed, direction, arrival, reason: 'Experimental extrapolation of the last three radar frames. Assumes rain keeps its current shape and speed.' };
}
