"""Launch FastAPI server for OutfitMatch.

Usage (from project root):
    .venv/Scripts/python.exe scripts/serve.py
    .venv/Scripts/python.exe scripts/serve.py --reload --port 8001

NOTE: ALWAYS use .venv/Scripts/python.exe directly, NOT uv run.
uv run re-syncs torch to CPU-only, breaking GPU model loading.
"""

import argparse
import os
from pathlib import Path


def _load_dotenv(env_path: Path) -> None:
    """Populate os.environ from a local .env file without overriding set vars."""
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value and value[0] in {'"', "'"} and value[-1] == value[0]:
            value = value[1:-1]
        elif " #" in value or "\t#" in value:
            value = value.split("#", 1)[0].strip()
        if key:
            os.environ.setdefault(key, value)


def main():
    _load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    parser = argparse.ArgumentParser(description="Start OutfitMatch FastAPI server.")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address")
    parser.add_argument("--port", type=int, default=8000, help="Port")
    parser.add_argument("--reload", action="store_true", help="Auto-reload on code changes")
    args = parser.parse_args()

    # Ensure HF caches off C: drive
    models_base = os.environ.get("OUTFITMATCH_MODELS_BASE", "D:/Models")
    os.environ.setdefault("HF_HOME", f"{models_base}/hf_home")
    os.environ.setdefault("HF_HUB_CACHE", f"{models_base}/hf_hub")

    import uvicorn

    uvicorn.run(
        "outfitmatch.server.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
