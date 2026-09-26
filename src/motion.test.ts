import { describe, expect, it } from 'vitest';
import { decodeRadar, estimateMotion, fromWorld, SIZE, worldPoint, type MotionInput } from './motion';

const now = 1780000000;
const coverage = new Uint8Array(SIZE * SIZE).fill(1);
const cloud = (center: number) => {
  const grid = new Float32Array(SIZE * SIZE);
  for (let y = 112; y <= 144; y++) for (let x = center - 10; x <= center + 10; x++) {
    const d = Math.hypot((x - center) / 10, (y - 128) / 16);
    if (d <= 1) grid[y * SIZE + x] = 1 + (1 - d);
  }
  return grid;
};
const input = (): MotionInput => ({ grids: [cloud(88), cloud(92), cloud(96)], times: [now - 1200, now - 600, now], lat: 13.75, coverage, now });

describe('radar motion safeguards', () => {
  it('recovers eastward movement and a bounded experimental arrival', () => {
    const result = estimateMotion(input());
    expect(result.status).toBe('ready'); expect(result.dx).toBeCloseTo(0.4); expect(result.dy).toBe(0);
    expect(result.direction).toBe('E'); expect(result.arrival).toBeGreaterThan(45); expect(result.arrival).toBeLessThanOrEqual(60);
    expect(result).not.toHaveProperty('probability'); expect(result).not.toHaveProperty('confidence');
  });
  it('accounts for elapsed time since the radar observation', () => {
    const fresh = estimateMotion(input());
    const delayed = estimateMotion({ ...input(), now: now + 600 });
    expect(delayed.arrival).toBe(fresh.arrival! - 10);
  });
  it('does not mistake missing local coverage for dry weather', () => {
    const result = estimateMotion({ ...input(), coverage: new Uint8Array(SIZE * SIZE) });
    expect(result.status).toBe('no-coverage'); expect(result.arrival).toBeNull();
  });
  it('rejects stale observations', () => { expect(estimateMotion({ ...input(), now: now + 2200 }).status).toBe('stale'); });
  it('rejects gaps in the sequence', () => { expect(estimateMotion({ ...input(), times: [now - 3600, now - 600, now] }).status).toBe('uncertain'); });
  it('rejects inconsistent movement', () => { expect(estimateMotion({ ...input(), grids: [cloud(88), cloud(96), cloud(92)] }).status).toBe('uncertain'); });
  it('withholds a forecast for stationary echoes', () => { expect(estimateMotion({ ...input(), grids: [cloud(96), cloud(96), cloud(96)] }).status).toBe('uncertain'); });
  it('reports observed local echoes without inventing an arrival', () => {
    const result = estimateMotion({ ...input(), grids: [cloud(128), cloud(128), cloud(128)] });
    expect(result.status).toBe('raining'); expect(result.arrival).toBeNull();
  });
  it('labels a blank but covered radar as no echoes, not a rain probability', () => {
    const result = estimateMotion({ ...input(), grids: Array.from({ length: 3 }, () => new Float32Array(SIZE * SIZE)) });
    expect(result.status).toBe('no-echo'); expect(result.arrival).toBeNull();
  });
  it('does not infer an arrival for a storm moving away', () => {
    const result = estimateMotion({ ...input(), grids: [cloud(96), cloud(92), cloud(88)] });
    expect(result.direction).toBe('W'); expect(result.arrival).toBeNull();
  });
  it('requires three frames', () => { expect(estimateMotion({ ...input(), times: [now], grids: [cloud(96)] }).status).toBe('uncertain'); });
});

describe('radar pixels and map projection', () => {
  it('excludes transparent and sub-threshold pixels', () => {
    const result = decodeRadar(new Uint8ClampedArray([0,163,224,255, 0,163,224,0, 206,192,135,150, 255,170,0,255]));
    expect(result[0]).toBeGreaterThan(0); expect(result[1]).toBe(0); expect(result[2]).toBe(0); expect(result[3]).toBeGreaterThan(result[0]);
  });
  it('roundtrips Web Mercator coordinates in Thailand', () => {
    const point = worldPoint(13.7563, 100.5018);
    const [lat, lon] = fromWorld(point.x, point.y);
    expect(lat).toBeCloseTo(13.7563, 6); expect(lon).toBeCloseTo(100.5018, 6);
  });
  it('recognizes high-reflectivity red, magenta, white, and green echoes', () => {
    const values = decodeRadar(new Uint8ClampedArray([93,0,0,255, 255,119,255,255, 255,255,255,255, 0,255,0,255]));
    expect(Array.from(values).every(v => v > 2)).toBe(true);
  });
});
