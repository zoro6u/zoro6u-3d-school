"""Loads lesson data (metadata, tool manifest, curated facts) and teacher personas from /content."""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Lesson:
    id: str
    subject: str
    teacher_id: str
    raw: dict[str, Any]
    facts: str


@lru_cache
def load_lessons(content_dir: str) -> dict[str, Lesson]:
    lessons: dict[str, Lesson] = {}
    for path in sorted(Path(content_dir, "lessons").glob("*/lesson.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        facts_path = path.parent / "facts.md"
        facts = facts_path.read_text(encoding="utf-8") if facts_path.exists() else ""
        lessons[raw["id"]] = Lesson(raw["id"], raw["subject"], raw["teacher"], raw, facts)
    return lessons


@lru_cache
def load_teacher(content_dir: str, teacher_id: str) -> dict[str, Any]:
    path = Path(content_dir, "teachers", f"{teacher_id}.json")
    return json.loads(path.read_text(encoding="utf-8"))
