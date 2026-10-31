import json
from pathlib import Path

import pytest

from app.config import REPO_ROOT
from app.content import load_lessons
from app.llm.tools import build_tool_schemas, validate_tool_call

CASES = json.loads(Path(REPO_ROOT, "content/tests/tool-cases.json").read_text(encoding="utf-8"))["cases"]
LESSONS = load_lessons(str(REPO_ROOT / "content"))


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['lesson'][:4]}-{c['tool']}-{json.dumps(c['args'])}")
def test_shared_tool_cases(case):
    r = validate_tool_call(LESSONS[case["lesson"]].raw, case["tool"], case["args"])
    assert r.ok is case["ok"], r.message
    if case["ok"]:
        assert r.action == case["action"]
    else:
        assert r.action is None and r.message


def test_non_dict_args_rejected():
    raw = LESSONS["physics-oscillations"].raw
    assert not validate_tool_call(raw, "set_param", "gravity=moon").ok
    assert not validate_tool_call(raw, "reset_scene", None).ok


def test_nan_and_inf_rejected():
    raw = LESSONS["physics-oscillations"].raw
    for bad in (float("nan"), float("inf"), float("-inf")):
        assert not validate_tool_call(raw, "set_param", {"name": "pendulum_length", "value": bad}).ok


def test_ranges_come_from_the_lab_data_not_duplicated():
    raw = LESSONS["physics-oscillations"].raw
    spec = raw["physics"]["pendulum"]["length"]
    assert validate_tool_call(raw, "set_param", {"name": "pendulum_length", "value": spec["max"]}).ok
    assert not validate_tool_call(raw, "set_param", {"name": "pendulum_length", "value": spec["max"] + 0.01}).ok


def test_schemas_only_offer_manifest_tools():
    names = {k: {t["name"] for t in build_tool_schemas(v.raw)} for k, v in LESSONS.items()}
    assert names["physics-oscillations"] == {"set_param", "reset_scene"}
    assert names["biology-animal-cell"] == {"set_param", "focus_object", "reset_scene"}
    assert names["chemistry-water-synthesis"] == {"set_param", "play_reaction_step", "reset_scene"}


def test_schema_enums_match_validator():
    tools = {t["name"]: t for t in build_tool_schemas(LESSONS["biology-animal-cell"].raw)}
    ids = tools["focus_object"]["input_schema"]["properties"]["id"]["enum"]
    assert len(ids) == 9 and "mitochondria" in ids
    desc = {t["name"]: t["description"] for t in build_tool_schemas(LESSONS["physics-oscillations"].raw)}["set_param"]
    assert "pendulum_length (number 0.2–2.5 m)" in desc
