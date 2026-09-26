export interface Place { name: string; region: string; lat: number; lon: number }
export interface RadarFrame { time: number; path: string }
export interface RadarData { host: string; generated: number; radar: { past: RadarFrame[] } }
export interface WeatherData {
  current: { time: number; temperature_2m: number | null; apparent_temperature: number | null; relative_humidity_2m: number | null; weather_code: number | null; wind_speed_10m: number | null; is_day: number };
  hourly: { time: number[]; precipitation_probability: (number | null)[]; precipitation: (number | null)[]; temperature_2m: (number | null)[]; weather_code: (number | null)[] };
}
export type MotionStatus = 'ready' | 'raining' | 'no-echo' | 'no-coverage' | 'uncertain' | 'stale' | 'error';
export interface MotionResult {
  status: MotionStatus; dx: number; dy: number; arrival: number | null;
  speed: number; direction: string; reason: string;
}
export interface Analysis extends MotionResult { image: string; time: number; computedAt: number; lat: number; lon: number }
