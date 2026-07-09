import time
from collections import defaultdict

from fastapi import HTTPException


class SimpleRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if t > now - self.window]
        if len(self.requests[key]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window} seconds.",
            )
        self.requests[key].append(now)


_session_limiter = SimpleRateLimiter(max_requests=10, window_seconds=60)
