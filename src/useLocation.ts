import { useCallback, useEffect, useRef, useState } from 'react';
import type { Place } from './types';

export type LocationStatus = 'locating' | 'current' | 'selected' | 'saved' | 'needed';
function savedPlace(): Place | null {
  try {
    const p = JSON.parse(localStorage.getItem('rainmai-place') ?? 'null');
    if (p && typeof p.name === 'string' && typeof p.region === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat >= 5.5 && p.lat <= 20.7 && p.lon >= 97.3 && p.lon <= 105.7) {
      return { ...p, name: /^(Your location|Current location)$/.test(p.name) ? 'Saved location' : p.name };
    }
  } catch { /* Storage is optional. */ }
  return null;
}
function remember(place: Place) {
  try { localStorage.setItem('rainmai-place', JSON.stringify(place)); } catch { /* Storage is optional. */ }
}

export function useLocation() {
  const [place, setPlace] = useState<Place | null>(null);
  const [status, setStatus] = useState<LocationStatus>('locating');
  const [error, setError] = useState('');
  const request = useRef(0);
  const choose = useCallback((next: Place) => {
    request.current++;
    setPlace(next); setStatus('selected'); setError(''); remember(next);
  }, []);
  const locate = useCallback(() => {
    const token = ++request.current;
    setStatus('locating'); setError(''); setPlace(null);
    const fail = (message: string) => {
      if (token !== request.current) return;
      const saved = savedPlace();
      setPlace(saved); setStatus(saved ? 'saved' : 'needed'); setError(message);
    };
    if (!navigator.geolocation) { fail('Location access is unavailable in this browser. Choose your area instead.'); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (token !== request.current) return;
      if (coords.latitude < 5.5 || coords.latitude > 20.7 || coords.longitude < 97.3 || coords.longitude > 105.7) {
        fail('Rainmai covers Thailand. Choose a location in Thailand to explore.'); return;
      }
      const next = { name: 'Current location', region: `${coords.latitude.toFixed(3)}° N, ${coords.longitude.toFixed(3)}° E`, lat: coords.latitude, lon: coords.longitude };
      setPlace(next); setStatus('current'); remember(next);
    }, e => fail(e.code === 1 ? 'Location permission is off. You can choose your area below.' : 'We couldn’t find your location. Try again or choose your area.'), { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false });
  }, []);
  useEffect(() => {
    // Defer once so React StrictMode does not make duplicate GPS requests.
    const timer = setTimeout(locate, 0);
    return () => { clearTimeout(timer); request.current++; };
  }, [locate]);
  return { place, status, error, choose, locate };
}
