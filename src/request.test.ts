import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestData } from './request';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Safari-compatible data requests', () => {
  it('loads data without the newer AbortSignal static helpers and cleans up', async () => {
    vi.stubGlobal('AbortSignal', {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 60 }) }));
    await expect(requestData('/forecast', response => response.json())).resolves.toEqual({ value: 60 });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels both an in-flight request and a request that was already cancelled', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      signals.push(options.signal); return { ok: true, json: async () => ({}) };
    }));
    const controller = new AbortController();
    const first = requestData('/forecast', response => response.json(), controller.signal);
    controller.abort(); await first;
    await requestData('/forecast', response => response.json(), controller.signal);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a stalled response body, not just the connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({ ok: true, json: () => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }) })));
    const result = expect(requestData('/forecast', response => response.json())).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(18000); await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up after a provider failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(requestData('/forecast', response => response.json())).rejects.toThrow('503');
    expect(vi.getTimerCount()).toBe(0);
  });
});
