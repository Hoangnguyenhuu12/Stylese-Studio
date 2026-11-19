"""Vercel / ASGI entrypoint for the Stylese Studio FastAPI service."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_SRC = _ROOT / "src"
for _path in (str(_ROOT), str(_SRC)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

from outfitmatch.server.app import app  # noqa: E402

__all__ = ["app"]
