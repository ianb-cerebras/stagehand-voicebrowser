import asyncio
import json
import logging
import os
import sys
from dotenv import load_dotenv
import assemblyai as aai
import pyaudio

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcriber")

def handle_transcript(transcript):
    """Handle incoming transcript data"""
    if transcript.text and transcript.is_final:
        logger.info(f"Final transcript: {transcript.text}")
        
        # Output JSON for TypeScript to consume
        transcript_data = {
            "type": "transcript",
            "text": transcript.text,
            "timestamp": getattr(transcript, 'created', None)
        }
        print(json.dumps(transcript_data), flush=True)

async def transcribe_audio():
    """Simple AssemblyAI real-time transcription"""
    
    # Get API key
    api_key = os.getenv('ASSEMBLYAI_API_KEY')
    if not api_key:
        logger.error("ASSEMBLYAI_API_KEY not found in environment")
        sys.exit(1)
    
    # Configure AssemblyAI
    aai.settings.api_key = api_key
    
    # Try to use the new universal streaming model if supported
    try:
        transcriber = aai.RealtimeTranscriber(
            sample_rate=16000,
            on_data=handle_transcript,
            on_error=lambda error: logger.error(f"Error: {error}"),
            on_open=lambda: logger.info("Connection opened"),
            on_close=lambda: logger.info("Connection closed"),
            model="universal"  # Add this if supported by your SDK version
        )
    except TypeError:
        # Fallback for older SDKs
        transcriber = aai.RealtimeTranscriber(
            sample_rate=16000,
            on_data=handle_transcript,
            on_error=lambda error: logger.error(f"Error: {error}"),
            on_open=lambda: logger.info("Connection opened"),
            on_close=lambda: logger.info("Connection closed"),
        )
    
    # Start transcription
    logger.info("Starting real-time transcription...")
    logger.info("Speak into your microphone...")
    
    try:
        # Connect to the service
        transcriber.connect()
        
        # Set up audio input
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=1024
        )
        
        logger.info("Microphone ready. Start speaking...")
        
        # Stream audio data
        while True:
            try:
                data = stream.read(1024, exception_on_overflow=False)
                transcriber.stream(data)
                await asyncio.sleep(0.01)  # Small delay to prevent blocking
            except KeyboardInterrupt:
                break
                
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        try:
            stream.stop_stream()
            stream.close()
            p.terminate()
            transcriber.close()
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(transcribe_audio()) 