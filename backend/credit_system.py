"""
Credit management system for the LR Preset application.
Handles user credits, test accounts, and credit operations.
"""

import os
import json
import time
import datetime
from supabase import create_client
import supabase_client

# Constants
DEFAULT_NEW_USER_CREDITS = 1
CREDITS_PER_PACK = 10
PRICE_PER_PACK = 9.99

def initialize_credit_tables():
    """
    Initialize the necessary tables for the credit system if they don't exist.
    This should be called during application startup.
    
    Note: No payment card information (PCI data) is stored in these tables.
    All payment processing is handled by Stripe, which is PCI compliant.
    We only store credit balances and transaction records.
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Check if the required tables exist
        # In a production environment, these tables should be created using migrations
        # or the Supabase dashboard before deploying the application
        
        # Check for user_credits table
        response = supabase.table('user_credits').select('id').limit(1).execute()
        if hasattr(response, 'error') and response.error:
            print("Warning: user_credits table may not exist. Please run the SQL creation script.")
            
        # Check for test_accounts table
        response = supabase.table('test_accounts').select('id').limit(1).execute()
        if hasattr(response, 'error') and response.error:
            print("Warning: test_accounts table may not exist. Please run the SQL creation script.")
        else:
            # Ensure amlanc@gmail.com is a test account
            admin_email = "amlanc@gmail.com"
            test_account_check = supabase.table('test_accounts').select('*').eq('email', admin_email).execute()
            if not test_account_check.data:
                # Add amlanc@gmail.com as a test account
                print(f"Adding {admin_email} as a test account")
                supabase.table('test_accounts').insert({
                    'email': admin_email,
                    'created_by': 'system_initialization'
                }).execute()
            
        # Check for credit_transactions table
        response = supabase.table('credit_transactions').select('id').limit(1).execute()
        if hasattr(response, 'error') and response.error:
            print("Warning: credit_transactions table may not exist. Please run the SQL creation script.")
        
        print("Credit system tables initialized")
        return True
    except Exception as e:
        print(f"Error initializing credit tables: {e}")
        return False

def is_admin_user(email):
    """
    Check if the provided email is an admin user.
    
    Args:
        email: User's email address
        
    Returns:
        Boolean indicating if this is an admin user
    """
    try:
        if not email:
            return False
            
        # Check if this is the default admin email
        if email.lower() == "amlanc@gmail.com":
            return True
            
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
        
        try:    
            # Check admin_users table
            response = supabase.table('admin_users').select('*').eq('email', email.lower()).execute()
            if response.data and len(response.data) > 0:
                return True
        except Exception as table_error:
            # If the table doesn't exist, log the error but continue
            print(f"Warning: Could not check admin_users table: {table_error}")
            # Since we already checked for the known admin emails above, we can return False here
            pass
            
        return False
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return False

def is_test_account(email):
    """
    Check if the provided email is a test account with unlimited credits.
    
    Args:
        email: User's email address
        
    Returns:
        Boolean indicating if this is a test account
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Query the test_accounts table
        response = supabase.table('test_accounts').select('*').eq('email', email).execute()
        
        # If we get any results, this is a test account
        return len(response.data) > 0
    except Exception as e:
        print(f"Error checking test account status: {e}")
        return False

def get_user_credits(user_id):
    """
    Get the current credit balance for a user.
    
    Args:
        user_id: User ID
        
    Returns:
        Dictionary with credit information or None if error
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return None
            
        # Query the user_credits table
        response = supabase.table('user_credits').select('*').eq('user_id', user_id).execute()
        
        # If we have results, return the credit info
        if response.data and len(response.data) > 0:
            return response.data[0]
        
        # If no results, the user doesn't have a credit record yet
        return {
            'user_id': user_id,
            'credits_balance': 0,
            'total_credits_earned': 0,
            'last_credit_update': datetime.datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Error getting user credits: {e}")
        return None

def add_credits_for_new_user(user_id, email):
    """
    Add the default number of credits for a new user.
    
    Args:
        user_id: User ID
        email: User's email address
        
    Returns:
        Boolean indicating success
    """
    try:
        # Check if this is a test account
        if is_test_account(email):
            print(f"User {email} is a test account - no need to add credits")
            return True
            
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Check if the user already has a credit record
        existing_credits = get_user_credits(user_id)
        
        # If the user already has credits, don't add more
        if existing_credits and existing_credits.get('credits_balance', 0) > 0:
            print(f"User {user_id} already has credits")
            return True
            
        # Add the default credits for a new user
        now = datetime.datetime.now().isoformat()
        credit_data = {
            'user_id': user_id,
            'credits_balance': DEFAULT_NEW_USER_CREDITS,
            'total_credits_earned': DEFAULT_NEW_USER_CREDITS,
            'last_credit_update': now
        }
        
        response = supabase.table('user_credits').upsert(credit_data).execute()
        
        return len(response.data) > 0
    except Exception as e:
        print(f"Error adding credits for new user: {e}")
        return False

def add_purchased_credits(user_id, credit_packs):
    """
    Add purchased credits to a user's account.
    
    Args:
        user_id: User ID
        credit_packs: Number of credit packs purchased
        
    Returns:
        Boolean indicating success
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Calculate the number of credits to add
        credits_to_add = credit_packs * CREDITS_PER_PACK
        
        # Get the user's current credits
        existing_credits = get_user_credits(user_id)
        
        # Calculate the new balance
        current_balance = existing_credits.get('credits_balance', 0)
        new_balance = current_balance + credits_to_add
        
        # Calculate the new total earned
        current_total = existing_credits.get('total_credits_earned', 0)
        new_total = current_total + credits_to_add
        
        # Update the user's credits
        now = datetime.datetime.now().isoformat()
        credit_data = {
            'user_id': user_id,
            'credits_balance': new_balance,
            'total_credits_earned': new_total,
            'last_credit_update': now
        }
        
        response = supabase.table('user_credits').upsert(credit_data).execute()
        
        return len(response.data) > 0
    except Exception as e:
        print(f"Error adding purchased credits: {e}")
        return False

def use_credit(user_id, email=None):
    """
    Use one credit for a conversion. If the user is a test account,
    no credit is deducted.
    
    Args:
        user_id: User ID
        email: User's email (optional, for test account check)
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        # If email is provided, check if this is a test account
        if email and is_test_account(email):
            print(f"User {email} is a test account - no credit deduction")
            return True, None
            
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False, "Database connection error"
            
        # Get the user's current credits
        existing_credits = get_user_credits(user_id)
        
        # Check if the user has enough credits
        current_balance = existing_credits.get('credits_balance', 0)
        if current_balance < 1:
            return False, "Insufficient credits"
            
        # Deduct one credit
        new_balance = current_balance - 1
        
        # Update the user's credits
        now = datetime.datetime.now().isoformat()
        credit_data = {
            'user_id': user_id,
            'credits_balance': new_balance,
            'last_credit_update': now
        }
        
        response = supabase.table('user_credits').update(credit_data).eq('user_id', user_id).execute()
        
        return True, None
    except Exception as e:
        print(f"Error using credit: {e}")
        return False, str(e)

def add_test_account(email, created_by):
    """
    Add a new test account with unlimited credits.
    
    Args:
        email: Email address to add as a test account
        created_by: Admin user who added this account
        
    Returns:
        Boolean indicating success
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Check if the account already exists
        if is_test_account(email):
            print(f"Test account {email} already exists")
            return True
            
        # Add the test account
        now = datetime.datetime.now().isoformat()
        account_data = {
            'email': email,
            'created_at': now,
            'created_by': created_by
        }
        
        response = supabase.table('test_accounts').insert(account_data).execute()
        
        return len(response.data) > 0
    except Exception as e:
        print(f"Error adding test account: {e}")
        return False

def remove_test_account(email):
    """
    Remove a test account.
    
    Args:
        email: Email address to remove
        
    Returns:
        Boolean indicating success
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Delete the test account
        response = supabase.table('test_accounts').delete().eq('email', email).execute()
        
        return True
    except Exception as e:
        print(f"Error removing test account: {e}")
        return False

def get_all_test_accounts():
    """
    Get a list of all test accounts.
    
    Returns:
        List of test account emails
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return []
            
        # Query all test accounts
        response = supabase.table('test_accounts').select('*').execute()
        
        return response.data
    except Exception as e:
        print(f"Error getting test accounts: {e}")
        return []


def get_all_users(include_credits=True):
    """
    Get a list of all users with their information.
    Admin-only function.
    
    Args:
        include_credits: Whether to include credit information
        
    Returns:
        List of user objects with their information
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return []
            
        # Get all users from the auth.users table
        # This assumes you're using Supabase Auth
        response = supabase.table('users').select('id,email,created_at').execute()
        
        if not response.data:
            return []
            
        users = response.data
        
        # Add user type information
        for user in users:
            # Check if admin
            user['is_admin'] = is_admin_user(user.get('email'))
            
            # Check if test account
            user['is_test'] = is_test_account(user.get('email'))
            
            # Add credit information if requested
            if include_credits:
                credit_info = get_user_credits(user.get('id'))
                if credit_info:
                    user['credits'] = credit_info.get('balance', 0)
                    user['total_credits_earned'] = credit_info.get('total_earned', 0)
                    user['last_credit_update'] = credit_info.get('last_update')
                else:
                    user['credits'] = 0
                    user['total_credits_earned'] = 0
                    user['last_credit_update'] = None
        
        return users
    except Exception as e:
        print(f"Error getting all users: {e}")
        return []


def add_admin_user(email, added_by):
    """
    Add a new admin user.
    Admin-only function.
    
    Args:
        email: Email address to add as an admin user
        added_by: Admin user who added this account
        
    Returns:
        Boolean indicating success
    """
    try:
        if not email:
            return False
            
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Check if already an admin
        if is_admin_user(email):
            return True
            
        # Add to admin_users table
        response = supabase.table('admin_users').insert({
            'email': email.lower(),
            'added_by': added_by,
            'created_at': datetime.datetime.now().isoformat()
        }).execute()
        
        return True
    except Exception as e:
        print(f"Error adding admin user: {e}")
        return False


def remove_admin_user(email):
    """
    Remove an admin user.
    Admin-only function.
    
    Args:
        email: Email address to remove from admin users
        
    Returns:
        Boolean indicating success
    """
    try:
        if not email or email.lower() == "amlanc@gmail.com":
            # Don't allow removing the default admin
            return False
            
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Remove from admin_users table
        response = supabase.table('admin_users').delete().eq('email', email.lower()).execute()
        
        return True
    except Exception as e:
        print(f"Error removing admin user: {e}")
        return False


def admin_add_credits(user_id, credits_amount, admin_email):
    """
    Add credits to a user's account (admin function).
    
    Args:
        user_id: ID of the user to add credits to
        credits_amount: Number of credits to add
        admin_email: Email of the admin performing the action
        
    Returns:
        Boolean indicating success
    """
    try:
        if not user_id or credits_amount <= 0:
            return False
            
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return False
            
        # Get current credit balance
        user_credits = get_user_credits(user_id)
        current_balance = user_credits.get('balance', 0) if user_credits else 0
        total_earned = user_credits.get('total_earned', 0) if user_credits else 0
        
        # Calculate new values
        new_balance = current_balance + credits_amount
        new_total_earned = total_earned + credits_amount
        
        # Update or insert credit record
        if user_credits:
            # Update existing record
            response = supabase.table('user_credits').update({
                'credits_balance': new_balance,
                'total_credits_earned': new_total_earned,
                'last_credit_update': datetime.datetime.now().isoformat()
            }).eq('user_id', user_id).execute()
        else:
            # Insert new record
            response = supabase.table('user_credits').insert({
                'user_id': user_id,
                'credits_balance': new_balance,
                'total_credits_earned': new_total_earned,
                'last_credit_update': datetime.datetime.now().isoformat(),
                'created_at': datetime.datetime.now().isoformat()
            }).execute()
            
        # Record the transaction
        transaction_response = supabase.table('credit_transactions').insert({
            'user_id': user_id,
            'transaction_type': 'admin_grant',
            'credits_amount': credits_amount,
            'transaction_reference': f"Granted by admin: {admin_email}",
            'created_at': datetime.datetime.now().isoformat()
        }).execute()
        
        return True
    except Exception as e:
        print(f"Error adding admin credits: {e}")
        return False


def get_transaction_history(days=30, transaction_type=None):
    """
    Get transaction history for all users.
    Admin-only function.
    
    Args:
        days: Number of days to look back (default: 30)
        transaction_type: Optional filter for transaction type
        
    Returns:
        List of transaction objects
    """
    try:
        supabase = supabase_client.get_supabase_client()
        if not supabase:
            print("Failed to get Supabase client")
            return []
            
        # Calculate the date threshold
        date_threshold = (datetime.datetime.now() - datetime.timedelta(days=days)).isoformat()
        
        # Build the query
        query = supabase.table('credit_transactions').select('*').gte('created_at', date_threshold)
        
        # Add transaction type filter if provided
        if transaction_type:
            query = query.eq('transaction_type', transaction_type)
            
        # Execute the query
        response = query.order('created_at', desc=True).execute()
        
        if response.data:
            transactions = response.data
            
            # Enrich with user information
            for transaction in transactions:
                user_id = transaction.get('user_id')
                if user_id:
                    # Get user email
                    user_response = supabase.table('users').select('email').eq('id', user_id).execute()
                    if user_response.data and len(user_response.data) > 0:
                        transaction['user_email'] = user_response.data[0].get('email')
                    else:
                        transaction['user_email'] = 'Unknown'
            
            return transactions
        else:
            return []
    except Exception as e:
        print(f"Error getting transaction history: {e}")
        return []
