#!/usr/bin/env python3
"""
Test script to verify ngrok connection to your API server.
Run this from Colab or locally to test the connection.
"""

import requests
import sys
import json

def test_connection(api_url: str):
    """Test connection to API server via ngrok."""
    
    print(f"Testing connection to: {api_url}")
    print("-" * 50)
    
    # Test 1: Health check
    try:
        print("1. Testing health endpoint...")
        response = requests.get(f"{api_url}/health", timeout=5)
        if response.status_code == 200:
            print("   ✅ Health check passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Connection failed: {e}")
        return False
    
    # Test 2: Check Colab endpoints
    try:
        print("\n2. Testing Colab endpoints...")
        response = requests.get(f"{api_url}/api/colab/jobs/pending", timeout=5)
        if response.status_code == 200:
            print("   ✅ Pending jobs endpoint accessible")
            data = response.json()
            print(f"   Found {len(data.get('jobs', []))} pending jobs")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Endpoint test failed: {e}")
    
    # Test 3: Create a test job
    try:
        print("\n3. Testing job creation...")
        test_plan = {
            "frames": [
                {
                    "id": "test-frame",
                    "type": "whiteboard_diagram",
                    "duration": 5,
                    "text": "Test",
                    "animate": False
                }
            ]
        }
        
        response = requests.post(
            f"{api_url}/api/colab/generate",
            json={"videoPlan": test_plan},
            timeout=10
        )
        
        if response.status_code == 202:
            print("   ✅ Job creation successful")
            job_data = response.json()
            print(f"   Job ID: {job_data.get('jobId')}")
            print(f"   Status endpoint: {job_data.get('endpoints', {}).get('status')}")
            return True
        else:
            print(f"   ❌ Job creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request failed: {e}")
        return False

if __name__ == "__main__":
    # Get API URL from command line or environment
    if len(sys.argv) > 1:
        api_url = sys.argv[1].rstrip('/')
    else:
        api_url = input("Enter your API URL (e.g., https://abc123.ngrok-free.app): ").strip().rstrip('/')
    
    if not api_url:
        print("❌ No API URL provided")
        sys.exit(1)
    
    if not api_url.startswith('http'):
        api_url = f"https://{api_url}"
    
    success = test_connection(api_url)
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! Your ngrok tunnel is working.")
        print("\nYou can now use this URL in your Colab notebook:")
        print(f"   API_BASE_URL = \"{api_url}\"")
    else:
        print("❌ Some tests failed. Check your ngrok tunnel and API server.")
    print("=" * 50)
    
    sys.exit(0 if success else 1)

