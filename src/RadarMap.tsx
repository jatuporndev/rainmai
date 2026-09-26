import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowUpRight, ChevronDown, Crosshair, Expand, Layers, LoaderCircle, Minus, Pause, Play, Plus, Radio, RotateCcw, Shrink } from 'lucide-react';
import { fromWorld, worldPoint } from './motion';
import { thaiTime } from './api';
import type { Analysis, Place, RadarData } from './types';

interface Props { place: Place; radar: RadarData | null; loading: boolean; error: string; analysis: Analysis | null; now: number; onSelect: (place: Place) => void; onRetry: () => void }

export default function RadarMap({ place, radar, loading, error, analysis, now, onSelect, onRetry }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.Layer | null>(null);
  const currentPlace = useRef(place);
  const onSelectRef = useRef(onSelect);
  currentPlace.current = place; onSelectRef.current = onSelect;
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [showRadar, setShowRadar] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [baseError, setBaseError] = useState(false);
  const [coverageError, setCoverageError] = useState(false);
  const [tileLoading, setTileLoading] = useState(false);
  const frames = radar?.radar.past.slice(-7) ?? [];
  const latest = frames.length - 1;
  const selected = index < 0 ? latest : Math.min(index, latest + 6);
  const future = selected > latest;
  const lead = future ? (selected - latest) * 10 : 0;
  const canPredict = !!analysis && (analysis.status === 'ready' || analysis.status === 'raining') && analysis.speed >= 3 && now - analysis.time < 2100;
  const lastTime = frames.at(-1)?.time ?? now;
  const frameTime = future ? now + lead * 60 : frames[selected]?.time;

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, { zoomControl: false, attributionControl: true, center: [currentPlace.current.lat, currentPlace.current.lon], zoom: 8, minZoom: 5, maxZoom: 12, maxBounds: [[0, 90], [27, 113]], maxBoundsViscosity: 0.7 });
    map.current = instance;
    instance.attributionControl.setPrefix(false);
    const base = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>', className: 'base-tiles' }).addTo(instance);
    base.on('tileerror', () => setBaseError(true));
    base.on('tileload', () => setBaseError(false));
    instance.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      if (lat >= 5.5 && lat <= 20.7 && lng >= 97.3 && lng <= 105.7) onSelectRef.current({ name: 'Selected point', region: `${lat.toFixed(3)}° N, ${lng.toFixed(3)}° E`, lat, lon: lng });
    });
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.flyTo([place.lat, place.lon], instance.getZoom(), { duration: 0.8 });
    const group = L.layerGroup().addTo(instance);
    [20000, 40000].forEach(radius => L.circle([place.lat, place.lon], { radius, color: '#527365', weight: 1, opacity: 0.2, fill: false, dashArray: '3 7', interactive: false }).addTo(group));
    const icon = L.divIcon({ className: 'location-marker', iconSize: [24, 24], iconAnchor: [12, 12], html: '<span class="pin-ring"></span><span class="pin-center"></span>' });
    const marker = L.marker([place.lat, place.lon], { icon, interactive: false }).addTo(group);
    // textContent avoids interpreting provider location names as HTML.
    const label = document.createElement('span'); label.textContent = place.name;
    marker.bindTooltip(label, { permanent: true, direction: 'bottom', offset: [0, 19], className: 'location-tooltip' });
    return () => { group.remove(); };
  }, [place]);

  useEffect(() => { setIndex(-1); setPlaying(false); }, [radar, place]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (overlay.current) { instance.removeLayer(overlay.current); overlay.current = null; }
    setTileError(false); setTileLoading(false);
    if (!radar || !showRadar || !frames.length) return;
    let layer: L.TileLayer | L.ImageOverlay;
    if (future) {
      if (!analysis || !canPredict) return;
      const center = worldPoint(place.lat, place.lon);
      const minutes = Math.max(0, (now - analysis.time) / 60) + lead;
      const x = center.x + analysis.dx * minutes, y = center.y + analysis.dy * minutes;
      const bounds: L.LatLngBoundsExpression = [fromWorld(x - 128, y + 128), fromWorld(x + 128, y - 128)];
      layer = L.imageOverlay(analysis.image, bounds, { opacity: 0.65, className: 'prediction-image', interactive: false });
      layer.on('error', () => { setTileError(true); setTileLoading(false); });
    } else {
      const frame = frames[selected];
      if (!frame) return;
      layer = L.tileLayer(`${radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_0.png`, { opacity: 0.72, maxNativeZoom: 7, maxZoom: 12, tileSize: 256, attribution: '<a href="https://www.rainviewer.com" target="_blank" rel="noreferrer">RainViewer</a>' });
      layer.on('tileerror', () => { setTileError(true); setTileLoading(false); });
    }
    setTileLoading(true);
    layer.on('load', () => setTileLoading(false));
    layer.addTo(instance); overlay.current = layer;
    return () => { layer.remove(); };
  // Rebuild only for the displayed frame, not on every clock tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radar, selected, showRadar, place, analysis, canPredict]);

  useEffect(() => {
    setCoverageError(false);
    if (!map.current || !radar || !showCoverage) return;
    const layer = L.tileLayer(`${radar.host}/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png`, { opacity: 0.28, maxNativeZoom: 7, maxZoom: 12 }).addTo(map.current);
    layer.on('tileerror', () => setCoverageError(true));
    return () => { layer.remove(); };
  }, [radar, showCoverage]);

  useEffect(() => {
    if (!playing || !frames.length) return;
    const timer = setInterval(() => setIndex(i => {
      const at = i < 0 ? latest : i;
      const end = canPredict ? latest + 6 : latest;
      return at >= end ? 0 : at + 1;
    }), 950);
    return () => clearInterval(timer);
  }, [playing, latest, canPredict, frames.length]);

  useEffect(() => {
    if (!expanded) return;
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', listener);
    return () => { document.body.style.overflow = old; window.removeEventListener('keydown', listener); };
  }, [expanded]);

  return <section className={`radar-card ${expanded ? 'map-expanded' : ''}`} aria-label="Interactive rain radar">
    <div className="radar-heading"><div className="radar-title"><Radio size={18} /><h2>Rain, in real time</h2><span className="live-tag"><i /> {error ? 'UNAVAILABLE' : loading ? 'CONNECTING' : now - lastTime > 2100 ? 'DELAYED' : future ? 'PREDICTION' : selected < latest ? 'HISTORY' : 'LIVE RADAR'}</span></div><button className="icon-button expand-button" aria-label={expanded ? 'Exit expanded map' : 'Expand map'} onClick={() => setExpanded(v => !v)}>{expanded ? <Shrink size={17} /> : <Expand size={17} />}</button></div>
    <div className="map-stage">
      <div ref={container} className="map-container" aria-label="Rain radar map. Drag to explore; click a point in Thailand to select it." />
      <div className={`map-time ${future ? 'forecast-time' : ''}`}><span className="status-dot" /><span>{future ? 'EXPERIMENTAL FORECAST' : 'OBSERVED RADAR'}</span><b>{frameTime ? thaiTime(frameTime) : '—'} <small>ICT</small></b></div>
      <div className="map-top-right"><button className="map-control layers-button" aria-label="Layers" onClick={() => setLayersOpen(v => !v)} aria-expanded={layersOpen}><Layers size={16} /><span>Layers</span><ChevronDown size={13} /></button>
        {layersOpen && <div className="layers-popover"><strong>Map layers</strong><label><input type="checkbox" checked={showRadar} onChange={e => setShowRadar(e.target.checked)} /> Rain radar</label><label><input type="checkbox" checked={showCoverage} onChange={e => setShowCoverage(e.target.checked)} /> Coverage mask</label><p>Shaded areas have no radar coverage. Range rings: 20 & 40 km.</p></div>}
      </div>
      <div className="map-zoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={19} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={19} /></button><button className="recenter" aria-label="Recenter on selected location" onClick={() => map.current?.flyTo([place.lat, place.lon], 8)}><Crosshair size={19} /></button></div>
      {loading && !radar && <div className="map-message"><LoaderCircle className="spin" size={20} /><span>Connecting to the radar…</span></div>}
      {(error || tileError || baseError || coverageError || (future && !canPredict)) && <div className="map-message map-message-error" role="status"><Radio size={20} /><span>{error || (future && !canPredict ? 'Not enough radar evidence for a motion forecast here.' : coverageError ? 'The coverage mask could not load. Radar availability in blank areas is unknown.' : tileError ? 'Some radar tiles could not load. Empty areas may have missing data.' : 'The base map could not load. Check your connection.')}</span><button onClick={onRetry} aria-label="Retry map data"><RotateCcw size={16} /></button></div>}
      {tileLoading && radar && <div className="tile-loading"><LoaderCircle size={12} className="spin" /> Loading frame</div>}
      <div className="map-legend"><span>Rain intensity</span><div className="legend-colors"><i /><i /><i /><i /><i /></div><div className="legend-labels"><span>Light</span><span>Heavy</span></div></div>
      <div className="map-hint"><span className="tiny-pin" /> Tap the map to explore a location</div>
      {future && canPredict && <div className="prediction-caution"><ArrowUpRight size={13} /> Local projection only · storms can change</div>}
    </div>
    <div className="timeline">
      <div className="timeline-top"><div className="timeline-tabs"><button className={!future ? 'active' : ''} onClick={() => { setIndex(-1); setPlaying(false); }}>Observed</button><button className={future ? 'active future-active' : ''} onClick={() => { setIndex(latest + 1); setPlaying(false); }} disabled={!frames.length}>Prediction <span>+60 min</span></button></div><span className="frame-age">{radar ? `${Math.max(0, Math.floor((now - lastTime) / 60))} min since latest frame` : 'Waiting for radar'}</span></div>
      <div className="timeline-scrubber"><button className="play-button" onClick={() => setPlaying(p => !p)} disabled={!frames.length} aria-label={playing ? 'Pause radar animation' : 'Play radar animation'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><div className="timeline-track"><div className="track-observed" style={{ width: `${frames.length ? latest / (latest + 6) * 100 : 50}%` }} /><input aria-label="Radar timeline" aria-valuetext={future ? `Experimental forecast ${lead} minutes ahead` : `Observed ${frameTime ? thaiTime(frameTime) : 'unavailable'}`} type="range" min={0} max={Math.max(1, latest + 6)} value={Math.max(0, selected)} disabled={!frames.length} onChange={e => { setIndex(Number(e.target.value)); setPlaying(false); }} /><div className="timeline-ticks"><span>−60 min</span><span>−30</span><span className="now-tick">Latest</span><span>+30</span><span>+60 min</span></div></div></div>
      <div className="timeline-foot"><span><i className="observed-key" /> Radar observation</span><span><i className="prediction-key" /> Motion estimate, not a guarantee</span></div>
    </div>
  </section>;
}
