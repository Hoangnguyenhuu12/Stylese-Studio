"""Look up dynamically assembled outfits by their stable ID."""

from __future__ import annotations

from dataclasses import asdict
from functools import lru_cache

from fastapi import APIRouter, HTTPException

router = APIRouter()


@lru_cache(maxsize=1)
def _outfit_index(graph):
    """Index the same default assemblies used by retrieval, once per graph."""
    from outfitmatch.kb.assemble_record import to_outfit_record
    from outfitmatch.kb.traversal import assemble_outfits

    seeds = [item.item_id for item in graph._items.values() if item.category in {"top", "dress"}]
    records = (to_outfit_record(outfit.items, outfit.score) for outfit in assemble_outfits(graph, seeds))
    return {record.outfit_id: record for record in records}


@router.get("/{outfit_id}")
async def get_outfit(outfit_id: str) -> dict:
    """Return a graph outfit, or 404 if it cannot be assembled."""
    from starlette.concurrency import run_in_threadpool
    from outfitmatch.server.deps import get_graph

    graph = get_graph()
    index = await run_in_threadpool(_outfit_index, graph)
    record = index.get(outfit_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Outfit {outfit_id} not found")
    return asdict(record)
