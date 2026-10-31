"""
Teacher tools: the schemas Claude sees, and the validator that decides whether a tool call may run.

The allowed tools, parameter names and ranges come from each lesson's `teacherTools` manifest in
/content/lessons/<id>/lesson.json (ranges point at the same data the lab sliders use via "ref"), and the
frontend validates again with the same manifest. Nothing the model emits is trusted.
"""

import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ToolCheck:
    ok: bool
    action: dict[str, Any] | None = None
    message: str = ""


def _walk(raw: dict[str, Any], path: str) -> Any:
    node: Any = raw
    for part in path.split("."):
        node = node[part]
    return node


def manifest(raw: dict[str, Any]) -> dict[str, Any]:
    return raw.get("teacherTools", {})


def param_specs(raw: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """set_param parameter specs with `ref`s resolved to concrete min/max."""
    specs: dict[str, dict[str, Any]] = {}
    for name, spec in manifest(raw).get("set_param", {}).get("params", {}).items():
        spec = dict(spec)
        if "ref" in spec:
            ref = _walk(raw, spec["ref"])
            spec["min"], spec["max"] = ref["min"], ref["max"]
        specs[name] = spec
    return specs


def focus_ids(raw: dict[str, Any]) -> list[str]:
    spec = manifest(raw).get("focus_object", {})
    if "idsRef" in spec:
        return [item["id"] for item in _walk(raw, spec["idsRef"])]
    return list(spec.get("ids", []))


def _describe_param(name: str, s: dict[str, Any]) -> str:
    unit = f" {s['unit']}" if s.get("unit") else ""
    if s["type"] == "number":
        kind = f"number {s['min']}–{s['max']}{unit}"
    elif s["type"] == "enum":
        kind = "one of: " + ", ".join(s["values"])
    else:
        kind = "true or false"
    return f"- {name} ({kind}): {s.get('description', '')}".rstrip()


def build_tool_schemas(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Anthropic tool definitions for this lesson. Only tools in the manifest are offered."""
    m = manifest(raw)
    tools: list[dict[str, Any]] = []
    if "set_param" in m:
        specs = param_specs(raw)
        tools.append(
            {
                "name": "set_param",
                "description": (
                    "Change one setting of the 3D scene so you can demonstrate what you are explaining. "
                    "Use a value inside the allowed range. Settings:\n"
                    + "\n".join(_describe_param(n, s) for n, s in specs.items())
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "enum": list(specs)},
                        "value": {"type": ["number", "string", "boolean"], "description": "must match the setting's type"},
                    },
                    "required": ["name", "value"],
                },
            }
        )
    if "focus_object" in m:
        tools.append(
            {
                "name": "focus_object",
                "description": "Fly the camera to an object in the scene and highlight it. " + m["focus_object"].get("description", ""),
                "input_schema": {
                    "type": "object",
                    "properties": {"id": {"type": "string", "enum": focus_ids(raw)}},
                    "required": ["id"],
                },
            }
        )
    if "play_reaction_step" in m:
        s = m["play_reaction_step"]
        tools.append(
            {
                "name": "play_reaction_step",
                "description": "Animate the reaction to stage n and pause there. " + s.get("description", ""),
                "input_schema": {
                    "type": "object",
                    "properties": {"n": {"type": "integer", "minimum": s["min"], "maximum": s["max"]}},
                    "required": ["n"],
                },
            }
        )
    if "reset_scene" in m:
        tools.append(
            {
                "name": "reset_scene",
                "description": "Reset the scene to its starting state.",
                "input_schema": {"type": "object", "properties": {}},
            }
        )
    return tools


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _fail(msg: str) -> ToolCheck:
    return ToolCheck(False, None, msg)


def validate_tool_call(raw: dict[str, Any], tool: str, args: Any) -> ToolCheck:
    """Validate a model-proposed tool call. On success returns the normalised action for the frontend."""
    m = manifest(raw)
    if tool not in m:
        if tool in ("set_param", "focus_object", "play_reaction_step", "reset_scene"):
            return _fail(f"The tool '{tool}' is not available in this lesson.")
        return _fail(f"Unknown tool '{tool}'.")
    if not isinstance(args, dict):
        return _fail("Tool arguments must be an object.")

    def only(*keys: str) -> ToolCheck | None:
        extra = sorted(set(args) - set(keys))
        return _fail(f"Unexpected argument(s): {', '.join(extra)}.") if extra else None

    if tool == "reset_scene":
        return only() or ToolCheck(True, {"tool": "reset_scene"}, "OK: scene reset.")

    if tool == "focus_object":
        if (bad := only("id")) is not None:
            return bad
        ids = focus_ids(raw)
        obj = args.get("id")
        if not isinstance(obj, str) or obj not in ids:
            return _fail(f"id must be one of: {', '.join(ids)}.")
        return ToolCheck(True, {"tool": "focus_object", "id": obj}, f"OK: focused on {obj}.")

    if tool == "play_reaction_step":
        if (bad := only("n")) is not None:
            return bad
        spec = m["play_reaction_step"]
        n = args.get("n")
        if not _is_number(n) or float(n) != int(n):
            return _fail("n must be an integer.")
        if not spec["min"] <= n <= spec["max"]:
            return _fail(f"n must be between {spec['min']} and {spec['max']} (got {int(n)}).")
        return ToolCheck(True, {"tool": "play_reaction_step", "n": int(n)}, f"OK: moved to stage {int(n)}.")

    # set_param
    if (bad := only("name", "value")) is not None:
        return bad
    specs = param_specs(raw)
    name = args.get("name")
    if not isinstance(name, str) or name not in specs:
        return _fail(f"name must be one of: {', '.join(specs)}.")
    if "value" not in args:
        return _fail("value is required.")
    spec, value = specs[name], args["value"]
    if spec["type"] == "number":
        if not _is_number(value):
            return _fail(f"{name} must be a number.")
        if not spec["min"] <= value <= spec["max"]:
            return _fail(f"{name} must be between {spec['min']} and {spec['max']} (got {value}).")
        value = float(value) if isinstance(value, float) else value
    elif spec["type"] == "enum":
        if not isinstance(value, str) or value not in spec["values"]:
            return _fail(f"{name} must be one of: {', '.join(spec['values'])}.")
    elif spec["type"] == "boolean":
        if not isinstance(value, bool):
            return _fail(f"{name} must be true or false.")
    else:  # pragma: no cover - manifest error
        return _fail(f"{name} has an unsupported type.")
    return ToolCheck(True, {"tool": "set_param", "name": name, "value": value}, f"OK: {name} set to {value}.")
