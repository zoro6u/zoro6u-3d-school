import type { PendulumParams, SpringParams } from './models';

/** Arithmetic–geometric mean. Converges quadratically; 10 iterations is far beyond double precision. */
export function agm(a: number, b: number): number {
  let x = a;
  let y = b;
  for (let i = 0; i < 10; i++) {
    [x, y] = [(x + y) / 2, Math.sqrt(x * y)];
  }
  return x;
}

/** Small-angle pendulum period T = 2π√(L/g). */
export function pendulumPeriodSmall(p: Pick<PendulumParams, 'length' | 'g'>): number {
  return 2 * Math.PI * Math.sqrt(p.length / p.g);
}

/**
 * Exact undamped period for amplitude θ0 (radians, 0 < θ0 < π):
 * T = 4√(L/g)·K(sin(θ0/2)) = T_small / AGM(1, cos(θ0/2)).
 */
export function pendulumPeriodExact(p: Pick<PendulumParams, 'length' | 'g'>, theta0: number): number {
  return pendulumPeriodSmall(p) / agm(1, Math.cos(theta0 / 2));
}

/** Spring–mass period T = 2π√(m/k). Independent of amplitude. */
export function springPeriod(p: Pick<SpringParams, 'mass' | 'k'>): number {
  return 2 * Math.PI * Math.sqrt(p.mass / p.k);
}

/**
 * Period of a linear oscillator x'' + γx' + ω0²x = 0: 2π/√(ω0² − γ²/4).
 * Returns NaN when over-damped (no oscillation).
 */
export function dampedPeriod(omega0: number, gamma: number): number {
  const w2 = omega0 * omega0 - (gamma * gamma) / 4;
  return w2 > 0 ? (2 * Math.PI) / Math.sqrt(w2) : Number.NaN;
}

/** Relative error of the small-angle formula versus the exact period, as a fraction. */
export function smallAngleError(theta0: number): number {
  return 1 / agm(1, Math.cos(theta0 / 2)) - 1;
}
