import { useId } from 'react';
import type { ParamSpec } from './config';

interface Props {
  label: string;
  unit: string;
  spec: ParamSpec;
  value: number;
  decimals?: number;
  onChange: (v: number) => void;
}

export function Slider({ label, unit, spec, value, decimals = 2, onChange }: Props) {
  const id = useId();
  const shown = `${value.toFixed(decimals)} ${unit}`;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <output htmlFor={id}><bdi dir="ltr" className="tabular-nums text-sky-300">{shown}</bdi></output>
      </div>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-sky-400"
        dir="ltr"
      />
    </div>
  );
}
