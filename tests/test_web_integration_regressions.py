"""Regressions for the web/API integration boundaries."""

import json
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from outfitmatch.server.routes.chat import router as chat_router
from outfitmatch.server.schemas import RecommendRequestDTO
from outfitmatch.stylist.service import StylistService


def test_partial_quiz_is_valid_and_keeps_body_measurements():
    request = RecommendRequestDTO(occasion="office", quiz_answers={"height_cm": 170, "weight_kg": 65})
    assert request.quiz_answers.favorite_colors == []
    assert request.quiz_answers.height_cm == 170


def test_chat_sse_serializes_cards_and_history():
    class Stylist:
        def chat_stream(self, **kwargs):
            assert kwargs["history"] == [{"role": "user", "content": "trước đó"}]
            yield {"type": "outfit_cards", "data": [{"outfit_id": "OF_12345"}]}
            yield {"type": "done"}

    app = FastAPI()
    app.include_router(chat_router, prefix="/api/chat")
    with patch("outfitmatch.server.deps._stylist_service", Stylist()), TestClient(app) as client:
        response = client.post("/api/chat", json={"message": "tiếp", "history": [{"role": "user", "content": "trước đó"}]})
    assert response.status_code == 200
    data = response.text.split("data: ")[1].splitlines()[0]
    assert json.loads(data) == [{"outfit_id": "OF_12345"}]


def test_hallucinated_answer_is_never_streamed():
    service = StylistService(model=None, processor=None, graph=None, generate_fn=lambda *args, **kwargs: "OF_99999")
    events = list(service.chat_stream("Gợi ý cho tôi"))
    assert any(event["type"] == "error" for event in events)
    assert not any(event["type"] == "token" for event in events)


def test_outfit_detail_and_missing_graph_nodes():
    from outfitmatch.kb.assemble_record import to_outfit_record
    from outfitmatch.kb.graph import Edge
    from outfitmatch.kb.graph_store import OutfitGraph
    from outfitmatch.kb.schema import ItemRecord
    from outfitmatch.kb.traversal import assemble_from_seed
    from outfitmatch.server.routes.outfits import router

    def item(item_id, category):
        return ItemRecord(item_id, category, "", [0.1], {"price_vnd": 100000, "in_stock": True, "product_url": "https://example.com"})

    graph = OutfitGraph([item("top", "top"), item("bottom", "bottom")], [
        Edge("top", "missing", "top", "bottom", 1.0),
        Edge("top", "bottom", "top", "bottom", 0.9),
    ])
    assembled = assemble_from_seed(graph, "top")[0]
    outfit_id = to_outfit_record(assembled.items, assembled.score).outfit_id
    app = FastAPI()
    app.include_router(router, prefix="/api/outfits")
    with patch("outfitmatch.server.deps._graph", graph), TestClient(app) as client:
        response = client.get(f"/api/outfits/{outfit_id}")
        missing = client.get("/api/outfits/OF_99999")
    assert response.status_code == 200
    assert {item["item_id"] for item in response.json()["items"]} == {"top", "bottom"}
    assert missing.status_code == 404
