# LocalMiniDrama

> A locally-running AI short drama & comic generator — download and use, no VPN required, fully open source.

![version](https://img.shields.io/badge/version-1.1.4-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![stack](https://img.shields.io/badge/stack-Vue3%20%2B%20Node.js%20%2B%20Electron-informational)

**[中文](README.md) | English | [Author's Story](README.story.md)**

There are plenty of AI short-drama tools out there, but almost none that truly run **offline locally, work out of the box, and keep your assets private**. This project is built entirely in JavaScript from scratch. Connect your own AI API (or any cloud API), launch the app, and start generating your own AI short drama.

---

## 📸 Screenshots

<img src="项目截图/武侠.png" alt="Project list" width="600" />
<img src="项目截图/武侠分镜.png" alt="Storyboard editor" width="600" />
<img src="项目截图/3.png" alt="Image generation" width="400" />
<img src="项目截图/4.png" alt="Preview" width="400" />
<img src="项目截图/5.png" alt="Output" width="400" />

---

## ✨ Features

### Full Creation Workflow

| Step | Feature | Description |
|:----:|---------|-------------|
| 1 | Story Generation | Enter a synopsis + style; AI generates the full script |
| 2 | Script Editing | Edit script text and manage episodes |
| 3 | Character Generation | AI generates character list; generate portrait for each character |
| 4 | Scene Generation | Extract scenes from script; generate scene images |
| 5 | Prop Generation | Extract / manually add props; generate prop images |
| 6 | Storyboard Generation | Auto-generate storyboard from the current episode |
| 7 | Storyboard Image / Video | Generate image and video clip for each shot |
| 8 | Video Synthesis | Merge all shot videos into a complete episode |

### One-Click Pipeline

- **Generate All**: Characters → Scenes → Storyboard → Images → Videos → Synthesize — fully automated
- **Fill & Generate**: Intelligently skips already-generated content; only fills in what's missing
- **Auto Retry**: Each step retries up to 3 times (handles 429 rate limits etc.); errors are logged and the pipeline continues
- **Live Progress**: Shows current step and full error log in real time

### Drama & Resource Management

- **Drama Detail Page**: Manage drama info (title / style / aspect ratio), per-drama character / scene / prop library, and episode list (add / delete / script preview)
- **Material Library**: Global library for characters / scenes / props reusable across dramas; strictly isolated from per-drama libraries
- **Import from Material Library**: One-click import from the global library into the current drama's resource library

### Storyboard Editing

- **Image Prompt**: View and edit the image-generation prompt for each shot; regenerate after changes
- **Video Prompt**: Edit the full prompt text manually, or expand the composition panel to edit individual fields (scene / duration / character action / mood / camera movement / shot type etc.) — prompt is auto-reassembled on save
- **Image Management**: AI generation, manual upload, drag-and-drop upload; replace at any time

### AI Configuration

- Three independent model slots: image generation, video generation, text generation
- Compatible with Alibaba Cloud DashScope, Volcengine, locally-deployed models, and more
- Visual configuration panel; changes take effect immediately; connection test supported

### UI / Theme

- **Dark mode** (default) and **Light mode** toggle, preference persisted across sessions
- Theme toggle button available on every page

---

## 🚀 Quick Start

### Option A — Download exe (recommended for end users)

Go to [Releases](../../releases) and download the latest installer (`LocalMiniDrama Setup x.x.x.exe`) or portable version (`LocalMiniDrama x.x.x.exe`). Double-click to run.

On first launch, a config file is created at:
```
%APPDATA%\LocalMiniDrama\backend\configs\config.yaml
```
Open **AI Config** inside the app, enter your API key, and you're ready to go.

### Option B — Development Mode

> Requires Node.js >= 18

**1. Start the backend**

```bash
cd backend-node
npm install
cp configs/config.example.yaml configs/config.yaml
# Edit config.yaml — fill in your AI model API endpoint and key
npm run migrate   # First run: initialise the database
npm start         # Runs on port 5679 by default
```

**2. Start the frontend**

```bash
cd frontweb
npm install
npm run dev       # Runs on port 3013; proxies to backend at 5679
```

Open `http://localhost:3013` in your browser.

**3. Build a Windows exe (optional)**

```bash
cd desktop
npm install
npm run dist      # Produces NSIS installer + portable exe

# Slow Electron download in China? Use the mirror:
npm run dist:cn
```

See [desktop/README.md](desktop/README.md) for details.

---

## 🏗 Architecture

```
LocalMiniDrama/
├── backend-node/          # Node.js backend (Express + SQLite)
│   ├── src/
│   │   ├── config/        # YAML config loader
│   │   ├── db/            # SQLite connection & migrations
│   │   ├── services/      # Business logic
│   │   └── routes/        # API routes
│   └── configs/           # config.yaml lives here
├── frontweb/              # Vue 3 frontend (Vite + Element Plus)
│   └── src/
│       ├── views/
│       │   ├── FilmList.vue      # Home: project list & material library
│       │   ├── DramaDetail.vue   # Drama: info / episodes / resource library
│       │   └── FilmCreate.vue    # Studio: script / characters / storyboard
│       ├── api/                  # Backend API wrappers
│       ├── composables/          # Shared logic (theme toggle, etc.)
│       ├── stores/               # Pinia state management
│       └── styles/               # Global styles & theme variables
├── desktop/               # Electron shell (builds the exe)
└── README.md
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + Vite + Element Plus + Pinia + Axios |
| Backend | Node.js + Express + SQLite (better-sqlite3) |
| Desktop | Electron 28 + electron-builder |
| Language | Plain JavaScript (no TypeScript) |

---

## 📋 Changelog

### v1.1.4 (current)

- **Drama Detail Page** — new dedicated page for managing drama settings, per-drama resource library, and episode list
- **Resource Library Scoping** — per-drama library and global material library are now strictly isolated; fixes the bug where resources from different dramas were visible to each other
- **Import from Material Library** — one-click import of global assets into the current drama's library
- **Episode Management** — add / delete episodes; script preview shows the first 20 characters
- **Image Replace Fix** — uploading a new image after AI generation now correctly replaces the old one (fixes `local_path` not being cleared)
- **Light / Dark Theme** — toggle between dark (default) and light mode; preference is saved; available on all three pages
- **Navigation Improvements** — "Back to Drama" button in the studio page; new projects land directly in the studio; clicking an episode navigates to the correct episode

### v1.1.x (previous)

- **One-click pipeline**: Generate All + Fill & Generate with smart skip of existing content
- **Auto retry**: Up to 3 retries per step to handle rate-limit (429) errors
- **Live progress panel**: Real-time step indicator and error log during pipeline runs
- **Video prompt editor**: Full-text edit + per-field composition panel (shot type, camera movement, etc.)
- **Image prompt editor**: View and edit the image prompt for each individual storyboard shot
- **Storyboard error display**: Generation errors shown on the shot card and persisted in the database
- **AI config improvements**: Connection test for DashScope, Volcengine, and other providers

---

## 🎯 Who Is This For

- Content creators who want to produce AI short dramas / comics quickly
- Privacy-conscious users who don't want to upload assets to the cloud
- Developers who like to customise and extend their generation pipeline
- Newcomers who want to explore the short-drama / AI video space without upfront costs

---

## 🔗 Similar Tools

| Tool | Notes |
|------|-------|
| **Kino 视界** | Active Chinese AI short-drama platform; cloud-based, closed source |
| **Filmaction AI** | AI-driven plot / storyboard / voice generation; SaaS / web, partly paid |
| **oiioii** | Open source, lightweight AI visual creation tool, flexible deployment |
| **ChatFire** | AI-driven dialogue-based short-drama creator; inspired this project's backend design |

This project focuses on **local offline use, a friendly UI, and easy customisation**. Feel free to open an Issue to recommend other great tools.

---

## 💬 About the Author

Just an ordinary game developer who got excited about the AI short-drama trend, couldn't decide what to do, and ended up building this open-source tool in JavaScript. Ship first, figure out the rest later.

Want the full story — the indecision, inspirations, and acknowledgements? 👉 [Author's Story (Chinese)](README.story.md)

---

## 📄 License

[MIT](LICENSE)
