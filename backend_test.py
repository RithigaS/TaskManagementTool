#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class KanbanAPITester:
    def __init__(self, base_url="https://agileboards-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.project_id = None
        self.task_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_auth_signup(self):
        """Test user signup"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@example.com"
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data={
                "email": test_email,
                "name": "Test User",
                "password": "TestPass123!"
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_auth_login(self):
        """Test user login with existing credentials"""
        # First create a user
        test_email = f"login_test_{datetime.now().strftime('%H%M%S')}@example.com"
        signup_success, signup_response = self.run_test(
            "Create User for Login Test",
            "POST",
            "auth/signup",
            200,
            data={
                "email": test_email,
                "name": "Login Test User",
                "password": "LoginTest123!"
            }
        )
        
        if not signup_success:
            return False
            
        # Now test login
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": test_email,
                "password": "LoginTest123!"
            }
        )
        return success and 'access_token' in response

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success and 'id' in response

    def test_create_project(self):
        """Test project creation"""
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data={
                "name": "Test Project",
                "description": "A test project for API testing"
            }
        )
        if success and 'id' in response:
            self.project_id = response['id']
            print(f"   Project ID: {self.project_id}")
            return True
        return False

    def test_get_projects(self):
        """Test get projects list"""
        success, response = self.run_test(
            "Get Projects List",
            "GET",
            "projects",
            200
        )
        return success and isinstance(response, list)

    def test_get_project(self):
        """Test get single project"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Single Project",
            "GET",
            f"projects/{self.project_id}",
            200
        )
        return success and response.get('id') == self.project_id

    def test_update_project(self):
        """Test project update"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Update Project",
            "PUT",
            f"projects/{self.project_id}",
            200,
            data={
                "name": "Updated Test Project",
                "description": "Updated description"
            }
        )
        return success and response.get('name') == "Updated Test Project"

    def test_create_task(self):
        """Test task creation"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Create Task",
            "POST",
            f"projects/{self.project_id}/tasks",
            200,
            data={
                "title": "Test Task",
                "description": "A test task",
                "status": "todo"
            }
        )
        if success and 'id' in response:
            self.task_id = response['id']
            print(f"   Task ID: {self.task_id}")
            return True
        return False

    def test_get_tasks(self):
        """Test get tasks for project"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Tasks",
            "GET",
            f"projects/{self.project_id}/tasks",
            200
        )
        return success and isinstance(response, list)

    def test_update_task(self):
        """Test task update"""
        if not self.project_id or not self.task_id:
            print("❌ No project/task ID available for testing")
            return False
            
        success, response = self.run_test(
            "Update Task Status",
            "PUT",
            f"projects/{self.project_id}/tasks/{self.task_id}",
            200,
            data={
                "status": "in_progress"
            }
        )
        return success and response.get('status') == "in_progress"

    def test_get_activities(self):
        """Test get project activities"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Project Activities",
            "GET",
            f"projects/{self.project_id}/activities",
            200
        )
        return success and isinstance(response, list)

    def test_delete_task(self):
        """Test task deletion"""
        if not self.project_id or not self.task_id:
            print("❌ No project/task ID available for testing")
            return False
            
        success, response = self.run_test(
            "Delete Task",
            "DELETE",
            f"projects/{self.project_id}/tasks/{self.task_id}",
            200
        )
        return success

    def test_delete_project(self):
        """Test project deletion"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Delete Project",
            "DELETE",
            f"projects/{self.project_id}",
            200
        )
        return success

    def test_invalid_auth(self):
        """Test invalid authentication"""
        # Save current token
        original_token = self.token
        self.token = "invalid_token"
        
        success, response = self.run_test(
            "Invalid Auth Test",
            "GET",
            "auth/me",
            401
        )
        
        # Restore token
        self.token = original_token
        return success

def main():
    print("🚀 Starting Kanban API Tests")
    print("=" * 50)
    
    tester = KanbanAPITester()
    
    # Test sequence
    test_sequence = [
        ("Authentication - Signup", tester.test_auth_signup),
        ("Authentication - Me", tester.test_auth_me),
        ("Authentication - Login", tester.test_auth_login),
        ("Authentication - Invalid Token", tester.test_invalid_auth),
        ("Projects - Create", tester.test_create_project),
        ("Projects - Get List", tester.test_get_projects),
        ("Projects - Get Single", tester.test_get_project),
        ("Projects - Update", tester.test_update_project),
        ("Tasks - Create", tester.test_create_task),
        ("Tasks - Get List", tester.test_get_tasks),
        ("Tasks - Update", tester.test_update_task),
        ("Activities - Get List", tester.test_get_activities),
        ("Tasks - Delete", tester.test_delete_task),
        ("Projects - Delete", tester.test_delete_project),
    ]
    
    # Run all tests
    for test_name, test_func in test_sequence:
        try:
            result = test_func()
            if not result:
                print(f"⚠️  Test '{test_name}' failed but continuing...")
        except Exception as e:
            print(f"💥 Test '{test_name}' crashed: {str(e)}")
            tester.failed_tests.append({
                "test": test_name,
                "error": f"Test crashed: {str(e)}"
            })
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"{i}. {failure.get('test', 'Unknown')}")
            if 'error' in failure:
                print(f"   Error: {failure['error']}")
            elif 'expected' in failure:
                print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                print(f"   Response: {failure.get('response', 'N/A')}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())