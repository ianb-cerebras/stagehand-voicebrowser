import logging
import os
import time
from datetime import datetime
from faster_whisper import WhisperModel
import pyaudio
import wave
import threading
import queue
import numpy as np
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_stt")

class LocalSTTAgent:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        """
        Initialize the local speech-to-text agent with push-to-talk
        
        Args:
            model_size: Whisper model size ("tiny", "base", "small", "medium", "large-v3")
            device: "cpu" or "cuda" (if you have a GPU)
            compute_type: "int8", "float16", etc.
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        
        # Audio recording parameters
        self.chunk = 1024
        self.format = pyaudio.paInt16
        self.channels = 1
        self.rate = 16000
        self.recording = False
        self.audio_queue = queue.Queue()
        
        # Push-to-talk state
        self.is_recording = False
        self.audio_buffer = []
        
        # Initialize Whisper model
        logger.info(f"Loading Whisper model: {model_size} on {device}")
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("Whisper model loaded successfully")
        
        # Initialize PyAudio
        self.audio = pyaudio.PyAudio()
        
        # Create transcripts directory
        self.transcripts_dir = "transcripts"
        os.makedirs(self.transcripts_dir, exist_ok=True)
        
        # Create a timestamped transcript file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.transcript_file = os.path.join(self.transcripts_dir, f"transcript_{timestamp}.txt")
        
        # Write header to transcript file
        with open(self.transcript_file, "w") as f:
            f.write(f"Local Faster-Whisper Transcription Session (Push-to-Talk)\n")
            f.write(f"Model: {model_size}, Device: {device}, Compute: {compute_type}\n")
            f.write(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Press Enter to start/stop recording\n")
            f.write("-" * 50 + "\n\n")

    def audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio recording"""
        if self.recording and self.is_recording:
            self.audio_queue.put(in_data)
            self.audio_buffer.append(in_data)
        return (in_data, pyaudio.paContinue)

    def start_recording(self):
        """Start recording audio from microphone"""
        logger.info("Starting audio recording...")
        self.recording = True
        
        # Open audio stream
        self.stream = self.audio.open(
            format=self.format,
            channels=self.channels,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.chunk,
            stream_callback=self.audio_callback
        )
        
        self.stream.start_stream()

    def stop_recording(self):
        """Stop recording audio"""
        logger.info("Stopping audio recording...")
        self.recording = False
        
        if hasattr(self, 'stream'):
            self.stream.stop_stream()
            self.stream.close()

    def toggle_recording(self):
        """Toggle recording on/off"""
        if not self.is_recording:
            # Start recording
            self.is_recording = True
            self.audio_buffer = []  # Clear previous buffer
            print("🎤 Recording... (press Enter to stop)", end='', flush=True)
        else:
            # Stop recording
            self.is_recording = False
            print()  # New line after recording indicator
            
            # Process the recorded audio
            if self.audio_buffer:
                self.process_recorded_audio()

    def process_recorded_audio(self):
        """Process the recorded audio buffer"""
        if not self.audio_buffer:
            return
            
        # Combine all audio chunks
        audio_data = b''.join(self.audio_buffer)
        
        if len(audio_data) > 0:
            # Save audio chunk
            temp_file = self.save_audio_chunk(audio_data)
            
            # Transcribe
            transcript = self.transcribe_audio(temp_file)
            
            if transcript:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] -> {transcript}")
                
                # Save to file
                self.save_transcript(transcript)
                
                # Output in format expected by Node.js (to stdout)
                print(f"[{timestamp}] -> {transcript}", flush=True)
            else:
                print("No speech detected")
            
            # Clean up temp file
            os.remove(temp_file)
        else:
            print("No audio recorded")

    def save_audio_chunk(self, audio_data, filename="temp_audio.wav"):
        """Save audio data to a WAV file"""
        with wave.open(filename, 'wb') as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(self.audio.get_sample_size(self.format))
            wf.setframerate(self.rate)
            wf.writeframes(audio_data)
        return filename

    def transcribe_audio(self, audio_file):
        """Transcribe audio file using faster-whisper"""
        try:
            logger.info(f"Transcribing audio file: {audio_file}")
            segments, info = self.model.transcribe(
                audio_file,
                beam_size=5,
                language="en",
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # Collect all segments
            transcript = ""
            for segment in segments:
                transcript += segment.text + " "
            
            transcript = transcript.strip()
            
            if info.language:
                logger.info(f"Detected language: {info.language} (probability: {info.language_probability:.2f})")
            
            return transcript
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            return ""

    def save_transcript(self, transcript):
        """Save transcript to file"""
        if transcript:
            timestamp = datetime.now().strftime("%H:%M:%S")
            try:
                with open(self.transcript_file, "a", encoding="utf-8") as f:
                    f.write(f"[{timestamp}] {transcript}\n")
                logger.info(f"Transcript saved to: {self.transcript_file}")
            except Exception as e:
                logger.error(f"Error saving transcript: {e}")

    def run_push_to_talk(self):
        """Run continuous transcription with short chunks"""
        logger.info("Starting continuous transcription (press Ctrl+C to stop)")
        logger.info("Recording in 3-second chunks and transcribing automatically")
        print("\n🎤 Continuous Recording Mode")
        print("Recording in 3-second chunks...")
        print("Press Ctrl+C to exit\n")
        
        try:
            # Start recording stream
            self.start_recording()
            
            # Record in continuous chunks
            while True:
                # Record for 3 seconds
                self.audio_buffer = []
                self.is_recording = True
                time.sleep(3)
                self.is_recording = False
                
                # Process the recorded audio
                if self.audio_buffer:
                    self.process_recorded_audio()
                
                # Small delay between chunks
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            logger.info("Stopping transcription...")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        if hasattr(self, 'stream'):
            self.stream.close()
        self.audio.terminate()
        logger.info("Cleanup completed")

def main():
    """Main function to run the local STT agent"""
    print("🎤 Local Faster-Whisper Speech-to-Text Agent (Push-to-Talk)")
    print("=" * 60)
    
    # You can customize these parameters
    model_size = "base"  # Options: "tiny", "base", "small", "medium", "large-v3"
    device = "cpu"       # Use "cuda" if you have a GPU
    compute_type = "int8"  # Options: "int8", "float16", etc.
    
    print(f"Model: {model_size}")
    print(f"Device: {device}")
    print(f"Compute Type: {compute_type}")
    print()
    
    # Create and run the agent
    agent = LocalSTTAgent(model_size=model_size, device=device, compute_type=compute_type)
    agent.run_push_to_talk()

if __name__ == "__main__":
    main()