# Stagehand Voice Browser 🚀🗣️

Voice-controlled, AI-powered web automation built with **Stagehand**, **Playwright**, and local **Whisper (faster-whisper)** speech-to-text, with Cerebras LLM calls for lightweight intent classification.

---

## ✨ Key Features

1. **Natural-language browser control** – Say commands like “*Click the sign-in button*” and Stagehand executes them.
2. **Push-to-Talk** – Hold the **`m`** key to record audio; release to send.
3. **Local STT** – Runs Whisper on-device (no external STT bills, works offline).
4. **Scroll intent classifier** – Cerebras Llama-4 model responds with `1 | 2 | 3` so we can intercept “scroll up / down” instantly.
5. **Structured LLM Output** – Uses Cerebras *structured output* (`response_format: json_schema`) for guaranteed JSON replies.
6. **Cross-platform** – macOS / Linux (requires FFmpeg and Python 3.11).

---

## 🖥️  Architecture

```mermaid
flowchart TD
  A[Mic input] -->|PCM 16kHz| B(Local STT agent – Python)
  B -->|Transcript line| C[Node.js index.ts]
  C -->|Cerebras classify 1‒3| D{1 / 2 / 3}
  D -- 2 --> E[Playwright scroll up]
  D -- 3 --> F[Playwright scroll down]
  D -- 1 --> G[Stagehand page.act()]
  G --> H[Browser]
  E & F --> H
```

---

## 🔧 Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | Stagehand & Playwright |
| Python  | 3.11 | faster-whisper agent |
| FFmpeg  | any  | Audio device capture |

> macOS users: `brew install ffmpeg`.

---

## 🏗️  Setup

```bash
# 1. Clone & install JS deps
npm install

# 2. Python venv + deps
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env`:

```bash
CEREBRAS_API_KEY=your_key_here  # required
```

---

## ▶️  Running

```bash
npm start
```

1. A headless browser launches and navigates to Google.
2. Terminal prints:
   ```
   🎤 Press 'm' to toggle microphone recording
   ```
3. **Hold `m`**, speak, **release**.
4. Watch the command run or scroll.

---

## 🎙️  Command Cheatsheet

| Voice phrase | Result |
|--------------|--------|
| “scroll down” | page scrolls 50 vh down |
| “scroll up” | page scrolls 50 vh up |
| anything else | forwarded to Stagehand `page.act` |
| “exit / quit / stop” | shuts everything down |

---

## ⚙️  Environment Variables

* `CEREBRAS_API_KEY` – **required** for the classifier.
* `OPENAI_API_KEY` – optional, only used if you proxy Stagehand via OpenAI.

---

## 🗑️  Cleaning Up

Generated artefacts:

* `transcripts/` – per-session text logs.
* Temporary `command.mp3` is auto-deleted.

Delete with:
```bash
rm -rf transcripts/*
```

---

## 🐞  Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ffmpeg` not found | Install FFmpeg & ensure it’s in `$PATH`. |
| Python agent exits `code 0` immediately | Check that `venv/bin/python` exists; else it falls back to `python3`. |
| No scroll happens | Verify `[Cerebras classification] 2/3`; if `1`, model mis-classifies – speak clearly or tweak prompt. |
| Mic permission denied | macOS → *System Settings → Privacy & Security → Microphone → enable Terminal/iTerm.* |

---

## 🤝  Contributing
Pull requests welcome! Please run:
```bash
npm run lint && npm test
```
---

## 📄  License
MIT © 2025 Ian Baime 