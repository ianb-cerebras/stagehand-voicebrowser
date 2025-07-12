import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import mic from "mic";
import dotenv from "dotenv";
dotenv.config();

const live = async () => {
  console.log("Starting Deepgram client...");
  
  if (!process.env.DEEPGRAM_API_KEY) {
    console.error("❌ Error: DEEPGRAM_API_KEY not found in .env file");
    process.exit(1);
  }

  // STEP 1: Test microphone first
  console.log("Testing microphone...");
  const micTest = new Promise((resolve, reject) => {
    const testMic = mic({
      rate: '16000',
      channels: '1',
      debug: true,
    });

    const testStream = testMic.getAudioStream();
    let dataReceived = false;

    testStream.once('data', () => {
      dataReceived = true;
      console.log("✅ Microphone test successful!");
      testMic.stop();
      resolve();
    });

    testStream.once('error', (err) => {
      reject(new Error(`Microphone test failed: ${err}`));
    });

    setTimeout(() => {
      testMic.stop();
      if (!dataReceived) {
        reject(new Error("Microphone test timeout - no audio data received"));
      }
    }, 3000);

    testMic.start();
  });

  try {
    await micTest;
  } catch (err) {
    console.error("❌ Microphone Error:", err);
    process.exit(1);
  }

  // STEP 2: Create a Deepgram client using the API key
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  // STEP 3: Create a live transcription connection with VAD
  console.log("Connecting to Deepgram...");
  const connection = deepgram.listen.live({
    model: "nova-3",
    language: "en-US",
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true
  });

  // STEP 4: Set up microphone
  const microphone = mic({
    rate: '16000',
    channels: '1',
    debug: true,
    exitOnSilence: 10
  });

  const micStream = microphone.getAudioStream();
  let lastSpeechTime = Date.now();
  let isSpeaking = false;
  const SILENCE_TIMEOUT = 5000;

  // STEP 5: Listen for events from the live transcription connection
  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log("🎤 Connected to Deepgram, listening...");
    console.log("Speak naturally, will auto-detect when you're done\n");

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log("Connection closed.");
      microphone.stop();
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript.trim()) {
        lastSpeechTime = Date.now();
        if (!isSpeaking) {
          isSpeaking = true;
          console.log("🗣️ Speech detected!");
        }
        
        // Show both interim and final results with different formatting
        if (data.is_interim) {
          process.stdout.write(`\r💭 ${transcript}`);
        } else {
          console.log(`\n✅ ${transcript}`);
        }
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error("❌ Deepgram Error:", err);
      microphone.stop();
    });

    connection.on(LiveTranscriptionEvents.VADEvent, (event) => {
      if (event.type === 'start') {
        isSpeaking = true;
        lastSpeechTime = Date.now();
      } else if (event.type === 'end') {
        isSpeaking = false;
      }
    });

    // STEP 6: Send microphone data to Deepgram
    micStream.on('data', (data) => {
      try {
        connection.send(data);
      } catch (err) {
        console.error("❌ Error sending audio data:", err);
      }

      if (isSpeaking && Date.now() - lastSpeechTime > SILENCE_TIMEOUT) {
        console.log("\n👋 No speech detected for a while, stopping...");
        microphone.stop();
        connection.close();
        process.exit(0);
      }
    });

    micStream.on('error', (err) => {
      console.error("❌ Microphone Error:", err);
      connection.close();
    });

    // Start recording
    console.log("Starting microphone...");
    microphone.start();
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log("\n👋 Stopping...");
    microphone.stop();
    connection.close();
    process.exit();
  });
};

console.log("Starting application...");
live().catch(err => {
  console.error("❌ Application Error:", err);
  process.exit(1);
});