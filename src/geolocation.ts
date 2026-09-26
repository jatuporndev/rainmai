import type { Place } from './types';

export type LocationFailure = { kind: 'permission' | 'timeout' | 'unavailable' | 'outside'; message: string; detail?: string };

// iPadOS can identify as a Mac. Keep its first location request inside a real
// tap, too. This is a conservative UX choice, not a permission-state test.
export function needsLocationTap(browser: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  return /iPhone|iPad|iPod/.test(browser.userAgent) || (browser.platform === 'MacIntel' && browser.maxTouchPoints > 1);
}

// Invoke synchronously from the button handler, without a Permissions API
// preflight. Safari can report a permission state that differs from its prompt.
export function requestLocation(onSuccess: (place: Place) => void, onFailure: (failure: LocationFailure) => void) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { active = false; clearTimeout(timer); };
  const fail = (failure: LocationFailure) => {
    if (!active) return;
    cancel(); onFailure(failure);
  };
  const timeout = () => fail({ kind: 'timeout', message: 'Finding your location took too long. Tap Try my location to request it again, or choose your area.' });
  if (!navigator.geolocation) {
    fail({ kind: 'unavailable', message: 'Location access is unavailable in this browser. Choose your area instead.' });
    return cancel;
  }
  // Some browser/OS permission flows never deliver a callback. Always let the
  // user recover; ignore any late result after timeout, retry or manual choice.
  timer = setTimeout(timeout, 25000);
  try {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!active) return;
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
        fail({ kind: 'unavailable', message: 'Your device could not find a location. Try again or choose your area.' }); return;
      }
      if (coords.latitude < 5.5 || coords.latitude > 20.7 || coords.longitude < 97.3 || coords.longitude > 105.7) {
        fail({ kind: 'outside', message: 'Rainmai covers Thailand. Choose a location in Thailand to explore.' }); return;
      }
      cancel();
      onSuccess({ name: 'Current location', region: `${coords.latitude.toFixed(3)}° N, ${coords.longitude.toFixed(3)}° E`, lat: coords.latitude, lon: coords.longitude });
    }, error => {
      if (error.code === 1) fail({ kind: 'permission', message: 'Your browser did not grant location access. This can happen even when the website setting is Ask.', detail: error.message?.slice(0, 300) });
      else if (error.code === 3) timeout();
      else fail({ kind: 'unavailable', message: 'Your device could not find a location. Check Location Services, then try again or choose your area.', detail: error.message?.slice(0, 300) });
    }, { timeout: 20000, maximumAge: 60000, enableHighAccuracy: false });
  } catch {
    fail({ kind: 'unavailable', message: 'Location access could not start. Open Rainmai directly in Safari or another browser, or choose your area.' });
  }
  return cancel;
}
