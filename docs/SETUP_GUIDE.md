# Stylese Studio — Hướng dẫn Cài đặt & Chạy Web UI

> **Dành cho:** Co-worker clone repo từ GitHub và chạy web UI trên máy local.
> **Cập nhật:** 2026-07-14 · **Branch:** `Model` (hoặc `feat/benchmark`)

---

## 0. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Cách kiểm tra |
|---|---|---|
| Python | **3.13** (3.12 chạy được server/KB) | `python --version` |
| Node.js | **≥20.9** | `node --version` |
| npm | đi kèm Node.js (`npm.cmd` trên PowerShell nếu bị chặn script) | `npm --version` |
| Git | bất kỳ | `git --version` |
| GPU NVIDIA (để chạy model local) | **≥ 8 GB VRAM**, CUDA 12.4+ | `nvidia-smi` |

> **Nếu máy không có GPU ≥ 8 GB VRAM (ví dụ laptop 4 GB VRAM hoặc chỉ có CPU):** Bạn vẫn chạy đầy đủ Graph KB + Web UI + AI Stylist bằng **chế độ Remote/Cloud** (Gemini API, OpenAI-compatible API, hoặc host model Qwen của nhóm trên Kaggle/Colab). Xem §4.2 bên dưới.

---

## 1. Clone repo

```bash
git clone https://github.com/Hoangnguyenhuu12/Stylese-Studio.git
cd Stylese-Studio
```

> **Lưu ý:** Repo đã chuyển từ `vominhnhatquang/fashion_match_project` sang `Lendo-Stylix/fashion_match`.

---

## 2. Cài đặt Python backend

### 2.1 Cài `uv` (package manager)

```powershell
# Windows PowerShell (Admin)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2.2 Cài dependencies

```bash
uv sync --group dev
```

Quá trình này cài tất cả Python packages vào `.venv/`, bao gồm:
- `torch`, `transformers`, `peft`, `bitsandbytes` (model)
- `fastapi`, `uvicorn`, `sse-starlette` (server)
- `pytest`, `ruff`, `mypy` (dev tools)

> **Thời gian:** ~5-10 phút tùy tốc độ mạng.

---

## 3. Cài đặt Frontend (Next.js)

```bash
cd web
npm install
cd ..
```

> **Thời gian:** ~2-5 phút.

---

## 4. Tải dữ liệu Catalog & Cấu hình AI Stylist

### 4.1 Tải dữ liệu Catalog (bắt buộc cho `/api/recommend` và `/api/chat`)

`item_edges.parquet` đã có sẵn trong repo, còn 2 file `catalog_metadata.parquet` và `item_store_links.parquet` cần lấy từ `Nhat-Quang/VN_Fashion_data` (dataset có kiểm soát quyền truy cập).

1. Copy `.env.example` thành `.env` và điền `HF_TOKEN=hf_...` (từ tài khoản Hugging Face đã được cấp quyền vào `Nhat-Quang/VN_Fashion_data`).
2. Chạy:
```powershell
.venv\Scripts\python.exe scripts\setup_data.py
# Thêm --images nếu muốn tải thêm ảnh sản phẩm về data/custom/catalog/images/
```

---

### 4.2 Chọn chế độ chạy AI Stylist

> Toàn bộ phần truy xuất Graph KB, rerank quiz, gợi ý size và chống bịa `outfit_id` đều chạy **local trên máy bạn** ở cả 3 cách dưới đây.

#### Cách 1 — Chạy model local thật (yêu cầu GPU NVIDIA ≥ 8 GB VRAM)

Model `Qwen3-VL-8B-Thinking` bnb-4bit + LoRA chiếm **~6.8 GB VRAM** (nếu GPU chỉ có 4 GB VRAM sẽ bị tràn VRAM/OOM).

```bash
uv run python scripts/setup_models.py --base --adapters
```

Script này tải base model và LoRA adapter về `D:/Models/`. Trong `.env`, đặt `STYLIST_PROVIDER=local` (hoặc để `auto` khi không cấu hình key remote).

#### Cách 2 — Chạy qua Cloud LLM API (cho máy GPU < 8 GB VRAM hoặc không có GPU)

Thêm vào `.env` một trong hai lựa chọn sau:

```env
# Lựa chọn A: Gemini API
STYLIST_PROVIDER=gemini
GEMINI_API_KEY=AIza...
STYLIST_MODEL=gemini-2.5-flash

# Lựa chọn B: OpenAI-compatible API (OpenAI, OpenRouter, Groq, Ollama, vLLM...)
# STYLIST_PROVIDER=openai
# STYLIST_API_BASE=https://api.openai.com/v1
# STYLIST_API_KEY=sk-...
# STYLIST_MODEL=gpt-4o-mini
```

#### Cách 3 — Chạy model `Qwen3-VL-8B + LoRA` tự train trên Kaggle / Colab (không cần máy mạnh)

Phù hợp khi demo/bảo vệ đồ án bằng đúng model nhóm đã fine-tune (lưu ý phiên Kaggle phải đang mở trong lúc chat):

1. Tạo Kaggle Notebook bật **GPU T4 x2** (hoặc P100, 16 GB VRAM) + **Internet: On**.
2. Cài thư viện & `cloudflared`, load `unsloth/Qwen3-VL-8B-Thinking-bnb-4bit` + adapter `Nhat-Quang/outfitmatch-stylist-final-qwen3vl8b-thinking-lora` với `device_map={"": 0}`, `torch_dtype="auto"`.
3. Mở endpoint FastAPI `/v1/chat/completions` và chạy `cloudflared tunnel --url http://localhost:8000` để lấy link `https://xxxx.trycloudflare.com`.
4. Dán link vào `.env` trên máy local:
```env
STYLIST_PROVIDER=openai
STYLIST_API_BASE=https://xxxx.trycloudflare.com/v1
STYLIST_API_KEY=kaggle-local
STYLIST_MODEL=qwen3-vl-8b-stylist
```

---

## 5. Chạy Web UI

Mở **2 terminal** riêng biệt:

### Terminal 1 — Backend (FastAPI)

```powershell
cd Stylese-Studio
.venv\Scripts\python.exe scripts\serve.py
```

(`scripts/serve.py` tự động đọc file `.env` và tải Graph KB + kết nối Stylist theo cấu hình đã chọn.)

### Terminal 2 — Frontend (Next.js)

```powershell
cd Stylese-Studio\web
npm run dev
# Trên Windows PowerShell nếu bị chặn ExecutionPolicy với npm.ps1, dùng:
# npm.cmd run dev
```

### Truy cập

| URL | Mô tả |
|---|---|
| http://localhost:3000 | **Web UI** — trang chủ |
| http://localhost:3000/chat | Chat với AI Stylist |
| http://localhost:3000/quiz | Quiz onboarding (5 câu) |
| http://localhost:3000/results | Kết quả gợi ý outfit |
| http://localhost:8000/docs | **API docs** (Swagger UI) |
| http://localhost:8000/openapi.json | OpenAPI schema |

---

## 6. Kiểm tra hệ thống hoạt động

### 6.1 Backend test

```bash
make test-fast
```

Kết quả mong đợi: `29 passed` (hoặc ít hơn nếu không có GPU — các test mock model vẫn pass).

### 6.2 Health check API

```bash
curl http://localhost:8000/api/health
```

Response:
```json
{
  "status": "ok",
  "graph_loaded": true,
  "stylist_available": true,   // false nếu không có GPU
  "gpu_available": true         // false nếu không có GPU
}
```

### 6.3 Quiz API

```bash
curl http://localhost:8000/api/quiz
```

Trả về 5 câu hỏi onboarding.

### 6.4 Recommend API (deterministic, không cần GPU)

```bash
curl -X POST http://localhost:8000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"occasion": "office"}'
```

### 6.5 Frontend build check

```bash
make web-build
```

Kết quả mong đợi: `✓ Compiled successfully`.

---

## 7. Các lệnh Makefile thông dụng

```bash
make serve          # Chạy backend (production)
make serve-dev      # Chạy backend (hot reload, port 8001)
make web-dev        # Chạy frontend dev server
make web-build      # Build frontend production
make test-fast      # pytest nhanh (không coverage)
make test           # pytest + coverage report
make lint           # ruff check + format check + mypy
make format         # ruff format + auto-fix
make qdrant-up      # Khởi động Qdrant (Docker) — optional
make qdrant-down    # Tắt Qdrant
```

---

## 8. Xử lý sự cố thường gặp

### "No module named 'torch'" hoặc "Cannot access accelerator device"

Nguyên nhân: `uv run` tự động cài torch CPU, ghi đè torch CUDA.

**Fix:** Dùng `.venv/Scripts/python.exe` trực tiếp (không `uv run`):
```bash
.venv/Scripts/python.exe -m uvicorn outfitmatch.server.app:app --host 0.0.0.0 --port 8000
```

### "port 8000 already in use"

```bash
# Windows: tìm process đang dùng port 8000
netstat -ano | findstr :8000
# Kill process
taskkill /PID <PID> /F
```

### "Qdrant connection refused"

Không có Qdrant → server tự động fallback sang graph scan. Không ảnh hưởng đến chức năng.

### "Model not found at D:/Models/..."

Stylist model chưa được tải. Chạy `uv run python scripts/setup_models.py --base --adapters` hoặc bỏ qua — server vẫn hoạt động.

### Next.js build lỗi TypeScript

```bash
cd web
npx tsc --noEmit    # Kiểm tra type errors
npm run build       # Build lại
```

---

## 9. Cấu trúc thư mục quan trọng

```text
fashion_match/
├── src/outfitmatch/       # Python source code
│   ├── server/            # FastAPI backend (mới)
│   ├── stylist/           # Model + service
│   ├── kb/                # Graph KB
│   ├── quiz/              # Onboarding quiz
│   └── pipeline.py        # E2E pipeline
├── web/                   # Next.js 16 frontend (mới)
│   └── src/app/           # Pages: home, chat, quiz, results
├── scripts/
│   ├── serve.py           # Backend launch script
│   └── setup_models.py    # Tải model về local
├── tests/                 # Unit + E2E tests
├── docs/                  # Tài liệu
├── data/custom/           # Catalog, graph, outfits parquet files
├── Makefile               # Convenience commands
└── pyproject.toml         # Python project config
```

---

## 10. Liên hệ

| Vai trò | Người phụ trách |
|---|---|
| Data/KB | Nhật Quang |
| Model/Stylist | Đình Lộc |
| Retrieval/API/UI | Hữu Hoàng |

Repo: https://github.com/Hoangnguyenhuu12/Stylese-Studio