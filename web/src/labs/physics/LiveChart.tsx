import { useEffect, useRef } from 'react';
import { CHANNELS, WINDOW_S, type OscillatorEngine } from './sim/engine';

export interface ChartSeries {
  channel: (typeof CHANNELS)[number];
  label: string;
  color: string;
  dash?: number[];
}

interface Props {
  engine: OscillatorEngine;
  title: string;
  timeLabel: string;
  unit: string;
  series: ChartSeries[];
  /** 'symmetric' centres zero (positions); 'zero' starts at zero (energies). */
  range: 'symmetric' | 'zero';
  lowGraphics: boolean;
  summary: (latest: string) => string;
}

const H = 200;
const PAD = { l: 46, r: 10, t: 8, b: 40 };

function niceNum(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export function LiveChart({ engine, title, timeLabel, unit, series, range, lowGraphics, summary }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLSpanElement>(null);
  const summaryRef = useRef(summary);
  summaryRef.current = summary;

  useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, lowGraphics ? 1 : 2);
    let w = 0;
    const resize = () => {
      w = Math.max(200, box.clientWidth);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    let raf = 0;
    let lastDraw = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastDraw < 33) return; // ~30 fps is plenty for a chart
      lastDraw = now;
      const hist = engine.history;
      const n = hist.length;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, H);
      const pw = w - PAD.l - PAD.r;
      const ph = H - PAD.t - PAD.b;
      const t1 = Math.max(engine.time, WINDOW_S);
      const t0 = t1 - WINDOW_S;

      let lo = 0;
      let hi = 0;
      for (const s of series) {
        const ci = CHANNELS.indexOf(s.channel);
        for (let i = 0; i < n; i++) {
          const v = hist.value(ci, i);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      if (range === 'symmetric') {
        const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-9);
        lo = -m * 1.1;
        hi = m * 1.1;
      } else {
        lo = 0;
        hi = Math.max(hi * 1.1, 1e-9);
      }
      const X = (t: number) => PAD.l + ((t - t0) / WINDOW_S) * pw;
      const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph;

      ctx.font = '11px system-ui, sans-serif';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#334155';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let g = 0; g <= 4; g++) {
        const v = lo + ((hi - lo) * g) / 4;
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(w - PAD.r, y);
        ctx.stroke();
        ctx.fillText(niceNum(v), PAD.l - 5, y);
      }
      if (range === 'symmetric') {
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(PAD.l, Y(0));
        ctx.lineTo(w - PAD.r, Y(0));
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const step = 2;
      for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(String(t), X(t), H - PAD.b + 5);
      }
      ctx.textAlign = 'left';
      ctx.fillText(`${timeLabel}  ·  y: [${unit}]`, PAD.l, H - 15);

      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.l, PAD.t, pw, ph);
      ctx.clip();
      for (const s of series) {
        const ci = CHANNELS.indexOf(s.channel);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(s.dash ?? []);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < n; i++) {
          const x = X(hist.time(i));
          const y = Y(hist.value(ci, i));
          if (started) ctx.lineTo(x, y);
          else {
            ctx.moveTo(x, y);
            started = true;
          }
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([]);

      if (live.current && n > 0) {
        const first = CHANNELS.indexOf(series[0]!.channel);
        live.current.textContent = summaryRef.current(niceNum(hist.value(first, n - 1)));
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine, series, range, lowGraphics, timeLabel, unit]);

  return (
    <figure className="rounded-xl border border-slate-700 bg-slate-900 p-3">
      <figcaption className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <span>{title}</span>
        <ul className="flex flex-wrap gap-3 text-xs font-normal">
          {series.map((s) => (
            <li key={s.channel} className="flex items-center gap-1">
              <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash?.join(' ')} /></svg>
              {s.label}
            </li>
          ))}
        </ul>
      </figcaption>
      <div ref={wrap} dir="ltr">
        <canvas ref={canvas} role="img" aria-label={title} />
      </div>
      <span ref={live} className="sr-only" role="status" aria-live="off" />
    </figure>
  );
}
