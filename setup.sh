#!/bin/bash

echo "🚀 Setting up Stagehand Voice Browser..."

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo "✅ Setup complete!"
echo ""
echo "Make sure you have the following environment variables set in your .env file:"
echo ""
echo "Then run: npm start"
echo ""
echo "Note: This approach uses Node.js audio recording and OpenAI Whisper API."
echo "Make sure you have 'sox' installed for audio recording:"
echo "  macOS: brew install sox"
echo "  Ubuntu: sudo apt-get install sox" 