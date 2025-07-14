#!/usr/bin/env python3

import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_stt")

def test_imports():
    """Test if all required modules can be imported"""
    try:
        logger.info("Testing imports...")
        
        # Test faster-whisper
        logger.info("Importing faster_whisper...")
        from faster_whisper import WhisperModel
        logger.info("✓ faster_whisper imported successfully")
        
        # Test PyAudio
        logger.info("Importing pyaudio...")
        import pyaudio
        logger.info("✓ pyaudio imported successfully")
        
        # Test other modules
        import wave
        import numpy as np
        logger.info("✓ All modules imported successfully")
        
        return True
        
    except ImportError as e:
        logger.error(f"✗ Import error: {e}")
        return False
    except Exception as e:
        logger.error(f"✗ Unexpected error: {e}")
        return False

def test_whisper_model():
    """Test if Whisper model can be loaded"""
    try:
        logger.info("Testing Whisper model loading...")
        from faster_whisper import WhisperModel
        
        # Try to load a small model
        logger.info("Loading 'tiny' model...")
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        logger.info("✓ Whisper model loaded successfully")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Error loading Whisper model: {e}")
        return False

def test_audio_devices():
    """Test if audio devices are available"""
    try:
        logger.info("Testing audio devices...")
        import pyaudio
        
        p = pyaudio.PyAudio()
        
        # Get number of devices
        device_count = p.get_device_count()
        logger.info(f"Found {device_count} audio devices")
        
        # List input devices
        input_devices = []
        for i in range(device_count):
            try:
                device_info = p.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    input_devices.append({
                        'index': i,
                        'name': device_info['name'],
                        'channels': device_info['maxInputChannels']
                    })
            except Exception as e:
                logger.warning(f"Could not get info for device {i}: {e}")
        
        logger.info(f"Found {len(input_devices)} input devices:")
        for device in input_devices:
            logger.info(f"  - Device {device['index']}: {device['name']} ({device['channels']} channels)")
        
        p.terminate()
        
        if input_devices:
            logger.info("✓ Audio devices found")
            return True
        else:
            logger.error("✗ No input devices found")
            return False
            
    except Exception as e:
        logger.error(f"✗ Error testing audio devices: {e}")
        return False

def main():
    """Run all tests"""
    logger.info("🧪 Testing Local STT Setup")
    logger.info("=" * 40)
    
    tests = [
        ("Module Imports", test_imports),
        ("Whisper Model", test_whisper_model),
        ("Audio Devices", test_audio_devices),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        logger.info(f"\n🔍 Running: {test_name}")
        if test_func():
            passed += 1
            logger.info(f"✅ {test_name} PASSED")
        else:
            logger.error(f"❌ {test_name} FAILED")
    
    logger.info(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! Local STT should work.")
        return True
    else:
        logger.error("💥 Some tests failed. Please check the errors above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 