"""POST /api/chat — SSE streaming."""

from __future__ import annotations

import json
from typing import Any

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
            history = [
                m
                for m in req.history
                if m.get("role") in {"user", "assistant"} and isinstance(m.get("content"), str)
            ]
            quiz = req.quiz_answers if isinstance(req.quiz_answers, dict) else {}
            height_cm = quiz.get("height_cm")
            weight_kg = quiz.get("weight_kg")
            events = stylist.chat_stream(
                user_message=req.message,
                history=history,
                quiz_answers=req.quiz_answers,
                closet_items=req.closet_items,
                height_cm=height_cm if isinstance(height_cm, int) else None,
                weight_kg=weight_kg if isinstance(weight_kg, int) else None,
            )
            async for event in iterate_in_threadpool(events):
                data = json.dumps(event.get("data"), ensure_ascii=False)
                yield f"event: {event['type']}\ndata: {data}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps(str(e), ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
