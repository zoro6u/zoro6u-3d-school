import lesson from '../../../../content/lessons/physics-oscillations/lesson.json';

/** Slider ranges, defaults and gravity presets come from the lesson data file, not from code. */
export interface ParamSpec {
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface PhysicsConfig {
  gravityPresets: { id: 'earth' | 'moon' | 'mars'; g: number }[];
  pendulum: Record<'length' | 'mass' | 'angleDeg' | 'damping', ParamSpec>;
  spring: Record<'k' | 'mass' | 'displacement' | 'damping', ParamSpec>;
}

export const physicsConfig = lesson.physics as PhysicsConfig;

export function clampTo(spec: ParamSpec, value: number): number {
  return Math.min(spec.max, Math.max(spec.min, value));
}

export function defaultSetup() {
  const { pendulum: p, spring: s, gravityPresets } = physicsConfig;
  return {
    pendulum: {
      mode: 'pendulum' as const,
      length: p.length.default,
      mass: p.mass.default,
      damping: p.damping.default,
      angleDeg: p.angleDeg.default,
      g: gravityPresets[0]!.g,
    },
    spring: {
      mode: 'spring' as const,
      k: s.k.default,
      mass: s.mass.default,
      damping: s.damping.default,
      displacement: s.displacement.default,
    },
  };
}
