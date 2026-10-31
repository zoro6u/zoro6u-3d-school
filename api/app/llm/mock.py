"""
Scripted stand-in for Claude, enabled only with MOCK_LLM=true (developer / CI use).

It speaks the same event protocol as the real client, including a two-round tool call
(text + tool_use, then a follow-up after the tool result), so the SSE endpoint, the tool validator and the
frontend can be exercised end to end without an API key. It is NOT the offline fallback tour (that is client-side).
"""

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any

from app.llm.types import LLMEvent, TextDelta, ToolUse, TurnEnd

# (keywords) -> (tool name, args, {lang: (intro, followup, socratic_followup)})
Script = tuple[tuple[str, ...], dict[str, Any] | None, dict[str, tuple[str, str, str]]]

SCRIPTS: dict[str, list[Script]] = {
    "physics": [
        (("testbad",), {"tool": "set_param", "args": {"name": "pendulum_length", "value": 99}},
         {"en": ("Let me try something extreme.", "That setting is outside what the lab allows, so let's just reason about it: a longer pendulum has a longer period.", "That is outside the lab's range. What do you think happens to the period if the length gets bigger?"),
          "ar": ("دعني أجرّب شيئًا متطرفًا.", "هذا الإعداد خارج ما يسمح به المختبر، فلنفكّر فيه بالكلام: كلما زاد الطول زاد زمن الدورة.", "هذا خارج مدى المختبر. ماذا تتوقع أن يحدث لزمن الدورة إذا زاد الطول؟")}),
        (("moon", "القمر"), {"tool": "set_param", "args": {"name": "gravity", "value": "moon"}},
         {"en": ("Good idea, let's visit the Moon.", "On the Moon gravity is only 1.62 meters per second squared, so the pendulum swings about two and a half times more slowly. Check the measured period against the theory.", "Watch the swing now. Gravity is much weaker here, so what do you expect the period to do compared with Earth?"),
          "ar": ("فكرة جيدة، لنزر القمر.", "الجاذبية على القمر 1.62 m/s² فقط، لذلك يتأرجح البندول أبطأ بنحو مرتين ونصف. قارن زمن الدورة المقيس بالنظري.", "راقب التأرجح الآن. الجاذبية هنا أضعف بكثير، فماذا تتوقع أن يحدث لزمن الدورة مقارنة بالأرض؟")}),
        (("angle", "large", "big", "90", "زاوية"), {"tool": "set_param", "args": {"name": "pendulum_angle_deg", "value": 90}},
         {"en": ("Let's try a big swing of 90 degrees.", "At 90 degrees the small-angle formula is about 18 percent too short, and the simulation shows the true, longer period.", "I've set 90 degrees. Compare the two theory periods with the measured one: which formula does the simulation agree with?"),
          "ar": ("لنجرّب تأرجحًا كبيرًا بزاوية 90 درجة.", "عند 90 درجة تعطي صيغة الزوايا الصغيرة زمنًا أقصر بنحو 18%، وتُظهر المحاكاة زمن الدورة الحقيقي الأطول.", "ضبطتُ الزاوية على 90 درجة. قارن الزمنين النظريين بالمقيس: مع أي صيغة تتفق المحاكاة؟")}),
        (("spring", "نابض"), {"tool": "set_param", "args": {"name": "experiment", "value": "spring"}},
         {"en": ("Switching to the mass-spring system.", "Here the period depends on the mass and the spring constant, not on how far you pull.", "Here's the spring. If you double the mass, what do you think happens to the period?"),
          "ar": ("ننتقل إلى نظام الكتلة والنابض.", "هنا يعتمد زمن الدورة على الكتلة وثابت النابض، وليس على مقدار الشد.", "هذا هو النابض. إذا ضاعفنا الكتلة، فماذا تتوقع أن يحدث لزمن الدورة؟")}),
        (("reset", "start over", "إعادة"), {"tool": "reset_scene", "args": {}},
         {"en": ("Resetting the lab.", "Everything is back to the start, so you can try a fresh experiment.", "Back to the start. What would you like to change first?"),
          "ar": ("أعيد ضبط المختبر.", "عاد كل شيء إلى البداية، فيمكنك تجربة تجربة جديدة.", "عدنا إلى البداية. ما الذي تود تغييره أولًا؟")}),
    ],
    "biology": [
        (("mitochondria", "powerhouse", "ميتوكوندريا"), {"tool": "focus_object", "args": {"id": "mitochondria"}},
         {"en": ("Let's zoom in on the mitochondria.", "These make most of the cell's ATP through respiration, and their folded inner membrane gives them more surface area.", "Here are the mitochondria. Why do you think their inner membrane is folded?"),
          "ar": ("لنقترب من الميتوكوندريا.", "تصنع معظم ATP في الخلية بالتنفس، وغشاؤها الداخلي المطوي يعطيها مساحة أكبر.", "هذه هي الميتوكوندريا. لماذا برأيك غشاؤها الداخلي مطوي؟")}),
        (("nucleus", "dna", "نواة"), {"tool": "focus_object", "args": {"id": "nucleus"}},
         {"en": ("Let's look at the nucleus.", "It stores the cell's DNA and controls which genes are used.", "Here is the nucleus. What do you think the cell would lose if it didn't have one?"),
          "ar": ("لننظر إلى النواة.", "تخزّن المادة الوراثية DNA وتتحكم في الجينات التي تُستخدم.", "هذه هي النواة. ماذا برأيك ستفقد الخلية لو لم تكن لها نواة؟")}),
        (("cut", "inside", "open", "مقطع"), {"tool": "set_param", "args": {"name": "cutaway", "value": True}},
         {"en": ("I'll slice the cell open.", "Now you can see the organelles through the opening.", "The cell is open. Which organelle can you spot first?"),
          "ar": ("سأفتح الخلية بمقطع.", "الآن تستطيع رؤية العضيات من خلال الفتحة.", "الخلية مفتوحة الآن. ما أول عُضيّة تلاحظها؟")}),
        (("reset", "إعادة"), {"tool": "reset_scene", "args": {}},
         {"en": ("Resetting the view.", "We're back to the whole cell.", "Back to the whole cell. Which part would you like to explore?"),
          "ar": ("أعيد ضبط العرض.", "عدنا إلى الخلية كاملة.", "عدنا إلى الخلية كاملة. أي جزء تود استكشافه؟")}),
    ],
    "chemistry": [
        (("break", "bond", "روابط"), {"tool": "play_reaction_step", "args": {"n": 2}},
         {"en": ("Let's jump to the bond-breaking step.", "Breaking bonds takes in energy, which is why a spark is needed to start this reaction.", "Here the bonds have broken. Does breaking bonds take in energy or release it?"),
          "ar": ("لننتقل إلى خطوة كسر الروابط.", "كسر الروابط يمتص طاقة، ولهذا نحتاج شرارة لبدء التفاعل.", "هنا انكسرت الروابط. هل كسر الروابط يمتص طاقة أم يحررها؟")}),
        (("form", "glow", "energy", "طاقة"), {"tool": "play_reaction_step", "args": {"n": 4}},
         {"en": ("Watch the new bonds form.", "Forming the O-H bonds releases more energy than breaking the old ones took, so the reaction is exothermic.", "See the glow? Which side of the reaction released more energy, breaking bonds or forming them?"),
          "ar": ("شاهد تكوّن الروابط الجديدة.", "تكوين روابط O–H يحرر طاقة أكبر مما استهلكه كسر الروابط القديمة، لذلك التفاعل طارد للحرارة.", "هل ترى التوهج؟ أيهما حرّر طاقة أكبر: كسر الروابط أم تكوينها؟")}),
        (("balance", "atoms", "ذرات", "وزن"), {"tool": "set_param", "args": {"name": "view", "value": "balance"}},
         {"en": ("Let's check the atoms.", "Atoms are never created or destroyed, so each element must match on both sides.", "I've opened the balancing view. Which element is out of balance right now?"),
          "ar": ("لنفحص الذرات.", "الذرات لا تُخلق ولا تفنى، لذلك يجب أن يتساوى كل عنصر في الطرفين.", "فتحتُ عرض الموازنة. أي عنصر غير متزن الآن؟")}),
        (("reset", "start", "إعادة"), {"tool": "reset_scene", "args": {}},
         {"en": ("Back to the beginning.", "The reaction is reset to the reactants.", "We're at the start. What do you predict will happen when the molecules meet?"),
          "ar": ("نعود إلى البداية.", "عاد التفاعل إلى المواد المتفاعلة.", "نحن في البداية. ماذا تتوقع أن يحدث عندما تلتقي الجزيئات؟")}),
    ],
}

DEFAULT = {
    "en": ("", "I'm here to help with this lab. Ask me about what you see, or tell me to show you something.", "What have you noticed in the lab so far?"),
    "ar": ("", "أنا هنا لأساعدك في هذا المختبر. اسألني عما تراه، أو اطلب مني أن أريك شيئًا.", "ما الذي لاحظته في المختبر حتى الآن؟"),
}


def _words(text: str) -> list[str]:
    return re.findall(r"\S+\s*", text)


class MockLLM:
    def __init__(self, delay: float = 0.02) -> None:
        self.delay = delay

    async def stream_turn(self, system: list[dict[str, Any]], messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> AsyncIterator[LLMEvent]:
        sys_text = "\n".join(b["text"] for b in system)
        subject = (re.search(r"the (\w+) teacher in 3D School", sys_text) or [None, "physics"])[1]
        lang = "ar" if "Reply in Arabic" in sys_text else "en"
        socratic = "Mode: SOCRATIC" in sys_text
        last = messages[-1]
        followup_round = isinstance(last["content"], list) and any(
            isinstance(b, dict) and b.get("type") == "tool_result" for b in last["content"]
        )
        if followup_round:
            user_text = self._first_user_text(messages)
            script = self._match(subject, user_text)
            _, followup, socratic_followup = (script[2] if script else DEFAULT)[lang]
            # If a tool errored, say so honestly instead of pretending it worked.
            errored = any(b.get("is_error") for b in last["content"])
            text = followup if script else (socratic_followup if socratic else followup)
            if script and socratic and not errored:
                text = socratic_followup
            async for ev in self._text(text):
                yield ev
            yield TurnEnd("end_turn", [{"type": "text", "text": text}])
            return

        user_text = last["content"] if isinstance(last["content"], str) else ""
        script = self._match(subject, user_text)
        if script is None:
            scene = self._scene(user_text)
            intro, body, q = DEFAULT[lang]
            text = (q if socratic else body)
            if scene.get("experiment") == "pendulum" and "angle_deg" in scene and lang == "en":
                text = f"I can see a pendulum at {scene['angle_deg']} degrees. " + text
            async for ev in self._text(text):
                yield ev
            yield TurnEnd("end_turn", [{"type": "text", "text": text}])
            return
        _, call, texts = script
        intro = texts[lang][0]
        async for ev in self._text(intro):
            yield ev
        tu = ToolUse("toolu_mock_1", call["tool"], call["args"])
        yield TurnEnd(
            "tool_use",
            [{"type": "text", "text": intro}, {"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input}],
            [tu],
        )

    # -- helpers -----------------------------------------------------------------------
    async def _text(self, text: str) -> AsyncIterator[LLMEvent]:
        for w in _words(text):
            if self.delay:
                await asyncio.sleep(self.delay)
            yield TextDelta(w)

    @staticmethod
    def _first_user_text(messages: list[dict[str, Any]]) -> str:
        for m in reversed(messages):
            if m["role"] == "user" and isinstance(m["content"], str):
                return m["content"]
        return ""

    @staticmethod
    def _scene(text: str) -> dict[str, Any]:
        m = re.search(r"<scene_state>(.*?)</scene_state>", text, re.DOTALL)
        try:
            return json.loads(m.group(1)) if m else {}
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _match(subject: str, text: str) -> Script | None:
        body = re.sub(r"<scene_state>.*?</scene_state>", "", text, flags=re.DOTALL).lower()
        for script in SCRIPTS.get(subject, []):
            if any(k in body for k in script[0]):
                return (script[0], {"tool": script[1]["tool"], "args": script[1]["args"]}, script[2])  # type: ignore[index,return-value]
        return None
