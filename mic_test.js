import mic from 'mic';
import fs from 'fs';

console.log("🎤 Starting microphone test...");

// Create microphone instance
const microphone = mic({
    rate: '16000',
    channels: '1',
    debug: true,
    exitOnSilence: 6
});

// Get the microphone input stream
const micInputStream = microphone.getAudioStream();

// Create a write stream for testing
const outputFileStream = fs.createWriteStream('test.raw');

// Handle data
micInputStream.on('data', (data) => {
    console.log(`Received chunk of ${data.length} bytes`);
    outputFileStream.write(data);
});

// Handle errors
micInputStream.on('error', (err) => {
    console.error("Error in Input Stream: " + err);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log("\n🛑 Stopping microphone test...");
    microphone.stop();
    outputFileStream.end();
    process.exit();
});

console.log("🎙️  Recording... (speak into your microphone)");
console.log("📊 You should see 'Received chunk' messages if mic is working");
console.log("❌ Press Ctrl+C to stop");

// Start recording
microphone.start(); 