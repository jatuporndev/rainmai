import type { Place, RadarData, WeatherData } from './types';
import { requestData } from './request';

export const PLACES: Place[] = [
  { name: 'Bangkok', region: 'Bangkok Metropolis', lat: 13.7563, lon: 100.5018 },
  { name: 'Chiang Mai', region: 'Northern Thailand', lat: 18.7883, lon: 98.9853 },
  { name: 'Phuket', region: 'Southern Thailand', lat: 7.8804, lon: 98.3923 },
  { name: 'Pattaya', region: 'Chon Buri', lat: 12.9236, lon: 100.8825 },
  { name: 'Khon Kaen', region: 'Northeastern Thailand', lat: 16.4322, lon: 102.8236 },
  { name: 'Hat Yai', region: 'Songkhla', lat: 7.0084, lon: 100.4747 },
];

export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  return requestData(url, response => response.json(), signal);
}

export async function fetchRadar(signal: AbortSignal) {
  const data = await getJSON<RadarData>('https://api.rainviewer.com/public/weather-maps.json', signal);
  if (!data.host?.startsWith('https://') || !Array.isArray(data.radar?.past) || !data.radar.past.length) throw new Error('No radar frames are available from RainViewer.');
  data.radar.past = data.radar.past.filter(f => Number.isFinite(f.time) && typeof f.path === 'string').sort((a, b) => a.time - b.time);
  if (!data.radar.past.length) throw new Error('The radar timeline is temporarily unavailable.');
  return data;
}

export async function fetchWeather(place: Place, signal: AbortSignal) {
  const params = new URLSearchParams({
    latitude: String(place.lat), longitude: String(place.lon),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'precipitation_probability,precipitation,temperature_2m,weather_code',
    timezone: 'Asia/Bangkok', timeformat: 'unixtime', forecast_days: '2',
  });
  const data = await getJSON<WeatherData>(`https://api.open-meteo.com/v1/forecast?${params}`, signal);
  const h = data.hourly;
  if (!data.current || !Array.isArray(h?.time) || !h.time.length || !h.time.every(Number.isFinite) ||
    ![h.precipitation_probability, h.precipitation, h.temperature_2m, h.weather_code].every(series =>
      Array.isArray(series) && series.length === h.time.length && series.every(value => value === null || Number.isFinite(value)))) {
    throw new Error('The weather provider returned incomplete data.');
  }
  return data;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const data = await getJSON<{ results?: { name: string; admin1?: string; latitude: number; longitude: number; country_code: string }[] }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=12&language=en&countryCode=TH`, signal);
  return (data.results ?? []).filter(p => p.country_code === 'TH').map(p => ({ name: p.name, region: p.admin1 ?? 'Thailand', lat: p.latitude, lon: p.longitude }));
}

export function thaiTime(seconds: number, hourOnly = false) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', ...(hourOnly ? {} : { minute: '2-digit' }), hour12: false }).format(new Date(seconds * 1000)) + (hourOnly ? ':00' : '');
}
export function weatherLabel(code: number | null | undefined) {
  if (code == null) return 'Weather unavailable';
  if (code === 0) return 'Clear skies';
  if (code < 3) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code < 50) return 'Misty skies';
  if (code < 60) return 'Light drizzle';
  if (code < 70) return 'Rainy skies';
  if (code < 80) return 'Wintry showers';
  if (code < 90) return 'Rain showers';
  return 'Thunderstorms';
}
