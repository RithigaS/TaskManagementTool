#!/usr/bin/env python3

import asyncio
import websockets
import json
import requests
from datetime import datetime

class WebSocketTester:
    def __init__(self, base_url="https://agileboards-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.ws_url = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
        self.token = None
        self.user_id = None
        self.project_id = None

    def setup_user_and_project(self):
        """Create a user and project for WebSocket testing"""
        print("🔧 Setting up user and project for WebSocket testing...")
        
        # Create user
        test_email = f"ws_test_{datetime.now().strftime('%H%M%S')}@example.com"
        response = requests.post(f"{self.base_url}/api/auth/signup", json={
            "email": test_email,
            "name": "WebSocket Test User",
            "password": "WSTest123!"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            self.user_id = data['user']['id']
            print(f"✅ User created: {self.user_id}")
        else:
            print(f"❌ Failed to create user: {response.status_code}")
            return False
        
        # Create project
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        response = requests.post(f"{self.base_url}/api/projects", 
                               json={"name": "WebSocket Test Project", "description": "Testing WebSocket"},
                               headers=headers)
        
        if response.status_code == 200:
            self.project_id = response.json()['id']
            print(f"✅ Project created: {self.project_id}")
            return True
        else:
            print(f"❌ Failed to create project: {response.status_code}")
            return False

    async def test_websocket_connection(self):
        """Test WebSocket connection and real-time updates"""
        print("\n🔍 Testing WebSocket connection...")
        
        try:
            # Connect to WebSocket
            ws_endpoint = f"{self.ws_url}/ws/{self.user_id}"
            print(f"Connecting to: {ws_endpoint}")
            
            async with websockets.connect(ws_endpoint) as websocket:
                print("✅ WebSocket connected successfully")
                
                # Set up a timeout for receiving messages
                message_received = False
                
                # Create a task in another thread to trigger WebSocket message
                await asyncio.sleep(1)  # Give WebSocket time to establish
                
                # Create a task via API to trigger WebSocket notification
                headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
                response = requests.post(f"{self.base_url}/api/projects/{self.project_id}/tasks",
                                       json={"title": "WebSocket Test Task", "description": "Testing real-time updates"},
                                       headers=headers)
                
                if response.status_code == 200:
                    print("✅ Task created via API")
                    
                    # Wait for WebSocket message
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        data = json.loads(message)
                        print(f"✅ Received WebSocket message: {data.get('type', 'unknown')}")
                        message_received = True
                    except asyncio.TimeoutError:
                        print("⚠️  No WebSocket message received within timeout")
                else:
                    print(f"❌ Failed to create task: {response.status_code}")
                
                return message_received
                
        except Exception as e:
            print(f"❌ WebSocket connection failed: {str(e)}")
            return False

async def main():
    print("🚀 Starting WebSocket Tests")
    print("=" * 40)
    
    tester = WebSocketTester()
    
    # Setup
    if not tester.setup_user_and_project():
        print("❌ Setup failed, cannot test WebSocket")
        return 1
    
    # Test WebSocket
    ws_success = await tester.test_websocket_connection()
    
    print("\n" + "=" * 40)
    print("📊 WEBSOCKET TEST RESULTS")
    print("=" * 40)
    
    if ws_success:
        print("✅ WebSocket functionality: WORKING")
        print("✅ Real-time updates: FUNCTIONAL")
        return 0
    else:
        print("❌ WebSocket functionality: ISSUES DETECTED")
        print("⚠️  Real-time updates may not work properly")
        return 1

if __name__ == "__main__":
    asyncio.run(main())