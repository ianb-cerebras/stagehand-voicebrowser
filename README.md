# Cerebras + Stagehand + Cartesia Voice Browser 🚀🗣️

Voice-controlled, AI-powered web automation built with **C**, **Playwright**, and **Cartesia Ink Whisper** streaming speech-to-text, with direct command execution for natural browser control.

---

## ✨ Key Features

1. **Natural-language browser control** – Say commands like "*Click the sign-in button*" and Stagehand executes them.
2. **Continuous Voice Streaming** – Speak naturally; no button presses required.
3. **Real-time STT (Cartesia)** – Fast, accurate transcription via Cartesia's streaming ink-whisper model.
4. **Direct Command Execution** – Scroll commands are handled instantly, other commands go directly to Stagehand.
5. **Smooth Scrolling** – Built-in smooth scroll animations for better user experience.
6. **Cross-platform** – macOS / Linux (requires FFmpeg).e


---

## 🔧 Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | Stagehand & Playwright |
| FFmpeg  | any  | Audio device capture |

(Cartesia handles transcription in the cloud – no Python or local models required.)

---

## 🏗️  Setup

```bash
# 1. Clone & install JS deps
npm install

# 2. (Optional) Install FFmpeg if missing – macOS: brew install ffmpeg
```

Create a `.env`:

```bash
# Cartesia streaming speech-to-text
CARTESIA_API_KEY=your_cartesia_key

# Cerebras - powers the system
CEREBRAS_API_KEY=your_cerebras_key
```

---

## ▶️  Running

```bash
npm start
```

1. A headless browser launches and navigates to Google.
2. Terminal prints: `🎤 Cartesia streaming STT connected. Speak freely (Ctrl+C to exit)`
3. Speak commands in natural language - streaming transcription happens automatically.
4. Watch the command run or scroll.

---

## 🎙️  Command Cheatsheet

| Voice phrase | Result |
|--------------|--------|
| “scroll down” | page scrolls 60vh down with smooth animation |
| “scroll up” | page scrolls 30vh up with smooth animation |
| anything else | forwarded to Stagehand `page.act` |
| “exit / quit / stop” | shuts everything down |

---

## ⚙️  Environment Variables

* `CARTESIA_API_KEY` – **required** for streaming speech-to-text transcription.
* `CEREBRAS_API_KEY` – **required** for powering the whole system 
