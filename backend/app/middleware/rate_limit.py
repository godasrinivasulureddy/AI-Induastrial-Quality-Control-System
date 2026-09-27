import time
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict

# Simple in‑memory rate limiter: max 100 requests per minute per IP
MAX_REQUESTS = 100
WINDOW_SECONDS = 60
_requests_log: dict[str, list[float]] = defaultdict(list)

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "anonymous"
        now = time.time()
        timestamps = _requests_log[client_ip]
        # Remove timestamps older than window
        while timestamps and now - timestamps[0] > WINDOW_SECONDS:
            timestamps.pop(0)
        if len(timestamps) >= MAX_REQUESTS:
            return JSONResponse(status_code=429, content={"detail": "Too many requests, slow down."})
        timestamps.append(now)
        response = await call_next(request)
        return response
