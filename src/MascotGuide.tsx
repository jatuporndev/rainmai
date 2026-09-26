import { Info } from 'lucide-react';
import Dialog from './Dialog';
import { MASCOT_POSES, MascotArtwork, mascotMood } from './RainMascot';

export default function MascotGuide({ probability, onClose }: { probability: number | null; onClose: () => void }) {
  const active = mascotMood(probability);
  return <Dialog title="Meet your rain companions" className="mascot-guide-dialog" wide onClose={onClose}>
    <p className="dialog-intro">Four hand-drawn friends, ready for whatever the sky has planned.</p>
    <p className="mascot-guide-intro" lang="th">ตัวละครเปลี่ยนตามเปอร์เซ็นต์ของชั่วโมงที่คุณเลือก จากซ้ายไปขวาตามภาพต้นฉบับ</p>
    <div className="mascot-guide-grid">{MASCOT_POSES.map(pose => <article key={pose.mood} className={`mascot-guide-card ${active === pose.mood ? 'is-current' : ''}`} data-pose={pose.mood}>
      <div className="mascot-guide-current">{active === pose.mood ? `Showing now · ${Math.round(probability!)}%` : ' '}</div>
      <div className="mascot-guide-art"><MascotArtwork mood={pose.mood} /></div>
      <strong className="mascot-guide-range">{pose.range}</strong><h3>{pose.title}</h3><p lang="th">{pose.description}</p>
    </article>)}</div>
    <div className="mascot-guide-boundaries" lang="th"><strong>ตรงขอบช่วงก็เปลี่ยนตัวเลย</strong><span>30% → ตัวที่ 2</span><span>60% → ตัวที่ 3</span><span>80% → ตัวที่ 4</span></div>
    <div className="mascot-guide-atmosphere" lang="th"><strong>บรรยากาศบนหน้าเว็บ</strong><span>60–79% · แอนิเมชันฝนเบา ๆ</span><span>80% ขึ้นไป · ฝนหนาแน่นขึ้นและฟ้าครึ้ม</span><p>เป็นภาพประกอบตามโอกาสฝนตก ไม่ใช่ความแรงฝนที่วัดได้จริง</p></div>
    <div className="mascot-guide-note"><Info size={16}/><p>The characters and atmospheric effects follow the displayed hourly rain probability, not observed rainfall intensity. When a forecast is missing, no rain category or rain effect is selected. You can pause animation beside the forecast or use your device’s reduced-motion setting.</p></div>
  </Dialog>;
}
