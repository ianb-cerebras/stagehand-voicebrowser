# 🎤 LiveKit Speech-to-Text Demo

This demo recreates the LiveKit + AssemblyAI Speech-to-Text integration as described in the documentation. It provides real-time speech transcription using LiveKit's agent system and AssemblyAI's streaming API.

## 📋 Prerequisites

1. **LiveKit Account**: Sign up at [livekit.io](https://livekit.io) and create a project
2. **AssemblyAI API Key**: Get a free API key at [assemblyai.com](https://assemblyai.com)
3. **Python 3.8+**: For running the agent
4. **Web Browser**: For the frontend demo

## 🚀 Quick Setup

### 1. Environment Setup

Create a `.env` file with your credentials:

```bash
# LiveKit credentials (from your LiveKit dashboard)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# AssemblyAI credentials
ASSEMBLYAI_API_KEY=your_assemblyai_key
```

### 2. Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install livekit-agents livekit-plugins-assemblyai livekit-server-sdk python-dotenv
```

### 3. Generate Access Token

```bash
python generate_token.py
```

This will prompt you for room name and participant identity, then generate a JWT token for the frontend.

### 4. Start the Agent

```bash
python livekit_stt_demo.py dev
```

The agent will connect to your LiveKit server and wait for participants to join.

### 5. Open the Frontend

Open `livekit_demo.html` in your browser and:
1. Enter your LiveKit URL
2. Enter the token generated in step 3
3. Click "Connect"
4. Allow microphone access
5. Start speaking!

## 📁 Files Overview

- **`livekit_stt_demo.py`**: The main LiveKit agent that handles speech-to-text
- **`livekit_demo.html`**: Frontend interface for testing the demo
- **`generate_token.py`**: Utility to generate LiveKit access tokens
- **`.env`**: Environment variables (create this file)

## 🔧 How It Works

1. **LiveKit Agent** (`livekit_stt_demo.py`):
   - Connects to LiveKit server as a worker
   - Listens for audio tracks in rooms
   - Uses AssemblyAI to transcribe speech in real-time
   - Outputs transcripts as JSON to stdout

2. **Frontend** (`livekit_demo.html`):
   - Connects to LiveKit room as a participant
   - Publishes microphone audio
   - Receives transcription data from the agent

3. **Token Generator** (`generate_token.py`):
   - Creates JWT tokens for frontend authentication
   - Handles room permissions and participant identity

## 🎯 Features

- ✅ Real-time speech transcription
- ✅ LiveKit room management
- ✅ AssemblyAI integration
- ✅ JSON output for external processing
- ✅ Simple web interface
- ✅ Token-based authentication

## 🐛 Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Connection failed**:
   - Check your LiveKit URL and credentials
   - Ensure the agent is running before connecting frontend

3. **No transcription**:
   - Verify AssemblyAI API key is valid
   - Check microphone permissions in browser
   - Ensure agent is connected to the same room

4. **Token errors**:
   - Generate a fresh token with `python generate_token.py`
   - Check token expiration time

### Debug Mode

Run the agent with verbose logging:
```bash
python livekit_stt_demo.py dev --verbose
```

## 🔗 Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [AssemblyAI Documentation](https://www.assemblyai.com/docs/)
- [LiveKit Agents Guide](https://docs.livekit.io/agents/)

## 📝 Notes

- This demo uses LiveKit Agents v0.x for compatibility
- The agent outputs JSON transcripts to stdout for external processing
- Room names and participant identities can be customized
- Tokens expire after 1 hour by default

## 🎉 Next Steps

Once the demo is working, you can:
1. Integrate with your own applications
2. Add custom processing for transcripts
3. Implement additional AI agents
4. Scale to multiple rooms and participants 