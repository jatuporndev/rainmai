import { useEffect, useState } from 'react';
import { ArrowUpRight, Crosshair, LoaderCircle, MapPin, Search } from 'lucide-react';
import { PLACES, searchPlaces } from './api';
import type { Place } from './types';
import Dialog from './Dialog';

export default function LocationSearch({ onSelect, onLocate, onClose }: { onSelect: (place: Place) => void; onLocate: () => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    onLocate(); onClose();
  };
  const places = query.trim().length >= 2 && !error ? results : PLACES;
  return <Dialog title="Find your sky" onClose={onClose}>
    <p className="dialog-intro">Your neighborhood, your next move.</p>
    <div className="search-input"><Search size={18} /><input autoFocus placeholder="Search a city in Thailand…" aria-label="Search a city in Thailand" value={query} onChange={e => setQuery(e.target.value)} />{loading && <LoaderCircle size={17} className="spin" />}</div>
    <button className="use-location" onClick={locate}><Crosshair size={18} /> Use my current location<ArrowUpRight size={17} /></button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="search-caption">{query.trim().length >= 2 && !error ? 'SEARCH RESULTS' : 'EXPLORE THAILAND'}</div>
    <div className="place-results">{places.map((place, i) => <button key={`${place.lat}-${place.lon}-${i}`} onClick={() => choose(place)}><span className="place-icon"><MapPin size={19} /></span><span><strong>{place.name}</strong><small>{place.region}</small></span><ArrowUpRight size={17} /></button>)}{!places.length && !loading && <p className="empty-search">No places found. Try a nearby city or a Thai place name.</p>}{loading && <p className="empty-search">Searching Thailand…</p>}</div>
    <p className="privacy-note">Location is used only to load your weather. No account needed.</p>
  </Dialog>;
}
