#!/usr/bin/env python3
"""
LiveKit Token Generator
Generates access tokens for LiveKit rooms
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Try to import livekit
try:
    from livekit import api
except ImportError:
    print("Error: livekit not found.")
    print("Install it with: pip install livekit")
    sys.exit(1)

load_dotenv()

def generate_token(room_name="demo-room", participant_identity="demo-user", duration_hours=1):
    """
    Generate a LiveKit access token
    
    Args:
        room_name: Name of the room to join
        participant_identity: Identity of the participant
        duration_hours: Token validity duration in hours
    
    Returns:
        JWT token string
    """
    
    # Get API credentials from environment
    api_key = os.getenv('LIVEKIT_API_KEY')
    api_secret = os.getenv('LIVEKIT_API_SECRET')
    
    if not api_key or not api_secret:
        print("Error: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in environment")
        return None
    
    # Calculate expiration time
    exp = datetime.now() + timedelta(hours=duration_hours)
    
    # Create access token using the livekit.api module
    token = api.AccessToken(
        api_key=api_key,
        api_secret=api_secret,
        identity=participant_identity,
        exp=exp
    )
    
    # Grant permissions
    token.add_grant(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True
    )
    
    return token.to_jwt()

def main():
    """Main function to generate and display token"""
    
    print("🔑 LiveKit Token Generator")
    print("=" * 40)
    
    # Get user input
    room_name = input("Room name (default: demo-room): ").strip() or "demo-room"
    participant_identity = input("Participant identity (default: demo-user): ").strip() or "demo-user"
    
    # Generate token
    token = generate_token(room_name, participant_identity)
    
    if token:
        print("\n✅ Token generated successfully!")
        print(f"Room: {room_name}")
        print(f"Participant: {participant_identity}")
        print(f"Expires: {datetime.now() + timedelta(hours=1)}")
        print("\n🔑 Access Token:")
        print("-" * 40)
        print(token)
        print("-" * 40)
        
        # Also show LiveKit URL if available
        livekit_url = os.getenv('LIVEKIT_URL')
        if livekit_url:
            print(f"\n🌐 LiveKit URL: {livekit_url}")
            print("\n📋 Copy these values to your demo HTML file!")
    else:
        print("❌ Failed to generate token")

if __name__ == "__main__":
    main() 