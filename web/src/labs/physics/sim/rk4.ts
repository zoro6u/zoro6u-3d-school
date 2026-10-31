/** A 1-DOF second-order system: x' = v, v' = acc(x, v). */
export interface State {
  x: number;
  v: number;
}
export type Accel = (x: number, v: number) => number;

/** One classical 4th-order Runge–Kutta step, in place. Allocation-free (runs ~500×/s). */
export function rk4Step(acc: Accel, s: State, dt: number): void {
  const { x, v } = s;
  const h = dt / 2;
  const k1x = v;
  const k1v = acc(x, v);
  const k2x = v + h * k1v;
  const k2v = acc(x + h * k1x, v + h * k1v);
  const k3x = v + h * k2v;
  const k3v = acc(x + h * k2x, v + h * k2v);
  const k4x = v + dt * k3v;
  const k4v = acc(x + dt * k3x, v + dt * k3v);
  s.x = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  s.v = v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
}
