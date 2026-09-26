import { useEffect, useRef } from 'react';

export type Atmosphere = 'clear' | 'drizzle' | 'downpour';
interface Drop { x: number; y: number; length: number; speed: number; opacity: number }

export default function WeatherAtmosphere({ tone, paused }: { tone: Atmosphere; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || tone === 'clear') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const heavy = tone === 'downpour';
    let width = 0, height = 0, frame = 0, lastTime = 0;
    let drops: Drop[] = [];
    const randomDrop = (spread = true): Drop => ({
      x: Math.random() * (width + 100), y: spread ? Math.random() * height : -80,
      length: heavy ? 30 + Math.random() * 40 : 15 + Math.random() * 15,
      speed: heavy ? 720 + Math.random() * 620 : 260 + Math.random() * 240,
      opacity: heavy ? 0.28 + Math.random() * 0.4 : 0.3 + Math.random() * 0.25,
    });
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      const density = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
      // A single canvas and a small particle budget, even on high-DPI phones.
      const count = Math.round(Math.min(heavy ? 300 : 85, Math.max(heavy ? 110 : 35, width * (heavy ? 0.22 : 0.06))));
      drops = Array.from({ length: count }, () => randomDrop());
      canvas.dataset.particles = String(count);
      // Resizing clears a canvas. Paint immediately, including when motion is paused.
      paint(0);
    };
    const paint = (delta: number) => {
      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';
      for (const drop of drops) {
        drop.y += drop.speed * delta;
        drop.x -= drop.speed * delta * (heavy ? 0.17 : 0.06);
        if (drop.y > height + 80 || drop.x < -80) Object.assign(drop, randomDrop(false));
        const lean = drop.length * (heavy ? 0.17 : 0.06);
        const gradient = context.createLinearGradient(drop.x + lean, drop.y - drop.length, drop.x, drop.y);
        const color = heavy ? '223,240,250' : '70,107,128';
        gradient.addColorStop(0, `rgba(${color},0)`);
        gradient.addColorStop(1, `rgba(${color},${drop.opacity})`);
        context.strokeStyle = gradient;
        context.lineWidth = heavy ? 1.1 + drop.opacity : 1.2;
        context.beginPath(); context.moveTo(drop.x + lean, drop.y - drop.length); context.lineTo(drop.x, drop.y); context.stroke();
      }
    };
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - lastTime < 1000 / 30) return;
      const delta = Math.min((time - lastTime) / 1000, 0.06);
      lastTime = time;
      paint(delta);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      // Reduced motion and pause keep a still rain scene instead of an empty sky.
      paint(0);
      const disabled = paused || reducedMotion.matches || document.hidden;
      canvas.dataset.animation = reducedMotion.matches ? 'reduced' : disabled ? 'paused' : 'running';
      if (!disabled) { lastTime = performance.now(); frame = requestAnimationFrame(draw); }
    };
    resize(); sync();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      reducedMotion.removeEventListener('change', sync);
      context.clearRect(0, 0, width, height);
    };
  }, [tone, paused]);

  return <><div className={`weather-atmosphere weather-${tone}`} data-paused={paused} aria-hidden="true">
    <div className="weather-sky-glow" />
    <div className="weather-cloud weather-cloud-back" />
    <div className="weather-cloud weather-cloud-front" />
    <div className="weather-cloud weather-cloud-low" />
    <div className="weather-horizon" />
  </div>
    {tone !== 'clear' && <canvas className="weather-rain-canvas" ref={canvasRef} aria-hidden="true" />}
  </>;
}
