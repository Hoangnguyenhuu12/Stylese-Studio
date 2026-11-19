"""POST /api/chat — SSE streaming."""

from __future__ import annotations

from typing import Any
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from starlette.concurrency import iterate_in_threadpool

from outfitmatch.server.schemas import ChatRequest

router = APIRouter()


@router.post("")
async def chat(req: ChatRequest) -> Any:
    """Chat endpoint: SSE stream of stylist events."""
    from outfitmatch.server.deps import get_stylist_service

    stylist = get_stylist_service()
    if stylist is None:
        raise HTTPException(status_code=503, detail="Stylist model not available")

    async def event_generator():
        try:
            history = [m for m in req.history if m.get("role") in {"user", "assistant"} and isinstance(m.get("content"), str)]
            events = stylist.chat_stream(user_message=req.message, history=history, quiz_answers=req.quiz_answers)
            async for event in iterate_in_threadpool(events):
                data = json.dumps(event.get("data"), ensure_ascii=False)
                yield f"event: {event['type']}\ndata: {data}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps(str(e), ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
