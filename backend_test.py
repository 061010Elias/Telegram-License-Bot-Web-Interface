#!/usr/bin/env python3
import requests
import json
import time
import unittest
import uuid
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://a0d1a663-69dc-4dcc-a21b-359c9ef7a2c3.preview.emergentagent.com/api"

class TelegramBotBackendTest(unittest.TestCase):
    """Test suite for Telegram Bot Backend API"""

    def test_01_api_health(self):
        """Test the root API endpoint to ensure server is running"""
        response = requests.get(f"{BASE_URL}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["message"], "Telegram Bot API Server")
        print("✅ API Health Check: Success")

    def test_02_get_users(self):
        """Test fetching users from the database"""
        response = requests.get(f"{BASE_URL}/users")
        self.assertEqual(response.status_code, 200)
        users = response.json()
        self.assertIsInstance(users, list)
        print(f"✅ Get Users: Success - Retrieved {len(users)} users")
        return users

    def test_03_get_tickets(self):
        """Test fetching tickets from the database"""
        response = requests.get(f"{BASE_URL}/tickets")
        self.assertEqual(response.status_code, 200)
        tickets = response.json()
        self.assertIsInstance(tickets, list)
        print(f"✅ Get Tickets: Success - Retrieved {len(tickets)} tickets")
        return tickets

    def test_04_get_accounts(self):
        """Test fetching accounts from the database"""
        response = requests.get(f"{BASE_URL}/accounts")
        self.assertEqual(response.status_code, 200)
        accounts = response.json()
        self.assertIsInstance(accounts, list)
        
        # Verify demo accounts were initialized
        self.assertGreaterEqual(len(accounts), 5, "Demo accounts should be initialized")
        
        # Check if we have the expected account types
        account_types = set(account["type"] for account in accounts)
        self.assertTrue("gaming" in account_types, "Gaming accounts should be initialized")
        self.assertTrue("streaming" in account_types, "Streaming accounts should be initialized")
        self.assertTrue("social" in account_types, "Social accounts should be initialized")
        
        print(f"✅ Get Accounts: Success - Retrieved {len(accounts)} accounts")
        print(f"✅ Demo Accounts Initialization: Success - Found account types: {', '.join(account_types)}")
        return accounts

    def test_05_get_activities(self):
        """Test fetching bot activities from the database"""
        response = requests.get(f"{BASE_URL}/activities")
        self.assertEqual(response.status_code, 200)
        activities = response.json()
        self.assertIsInstance(activities, list)
        print(f"✅ Get Activities: Success - Retrieved {len(activities)} activities")
        return activities

    def test_06_create_account(self):
        """Test creating a new account"""
        # Generate unique username to avoid conflicts
        unique_id = str(uuid.uuid4())[:8]
        new_account = {
            "type": "testing",
            "username": f"test_user_{unique_id}",
            "password": "test_password",
            "email": f"test_{unique_id}@example.com",
            "additional_info": "Test account created during backend testing"
        }
        
        response = requests.post(f"{BASE_URL}/accounts", json=new_account)
        self.assertEqual(response.status_code, 200)
        created_account = response.json()
        
        # Verify the account was created with correct data
        self.assertEqual(created_account["type"], new_account["type"])
        self.assertEqual(created_account["username"], new_account["username"])
        self.assertEqual(created_account["password"], new_account["password"])
        self.assertEqual(created_account["email"], new_account["email"])
        self.assertEqual(created_account["additional_info"], new_account["additional_info"])
        self.assertTrue(created_account["is_available"])
        self.assertIn("id", created_account)
        
        print(f"✅ Create Account: Success - Created account with ID: {created_account['id']}")
        return created_account

    def test_07_add_credits(self):
        """Test adding credits to a user"""
        # First, get a user to add credits to
        users = self.test_02_get_users()
        
        if not users:
            self.skipTest("No users available to test adding credits")
        
        user = users[0]
        user_id = user["id"]
        initial_credits = user["credits"]
        credits_to_add = 10
        
        # Add credits to the user
        payload = {
            "user_id": user_id,
            "credits_to_add": credits_to_add
        }
        
        response = requests.post(f"{BASE_URL}/admin/add-credits", json=payload)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["message"], f"Added {credits_to_add} credits to user")
        
        # Verify the credits were added by fetching the user again
        response = requests.get(f"{BASE_URL}/users")
        self.assertEqual(response.status_code, 200)
        updated_users = response.json()
        
        # Find the user we updated
        updated_user = next((u for u in updated_users if u["id"] == user_id), None)
        self.assertIsNotNone(updated_user, "Updated user should exist")
        
        # Check if credits were added correctly
        expected_credits = initial_credits + credits_to_add
        self.assertEqual(updated_user["credits"], expected_credits, 
                         f"User should have {expected_credits} credits after adding {credits_to_add}")
        
        print(f"✅ Add Credits: Success - Added {credits_to_add} credits to user {user_id}")
        print(f"   Initial credits: {initial_credits}, New credits: {updated_user['credits']}")
        
        return updated_user

    def test_08_error_handling(self):
        """Test error handling for invalid requests"""
        # Test invalid user ID for adding credits
        invalid_payload = {
            "user_id": "non_existent_user_id",
            "credits_to_add": 10
        }
        
        response = requests.post(f"{BASE_URL}/admin/add-credits", json=invalid_payload)
        self.assertEqual(response.status_code, 404)
        error = response.json()
        self.assertEqual(error["detail"], "User not found")
        
        print("✅ Error Handling: Success - Properly handled invalid user ID")
        
        # Test invalid endpoint
        response = requests.get(f"{BASE_URL}/non_existent_endpoint")
        self.assertEqual(response.status_code, 404)
        
        print("✅ Error Handling: Success - Properly handled invalid endpoint")

def run_tests():
    """Run all tests and print a summary"""
    print("\n" + "="*80)
    print("TELEGRAM BOT BACKEND API TEST SUITE")
    print("="*80)
    
    # Create a test suite
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TelegramBotBackendTest)
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped)}")
    
    if not result.failures and not result.errors:
        print("\n✅ ALL TESTS PASSED")
    else:
        print("\n❌ SOME TESTS FAILED")
        
        if result.failures:
            print("\nFAILURES:")
            for i, (test, traceback) in enumerate(result.failures, 1):
                print(f"{i}. {test}")
                print(f"   {traceback.split('Traceback')[0].strip()}")
        
        if result.errors:
            print("\nERRORS:")
            for i, (test, traceback) in enumerate(result.errors, 1):
                print(f"{i}. {test}")
                print(f"   {traceback.split('Traceback')[0].strip()}")
    
    print("="*80)
    
    return result.wasSuccessful()

if __name__ == "__main__":
    run_tests()