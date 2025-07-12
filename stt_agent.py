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

from livekit.plugins import assemblyai

load_dotenv()

logger = logging.getLogger("transcriber")

class Transcriber(Agent):
    def __init__(self):
        super().__init__(
            instructions="not-needed",
            stt=assemblyai.STT(),
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

    async def on_user_turn_completed(self, chat_ctx: llm.ChatContext, new_message: llm.ChatMessage):
        # Get the transcript
        user_transcript = new_message.text_content
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Log to console
        logger.info(f"[{timestamp}] -> {user_transcript}")
        
        # Save to local file
        try:
            with open(self.transcript_file, "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {user_transcript}\n")
            logger.info(f"Transcript saved to: {self.transcript_file}")
        except Exception as e:
            logger.error(f"Error saving transcript: {e}")

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