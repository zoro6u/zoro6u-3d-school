// Client-side twin of api/app/llm/tools.py. The server validates first; the browser validates again,
// because nothing that arrives over the wire is trusted. Both read the same manifest in lesson.json and are
// tested against the same cases in content/tests/tool-cases.json.

export type TeacherAction =
  | { tool: 'set_param'; name: string; value: number | string | boolean }
  | { tool: 'focus_object'; id: string }
  | { tool: 'play_reaction_step'; n: number }
  | { tool: 'reset_scene' };

export interface ToolCheck {
  ok: boolean;
  action?: TeacherAction;
  message: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function walk(raw: Obj, path: string): unknown {
  return path.split('.').reduce<unknown>((n, k) => (isObj(n) ? n[k] : undefined), raw);
}

interface ParamSpec {
  type: 'number' | 'enum' | 'boolean';
  min?: number;
  max?: number;
  values?: string[];
}

function manifest(raw: Obj): Obj {
  const m = raw.teacherTools;
  return isObj(m) ? m : {};
}

export function paramSpecs(raw: Obj): Record<string, ParamSpec> {
  const params = walk(manifest(raw) as Obj, 'set_param.params');
  const out: Record<string, ParamSpec> = {};
  if (!isObj(params)) return out;
  for (const [name, spec] of Object.entries(params)) {
    if (!isObj(spec)) continue;
    const s = { ...spec } as unknown as ParamSpec & { ref?: string };
    if (typeof s.ref === 'string') {
      const ref = walk(raw, s.ref);
      if (isObj(ref)) {
        s.min = ref.min as number;
        s.max = ref.max as number;
      }
    }
    out[name] = s;
  }
  return out;
}

export function focusIds(raw: Obj): string[] {
  const spec = manifest(raw).focus_object;
  if (!isObj(spec)) return [];
  if (typeof spec.idsRef === 'string') {
    const list = walk(raw, spec.idsRef);
    return Array.isArray(list) ? list.filter(isObj).map((o) => String(o.id)) : [];
  }
  return Array.isArray(spec.ids) ? spec.ids.map(String) : [];
}

const KNOWN = ['set_param', 'focus_object', 'play_reaction_step', 'reset_scene'];
const fail = (message: string): ToolCheck => ({ ok: false, message });

export function validateToolCall(raw: Obj, tool: string, args: unknown): ToolCheck {
  const m = manifest(raw);
  if (!(tool in m)) return fail(KNOWN.includes(tool) ? `The tool '${tool}' is not available in this lesson.` : `Unknown tool '${tool}'.`);
  if (!isObj(args)) return fail('Tool arguments must be an object.');
  const only = (...keys: string[]): ToolCheck | null => {
    const extra = Object.keys(args).filter((k) => !keys.includes(k));
    return extra.length ? fail(`Unexpected argument(s): ${extra.sort().join(', ')}.`) : null;
  };

  if (tool === 'reset_scene') return only() ?? { ok: true, action: { tool: 'reset_scene' }, message: 'OK: scene reset.' };

  if (tool === 'focus_object') {
    const bad = only('id');
    if (bad) return bad;
    const ids = focusIds(raw);
    const id = args.id;
    if (typeof id !== 'string' || !ids.includes(id)) return fail(`id must be one of: ${ids.join(', ')}.`);
    return { ok: true, action: { tool: 'focus_object', id }, message: `OK: focused on ${id}.` };
  }

  if (tool === 'play_reaction_step') {
    const bad = only('n');
    if (bad) return bad;
    const spec = m.play_reaction_step as { min: number; max: number };
    const n = args.n;
    if (!isNum(n) || !Number.isInteger(n)) return fail('n must be an integer.');
    if (n < spec.min || n > spec.max) return fail(`n must be between ${spec.min} and ${spec.max} (got ${n}).`);
    return { ok: true, action: { tool: 'play_reaction_step', n }, message: `OK: moved to stage ${n}.` };
  }

  // set_param
  const bad = only('name', 'value');
  if (bad) return bad;
  const specs = paramSpecs(raw);
  const name = args.name;
  if (typeof name !== 'string' || !(name in specs)) return fail(`name must be one of: ${Object.keys(specs).join(', ')}.`);
  if (!('value' in args)) return fail('value is required.');
  const spec = specs[name]!;
  const value = args.value;
  if (spec.type === 'number') {
    if (!isNum(value)) return fail(`${name} must be a number.`);
    if (value < spec.min! || value > spec.max!) return fail(`${name} must be between ${spec.min} and ${spec.max} (got ${value}).`);
  } else if (spec.type === 'enum') {
    if (typeof value !== 'string' || !spec.values!.includes(value)) return fail(`${name} must be one of: ${spec.values!.join(', ')}.`);
  } else if (typeof value !== 'boolean') {
    return fail(`${name} must be true or false.`);
  }
  return { ok: true, action: { tool: 'set_param', name, value: value as number | string | boolean }, message: `OK: ${name} set to ${String(value)}.` };
}

/** Validate a normalised action object (as streamed by the server) by turning it back into (tool, args). */
export function validateAction(raw: Obj, action: unknown): ToolCheck {
  if (!isObj(action) || typeof action.tool !== 'string') return fail('Malformed action.');
  const { tool, ...args } = action;
  return validateToolCall(raw, tool, args);
}
