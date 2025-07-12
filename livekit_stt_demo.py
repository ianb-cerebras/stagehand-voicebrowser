import logging
import json
import os
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
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

    async def on_user_turn_completed(self, chat_ctx: llm.ChatContext, new_message: llm.ChatMessage):
        # Add any backend processing of transcripts here if needed
        user_transcript = new_message.text_content
        logger.info(f" -> {user_transcript}")

        # Output JSON transcript to stdout for external consumption
        transcript_data = {
            "type": "transcript",
            "text": user_transcript,
            "timestamp": new_message.timestamp.isoformat() if hasattr(new_message, 'timestamp') else None
        }
        print(json.dumps(transcript_data), flush=True)

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