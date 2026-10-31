import type { Accel } from './rk4';

// SI units throughout: metres, kilograms, seconds, radians, joules.

export interface PendulumParams {
  length: number; // m
  mass: number; // kg
  g: number; // m/s²
  damping: number; // N·m·s/rad  (torque = −c·ω)
}

export interface SpringParams {
  k: number; // N/m
  mass: number; // kg
  damping: number; // N·s/m  (force = −c·v)
}

export interface Energies {
  ke: number;
  pe: number;
}

/** Full nonlinear pendulum: θ'' = −(g/L)·sin θ − c/(m L²)·θ'. No small-angle approximation. */
export function pendulumAccel(p: PendulumParams): Accel {
  const w2 = p.g / p.length;
  const gamma = p.damping / (p.mass * p.length * p.length);
  return (theta, omega) => -w2 * Math.sin(theta) - gamma * omega;
}

/** KE = ½ m L² ω², PE = m g L (1 − cos θ), measured from the lowest point. */
export function pendulumEnergies(p: PendulumParams, theta: number, omega: number): Energies {
  return {
    ke: 0.5 * p.mass * p.length * p.length * omega * omega,
    pe: p.mass * p.g * p.length * (1 - Math.cos(theta)),
  };
}

/** Hooke's law: x'' = −(k/m)·x − (c/m)·x'. */
export function springAccel(p: SpringParams): Accel {
  const w2 = p.k / p.mass;
  const gamma = p.damping / p.mass;
  return (x, v) => -w2 * x - gamma * v;
}

export function springEnergies(p: SpringParams, x: number, v: number): Energies {
  return { ke: 0.5 * p.mass * v * v, pe: 0.5 * p.k * x * x };
}
