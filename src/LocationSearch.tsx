import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Crosshair, LoaderCircle, MapPin, Search } from 'lucide-react';
import { PLACES, searchPlaces } from './api';
import type { Place } from './types';
import Dialog from './Dialog';

export default function LocationSearch({ onSelect, onClose }: { onSelect: (place: Place) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setLoading(false); setError(''); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), controller.signal).then(setResults).catch(() => { if (!controller.signal.aborted) setError('Location search is unavailable. Try one of the places below.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const choose = (place: Place) => { onSelect(place); onClose(); };
  const locate = () => {
    if (!navigator.geolocation) { setError('Your browser does not support location access. Search for your city instead.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!mounted.current) return;
      setLocating(false);
      if (coords.latitude < 5.5 || coords.latitude > 20.7 || coords.longitude < 97.3 || coords.longitude > 105.7) { setError('Rainmai currently focuses on Thailand. Choose a Thai city to explore.'); return; }
      choose({ name: 'Your location', region: `${coords.latitude.toFixed(3)}° N, ${coords.longitude.toFixed(3)}° E`, lat: coords.latitude, lon: coords.longitude });
    }, e => { if (!mounted.current) return; setLocating(false); setError(e.code === 1 ? 'Location permission was declined. You can still search for a city.' : 'We could not find your location. Try searching for your city.'); }, { timeout: 12000, maximumAge: 60000 });
  };
  const places = query.trim().length >= 2 && !error ? results : PLACES;
  return <Dialog title="Find your sky" onClose={onClose}>
    <p className="dialog-intro">Your neighborhood, your next move.</p>
    <div className="search-input"><Search size={18} /><input autoFocus placeholder="Search a city in Thailand…" aria-label="Search a city in Thailand" value={query} onChange={e => setQuery(e.target.value)} />{loading && <LoaderCircle size={17} className="spin" />}</div>
    <button className="use-location" onClick={locate} disabled={locating}>{locating ? <LoaderCircle size={18} className="spin" /> : <Crosshair size={18} />} {locating ? 'Finding your location…' : 'Use my current location'}<ArrowUpRight size={17} /></button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="search-caption">{query.trim().length >= 2 && !error ? 'SEARCH RESULTS' : 'EXPLORE THAILAND'}</div>
    <div className="place-results">{places.map((place, i) => <button key={`${place.lat}-${place.lon}-${i}`} onClick={() => choose(place)}><span className="place-icon"><MapPin size={19} /></span><span><strong>{place.name}</strong><small>{place.region}</small></span><ArrowUpRight size={17} /></button>)}{!places.length && !loading && <p className="empty-search">No places found. Try a nearby city or a Thai place name.</p>}{loading && <p className="empty-search">Searching Thailand…</p>}</div>
    <p className="privacy-note">Location is used only to load your weather. No account needed.</p>
  </Dialog>;
}
