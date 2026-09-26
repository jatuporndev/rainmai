import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWeather, PLACES, thaiTime } from './api';

afterEach(() => vi.unstubAllGlobals());
const forecast = () => ({ current: { temperature_2m: 29 }, hourly: { time: [1780000000], precipitation_probability: [null], precipitation: [0], temperature_2m: [29], weather_code: [0] } });
const mockResponse = (data: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));

describe('weather data boundaries', () => {
  it('preserves unavailable probabilities as null instead of reporting zero', async () => {
    mockResponse(forecast());
    expect((await fetchWeather(PLACES[0], new AbortController().signal)).hourly.precipitation_probability[0]).toBeNull();
  });
  it('rejects missing or mismatched hourly arrays for the error UI', async () => {
    mockResponse({ ...forecast(), hourly: { time: [1780000000] } });
    await expect(fetchWeather(PLACES[0], new AbortController().signal)).rejects.toThrow('incomplete data');
  });
  it('formats epochs in Thailand time irrespective of the machine timezone', () => {
    expect(thaiTime(Date.parse('2026-09-26T12:30:00Z') / 1000)).toBe('19:30');
  });
});
