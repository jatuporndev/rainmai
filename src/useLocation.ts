import { useCallback, useEffect, useRef, useState } from 'react';
import type { Place } from './types';
import { needsLocationTap, requestLocation, type LocationFailure } from './geolocation';

export type LocationStatus = 'ready' | 'locating' | 'current' | 'selected' | 'saved' | 'needed';
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
  const [status, setStatus] = useState<LocationStatus>(() => needsLocationTap(navigator) ? 'ready' : 'locating');
  const [error, setError] = useState('');
  const [failureKind, setFailureKind] = useState<LocationFailure['kind'] | null>(null);
  const [failureDetail, setFailureDetail] = useState('');
  const cancelRequest = useRef<(() => void) | null>(null);
  const choose = useCallback((next: Place) => {
    cancelRequest.current?.();
    setPlace(next); setStatus('selected'); setError(''); setFailureKind(null); setFailureDetail(''); remember(next);
  }, []);
  const locate = useCallback(() => {
    cancelRequest.current?.();
    setStatus('locating'); setError(''); setFailureKind(null); setFailureDetail(''); setPlace(null);
    cancelRequest.current = requestLocation(next => {
      setPlace(next); setStatus('current'); remember(next);
    }, failure => {
      const saved = savedPlace();
      setPlace(saved); setStatus(saved ? 'saved' : 'needed'); setError(failure.message); setFailureKind(failure.kind);
      setFailureDetail(failure.detail ?? '');
    });
  }, []);
  useEffect(() => {
    if (needsLocationTap(navigator)) return () => cancelRequest.current?.();
    // Defer once so React StrictMode does not make duplicate GPS requests.
    const timer = setTimeout(locate, 0);
    return () => { clearTimeout(timer); cancelRequest.current?.(); };
  }, [locate]);
  return { place, status, error, failureKind, failureDetail, choose, locate };
}
