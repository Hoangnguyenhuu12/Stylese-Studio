# Stylese Studio

**An AI stylist and fashion recommendation project for Vietnam, inspired by Asian fashion.**

Stylese Studio brings together style discovery, a personal wardrobe, and an AI stylist. The project uses a four-layer architecture built around a graph-based knowledge base.

Stylese is the brand name; Stylese Studio is the application name. Existing technical identifiers, including the `outfitmatch` Python package and model names, are unchanged.

## What is available

- **Home:** View wardrobe counts and a basic combination count (tops × bottoms plus dresses). This count does not assess whether items match.
- **Explore:** Browse style directions. Product images and listings require the catalog.
- **Stylist:** Chat about styling. The AI service requires the model and graph data; the local wardrobe is not sent to the AI automatically.
- **Closet:** Organize items and photos in folders. Data stays in this browser on this device; accounts and cross-device sync are not yet available.
- **Profile:** Save style preferences and complete the onboarding quiz. The news section does not yet have a connected source.

The recommendation pipeline has four layers:

| Layer | Purpose |
| --- | --- |
| 1. Graph knowledge base | Turn catalog items, tags, and embeddings into a sparse item-compatibility graph. |
| 2. Stylist | Use Qwen3-VL-8B with a LoRA adapter and tool calling, with SSE streaming. |
| 3. Retrieval | Filter Qdrant `items`, traverse the graph, and apply post-filters. |
| 4. Personalization | Use a five-question quiz for preference reranking and size suggestions. |

See the [architecture and roadmap](Kien_truc_v3.1.md) and [system architecture](docs/ARCHITECTURE.md) for details.

## Quick start

### Requirements

| Component | Version or requirement | Notes |
| --- | --- | --- |
| Python | **3.13** | See `.python-version`. |
| Node.js | **20.9 or later** | Tested on 26.5.0. |
| GPU, optional | NVIDIA GPU with at least 8 GB VRAM | Required for the stylist chat model. Without it, chat returns 503 and recommendations use the deterministic path. |
| Qdrant, optional | Docker | Used for seed filtering; the system falls back to a graph scan when unavailable. |

### 1. Clone and install

```bash
git clone https://github.com/Hoangnguyenhuu12/Stylese-Studio.git
cd Stylese-Studio

# Python backend
uv sync --group dev

# Frontend
cd web
npm install
cd ..
```

The application requires `data/custom/catalog/catalog_metadata.parquet`, `data/custom/catalog/item_store_links.parquet`, and `data/custom/graph/item_edges.parquet` from the same snapshot. Without the catalog or graph, the API can start, but recommendations and the stylist are unavailable. Check `/api/health` for status. The referenced dataset, `Nhat-Quang/VN_Fashion_data`, may require access permission.

### 2. Download the model

This step requires an NVIDIA GPU. The model uses bnb-4bit quantization and approximately 6.8 GB VRAM.

```bash
# Download Qwen3-VL-8B-Thinking bnb-4bit and the LoRA adapter to D:/Models
uv run python scripts/setup_models.py --base --adapters
```

You can skip this step without a GPU; the server will run, but the stylist will be unavailable.

### 3. Start the application

```bash
# Terminal 1: FastAPI backend
make serve

# Terminal 2: Next.js frontend
make web-dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- OpenAPI schema: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

### 4. Run checks

```bash
make test-fast      # Fast pytest suite without coverage
make test           # Pytest with coverage
make lint           # Ruff and mypy
```

## Architecture and status

| Layer | Module | Status |
| --- | --- | --- |
| 1 | Knowledge base builder: catalog, tagging, and graph | 5,618 items and 316,559 edges in the recorded snapshot |
| 2 | Stylist: Qwen3-VL-8B, LoRA, and SSE | Requires the model and a GPU for live verification |
| 3 | Retrieval: Qdrant seed filtering and graph traversal | Graph-first |
| 4 | Personalization: quiz, reranking, and sizing | Rule-based |
| Web UI | Next.js 16, TypeScript, and Tailwind CSS | Implemented |
| Backend | FastAPI, SSE, and OpenAPI | Requires the catalog for end-to-end verification |

## Project structure

```text
src/outfitmatch/
  vocab.py          # Controlled vocabulary: single source of truth
  kb/               # Layer 1: catalog, schema, tagging, graph, traversal, evaluation
  retrieval.py      # Layer 3: seed filtering, traversal, and post-filtering
  stylist/          # Layer 2: model, service, tools, and validation
  server/           # FastAPI routes, dependencies, app, and schemas
  quiz/             # Layer 4: onboarding quiz, reranking, and size suggestions
  metrics/          # FITB, compatibility AUC, and graph FITB recall
  pipeline.py       # RecommendRequest to retrieval, reranking, and size suggestion
  ui/               # Gradio demo placeholder

web/                # Next.js frontend: App Router, TypeScript, and Tailwind CSS

scripts/
  data/scrape/      # Vietnam store scraping and quality gate
  data/kb/          # Graph knowledge-base build, tag, audit, and evaluation CLIs
  stylist/          # Inference demo, GRPO training, and benchmarks
  serve.py          # FastAPI launch script

tests/              # Tests organized by source and script domains
```

## Common commands

```bash
# Data and knowledge base
uv run python -m scripts.data.kb.build_graph --no-qdrant
uv run python -m scripts.data.kb.eval_graph --seeds 300 --occasion office
uv run python -m scripts.data.kb.tag_items --limit 50

# Development
make serve           # Backend (production)
make serve-dev       # Backend with hot reload on port 8001
make web-dev         # Frontend development server
make web-build       # Frontend production build

# Quality
make test-fast       # Fast pytest suite
make test            # Pytest with coverage
make lint            # Ruff and mypy
make format          # Ruff formatting and fixes
```

## Recorded snapshot

These figures describe the recorded project snapshot; verify results against your own environment and data.

| Artifact or metric | Value |
| --- | --- |
| Catalog items | 5,618 |
| Graph edges | 316,559 |
| Materialized outfits | 1,000 |
| Invalid item-tag rows | 0 |
| Backend test coverage | Run the tests in your environment to verify. |
| Coherence violations | 0 |
| FITB Recall@5 | Approximately 0.98 |

## Documentation

| Document | Description |
| --- | --- |
| [Architecture and roadmap](Kien_truc_v3.1.md) | Canonical architecture and roadmap |
| [System architecture](docs/ARCHITECTURE.md) | Module boundaries, data flow, and schema |
| [Sprint report](docs/SPRINT_REPORT.md) | Scrum/XP progress report |
| [Setup guide](docs/SETUP_GUIDE.md) | Detailed setup instructions |
| [Experiment guide](docs/EXPERIMENT_GUIDE.md) | Evaluation, LLM-judge, and ablation workflows |
| [Stylist model analysis](docs/STYLIST_MODEL_ANALYSIS.md) | Stylist model selection analysis |
| [Project structure](docs/PROJECT_STRUCTURE.md) | Detailed project and folder structure |

## Team

| Member | Responsibility |
| --- | --- |
| Nhật Quang | Data and knowledge base (layer 1) |
| Đình Lộc | Model and stylist (layer 2) |
| Hữu Hoàng | Retrieval, quiz, UI, and API (layers 3–4) |
