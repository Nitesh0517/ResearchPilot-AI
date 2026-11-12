# ResearchPilot AI

**Autonomous Web Research & Intelligence Agent**  
*Global AI Hackathon – Tavily Research Agent*

**Repository:** [https://github.com/Nitesh0517/ResearchPilot-AI](https://github.com/Nitesh0517/ResearchPilot-AI)

ResearchPilot AI is an autonomous, evidence-grounded web research platform that plans multi-angle investigations, searches the live internet using **Tavily**, synthesizes cross-source findings using **Google Gemini**, audits every citation against real retrieved URLs, and generates structured, downloadable **PDF research reports** with persistent session history.

---

## Key Capabilities

- **Autonomous 9-Step Research Pipeline**
  1. **Query Input** — Validates natural-language research prompts and initializes a tracked session.
  2. **Query Analyzer** — Identifies user intent, core topic, analytical scope, and time sensitivity via Gemini.
  3. **Research Planner** — Decomposes complex questions into 3–4 targeted web search queries.
  4. **Tavily Search Agent** — Executes concurrent live web searches via `AsyncTavilyClient` (`tavily-python`).
  5. **Information Processor** — Canonicalizes URLs (stripping tracking params/fragments), removes duplicates, cleans snippets, and ranks sources by relevance.
  6. **Gemini Analysis Agent** — Synthesizes cross-source evidence via the current `google-genai` SDK with strict Pydantic JSON schemas and multi-model fallback resilience.
  7. **Citation Manager** — Audits every `[n]` reference and quantitative statistic against verified source URLs; strips unverified references so citations are never invented.
  8. **Report Generator** — Builds structured reports featuring Executive Summary, Problem Overview, Key Findings (explicitly separating **Retrieved Facts** from **AI-Generated Analysis**), Detailed Analysis, Source-Backed Statistics, Conclusion, and Related Follow-up Questions.
  9. **Persistence & Final Output** — Streams live step progress over Server-Sent Events (SSE) and saves reports to MongoDB (or local JSON fallback storage when MongoDB is not configured).

- **Evidence Integrity & Graceful Degradation**
  - Clearly distinguishes retrieved web evidence from AI-generated interpretation.
  - Never fabricates search results, citations, or statistics.
  - Surfaces clear `503 CONFIGURATION_MISSING` guidance if `TAVILY_API_KEY` or `GEMINI_API_KEY` is missing.
  - Operates seamlessly without MongoDB using local fallback storage (`backend/data/research_history.json`) and reports storage status via `/api/health`.

- **Interactive Dashboard, Follow-Up Research & PDF Export**
  - Modern SaaS UI inspired by Linear and Perplexity AI (`#101828` Deep Navy, `#6366F1` Indigo, `#F8FAFC` Light Surface).
  - Context-aware follow-up research linked to parent reports (`POST /api/research/follow-up`).
  - One-click multi-page PDF report export powered by ReportLab (`GET /api/research/{id}/pdf`).

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, React Router, Axios, Lucide React, Framer Motion |
| **Backend** | Python 3.14, FastAPI, Pydantic v2, Uvicorn |
| **Web Search** | Tavily Python SDK (`tavily-python` / `AsyncTavilyClient`) |
| **AI Reasoning** | Google Gen AI SDK (`google-genai`) with structured JSON output & automatic model fallback |
| **Database** | MongoDB (`motor` async driver) with automatic local JSON/memory fallback |
| **PDF Export** | ReportLab |
| **Testing** | Pytest, Pytest-Asyncio, FastAPI TestClient |

---

## Project Structure

```text
ResearchPilot-AI/
├── frontend/
│   ├── src/
│   │   ├── components/       # AgentWorkflowTracker, SourceCard, CitationBadge, ConfigAlert, Skeletons
│   │   ├── hooks/            # useHealth, useToast
│   │   ├── layouts/          # DashboardLayout (responsive sidebar + mobile drawer + live status)
│   │   ├── pages/            # LandingPage, DashboardPage, ResultsPage, HistoryPage, SettingsPage
│   │   ├── services/         # api.js (Axios REST client + SSE stream reader)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── agents/           # orchestrator.py (9-step workflow), processor.py (dedup & citation audit)
│   │   ├── database/         # repository.py (MongoDB + local JSON/memory fallback)
│   │   ├── models/           # research.py (Pydantic schemas)
│   │   ├── routes/           # health.py, research.py
│   │   ├── services/         # tavily_service.py, gemini_service.py, pdf_service.py
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── main.py
│   ├── tests/
│   │   └── test_api_and_agents.py
│   ├── pytest.ini
│   └── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Nitesh0517/ResearchPilot-AI.git
cd ResearchPilot-AI
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` (in the project root or `backend/.env`) and add your API keys:

```env
TAVILY_API_KEY=your_tavily_api_key
GEMINI_API_KEY=your_gemini_api_key

# Optional: Leave blank or omit to use automatic local storage fallback
MONGODB_URI=
MONGODB_DB_NAME=researchpilot_ai

GEMINI_MODEL=gemini-3.5-flash-lite
```

> **Security Note:** Never commit `.env` files or expose API keys in frontend code or logs. `.gitignore` excludes `.env`, `backend/.env`, `backend/data/`, and virtual environments.

### 3. Run the Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Run the Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite automatically proxies `/api/*` requests to `http://127.0.0.1:8000`.

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, API key configuration flags, Gemini model, and storage mode |
| `POST` | `/api/research` | Execute the 9-step autonomous research pipeline and return report JSON |
| `POST` | `/api/research/stream` | Stream real-time SSE agent step events followed by the completed report |
| `POST` | `/api/research/follow-up` | Run follow-up research grounded in an existing `parent_research_id` |
| `POST` | `/api/research/follow-up/stream` | Stream SSE progress for follow-up research |
| `GET` | `/api/research/history` | List saved reports (supports `?q=` search filtering) |
| `GET` | `/api/research/{research_id}` | Retrieve a single structured research report |
| `GET` | `/api/research/{research_id}/pdf` | Download the formatted PDF research report |
| `DELETE` | `/api/research/{research_id}` | Delete a saved research report |

---

## Testing & Build Verification

### Backend Tests
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

### Frontend Production Build
```powershell
cd frontend
npm run build
```
