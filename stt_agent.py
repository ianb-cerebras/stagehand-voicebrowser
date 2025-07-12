import logging
import json
import os
import assemblyai as aai
from assemblyai.streaming.v3 import (
    BeginEvent,
    StreamingClient,
    StreamingClientOptions,
    StreamingError,
    StreamingEvents,
    StreamingParameters,
    StreamingSessionParameters,
    TerminationEvent,
    TurnEvent,
)

api_key = os.getenv("ASSEMBLYAI_API_KEY")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def on_begin(self, event: BeginEvent):
    logger.info(f"Session started: {event.id}")

def on_turn(self, event: TurnEvent):
    # Print JSON for Node/TypeScript
    data = {
        "type": "transcript",
        "text": event.transcript,
        "end_of_turn": event.end_of_turn,
        "turn_is_formatted": event.turn_is_formatted,
    }
    print(json.dumps(data), flush=True)

    # Optionally, set formatting for the next turn
    if event.end_of_turn and not event.turn_is_formatted:
        params = StreamingSessionParameters(format_turns=True)
        self.set_params(params)

def on_terminated(self, event: TerminationEvent):
    logger.info(f"Session terminated: {event.audio_duration_seconds} seconds of audio processed")

def on_error(self, error: StreamingError):
    logger.error(f"Error occurred: {error}")

def main():
    client = StreamingClient(
        StreamingClientOptions(
            api_key=api_key,
            api_host="streaming.assemblyai.com",
        )
    )
    client.on(StreamingEvents.Begin, on_begin)
    client.on(StreamingEvents.Turn, on_turn)
    client.on(StreamingEvents.Termination, on_terminated)
    client.on(StreamingEvents.Error, on_error)

    client.connect(
        StreamingParameters(
            sample_rate=16000,
            format_turns=True,
        )
    )
    try:
        client.stream(
            aai.extras.MicrophoneStream(sample_rate=16000)
        )
    finally:
        client.disconnect(terminate=True)

if __name__ == "__main__":
    main()