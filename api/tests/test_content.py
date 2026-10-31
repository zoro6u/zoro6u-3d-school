"""Tour and quiz data are shared with the frontend; the Python validator must agree with the TypeScript one on them."""

import json
from pathlib import Path

import pytest

from app.config import REPO_ROOT
from app.content import load_lessons
from app.llm.tools import validate_tool_call

LESSONS = load_lessons(str(REPO_ROOT / "content"))


def read(lesson_id: str, name: str):
    return json.loads(Path(REPO_ROOT, "content/lessons", lesson_id, name).read_text(encoding="utf-8"))


@pytest.mark.parametrize("lesson_id", sorted(LESSONS))
def test_every_tour_action_passes_the_server_validator(lesson_id):
    tour = read(lesson_id, "tour.json")
    assert len(tour["steps"]) >= 3
    for step in tour["steps"]:
        for action in step["actions"]:
            args = {k: v for k, v in action.items() if k != "tool"}
            r = validate_tool_call(LESSONS[lesson_id].raw, action["tool"], args)
            assert r.ok, f"{lesson_id}/{step['id']}: {r.message}"
            assert r.action == action  # normalisation doesn't alter authored actions


@pytest.mark.parametrize("lesson_id", sorted(LESSONS))
def test_tour_and_quiz_text_exist_in_both_languages(lesson_id):
    tour = read(lesson_id, "tour.json")
    quiz = read(lesson_id, "quiz.json")
    for lang in ("en", "ar"):
        steps = read(lesson_id, f"tour.{lang}.json")["steps"]
        assert {s["id"] for s in tour["steps"]} == set(steps)
        qtext = read(lesson_id, f"quiz.{lang}.json")["questions"]
        assert {q["id"] for q in quiz["questions"]} == set(qtext)
        for q in quiz["questions"]:
            assert len(qtext[q["id"]]["choices"]) == 4
            assert 0 <= q["answer"] < 4
