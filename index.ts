// @ts-nocheck
import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import dotenv from "dotenv";
import fs from 'fs';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';
import path from "path";
import WebSocket from "ws";

dotenv.config();

// Silence Stagehand's OPENAI_API_KEY warning by providing a dummy key if missing
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "dummy_key"; // prevents init error log
}

const logger = console; // Simple console logger for TypeScript

// ------------------------------------------------------------
// Cartesia STT via OpenAI-compatible API
// ------------------------------------------------------------

/**
 * Transcribe an audio file using Cartesia Ink Whisper model.
 * Returns the transcribed text.
 */
async function transcribeWithCartesia(filePath: string): Promise<string> {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    console.warn("CARTESIA_API_KEY not set – returning empty transcript");
    return "";
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.cartesia.ai",
    } as any);

    const response: any = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath) as any,
      model: "ink-whisper",
      language: "en",
      timestamp_granularities: ["word"],
    } as any);

    return response.text || "";
  } catch (err) {
    console.error("Cartesia API error:", err);
    return "";
  }
}

// ------------------------------------------------------------
// Voice Transcription using Node.js Audio Recording + OpenAI Whisper
// ------------------------------------------------------------

/**
 * Dynamically import and return the AudioRecorder constructor
 */
async function loadAudioRecorder() {
    const { default: AudioRecorder } = await import('node-audiorecorder');
    return AudioRecorder;
}

/**
 * Record audio from the microphone and save it as a file (default mp3).
 * @param filePath - Path to save the audio file.
 * @param duration - Duration of the recording in seconds.
 */
async function recordAudio(filePath: string, duration = 20): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            const AudioRecorder = await loadAudioRecorder();

            const options = {
                program: 'rec',
                device: null,
                bits: 16,
                channels: 1,
                encoding: 'signed-integer',
                rate: 16000,
                type: 'mp3',
                silence: .5,
                thresholdStart: 0.5,
                thresholdStop: 0.3,
                keepSilence: true
            };

            const audioRecorder = new AudioRecorder(options, console);
            const writeStream = fs.createWriteStream(filePath);

            console.log(chalk.yellow("Recording audio..."));
            audioRecorder.start().stream().pipe(writeStream);

            audioRecorder.stream().on('error', (err: Error) => {
                console.error(chalk.red("Recording error:"), err);
                reject(err);
            });

            audioRecorder.stream().on('end', () => {
                console.log(chalk.green("Recording complete."));
                resolve();
            });

            setTimeout(() => {
                audioRecorder.stop();
            }, duration * 1000);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Execute a given instruction by using Stagehand's AI capabilities.
 * @param commandText - The text instruction (transcribed).
 * @param page - The Stagehand (Playwright) page object.
 */
async function executeAction(commandText: string, page: Page) {
    try {
        console.log(chalk.green("Executing command:"), commandText);
        const actResult = await page.act({
            action: commandText,
        });
        console.log(
            chalk.green("Action complete using Stagehand."),
            "\n",
            chalk.gray(actResult)
        );
    } catch (error) {
        console.error(chalk.red("Error executing action:"), error);
    }
}

/**
 * Combine all steps of voice command handling:
 * 1. Record
 * 2. Transcribe
 * 3. Execute
 * 4. Cleanup
 */
async function handleVoiceCommand(page: Page, audioFilePath = "command.mp3") {
    try {
        // 1. Record Audio
        await recordAudio(audioFilePath);

        // 2. Transcribe Audio
        const transcribedText = await transcribeAudio(audioFilePath);
        console.log(transcribedText)

        

        // 3. Execute Command
        await executeAction(transcribedText, page);

        // 4. Cleanup
        fs.unlinkSync(audioFilePath);
    } catch (error) {
        console.error(chalk.red("Error handling voice command:"), error);
        if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
    }
}

/**
 * Classify the user command using Cerebras LLM.
 * Returns "1" (no scrolling), "2" (scroll up), or "3" (scroll down).
 */
async function classifyCommand(transcript: string): Promise<'1' | '2' | '3'> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    console.warn('CEREBRAS_API_KEY not set – defaulting to 1');
    return '1';
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content:
              'You are a command classifier for a voice-controlled browser. Respond with JSON that matches the provided schema.',
          },
          { role: 'user', content: transcript },
        ],
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'scroll_classifier',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                code: { type: 'string', enum: ['1', '2', '3'] },
              },
              required: ['code'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const data = await response.json();
    console.log(chalk.gray("[Cerebras raw]"), JSON.stringify(data, null, 2));
    let classification: '1' | '2' | '3' = '1';
    try {
      let contentStr: string = data?.choices?.[0]?.message?.content || '';
      // Strip markdown code fences if present
      const fenceMatch = contentStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) {
        contentStr = fenceMatch[1];
      }

      const trimmed = contentStr.trim();

      // Direct single-digit reply
      if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
        classification = trimmed as '1' | '2' | '3';
        console.log('[Cerebras classification]', classification);
        return classification;
      }

      // Attempt JSON parse only if looks like JSON
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (parsed && (parsed.code === '1' || parsed.code === '2' || parsed.code === '3')) {
          classification = parsed.code;
        }
      } else {
        // Fallback: try to extract a 1/2/3 digit anywhere in the response
        const digitMatch = trimmed.match(/[123]/);
        if (digitMatch) {
          classification = digitMatch[0] as '1' | '2' | '3';
        } else {
          console.warn('[Cerebras classification] unexpected format:', trimmed.slice(0,50));
        }
      }
    } catch (e) {
      console.warn('[Cerebras classification] failed to parse JSON', e);
    }
    console.log('[Cerebras classification]', classification);
    return classification;
  } catch (err) {
    console.error('Cerebras API error:', err);
    return '1';
  }
}

/**
 * Placeholder for the new Node-only push-to-talk loop that will use Cartesia.
 * For now it just logs a message so the application can run without Python.
 */
function startStreamingVoiceLoop(page: Page, stagehand: Stagehand): Promise<void> {
  return new Promise(async (resolve) => {
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      throw new Error("CARTESIA_API_KEY not set");
    }

    const qs = new URLSearchParams({
      model: "ink-whisper",
      encoding: "pcm_s16le",
      sample_rate: "16000",
    }).toString();

    const ws = new WebSocket(`wss://api.cartesia.ai/stt/websocket?${qs}`, {
      headers: {
        "X-API-Key": apiKey,
        "Cartesia-Version": "2025-04-16",
      },
    });

    ws.on("open", async () => {
      console.log(chalk.yellow("🎤 Cartesia streaming STT connected. Speak freely (Ctrl+C to exit)"));

      const AudioRecorder = await loadAudioRecorder();
      const recorderOptions = {
        program: "rec",
        device: null,
        bits: 16,
        channels: 1,
        encoding: "signed-integer",
        rate: 16000,
        type: "raw", // send raw PCM without headers
        silence: 0,
      };

      const recorder = new AudioRecorder(recorderOptions, console);
      const micStream = recorder.start().stream();

      micStream.on("data", (chunk: Buffer) => {
        ws.send(chunk, { binary: true });
      });

      // Handle Ctrl+C for graceful shutdown
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", async (key) => {
        if (key === "\u0003") {
          console.log(chalk.green("👋 Shutting down…"));
          recorder.stop();
          ws.send("finalize");
          ws.send("done");
          ws.close();
          await stagehand.close();
          resolve();
          process.exit(0);
        }
      });
    });

    async function handleTranscript(text: string) {
      const trimmed = text.trim();
      if (trimmed.length < 4) return;     // ignore empty or 1-3 char fragments

      const lower = trimmed.toLowerCase();
      
      // Handle explicit scroll commands first
      if (lower.includes('scroll down')) {
        console.log(chalk.yellow('Scrolling down 30vh…'));
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.3));
        return;
      }
      if (lower.includes('scroll up')) {
        console.log(chalk.yellow('Scrolling up 30vh…'));
        await page.evaluate(() => window.scrollBy(0, -window.innerHeight * 0.3));
        return;
      }
      
      // Handle exit commands
      if (["exit", "quit", "stop"].includes(lower)) {
        console.log(chalk.green("👋 Voice exit detected – shutting down."));
        ws.send("finalize");
        ws.send("done");
        ws.close();
        await stagehand.close();
        resolve();
        process.exit(0);
      }
      
      // For other commands, skip classification and execute directly with Stagehand
      console.log(chalk.cyan("🎯 Executing Stagehand action:"), trimmed);
      await executeAction(trimmed, page);
    }

    ws.on("message", async (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        console.log(chalk.gray("Non-JSON message:"), data.toString());
        return; // ignore non-JSON messages
      }

      if (msg.type === "transcript" && msg.is_final) {
        // Extract text from words array or use text field
        const text = msg.words?.map((word: any) => word.word).join('') || msg.text || '';
        if (text.trim().length >= 4) {
          console.log(chalk.green("🎯 Final transcript:"), text);
          await handleTranscript(text);
        }
      }
    });

    ws.on("close", () => {
      console.log(chalk.gray("Cartesia WebSocket closed"));
    });

    ws.on("error", (err) => {
      console.error(chalk.red("WebSocket error:"), err);
    });
  });
}

async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  console.log(chalk.cyan("🎭 Stagehand Voice Browser"));
  console.log(chalk.yellow("🚀 Say commands; they'll be executed automatically.\n"));

  await page.goto("https://www.google.com");

  await startStreamingVoiceLoop(page, stagehand);
}

/**
 * This is the main function that runs when you npm run start
 */
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  console.log(
    `\nDemo Complete",
    )}\n`,
  );
}

run();