// @ts-nocheck
import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import dotenv from "dotenv";
import fs from 'fs';
import { OpenAI } from 'openai';

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
                silence: 2,
                thresholdStart: 0.5,
                thresholdStop: 0.5,
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
 * Use OpenAI's Whisper API to transcribe an audio file to text.
 * @param audioFilePath - Path to the audio file to transcribe.
 * @returns The transcribed text.
 */
async function transcribeAudio(audioFilePath: string): Promise<string> {
    try {
        const client = new OpenAI();
        const audioFile = fs.createReadStream(audioFilePath);
        
        console.log(chalk.yellow("Transcribing audio..."));
        const transcription = await client.audio.transcriptions.create({
            model: "whisper-1",
            file: audioFile,
            response_format: "text"
        });

        console.log(chalk.green("Transcribed text:"), transcription);
        return transcription;
    } catch (error) {
        console.error(chalk.red("Error transcribing audio:"), error);
        throw error;
    }
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
  console.log(chalk.yellow("🚀 Voice input mode started..."));
  console.log(chalk.gray("Speak your instructions; Stagehand will execute them.\n"));

  await page.goto("https://www.google.com");

  let isRunning = true;

  // Main voice command loop
  while (isRunning) {
    try {
      console.log(chalk.blue("🎤 Press Enter to start recording (or type 'exit' to quit)..."));
      
      // Wait for user input
      const userInput = await new Promise<string>((resolve) => {
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim());
        });
      });

      if (userInput.toLowerCase() === 'exit') {
        console.log(chalk.green("👋 Goodbye!"));
        isRunning = false;
        break;
      }

      // Handle voice command
      await handleVoiceCommand(page);
      
      console.log(chalk.gray("\n--- Ready for next command ---\n"));
      
    } catch (error) {
      console.error(chalk.red("Error in main loop:"), error);
    }
  }
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