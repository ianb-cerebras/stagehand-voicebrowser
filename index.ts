// @ts-nocheck
import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import dotenv from "dotenv";
import fs from 'fs';
import { OpenAI } from 'openai';
import { spawn } from "child_process";
import readline from "readline";
import path from "path";

dotenv.config();

const logger = console; // Simple console logger for TypeScript

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
 * Listen to stdout of the Python LiveKit→AssemblyAI transcriber and forward
 * each transcript line to Stagehand `page.act()`.
 */
async function startPythonVoiceLoop(page: Page, stagehand: Stagehand): Promise<void> {
  return new Promise((resolve) => {
    let pyExec = path.join(process.cwd(), "venv", "bin", "python");
    if (!fs.existsSync(pyExec)) {
      pyExec = "python3";
    }
    console.log(chalk.gray(`Starting transcriber using: ${pyExec}`));
    const child = spawn(pyExec, ["local_stt_agent.py"], {
      stdio: ["ignore", "pipe", "inherit"],
    });

    const rl = readline.createInterface({ input: child.stdout });

    rl.on("line", async (line) => {
      const match = line.match(/\[\d{2}:\d{2}:\d{2}\] -> (.+)/);
      if (!match) return;
      const transcribedMessage = match[1].trim();
      console.log(chalk.cyan(`🎙️  Voice command: ${transcribedMessage}`));
      // Save the transcript as a variable and log it
      let lastTranscript = transcribedMessage;
      console.log(chalk.magenta(`(Saved transcript variable): ${lastTranscript}`));
      if (["exit", "quit", "stop"].includes(transcribedMessage.toLowerCase())) {
        console.log(chalk.green("👋 Voice exit detected – shutting down."));
        rl.close();
        child.kill();
      } else {
        // Log the transcript variable before using it
        console.log(chalk.yellow(`[DEBUG] lastTranscript before Stagehand: ${lastTranscript}`));
        await executeAction(lastTranscript, page);
      }
    });

    child.on("exit", async (code) => {
      console.log(chalk.yellow(`Transcriber exited with code ${code}`));
      await stagehand.close();
      resolve();
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
  console.log(chalk.cyan("🎭 Stagehand Voice Browser (LiveKit)"));
  console.log(chalk.yellow("🚀 Say commands; they'll be executed automatically.\n"));

  await page.goto("https://www.google.com");

  await startPythonVoiceLoop(page, stagehand);
}

/**
 * This is the main function that runs when you do npm run start
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
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack",
    )}\n`,
  );
}

run();