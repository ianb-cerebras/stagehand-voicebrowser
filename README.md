# Stagehand Voice Browser 🚀🗣️

Voice-controlled, AI-powered web automation built with **Stagehand**, **Playwright**, and **Cartesia Ink Whisper** cloud speech-to-text, with Cerebras LLM calls for lightweight intent classification.

---

## ✨ Key Features

1. **Natural-language browser control** – Say commands like “*Click the sign-in button*” and Stagehand executes them.
2. **Push-to-Talk** – Hold the **`m`** key to record audio; release to send.
3. **Cloud STT (Cartesia)** – Fast, accurate transcription via Cartesia’s ink-whisper model.
4. **Scroll intent classifier** – Cerebras Llama-4 model responds with `1 | 2 | 3` so we can intercept “scroll up / down” instantly.
5. **Structured LLM Output** – Uses Cerebras *structured output* (`response_format: json_schema`) for guaranteed JSON replies.
6. **Cross-platform** – macOS / Linux (requires FFmpeg and Python 3.11).


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
# Cerebras Llama-4 scroll intent classifier
CEREBRAS_API_KEY=your_cerebras_key

# Cartesia Ink Whisper transcription
CARTESIA_API_KEY=your_cartesia_key
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

* `CEREBRAS_API_KEY` – **required** for the scroll intent classifier.
* `CARTESIA_API_KEY` – **required** for cloud transcription.
