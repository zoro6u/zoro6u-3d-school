import type { Snapshot, Setup } from './sim/engine';

/** JSON snapshot of the physics lab, as sent to the AI teacher with every question. */
export function physicsSceneState(snap: Snapshot, setup: Setup, running: boolean, gravityPreset: string | null) {
  const r = (n: number, d = 3) => Number(n.toFixed(d));
  const th = snap.theory;
  const common = {
    lab: 'physics',
    experiment: setup.mode,
    running,
    time_s: r(snap.time, 1),
    kinetic_energy_J: r(snap.ke),
    potential_energy_J: r(snap.pe),
    total_energy_J: r(snap.total),
    period_theory_small_angle_s: r(th.small),
    period_theory_exact_s: th.exact === null ? null : r(th.exact),
    period_theory_damped_s: th.damped === null ? null : r(th.damped),
    period_measured_s: snap.measuredMean === null ? null : r(snap.measuredMean),
    full_cycles_measured: snap.cycles,
  };
  if (setup.mode === 'pendulum') {
    return {
      ...common,
      params: {
        length_m: setup.length,
        mass_kg: setup.mass,
        start_angle_deg: setup.angleDeg,
        damping: setup.damping,
        gravity_m_s2: setup.g,
        gravity_preset: gravityPreset,
      },
      current_angle_deg: r((snap.x * 180) / Math.PI, 1),
      small_angle_formula_error_pct: th.smallAngleError === null ? null : r(th.smallAngleError * 100, 1),
    };
  }
  return {
    ...common,
    params: { spring_constant_N_per_m: setup.k, mass_kg: setup.mass, start_displacement_m: setup.displacement, damping: setup.damping },
    current_displacement_m: r(snap.x),
  };
}
