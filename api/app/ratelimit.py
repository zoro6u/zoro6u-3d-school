import time
from collections import defaultdict, deque
from collections.abc import Callable


class RateLimiter:
    """Sliding-window limiter, in memory (per process). Fine for a demo; use Redis if you scale out."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window: float = 60.0) -> float:
        """Returns 0 if allowed (and records the hit), else seconds until the next slot."""
        now = self._clock()
        q = self._hits[key]
        while q and now - q[0] >= window:
            q.popleft()
        if len(q) >= limit:
            return max(0.1, window - (now - q[0]))
        q.append(now)
        return 0.0

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()
