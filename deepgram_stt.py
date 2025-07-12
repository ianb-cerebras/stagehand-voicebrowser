import json
import logging
import os
import threading
import time
from dotenv import load_dotenv
from deepgram import (
    DeepgramClient,
    LiveTranscriptionEvents,
    LiveOptions,
)
import pyaudio

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcriber")

def on_message(self, result, **kwargs):
    """Handle incoming transcript messages from Deepgram"""
    sentence = result.channel.alternatives[0].transcript
    
    if len(sentence) == 0:
        return
    
    # Output JSON for TypeScript to consume
    transcript_data = {
        "type": "transcript",
        "text": sentence,
        "is_final": result.is_final,
        "speech_final": result.speech_final,
        "confidence": result.channel.alternatives[0].confidence,
        "duration": result.duration,
        "start": result.start
    }
    print(json.dumps(transcript_data), flush=True)
    
    # Log to console for debugging
    if result.is_final:
        logger.info(f"Final transcript: {sentence}")
    else:
        logger.info(f"Interim transcript: {sentence}")

def on_error(self, error, **kwargs):
    """Handle errors from Deepgram"""
    logger.error(f"Deepgram error: {error}")

def on_utterance_end(self, utterance_end, **kwargs):
    """Handle utterance end events"""
    logger.info(f"Utterance ended: {utterance_end}")

def on_speech_started(self, speech_started, **kwargs):
    """Handle speech started events"""
    logger.info(f"Speech started: {speech_started}")

def on_speech_ended(self, speech_ended, **kwargs):
    """Handle speech ended events"""
    logger.info(f"Speech ended: {speech_ended}")

def main():
    try:
        # Get API key from environment
        api_key = os.getenv('DEEPGRAM_API_KEY')
        if not api_key:
            logger.error("DEEPGRAM_API_KEY not found in environment")
            return
        
        # Initialize Deepgram client
        deepgram = DeepgramClient(api_key)
        
        # Create websocket connection
        dg_connection = deepgram.listen.websocket.v("1")
        
        # Set up event handlers
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
        dg_connection.on(LiveTranscriptionEvents.SpeechStarted, on_speech_started)
        dg_connection.on(LiveTranscriptionEvents.SpeechEnded, on_speech_ended)
        
        # Connect to Deepgram
        options = LiveOptions(
            model="nova-3",
            smart_format=True,
            punctuate=True,
            interim_results=True
        )
        
        logger.info("Starting Deepgram transcription...")
        logger.info("Speak into your microphone...")
        
        if dg_connection.start(options) is False:
            logger.error("Failed to start Deepgram connection")
            return
        
        # Set up microphone input
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=1024
        )
        
        logger.info("Microphone ready. Start speaking...")
        
        # Thread control
        lock_exit = threading.Lock()
        exit_flag = False
        
        def audio_thread():
            """Thread to read audio from microphone and send to Deepgram"""
            nonlocal exit_flag
            while True:
                lock_exit.acquire()
                if exit_flag:
                    break
                lock_exit.release()
                
                try:
                    data = stream.read(1024, exception_on_overflow=False)
                    dg_connection.send(data)
                except Exception as e:
                    logger.error(f"Audio thread error: {e}")
                    break
        
        # Start audio thread
        audio_thread_handle = threading.Thread(target=audio_thread)
        audio_thread_handle.start()
        
        # Wait for user to stop
        try:
            input("\nPress Enter to stop recording...\n")
        except KeyboardInterrupt:
            pass
        
        # Signal threads to stop
        lock_exit.acquire()
        exit_flag = True
        lock_exit.release()
        
        # Wait for audio thread to finish
        audio_thread_handle.join()
        
        # Clean up
        stream.stop_stream()
        stream.close()
        p.terminate()
        dg_connection.finish()
        
        logger.info("Transcription finished")
        
    except Exception as e:
        logger.error(f"Could not open socket: {e}")
        return

if __name__ == "__main__":
    main() 