"""Download gated VN Fashion catalog parquet files into data/custom/catalog/.

Usage:
    .venv/Scripts/python.exe scripts/setup_data.py
    .venv/Scripts/python.exe scripts/setup_data.py --images

Requires ``HF_TOKEN`` (in environment or ``.env``) with access to
``Nhat-Quang/VN_Fashion_data``.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = REPO_ROOT / "data" / "custom" / "catalog"
DATASET_REPO = "Nhat-Quang/VN_Fashion_data"
REQUIRED_FILES = (
    "custom/catalog/catalog_metadata.parquet",
    "custom/catalog/item_store_links.parquet",
)


def _load_dotenv(env_path: Path) -> None:
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


def main(argv: list[str] | None = None) -> int:
    _load_dotenv(REPO_ROOT / ".env")
    parser = argparse.ArgumentParser(description="Download VN Fashion catalog parquet files.")
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist.")
    parser.add_argument(
        "--images",
        action="store_true",
        help="Also download catalog product thumbnails into data/custom/catalog/images/.",
    )
    args = parser.parse_args(argv)

    from huggingface_hub import hf_hub_download, snapshot_download

    token = os.getenv("HF_TOKEN", "").strip() or None
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)

    for rel_path in REQUIRED_FILES:
        dest = REPO_ROOT / "data" / rel_path
        if dest.is_file() and not args.force:
            print(f"[skip] {dest} already exists", file=sys.stderr)
            continue
        print(f"[get ] {DATASET_REPO}/{rel_path}", file=sys.stderr)
        cached = hf_hub_download(
            repo_id=DATASET_REPO,
            repo_type="dataset",
            filename=rel_path,
            token=token,
        )
        shutil.copy2(cached, dest)
        print(f"[ok  ] saved -> {dest}", file=sys.stderr)

    if args.images:
        print(f"[get ] {DATASET_REPO}/custom/catalog/images/*", file=sys.stderr)
        snapshot_download(
            repo_id=DATASET_REPO,
            repo_type="dataset",
            allow_patterns=["custom/catalog/images/*"],
            local_dir=str(REPO_ROOT / "data"),
            token=token,
        )
        print(f"[ok  ] images synced -> {CATALOG_DIR / 'images'}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
