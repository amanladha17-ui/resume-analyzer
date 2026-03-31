# ResumeIQ — AI Resume Analyzer with Gemini AI & Data Visualization

> An intelligent resume analysis platform powered by **Google Gemini AI** that parses resumes, scores ATS compatibility, matches job roles, and visualizes insights through interactive dashboards.

## 🚀 Features

- **📄 Resume Parsing** — Supports PDF, DOCX, DOC, TXT
- **🤖 Gemini AI Analysis** — Real LLM-powered strengths, weaknesses, suggestions & summary
- **📊 Data Visualization** — Bar chart, radar chart, doughnut ATS ring, horizontal breakdown
- **🎯 ATS Score** — 0–100 compatibility score with detailed breakdown
- **💼 Job Role Matching** — Matches against 7 common tech roles with % compatibility
- **🔍 Integrity Check** — Detects LinkedIn mismatches, missing contact info
- **📁 History** — All analyses saved in SQLite database

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Charts | Chart.js 4.x |
| Backend | Node.js + Express.js |
| AI Engine | **Google Gemini AI** (gemini-1.5-flash) |
| PDF Parsing | pdf-parse |
| DOCX Parsing | mammoth |
| Database | SQLite (sql.js — no compilation needed) |

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ → [nodejs.org](https://nodejs.org)
- Free Gemini API Key → [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Step 1 — Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/resume-analyzer.git
cd resume-analyzer/backend
npm install
```

### Step 2 — Add your Gemini API Key
```bash
# In the backend folder, create a .env file:
echo "GEMINI_API_KEY=your_key_here" > .env
echo "PORT=5000" >> .env
```

**Get your FREE Gemini API key:**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with Google
3. Click **"Create API Key"**
4. Copy and paste into your `.env` file

### Step 3 — Run
```bash
npm start
# Open http://localhost:5000
```

> ✅ If no API key is set, the app still works using the built-in fallback analyzer.

## 📁 Project Structure

```
resume-analyzer/
├── backend/
│   ├── server.js              # Express entry point
│   ├── package.json
│   ├── .env                   # Your Gemini API key goes here (never commit this!)
│   ├── routes/
│   │   └── resume.js          # API endpoints
│   └── utils/
│       ├── analyzer.js        # Gemini AI analysis engine
│       └── db.js              # SQLite database layer
├── frontend/
│   └── index.html             # Full SPA
├── .env.example               # Template for .env
├── .gitignore
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Upload & analyze resume with Gemini AI |
| GET | `/api/analyses` | List all past analyses |
| GET | `/api/analyses/:id` | Get specific analysis |
| DELETE | `/api/analyses/:id` | Delete analysis |
| GET | `/api/health` | Health check |

## 📄 License
MIT


