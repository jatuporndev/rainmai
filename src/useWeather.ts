import { useEffect, useState } from 'react';
import { fetchRadar, fetchWeather } from './api';
import { decodeRadar } from './motion';
import { requestData } from './request';
import type { Analysis, MotionResult, Place, RadarData, WeatherData } from './types';

async function pixels(url: string, signal: AbortSignal) {
  const blob = await requestData(url, response => response.blob(), signal);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, 256, 256);
  bitmap.close();
  return ctx.getImageData(0, 0, 256, 256).data;
}

export function useWeather(place: Place | null, refresh: number, radarEnabled = true) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherKey, setWeatherKey] = useState('');
  const [weatherUpdated, setWeatherUpdated] = useState<number | null>(null);
  const placeKey = place ? `${place.lat},${place.lon}` : '';
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [radarError, setRadarError] = useState('');
  const [radarLoading, setRadarLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [cycle, setCycle] = useState(0);
  useEffect(() => { const timer = setInterval(() => setCycle(c => c + 1), 300000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setWeather(null); setWeatherError(''); setWeatherLoading(true);
    setWeatherKey(placeKey); setWeatherUpdated(null);
    if (!place) { setWeatherLoading(false); return; }
    fetchWeather(place, controller.signal).then(data => { if (!controller.signal.aborted) { setWeather(data); setWeatherUpdated(Date.now() / 1000); } })
      .catch(() => { if (!controller.signal.aborted) setWeatherError('Hourly weather is temporarily unavailable. Check your connection and try again.'); })
      .finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    return () => controller.abort();
  }, [placeKey, refresh, cycle]);
  useEffect(() => {
    const controller = new AbortController();
    if (!radarEnabled || !place) { setRadarLoading(false); return; }
    setRadarError(''); setRadarLoading(true);
    fetchRadar(controller.signal).then(data => { if (!controller.signal.aborted) setRadar(data); })
      .catch(() => { if (!controller.signal.aborted) { setRadar(null); setRadarError('Radar is temporarily unavailable. Your hourly forecast is loaded separately.'); } })
      .finally(() => { if (!controller.signal.aborted) setRadarLoading(false); });
    return () => controller.abort();
  }, [refresh, cycle, radarEnabled, !!place]);
  useEffect(() => {
    const controller = new AbortController();
    let worker: Worker | undefined;
    setAnalysis(null); setAnalysisLoading(true);
    if (!radarEnabled || !place) { setAnalysisLoading(false); return; }
    if (!radar) { setAnalysisLoading(radarLoading); return; }
    const frames = radar.radar.past.slice(-3);
    const coordinate = `${place.lat.toFixed(5)}/${place.lon.toFixed(5)}`;
    const urls = frames.map(f => `${radar.host}${f.path}/256/7/${coordinate}/2/0_0.png`);
    const coverageUrl = `${radar.host}/v2/coverage/0/256/7/${coordinate}/0/0_0.png`;
    const last = frames.at(-1)!;
    const finish = (result: MotionResult) => {
      if (controller.signal.aborted) return;
      setAnalysis({ ...result, image: urls.at(-1)!, time: last.time, computedAt: Date.now() / 1000, lat: place.lat, lon: place.lon }); setAnalysisLoading(false);
    };
    Promise.all([...urls.map(url => pixels(url, controller.signal)), pixels(coverageUrl, controller.signal)]).then(images => {
      if (controller.signal.aborted) return;
      const mask = images.pop()!;
      const coverage = new Uint8Array(256 * 256);
      for (let i = 0; i < coverage.length; i++) coverage[i] = mask[i * 4 + 3] < 40 ? 1 : 0;
      worker = new Worker(new URL('./motion.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<MotionResult>) => { finish(e.data); worker?.terminate(); };
      worker.onerror = () => { finish({ status: 'error', dx: 0, dy: 0, speed: 0, direction: '—', arrival: null, reason: 'Radar analysis could not finish. Please refresh to try again.' }); worker?.terminate(); };
      const grids = images.map(decodeRadar);
      worker.postMessage({ grids, coverage, times: frames.map(f => f.time), lat: place.lat, now: Date.now() / 1000 });
    }).catch(() => finish({ status: 'error', dx: 0, dy: 0, speed: 0, direction: '—', arrival: null, reason: 'Local radar imagery or coverage could not be loaded. Arrival estimates are unavailable.' }));
    return () => { controller.abort(); worker?.terminate(); };
  }, [radar, radarLoading, placeKey, radarEnabled]);
  // Hide results for the previous coordinates immediately, before effects clear them.
  const localAnalysis = place && analysis?.lat === place.lat && analysis.lon === place.lon ? analysis : null;
  const isLocal = weatherKey === placeKey;
  return { weather: isLocal ? weather : null, weatherUpdated: isLocal ? weatherUpdated : null, weatherError: isLocal ? weatherError : '', weatherLoading: !!place && (!isLocal || weatherLoading), radar, radarError, radarLoading, analysis: localAnalysis, analysisLoading };
}
