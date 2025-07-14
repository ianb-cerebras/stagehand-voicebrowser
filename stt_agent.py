import logging
import os
from datetime import datetime

from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    MetricsCollectedEvent,
    RoomOutputOptions,
    StopResponse,
    WorkerOptions,
    cli,
    llm,
)

# Disable endpointing so transcripts finalize as soon as audio ends
from livekit.plugins import assemblyai

load_dotenv()

logger = logging.getLogger("transcriber")

class Transcriber(Agent):
    def __init__(self):
        super().__init__(
            instructions="not-needed",
            stt=assemblyai.STT(
                end_of_turn_confidence_threshold=1.0,  # Disable model-based turn detection
                max_turn_silence=0,  # No silence threshold - finalize immediately when audio ends
            ),
        )
        # Create transcripts directory if it doesn't exist
        self.transcripts_dir = "transcripts"
        os.makedirs(self.transcripts_dir, exist_ok=True)
        
        # Create a timestamped transcript file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.transcript_file = os.path.join(self.transcripts_dir, f"transcript_{timestamp}.txt")
        
        # Write header to transcript file
        with open(self.transcript_file, "w") as f:
            f.write(f"LiveKit AssemblyAI Transcription Session\n")
            f.write(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("-" * 50 + "\n\n")
        
        # Local variable to accumulate transcription
        self.current_transcript = ""

    async def on_transcript(self, transcript: llm.ChatMessage):
        """Handle streaming transcript updates"""
        # Accumulate the transcript text
        self.current_transcript = transcript.text_content
        logger.info(f"Streaming: {self.current_transcript}")

    async def on_user_turn_completed(self, chat_ctx: llm.ChatContext, new_message: llm.ChatMessage):
        """Handle final transcript when audio stream ends"""
        # Get the final transcript
        final_transcript = new_message.text_content
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Log to console for Stagehand to pick up
        logger.info(f"[{timestamp}] -> {final_transcript}")
        
        # Save to local file
        try:
            with open(self.transcript_file, "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {final_transcript}\n")
            logger.info(f"Transcript saved to: {self.transcript_file}")
        except Exception as e:
            logger.error(f"Error saving transcript: {e}")

        # Clear the current transcript for next turn
        self.current_transcript = ""

        # Needed to stop the agent's default conversational loop
        raise StopResponse()


async def entrypoint(ctx: JobContext):
    logger.info(f"starting transcriber (speech to text) example, room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession()

    await session.start(
        agent=Transcriber(),
        room=ctx.room,
        room_output_options=RoomOutputOptions(
            # If you don't want to send the transcription back to the room, set this to False
            transcription_enabled=True,
            audio_enabled=False,
        ),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))