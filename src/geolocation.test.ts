import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLocation } from './geolocation';

let success: PositionCallback;
let failure: PositionErrorCallback;
const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => { success = ok; failure = fail; });
const position = { coords: { latitude: 13.7563, longitude: 100.5018 } } as GeolocationPosition;
beforeEach(() => { vi.useFakeTimers(); getCurrentPosition.mockClear(); vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('location request recovery', () => {
  it('requests immediately and accepts a delayed GPS fix within the deadline', () => {
    const ok = vi.fn(), fail = vi.fn();
    requestLocation(ok, fail);
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(18000);
    success(position);
    vi.advanceTimersByTime(30000);
    expect(ok).toHaveBeenCalledWith(expect.objectContaining({ name: 'Current location', lat: 13.7563 }));
    expect(fail).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('recovers when the browser never calls back and ignores late positions', () => {
    const ok = vi.fn(), fail = vi.fn();
    requestLocation(ok, fail);
    vi.advanceTimersByTime(25000);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ kind: 'timeout' }));
    success(position);
    expect(ok).not.toHaveBeenCalled();
  });
  it('keeps a manual choice or newer request safe from cancelled callbacks', () => {
    const ok = vi.fn(), fail = vi.fn();
    requestLocation(ok, fail)();
    success(position); failure({ code: 1 } as GeolocationPositionError);
    vi.advanceTimersByTime(30000);
    expect(ok).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled();
  });
  it.each([[1, 'permission'], [2, 'unavailable'], [3, 'timeout']])('distinguishes native error %s', (code, kind) => {
    const fail = vi.fn(); requestLocation(vi.fn(), fail);
    failure({ code } as GeolocationPositionError);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ kind }));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects invalid and out-of-coverage coordinates', () => {
    for (const latitude of [NaN, 51.5]) {
      const ok = vi.fn(), fail = vi.fn(); requestLocation(ok, fail);
      success({ coords: { latitude, longitude: 100 } } as GeolocationPosition);
      expect(ok).not.toHaveBeenCalled(); expect(fail).toHaveBeenCalledOnce();
    }
  });
  it('handles missing geolocation and synchronous browser errors', () => {
    const fail = vi.fn(); vi.stubGlobal('navigator', {});
    requestLocation(vi.fn(), fail);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unavailable' }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition() { throw new Error('blocked'); } } });
    requestLocation(vi.fn(), fail);
    expect(fail).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
});
