# Stylese Studio — AI Stylist v3.1-lite

**Stylese** là tên thương hiệu; **Stylese Studio** là tên ứng dụng. Các định danh kỹ thuật hiện có như package Python `outfitmatch`, URL repository và tên model vẫn được giữ để các lệnh và tài nguyên hiện tại hoạt động.

AI Stylist cá nhân hoá phong cách châu Á cho thị trường Việt Nam. Kiến trúc **v3.1-lite 4 tầng**, trong đó **graph KB là đường dẫn chính**.

Giao diện gồm Home, Explore, Stylist, Closet và Profile. Closet lưu món đồ và ảnh trong trình duyệt trên thiết bị hiện tại; chưa có tài khoản hay đồng bộ. Home tính số tổ hợp cơ bản theo công thức số áo × số quần/chân váy + số váy liền, chưa đánh giá độ phù hợp. Explore hiện giới thiệu các phong cách; ảnh và sản phẩm thực cần catalog. Stylist cần model và graph; tủ đồ cục bộ chưa tự động được gửi tới AI. Mục tin tức chưa kết nối nguồn dữ liệu.

```text
Tầng 1: Graph KB Builder  catalog → item tags/embeddings → sparse item-compat graph
Tầng 2: Stylist           Qwen3-VL-8B + LoRA + tool-calling (SSE streaming)
Tầng 3: Retrieval         Qdrant `items` seed filter + graph traversal + post-filter
Tầng 4: Personalization   Quiz 5 câu → preference rerank + size suggestion
```

> Canonical plan: [`Kien_truc_v3.1.md`](Kien_truc_v3.1.md) · Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## 🚀 Quick Start (Chạy Web UI)

### Yêu cầu

| Thành phần | Version | Ghi chú |
|---|---|---|
| Python | **3.13** | Dùng `.python-version` |
| Node.js | **≥20.9** | Tested on 26.5.0 |
| GPU (tùy chọn) | NVIDIA 8GB+ VRAM | Cần cho stylist chat; không có GPU → chat trả 503, recommend dùng deterministic path |
| Qdrant (tùy chọn) | Docker | Cần cho seed filter; không có → fallback graph scan |

### 1. Clone + Cài đặt

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

Ứng dụng cần `data/custom/catalog/catalog_metadata.parquet`, `data/custom/catalog/item_store_links.parquet` và `data/custom/graph/item_edges.parquet` từ cùng một snapshot. Nếu thiếu catalog hoặc graph, API vẫn khởi động nhưng chức năng gợi ý và stylist không khả dụng; kiểm tra `/api/health`. Dataset được dự án tham chiếu tại `Nhat-Quang/VN_Fashion_data` có thể yêu cầu quyền truy cập.

### 2. Tải model (cần GPU)

```bash
# Tải Qwen3-VL-8B-Thinking bnb-4bit + LoRA adapter về D:/Models
uv run python scripts/setup_models.py --base --adapters
```

> **Lưu ý:** Model dùng bnb-4bit quantization (~6.8 GB VRAM). Chỉ chạy được trên GPU NVIDIA.
> Nếu không có GPU, bỏ qua bước này — server sẽ chạy nhưng stylist unavailable.

### 3. Chạy Web UI

```bash
# Terminal 1: Backend (FastAPI)
make serve

# Terminal 2: Frontend (Next.js)
make web-dev
```

Truy cập:
- **Frontend:** http://localhost:3000
- **Backend API docs:** http://localhost:8000/docs
- **OpenAPI schema:** http://localhost:8000/openapi.json

### 4. Chạy Test

```bash
make test-fast      # pytest nhanh (không coverage)
make test           # pytest + coverage
make lint           # ruff + mypy
```

---

## 🏗️ Kiến trúc

| Tầng | Module | Trạng thái |
|---|---|---|
| **Tầng 1** | KB Builder — catalog, tagging, graph | ✅ 5,618 items, 316,559 edges |
| **Tầng 2** | Stylist — Qwen3-VL-8B + LoRA + SSE | 🟡 Cần model và GPU để kiểm tra thực tế |
| **Tầng 3** | Retrieval — Qdrant seed filter + traversal | ✅ Graph-first |
| **Tầng 4** | Personalization — Quiz + rerank + sizing | ✅ Rule-based |
| **Web UI** | Next.js 16 + TypeScript + Tailwind | ✅ Đã triển khai |
| **Backend** | FastAPI + SSE + OpenAPI | 🟡 Cần catalog để kiểm tra đầu-cuối |

---

## 📁 Cấu trúc source

```text
src/outfitmatch/
  vocab.py          # Controlled vocabulary — single source of truth
  kb/               # Tầng 1: catalog/schema/tagging/graph/traversal/eval
  retrieval.py      # Tầng 3: seed filter + traversal + post-filter
  stylist/          # Tầng 2: model, service, tools, validation
  server/           # FastAPI backend: routes, deps, app, schemas
  quiz/             # Tầng 4: onboarding quiz + rerank + size suggestion
  metrics/          # FITB/Compat AUC + graph FITB recall
  pipeline.py       # RecommendRequest → retrieval/rerank/size suggestion
  ui/               # Gradio demo placeholder

web/                # Next.js 16 frontend (App Router + TypeScript + Tailwind)

scripts/
  data/scrape/      # VN store scraping + quality gate
  data/kb/          # Build/tag/audit/eval graph KB CLIs
  stylist/          # Inference demo, GRPO training, benchmarks
  serve.py          # FastAPI launch script

tests/              # Mirrors src/scripts domains
```

---

## 🔧 Commands hay dùng

```bash
# Data / KB
uv run python -m scripts.data.kb.build_graph --no-qdrant
uv run python -m scripts.data.kb.eval_graph --seeds 300 --occasion office
uv run python -m scripts.data.kb.tag_items --limit 50

# Dev
make serve           # Backend (production)
make serve-dev       # Backend (hot reload, port 8001)
make web-dev         # Frontend dev server
make web-build       # Frontend production build

# Quality
make test-fast       # pytest nhanh
make test            # pytest + coverage
make lint            # ruff + mypy
make format          # ruff format + fix
```

---

## 📊 Trạng thái hiện tại

| Artifact / Metric | Giá trị |
|---|---|
| Catalog items | 5,618 |
| Graph edges | 316,559 |
| Materialized outfits | 1,000 |
| Item-tag invalid rows | 0 |
| Test coverage (backend) | Chạy test trên môi trường và dữ liệu của bạn để xác nhận |
| Coherence violations | 0 |
| FITB Recall@5 | ~0.98 |

---

## 📚 Tài liệu

| File | Nội dung |
|---|---|
| [`Kien_truc_v3.1.md`](Kien_truc_v3.1.md) | Kiến trúc/roadmap canonical |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Module boundaries, data flow, schema |
| [`docs/SPRINT_REPORT.md`](docs/SPRINT_REPORT.md) | Báo cáo tiến độ Scrum/XP |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Hướng dẫn cài đặt chi tiết cho co-worker |
| [`docs/EXPERIMENT_GUIDE.md`](docs/EXPERIMENT_GUIDE.md) | Workflow eval, LLM-judge, ablations |
| [`docs/STYLIST_MODEL_ANALYSIS.md`](docs/STYLIST_MODEL_ANALYSIS.md) | Phân tích chọn model stylist |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Báo cáo chi tiết folder/project |

---

## 👥 Team

| Vai trò | Owner |
|---|---|
| Dev A — Data/KB (Tầng 1) | Nhật Quang |
| Dev B — Model/Stylist (Tầng 2) | Đình Lộc |
| Dev C — Retrieval / Quiz / UI / API (Tầng 3-4) | Hữu Hoàng |
