import { useTranslation } from 'react-i18next';
import { smoothstep } from './engine/timeline';

interface Props {
  levels: number[];
  quantitative: boolean;
  /** Fractional stage index (linear in time). */
  progress: number;
  deltaH: number | null;
}

const W = 320;
const H = 190;
const PAD = { l: 14, r: 52, t: 14, b: 26 };

/** Energy of the system at each stage, joined by smooth S-curves. The marker follows the animation. */
export function EnergyDiagram({ levels, quantitative, progress, deltaH }: Props) {
  const { t } = useTranslation();
  const n = levels.length;
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  const span = hi - lo || 1;
  const X = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);

  const pts: string[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k <= 10; k++) {
      const r = k / 10;
      pts.push(`${X(i + r).toFixed(1)},${Y(levels[i]! + (levels[i + 1]! - levels[i]!) * smoothstep(r)).toFixed(1)}`);
    }

  const i0 = Math.min(Math.floor(progress), n - 2);
  const r = Math.min(Math.max(progress - i0, 0), 1);
  const cur = levels[i0]! + (levels[i0 + 1]! - levels[i0]!) * smoothstep(r);
  const start = levels[0]!;
  const end = levels[n - 1]!;
  const net = end - start;
  const dH = deltaH ?? (quantitative ? net : null);
  const exo = net < 0;

  return (
    <figure className="m-0">
      <div dir="ltr"><svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${t('chemistry.energy.title')}. ${t(exo ? 'chemistry.energy.exo' : 'chemistry.energy.endo')}`}>
        <line x1={PAD.l} y1={Y(start)} x2={W - PAD.r + 8} y2={Y(start)} stroke="#475569" strokeDasharray="4 3" />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#64748b" />
        <polyline points={pts.join(' ')} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        {net !== 0 && (
          <g stroke={exo ? '#fb923c' : '#38bdf8'} fill={exo ? '#fb923c' : '#38bdf8'}>
            <line x1={W - PAD.r + 22} y1={Y(start)} x2={W - PAD.r + 22} y2={Y(end) + (exo ? -5 : 5)} strokeWidth="2" />
            <polygon points={exo ? `${W - PAD.r + 17},${Y(end) - 6} ${W - PAD.r + 27},${Y(end) - 6} ${W - PAD.r + 22},${Y(end)}` : `${W - PAD.r + 17},${Y(end) + 6} ${W - PAD.r + 27},${Y(end) + 6} ${W - PAD.r + 22},${Y(end)}`} />
          </g>
        )}
        <circle cx={X(progress)} cy={Y(cur)} r="6" fill="#fde047" stroke="#0b1220" strokeWidth="2" />
        <text x={PAD.l} y={H - 8} fill="#94a3b8" fontSize="10">{t('chemistry.energy.reactants')}</text>
        <text x={W - PAD.r} y={H - 8} fill="#94a3b8" fontSize="10" textAnchor="end">{t('chemistry.energy.products')}</text>
        <text x={W / 2} y={H - 8} fill="#64748b" fontSize="10" textAnchor="middle">{t('chemistry.energy.progress')} →</text>
      </svg></div>
      <figcaption className="mt-1 space-y-0.5 text-xs text-slate-300">
        {dH !== null && (
          <div className="font-semibold text-orange-300">
            <bdi dir="ltr">{t('chemistry.energy.deltaH', { value: dH.toFixed(1) })}</bdi> — {t(exo ? 'chemistry.energy.exo' : 'chemistry.energy.endo')}
          </div>
        )}
        {dH === null && <div>{t(exo ? 'chemistry.energy.exo' : 'chemistry.energy.endo')}</div>}
        <div className="text-slate-400">{quantitative ? t('chemistry.energy.kj') : t('chemistry.energy.qualitative')}</div>
      </figcaption>
    </figure>
  );
}
