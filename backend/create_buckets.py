"""
Script to create required Supabase storage buckets
"""
import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables - try multiple possible locations for .env
# First try the current directory
load_dotenv()

# If credentials not found, try parent directory (project root)
if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
    parent_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(parent_env_path):
        print(f"Loading environment from: {parent_env_path}")
        load_dotenv(parent_env_path)

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("Error: Supabase URL or key not found in environment variables")
    exit(1)

print(f"Connecting to Supabase at {supabase_url}")
supabase = create_client(supabase_url, supabase_key)

# Create required buckets
required_buckets = ['images', 'presets']

# Get existing buckets
try:
    buckets = supabase.storage.list_buckets()
    print(f"Existing buckets: {buckets}")
    
    # Extract bucket names using the name attribute
    existing_bucket_names = [bucket.name for bucket in buckets]
    print(f"Existing bucket names: {existing_bucket_names}")
    
    # Create missing buckets
    for bucket_name in required_buckets:
        if bucket_name not in existing_bucket_names:
            print(f"Creating bucket: {bucket_name}")
            try:
                supabase.storage.create_bucket(bucket_name, {'public': False})
                print(f"Bucket '{bucket_name}' created successfully")
            except Exception as e:
                print(f"Error creating bucket '{bucket_name}': {e}")
        else:
            print(f"Bucket '{bucket_name}' already exists")
            
            # Ensure bucket is private
            try:
                supabase.storage.update_bucket(bucket_name, {'public': False})
                print(f"Ensured bucket '{bucket_name}' is private")
            except Exception as e:
                print(f"Error updating bucket '{bucket_name}': {e}")
            
    # Verify bucket creation
    updated_buckets = supabase.storage.list_buckets()
    updated_bucket_names = [bucket.name for bucket in updated_buckets]
    print(f"Updated bucket list: {updated_bucket_names}")
    
except Exception as e:
    print(f"Error: {e}")
