import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Crosshair, Droplets, Home, Info, Leaf, LoaderCircle, MapPin, Navigation, Pause, Play, Radio, RefreshCw, Search, ShieldCheck, Umbrella, Wind } from 'lucide-react';
import { thaiTime, weatherLabel } from './api';
import { useWeather } from './useWeather';
import { useLocation } from './useLocation';
import RainMascot, { mascotMood } from './RainMascot';
import MascotGuide from './MascotGuide';
import WeatherAtmosphere, { type Atmosphere } from './WeatherAtmosphere';
import LocationSearch from './LocationSearch';
import Dialog from './Dialog';
import { AboutDialog, ArrivalCard, OutlookDialog, WeatherIcon } from './WeatherDetails';
import './home.css';
import './atmosphere.css';

const RadarMap = lazy(() => import('./RadarMap'));
const advice = {
  easy: { title: 'A little lighter on the umbrella.', thai: 'โอกาสฝนน้อย แต่แวะดูฟ้าอีกนิดก่อนออกไป' },
  prepared: { title: 'An umbrella, just in case.', thai: 'หยิบร่มติดมือ เผื่อฟ้าเปลี่ยนใจ' },
  umbrella: { title: 'A good day to bring your umbrella.', thai: 'พกร่มไว้ อุ่นใจกว่า' },
  raincoat: { title: 'Raincoat on. You’ve got this.', thai: '' },
  waiting: { title: 'Let’s find your sky.', thai: 'มาดูฟ้าแถวคุณกัน' },
};
const validProbability = (value: number | null | undefined) => typeof value === 'number' && value >= 0 && value <= 100 ? value : null;

export default function App() {
  const location = useLocation();
  const { place } = location;
  const [dialog, setDialog] = useState<'location' | 'about' | 'outlook' | 'radar' | 'mascots' | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now() / 1000);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [effectsPaused, setEffectsPaused] = useState(false);
  const data = useWeather(place, refresh, dialog === 'radar');
  const { weather, weatherUpdated, weatherLoading, weatherError, radar, radarLoading, radarError, analysis, analysisLoading } = data;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { setSelectedTime(null); }, [place?.lat, place?.lon]);
  const hours = weather?.hourly.time.map((t, i) => ({ t, i })).filter(h => h.t > now).slice(0, 6) ?? [];
  const selected = hours.find(h => h.t === selectedTime) ?? hours[0];
  const probability = selected ? validProbability(weather?.hourly.precipitation_probability[selected.i]) : null;
  const isFirstHour = !!selected && selected.t === hours[0]?.t;
  const loading = location.status === 'locating' || weatherLoading;
  const mood = mascotMood(probability);
  const atmosphere: Atmosphere = loading ? 'clear' : mood === 'raincoat' ? 'downpour' : mood === 'umbrella' ? 'drizzle' : 'clear';
  useEffect(() => {
    const color = atmosphere === 'downpour' ? '#192d38' : atmosphere === 'drizzle' ? '#dce5e7' : '#f8f9f5';
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousMeta = meta?.getAttribute('content');
    const previousBody = document.body.style.backgroundColor;
    meta?.setAttribute('content', color); document.body.style.backgroundColor = color;
    return () => { if (previousMeta) meta?.setAttribute('content', previousMeta); document.body.style.backgroundColor = previousBody; };
  }, [atmosphere]);
  const copy = advice[mood];
  const retry = () => { setNow(Date.now() / 1000); setRefresh(v => v + 1); };
  const openRadar = () => setDialog(place ? 'radar' : 'location');
  const range = selected ? `${thaiTime(selected.t - 3600)}–${thaiTime(selected.t)} ICT` : 'Thailand time · ICT';
  const date = selected ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' }).format(new Date((selected.t - 3600) * 1000)) : '';
  const heroTitle = location.status === 'locating' ? 'Finding your little patch of sky…' : !place ? 'Let’s find your sky.' : weatherLoading ? 'A little weather check…' : weatherError ? 'The forecast is taking a moment.' : probability == null ? 'This hour is a little unknown.' : copy.title;

  return <div className={`rainmai-home atmosphere-${atmosphere}`} data-atmosphere={atmosphere}>
    <WeatherAtmosphere tone={atmosphere} paused={effectsPaused || dialog !== null} />
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#" aria-label="Rainmai home" onClick={() => { setDialog(null); setSelectedTime(null); }}><span className="brand-icon"><Droplets size={27} strokeWidth={1.8} /></span><span>rainmai<span className="brand-dot">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><button className={!dialog ? 'nav-active' : ''} onClick={() => { setDialog(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Home size={14} /> Your day</button><button onClick={() => document.getElementById('hourly')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Hourly outlook</button><button className={dialog === 'radar' ? 'nav-active' : ''} onClick={openRadar}>Rain radar <ArrowUpRight size={13} /></button></nav>
      <div className="header-right"><span className="thailand-label"><span className="thai-flag" /></span><button className="header-search" onClick={() => setDialog('location')} aria-label="Search locations"><Search size={18} /></button></div>
    </div></header>

    <main className="day-page">
      <div className="day-location-row"><button className="day-location" onClick={() => setDialog('location')} aria-label="Change location"><span className="day-location-icon">{location.status === 'locating' ? <LoaderCircle size={19} className="spin" /> : location.status === 'current' ? <Crosshair size={19} /> : <MapPin size={19} />}</span><span><small>{location.status === 'locating' ? 'FINDING YOU' : location.status === 'current' ? 'RIGHT WHERE YOU ARE' : location.status === 'saved' ? 'SAVED LOCATION · NOT LIVE GPS' : 'YOUR LITTLE PATCH OF SKY'}</small><strong>{place?.name ?? (location.status === 'locating' ? 'Locating your sky…' : 'Choose your location')}<ChevronDown size={14} /></strong></span></button>
        {weather && <div className="day-current"><WeatherIcon code={weather.current.weather_code} size={25} /><span><strong>{weather.current.temperature_2m == null ? '—' : Math.round(weather.current.temperature_2m)}°</strong><small>{weatherLabel(weather.current.weather_code)} · model</small></span></div>}
        <button className="day-refresh" onClick={retry} disabled={!place || weatherLoading} aria-label="Refresh weather data"><RefreshCw size={15} className={weatherLoading ? 'spin' : ''} /></button>
      </div>

      {location.error && <div className="location-notice" role="status"><MapPin size={17} /><p>{location.error}{location.status === 'saved' && <span> Showing your saved location instead.</span>}</p><button onClick={() => setDialog('location')}>Choose area <ArrowRight size={14} /></button></div>}

      <section className={`day-hero hero-${loading ? 'waiting' : mood}`} aria-labelledby="chance-heading">
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-topline"><span><span className="soft-dot" /> YOUR DAILY RAIN CHECK</span><div className="hero-atmosphere-controls">{atmosphere !== 'clear' && <button className="weather-animation-toggle" onClick={() => setEffectsPaused(value => !value)} aria-label={effectsPaused ? 'Resume weather animation' : 'Pause weather animation'} title={effectsPaused ? 'Resume weather animation' : 'Pause weather animation'}>{effectsPaused ? <Play size={14}/> : <Pause size={14}/>}</button>}<button onClick={() => setDialog('about')} aria-label="How rain probabilities work"><Info size={16} /></button></div></div>
        <div className="chance-heading"><h1 id="chance-heading">Chance of rain<span lang="th">โอกาสฝนตก</span></h1><div className="forecast-period">{selected ? <><span>{isFirstHour ? 'This hour' : date}</span><i />{range}</> : loading ? 'One moment. Looking up your forecast.' : 'Choose a location to see your forecast.'}</div></div>
        <div className={`chance-number ${loading ? 'number-loading' : ''}`} aria-live="polite" aria-label={probability == null ? 'Rain probability unavailable' : `${Math.round(probability)} percent chance of rain, ${range}`}><span>{probability == null ? '—' : Math.round(probability)}</span>{probability != null && <sup>%</sup>}</div>
        <div className="character-stage"><div className="character-halo" aria-hidden="true"/><div className="stage-note stage-note-left" aria-hidden="true"><span className="doodle-sun">✳</span><span>A little foresight.</span><svg viewBox="0 0 80 35"><path d="M3 8q28-18 65 15m-13-1 13 1-5-12" /></svg></div><RainMascot probability={probability} loading={loading} /><button className="mascot-info-button" onClick={() => setDialog('mascots')} aria-label="View mascot guide" aria-haspopup="dialog" title="Which mascot appears at each rain probability?"><Info size={18}/></button><div className="stage-note stage-note-right" aria-hidden="true"><svg viewBox="0 0 80 35"><path d="M76 6Q46-4 12 26m2-13-2 13 13-1" /></svg><span>A drier day.</span><Leaf size={22} /></div></div>
        <div className="mascot-message" aria-live="polite"><h2>{heroTitle}</h2><p lang="th">{location.status === 'locating' ? 'กำลังดูฟ้าแถวคุณ' : !place ? 'เลือกพื้นที่ หรืออนุญาตให้เราใช้ตำแหน่งของคุณ' : weatherLoading ? 'กำลังโหลดข้อมูลอากาศล่าสุด' : weatherError ? 'ข้อมูลอากาศยังไม่พร้อม ลองใหม่อีกครั้งได้เลย' : probability == null ? 'ยังไม่มีเปอร์เซ็นต์สำหรับชั่วโมงนี้ ลองดูชั่วโมงอื่นได้' : copy.thai}</p></div>
        {!place && !loading && <div className="hero-actions"><button className="primary-button" onClick={() => setDialog('location')}><MapPin size={15} /> Choose my area</button><button className="text-button" onClick={location.locate}><Crosshair size={14} /> Try my location</button></div>}
        {weatherError && <button className="hero-retry" onClick={retry}><RefreshCw size={14} /> Try again</button>}
        {selected && !isFirstHour && <button className="back-to-now" onClick={() => setSelectedTime(null)}><ArrowLeft size={13} /> Back to this hour</button>}
        <div className="hero-source"><span className="model-source-dot"/><span>Weather model by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>{weatherUpdated && <> · checked {thaiTime(weatherUpdated)} ICT</>}</span></div>
      </section>

      <section className="day-hourly" id="hourly" aria-labelledby="hourly-heading">
        <div className="day-section-heading"><div><span className="section-overline">A LITTLE LOOK AHEAD</span><h2 id="hourly-heading">The hourly outlook<span>.</span></h2></div><button onClick={() => setDialog(place ? 'outlook' : 'location')} className="all-hours">Next 24 hours <ArrowUpRight size={15} /></button></div>
        <p className="hourly-help">Tap an hour. Our little friend will get ready with you.</p>
        {loading ? <div className="day-hour-skeleton" aria-label="Loading hourly forecast">{Array.from({ length: 6 }, (_, i) => <div key={i}><i/><i/><i/></div>)}</div> : !weather || !hours.length ? <div className="day-hour-empty"><Umbrella size={24}/><p>{weatherError ? 'The hourly forecast is temporarily unavailable.' : 'Your hourly forecast will appear once we know your location.'}</p><button onClick={place ? retry : () => setDialog('location')}>{place ? 'Try again' : 'Choose location'}<ArrowRight size={14}/></button></div> : <div className="day-hours" role="group" aria-label="Choose a forecast hour">{hours.map(({ t, i }, position) => {
          const p = validProbability(weather.hourly.precipitation_probability[i]);
          const active = selected?.t === t;
          return <button className={`day-hour ${active ? 'selected' : ''}`} key={t} aria-pressed={active} aria-label={`${thaiTime(t - 3600)} to ${thaiTime(t)} ICT, ${p == null ? 'probability unavailable' : `${Math.round(p)} percent chance of rain`}`} onClick={() => setSelectedTime(t)}><span className="day-hour-time">{position === 0 ? 'This hour' : thaiTime(t - 3600)}</span><WeatherIcon code={weather.hourly.weather_code[i]} size={25}/><strong>{p == null ? '—' : <>{Math.round(p)}<span>%</span></>}</strong><span className="day-hour-rain">{weather.hourly.precipitation[i] == null ? '—' : weather.hourly.precipitation[i]} mm</span><span className="day-hour-meter"><i style={{ width: p == null ? 0 : `${p}%` }}/></span></button>;
        })}</div>}
        <div className="day-hour-note"><Info size={13}/><span>Chance of rain, not how heavy. Model estimates for each hour; showers can still change.</span><span className="hour-timezone">ICT · UTC+7</span></div>
      </section>

      <button className="radar-invitation" onClick={openRadar}><span className="radar-invitation-art" aria-hidden="true"><span/><span/><span/><Radio size={24}/><i/></span><span className="radar-invitation-copy"><small>WANT THE BIGGER PICTURE?</small><strong>See what’s on the way<span>.</span></strong><span>Live radar, rain movement & experimental arrival estimates.</span></span><span className="radar-invitation-link">Explore the radar <ArrowUpRight size={18}/></span></button>

      {weather && <div className="day-details" aria-label="Current weather model details"><span><Wind size={17}/><strong>{weather.current.wind_speed_10m == null ? '—' : Math.round(weather.current.wind_speed_10m)} km/h</strong> wind</span><span><Droplets size={16}/><strong>{weather.current.relative_humidity_2m == null ? '—' : weather.current.relative_humidity_2m}%</strong> humidity</span><span><span className="feels-icon" aria-hidden="true">☀</span><strong>Feels like {weather.current.apparent_temperature == null ? '—' : Math.round(weather.current.apparent_temperature)}°</strong></span><small>Current weather · model</small></div>}
      <div className="day-promise"><ShieldCheck size={15}/><p>A clearer picture. A little less guesswork.</p><button onClick={() => setDialog('about')}>Our data, explained <ArrowUpRight size={12}/></button></div>
    </main>

    <footer><div className="footer-brand"><Droplets size={18}/><strong>rainmai.</strong><span>ฝนไหม · Will it rain?</span></div><p>Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo <ArrowUpRight size={10}/></a><span>·</span>Radar by <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer <ArrowUpRight size={10}/></a></p><button onClick={() => setDialog('about')}>Made for Thailand <span className="thai-flag"/></button></footer>

    {dialog === 'location' && <LocationSearch onSelect={location.choose} onClose={() => setDialog(null)}/>}
    {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)}/>}
    {dialog === 'mascots' && <MascotGuide probability={loading ? null : probability} onClose={() => setDialog(null)}/>}
    {dialog === 'outlook' && place && <OutlookDialog place={place} weather={weather} weatherLoading={weatherLoading} weatherError={weatherError} now={now} retry={retry} onClose={() => setDialog(null)}/>}
    {dialog === 'radar' && place && <Dialog title={`A closer look at ${place.name.toLowerCase()}`} className="radar-dialog" wide onClose={() => setDialog(null)}><p className="dialog-intro">Observed rain. Experimental predictions. Always kept distinct.</p><div className="radar-dialog-grid"><Suspense fallback={<div className="radar-lazy-loading"><LoaderCircle className="spin"/>Opening your rain map…</div>}><RadarMap place={place} radar={radar} loading={radarLoading} error={radarError} analysis={analysis} now={now} onSelect={location.choose} onRetry={retry}/></Suspense><div className="radar-detail-side"><ArrivalCard analysis={analysis} loading={analysisLoading} radarError={radarError} now={now} onInfo={() => setDialog('about')}/><div className="radar-motion-note"><Navigation size={19}/><div><small>RAIN MOVEMENT</small><strong>{analysis && analysis.speed >= 3 && now - analysis.time < 2100 ? `Toward ${analysis.direction} · about ${Math.round(analysis.speed)} km/h` : 'No consistent movement to show yet'}</strong><p>Based on recent radar patterns, not the hourly weather model.</p></div></div><button className="radar-change-location" onClick={() => setDialog('location')}><MapPin size={15}/>Change location<ArrowRight size={14}/></button></div></div></Dialog>}

    <nav className="mobile-nav" aria-label="Mobile navigation"><button className={!dialog ? 'active' : ''} onClick={() => { setDialog(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Home size={20}/><span>Your day</span></button><button className={dialog === 'radar' ? 'active' : ''} onClick={openRadar}><Radio size={20}/><span>Radar</span></button><button className={dialog === 'location' ? 'active' : ''} onClick={() => setDialog('location')}><MapPin size={20}/><span>Location</span></button><button className={dialog === 'about' ? 'active' : ''} onClick={() => setDialog('about')}><Info size={20}/><span>About</span></button></nav>
  </div>;
}
