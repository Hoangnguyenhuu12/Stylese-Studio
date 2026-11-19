"""FastAPI dependency injection and lifespan singletons."""

from __future__ import annotations

import logging
import os
import tempfile
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException

logger = logging.getLogger(__name__)

# Module-level singletons, set during lifespan startup.
app: FastAPI | None = None
_graph: Any | None = None
_model: Any | None = None
_processor: Any | None = None
_stylist_service: Any | None = None
_stylist_mode: str = "unavailable"


@asynccontextmanager
async def lifespan(app_obj: FastAPI) -> AsyncGenerator[None]:
    """Load graph + stylist backend at startup, clean up at shutdown."""
    global _graph, _model, _processor, _stylist_service, _stylist_mode

    logger.info("Loading OutfitMatch singletons...")

    # Load graph KB (CPU)
    from scripts.data.scrape.base import CATALOG_DIR

    from outfitmatch.kb.catalog import load_catalog_items
    from outfitmatch.kb.graph_store import EDGES_PARQUET, load_graph

    try:
        if not EDGES_PARQUET.is_file():
            raise FileNotFoundError(f"Graph edges missing: {EDGES_PARQUET}")
        catalog_path = CATALOG_DIR / "catalog_metadata.parquet"
        links_path = CATALOG_DIR / "item_store_links.parquet"
        if (not catalog_path.is_file() or not links_path.is_file()) and os.getenv("HF_TOKEN"):
            from huggingface_hub import hf_hub_download

            tmp_cache = Path(tempfile.gettempdir()) / "outfitmatch_hf_cache"
            hf_token = os.getenv("HF_TOKEN", "").strip()
            if not catalog_path.is_file():
                catalog_path = Path(
                    hf_hub_download(
                        repo_id="Nhat-Quang/VN_Fashion_data",
                        repo_type="dataset",
                        filename="custom/catalog/catalog_metadata.parquet",
                        token=hf_token,
                        cache_dir=str(tmp_cache),
                    )
                )
            if not links_path.is_file():
                links_path = Path(
                    hf_hub_download(
                        repo_id="Nhat-Quang/VN_Fashion_data",
                        repo_type="dataset",
                        filename="custom/catalog/item_store_links.parquet",
                        token=hf_token,
                        cache_dir=str(tmp_cache),
                    )
                )
        if not catalog_path.is_file() or not links_path.is_file():
            raise FileNotFoundError(f"Catalog parquet missing: {catalog_path} / {links_path}")
        items = load_catalog_items(catalog_path, links_path)
        _graph = load_graph(items=items)
        logger.info("Graph loaded: %d items", len(items))
    except (FileNotFoundError, OSError):
        _graph = None
        logger.exception("Catalog or graph data unavailable; recommendations disabled")

    # Initialize stylist service (remote LLM first, then local GPU if weights exist)
    _stylist_service = None
    _stylist_mode = "unavailable"
    try:
        if _graph is None:
            raise RuntimeError("Graph unavailable")

        from outfitmatch.stylist.remote import (
            make_remote_generate_fn,
            resolve_remote_stylist_configs,
        )
        from outfitmatch.stylist.service import StylistService

        remote_cfgs = resolve_remote_stylist_configs()
        if remote_cfgs:
            _stylist_service = StylistService(
                model=None,
                processor=None,
                graph=_graph,
                generate_fn=make_remote_generate_fn(remote_cfgs),
            )
            _stylist_mode = " -> ".join(c.provider for c in remote_cfgs)
            logger.info(
                "Stylist connected via remote chain=%s",
                " -> ".join(f"{c.provider}:{c.model}" for c in remote_cfgs),
            )
        else:
            from outfitmatch.stylist.model import (
                DEFAULT_ADAPTER_DIR,
                DEFAULT_BASE_MODEL_DIR,
                load_stylist_model,
            )

            if not DEFAULT_BASE_MODEL_DIR.exists():
                raise FileNotFoundError(
                    "No remote LLM configured and local model not found at "
                    f"{DEFAULT_BASE_MODEL_DIR}"
                )
            adapter_path = DEFAULT_ADAPTER_DIR if DEFAULT_ADAPTER_DIR.exists() else None
            model, processor = load_stylist_model(
                base_model=DEFAULT_BASE_MODEL_DIR,
                lora_checkpoint=adapter_path,
            )
            _model = model
            _processor = processor
            _stylist_service = StylistService(model=model, processor=processor, graph=_graph)
            _stylist_mode = "local"
            logger.info("Local stylist model loaded successfully")
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not initialize stylist service (running without LLM): %s", e)

    yield

    logger.info("Shutting down OutfitMatch server.")


def get_graph() -> Any:
    """Dependency: retrieve the shared OutfitGraph."""
    if _graph is None:
        raise HTTPException(status_code=503, detail="Catalog or graph data unavailable")
    return _graph


def get_stylist_service() -> Any | None:
    """Dependency: retrieve the StylistService (or None if model unavailable)."""
    return _stylist_service


def get_model_and_processor() -> tuple[Any, Any] | None:
    """Dependency: retrieve (model, processor) or None."""
    if _model is None or _processor is None:
        return None
    return _model, _processor
