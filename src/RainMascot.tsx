import { useId } from 'react';

export type MascotMood = 'waiting' | 'easy' | 'prepared' | 'umbrella' | 'raincoat';
export type MascotPose = Exclude<MascotMood, 'waiting'>;

export function mascotMood(probability: number | null): MascotMood {
  if (probability == null || !Number.isFinite(probability) || probability < 0 || probability > 100) return 'waiting';
  // Match the whole-number probability shown in the interface at every boundary.
  const displayed = Math.round(probability);
  if (displayed < 30) return 'easy';
  if (displayed < 60) return 'prepared';
  if (displayed < 80) return 'umbrella';
  return 'raincoat';
}

export const MASCOT_POSES: { mood: MascotPose; range: string; title: string; description: string; crop: [number, number, number, number] }[] = [
  { mood: 'easy', range: '0–29%', title: 'Taking it easy', description: 'ต่ำกว่า 30% · ยืนยิ้มสบาย ๆ', crop: [360, 145, 210, 363] },
  { mood: 'prepared', range: '30–59%', title: 'Just in case', description: '30–59% · เตรียมร่มไว้ข้างตัว', crop: [715, 160, 278, 347] },
  { mood: 'umbrella', range: '60–79%', title: 'Umbrella ready', description: '60–79% · กางร่มพร้อมแล้ว', crop: [1024, 55, 355, 490] },
  { mood: 'raincoat', range: '80–100%', title: 'Raincoat on', description: '80% ขึ้นไป · ใส่เสื้อกันฝน', crop: [1464, 136, 253, 470] },
];

// Display clipped regions of the original drawing. The source PNG is unchanged:
// no redraw, recoloring, or generated replacement of the user's characters.
export function MascotArtwork({ mood }: { mood: MascotPose }) {
  const inkId = `mascot-ink-${useId().replace(/:/g, '')}`;
  const pose = MASCOT_POSES.find(p => p.mood === mood)!;
  const [x, y, width, height] = pose.crop;
  const scale = 0.54;
  return <svg className="mascot-original-art" viewBox="0 0 360 285" aria-hidden="true" focusable="false">
    <defs><filter id={inkId} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0" /></filter></defs>
    <svg x={180 - width * scale / 2} y={276 - height * scale} width={width * scale} height={height * scale} viewBox={`${x} ${y} ${width} ${height}`} overflow="hidden">
      <image href="/mascots/original-characters.png" width="1748" height="1440" filter={`url(#${inkId})`} />
    </svg>
  </svg>;
}

export default function RainMascot({ probability, loading }: { probability: number | null; loading: boolean }) {
  const mood = loading ? 'waiting' : mascotMood(probability);
  return <div className={`mascot-scene user-mascot mood-${mood}`} data-mood={mood} aria-hidden="true">
    {mood === 'waiting' ? <div className="mascot-awaiting"><span>· · ·</span><small>{loading ? 'Checking the sky' : 'Waiting for a forecast'}</small></div> : <MascotArtwork mood={mood} />}
  </div>;
}
