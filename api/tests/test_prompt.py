from app.config import REPO_ROOT
from app.content import load_lessons, load_teacher
from app.llm.prompt import build_system, with_scene_state

C = str(REPO_ROOT / "content")
LESSONS = load_lessons(C)


def test_all_three_lessons_have_curated_facts_and_valid_teachers():
    assert set(LESSONS) == {"physics-oscillations", "biology-animal-cell", "chemistry-water-synthesis"}
    for lesson in LESSONS.values():
        assert len(lesson.facts) > 1500
        assert load_teacher(C, lesson.teacher_id)["subject"] == lesson.subject


def test_system_prompt_has_persona_guardrails_and_facts():
    lesson = LESSONS["physics-oscillations"]
    static, dynamic = build_system(lesson, load_teacher(C, "karim"), "en", "explain")
    assert "Prof. Karim" in static["text"]
    assert "<facts>" in static["text"] and "2π√(L/g)" in static["text"]
    assert "Topic." in static["text"] and "Prompt safety" in static["text"]
    assert static["cache_control"] == {"type": "ephemeral"}
    assert "cache_control" not in dynamic


def test_language_and_mode_live_in_the_uncached_block():
    lesson = LESSONS["biology-animal-cell"]
    t = load_teacher(C, "nour")
    en_static, en_dyn = build_system(lesson, t, "en", "explain")
    ar_static, ar_dyn = build_system(lesson, t, "ar", "socratic")
    assert en_static["text"] == ar_static["text"]  # changing language/mode never busts the cache
    assert "Reply in English" in en_dyn["text"] and "Mode: EXPLAIN" in en_dyn["text"]
    assert "Modern Standard Arabic" in ar_dyn["text"] and "Mode: SOCRATIC" in ar_dyn["text"]
    assert "Western digits" in ar_dyn["text"]


def test_scene_state_is_wrapped_as_data_and_size_capped():
    out = with_scene_state("hi", {"angle": 30}, 4000)
    assert out.startswith("hi") and "<scene_state>" in out and '"angle":30' in out
    huge = with_scene_state("hi", {"x": "a" * 10000}, 4000)
    assert "omitted" in huge and "aaaa" not in huge
    assert with_scene_state("hi", None, 4000) == "hi"


def test_facts_agree_with_the_lab_data():
    f = LESSONS["physics-oscillations"].facts
    raw = LESSONS["physics-oscillations"].raw["physics"]
    for g in raw["gravityPresets"]:
        assert str(g["g"]) in f
    assert "483.6" in LESSONS["chemistry-water-synthesis"].facts
