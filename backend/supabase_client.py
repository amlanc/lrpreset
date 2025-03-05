import os
import json
import base64
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv
import datetime
import time

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
supabase_key = os.environ.get("SUPABASE_KEY")
supabase_service_key = os.environ.get("SUPABASE_SERVICE_KEY")

print(f"Supabase URL: {supabase_url}")
print(f"Supabase Key: {supabase_key[:10]}..." if supabase_key else "None")
print(f"Supabase Service Key: {'Available' if supabase_service_key else 'Not available'}")

# Always use real Supabase
USE_REAL_SUPABASE = True
print(f"Using real Supabase: {USE_REAL_SUPABASE}")

# Initialize the client
supabase = None
if supabase_url:
    try:
        # Prefer service key if available (bypasses RLS)
        if supabase_service_key:
            supabase = create_client(supabase_url, supabase_service_key)
            print("Supabase client initialized with SERVICE ROLE key (bypasses RLS)")
        elif supabase_key:
            supabase = create_client(supabase_url, supabase_key)
            print("Supabase client initialized with ANON key (subject to RLS)")
        else:
            raise ValueError("No Supabase key available")
            
        print("Supabase client initialized successfully")
        
        # Create required storage buckets if they don't exist
        try:
            # Check if buckets exist
            buckets = supabase.storage.list_buckets()
            bucket_names = [bucket.name for bucket in buckets]
            print(f"Existing buckets: {bucket_names}")
            
            # Create images bucket if it doesn't exist
            if 'images' not in bucket_names:
                print("Creating 'images' bucket...")
                supabase.storage.create_bucket('images', {'public': False})
                print("'images' bucket created successfully")
            
            # Create presets bucket if it doesn't exist
            if 'presets' not in bucket_names:
                print("Creating 'presets' bucket...")
                supabase.storage.create_bucket('presets', {'public': False})
                print("'presets' bucket created successfully")
                
        except Exception as bucket_error:
            print(f"Error creating storage buckets: {bucket_error}")
            # Continue anyway as the buckets might already exist
            
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        raise RuntimeError(f"Failed to initialize Supabase client: {e}")
else:
    raise ValueError("Supabase URL not found. Please set SUPABASE_URL environment variable.")

# In-memory storage for users and presets (temporary until DB operations complete)
mock_users = {}
mock_presets = {}

def get_supabase_client() -> Client:
    """Get a Supabase client instance"""
    if not supabase_url:
        raise ValueError("Supabase URL not found. Please set SUPABASE_URL environment variable.")
    
    # Prefer service key if available (bypasses RLS)
    if supabase_service_key:
        return create_client(supabase_url, supabase_service_key)
    elif supabase_key:
        return create_client(supabase_url, supabase_key)
    else:
        raise ValueError("No Supabase key available")

def store_user(user_id, user_data):
    """
    Store or update user information in Supabase.
    
    Args:
        user_id: Google user ID
        user_data: User profile data
        
    Returns:
        User data from Supabase
    """
    try:
        # Check if user exists
        existing_user = supabase.table('users').select('*').eq('google_id', user_id).execute()
        
        if len(existing_user.data) > 0:
            # Update existing user
            user = supabase.table('users').update({
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'picture': user_data.get('picture'),
                'last_login': 'now()'
            }).eq('google_id', user_id).execute()
            return user.data[0]
        else:
            # Create new user
            user = supabase.table('users').insert({
                'google_id': user_id,
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'picture': user_data.get('picture'),
                'created_at': 'now()',
                'last_login': 'now()'
            }).execute()
            return user.data[0]
    except Exception as e:
        print(f"Error storing user in Supabase: {e}")
        raise

def store_preset(user_id, image_data, metadata, xmp_content, original_filename="preset.xmp"):
    """Store a preset in Supabase"""
    try:
        # Generate a unique ID for this preset
        preset_id = str(uuid.uuid4())
        
        # Ensure image_data is binary
        if not isinstance(image_data, bytes):
            print("Warning: image_data is not bytes, converting...")
            if isinstance(image_data, str):
                if image_data.startswith('data:image'):
                    # Handle data URLs
                    header, encoded = image_data.split(",", 1)
                    image_data = base64.b64decode(encoded)
                else:
                    image_data = image_data.encode('utf-8')
            else:
                raise ValueError(f"Cannot convert image data of type {type(image_data)} to bytes")
        
        # Upload the image to storage
        image_path = f"{user_id}/{preset_id}/image.jpg"
        print(f"Uploading image to Supabase storage: {image_path}")
        
        # Upload with explicit content type
        try:
            supabase.storage.from_("images").upload(
                path=image_path,
                file=image_data,
                file_options={"content-type": "image/jpeg"}
            )
            
            # Verify image was uploaded
            try:
                image_files = supabase.storage.from_("images").list(f"{user_id}/{preset_id}")
                print(f"Image files after upload: {image_files}")
                if not image_files:
                    print("WARNING: Image upload verification failed - no files found")
            except Exception as verify_err:
                print(f"Error verifying image upload: {verify_err}")
                
        except Exception as img_err:
            print(f"Error uploading image: {img_err}")
            raise
        
        # Get the public URL for the image
        image_url = supabase.storage.from_("images").get_public_url(image_path)
        print(f"Image uploaded successfully, URL: {image_url}")
        
        # Ensure XMP content is properly encoded
        if isinstance(xmp_content, str):
            xmp_data = xmp_content.encode('utf-8')
        else:
            xmp_data = xmp_content
            
        # Upload the XMP file to storage
        xmp_path = f"{user_id}/{preset_id}/preset.xmp"
        try:
            supabase.storage.from_("presets").upload(
                path=xmp_path,
                file=xmp_data,
                file_options={"content-type": "application/xml"}
            )
            
            # Verify XMP was uploaded
            try:
                xmp_files = supabase.storage.from_("presets").list(f"{user_id}/{preset_id}")
                print(f"XMP files after upload: {xmp_files}")
                if not xmp_files:
                    print("WARNING: XMP upload verification failed - no files found")
            except Exception as verify_err:
                print(f"Error verifying XMP upload: {verify_err}")
                
        except Exception as xmp_err:
            print(f"Error uploading XMP: {xmp_err}")
            raise
        
        # Get the public URL for the XMP file
        xmp_url = supabase.storage.from_("presets").get_public_url(xmp_path)
        print(f"XMP file uploaded successfully, URL: {xmp_url}")
        
        # Store metadata in the database
        preset_data = {
            "id": preset_id,
            "user_id": user_id,
            "name": original_filename.rsplit('.', 1)[0] if '.' in original_filename else original_filename,
            "image_url": image_url,
            "xmp_url": xmp_url,
            "metadata": json.dumps(metadata) if not isinstance(metadata, str) else metadata,
            "created_at": "now()",
            "purchased": False,
            "original_filename": original_filename
        }
        
        print(f"Storing preset data in Supabase database")
        try:
            insert_response = supabase.table("presets").insert(preset_data).execute()
            print(f"Insert response: {insert_response}")
            print(f"Insert data: {insert_response.data if hasattr(insert_response, 'data') else 'No data'}")
            
            # Verify the preset was inserted by querying it back
            verify_response = supabase.table("presets").select("*").eq("id", preset_id).execute()
            print(f"Verification query response: {verify_response}")
            print(f"Verification data: {verify_response.data}")
            
            if not verify_response.data or len(verify_response.data) == 0:
                print(f"WARNING: Preset {preset_id} was not found after insertion!")
                # Try to insert again with a delay
                time.sleep(1)
                retry_insert = supabase.table("presets").insert(preset_data).execute()
                print(f"Retry insert response: {retry_insert}")
                
                # Verify again
                retry_verify = supabase.table("presets").select("*").eq("id", preset_id).execute()
                if not retry_verify.data or len(retry_verify.data) == 0:
                    raise ValueError(f"Failed to store preset in database after retry")
            
            # Return the preset ID on success
            return preset_id
            
        except Exception as db_error:
            print(f"Database error during preset insertion: {db_error}")
            import traceback
            traceback.print_exc()
            raise
    
    except Exception as e:
        print(f"Error storing preset in Supabase: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_preset(preset_id):
    """Get a preset by ID"""
    print(f"Getting preset from Supabase: {preset_id}")
    
    try:
        # Query the database first to get the user_id
        response = supabase.table("presets").select("*").eq("id", preset_id).execute()
        
        print(f"Supabase response: {response}")
        print(f"Response data: {response.data}")
        
        if response.data and len(response.data) > 0:
            preset_data = response.data[0]
            
            # Check if the preset exists in storage with the correct path
            user_id = preset_data.get('user_id', 'anonymous')
            try:
                image_path = f"{user_id}/{preset_id}"
                image_exists = supabase.storage.from_("images").list(image_path)
                print(f"Storage check for preset images at path {image_path}: {image_exists}")
            except Exception as storage_err:
                print(f"Error checking storage for preset images: {storage_err}")
            
            return preset_data
        else:
            print(f"Preset not found in Supabase: {preset_id}")
            
            # Try a broader search to see if the preset exists with a different ID
            try:
                all_presets = supabase.table("presets").select("id").limit(10).execute()
                print(f"Available preset IDs: {[p.get('id') for p in all_presets.data if all_presets.data]}")
            except Exception as list_err:
                print(f"Error listing presets: {list_err}")
                
            return None
    
    except Exception as e:
        print(f"Error getting preset from Supabase: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_image_url(preset_id):
    """Get the public URL for a preset image"""
    print(f"Getting image URL for preset: {preset_id}")
    
    try:
        # Query the database to get the preset
        response = supabase.table("presets").select("image_url").eq("id", preset_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0].get('image_url')
        
        # If not found in database, try to construct the URL
        image_path = f"{preset_id}/image.jpg"
        try:
            return supabase.storage.from_("images").get_public_url(image_path)
        except Exception as e:
            print(f"Error getting public URL for image: {e}")
            return None
    
    except Exception as e:
        print(f"Error getting image URL: {e}")
        return None

def get_signed_xmp_url(preset_id):
    """
    Get a signed URL for a preset XMP file
    
    Args:
        preset_id: ID of the preset
        
    Returns:
        Signed URL for the XMP file
    """
    try:
        # Get the preset to find the user_id
        preset = get_preset(preset_id)
        if not preset:
            print(f"Preset not found: {preset_id}")
            return None
            
        user_id = preset.get('user_id')
        if not user_id:
            print(f"User ID not found for preset: {preset_id}")
            return None
            
        # Generate a signed URL for the XMP file
        xmp_path = f"{user_id}/{preset_id}/preset.xmp"
        
        try:
            # Create a signed URL that expires in 1 hour (3600 seconds)
            signed_url = supabase.storage.from_("presets").create_signed_url(xmp_path, 3600)
            print(f"Generated signed URL for XMP file: {signed_url}")
            
            if isinstance(signed_url, dict) and 'signedURL' in signed_url:
                return signed_url['signedURL']
            else:
                print(f"Unexpected signed URL format: {signed_url}")
                return None
                
        except Exception as e:
            print(f"Error generating signed URL: {e}")
            
            # Try to check if the file exists
            try:
                files = supabase.storage.from_("presets").list(f"{user_id}/{preset_id}")
                print(f"Files in preset directory: {files}")
            except Exception as list_err:
                print(f"Error listing files: {list_err}")
                
            return None
            
    except Exception as e:
        print(f"Error getting signed XMP URL: {e}")
        return None

def mark_preset_as_purchased(preset_id, session_id):
    """Mark a preset as purchased in Supabase"""
    try:
        supabase.table("presets").update({"purchased": True}).eq("id", preset_id).execute()
        
        # Optionally store the payment session ID
        if session_id:
            supabase.table("payments").insert({
                "preset_id": preset_id,
                "session_id": session_id,
                "created_at": "now()"
            }).execute()
        
        return True
    
    except Exception as e:
        print(f"Error marking preset as purchased: {e}")
        return False

def get_user_presets(user_id):
    """Get all presets for a user"""
    try:
        print(f"Fetching presets for user: {user_id}")
        response = supabase.table("presets").select("*").eq("user_id", user_id).execute()
        
        print(f"Supabase response: {response}")
        print(f"Response data type: {type(response.data)}")
        print(f"Response data length: {len(response.data) if response.data else 0}")
        
        if response.data:
            print(f"First preset: {response.data[0] if response.data else None}")
            return response.data
        else:
            print("No presets found for user")
            return []
    
    except Exception as e:
        print(f"Error getting user presets: {e}")
        return []

def store_user(user_id, user_info):
    """Store or update user information in Supabase"""
    try:
        supabase = get_supabase_client()
        
        # Check if user exists
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        user_data = {
            "id": user_id,
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
            "last_login": "now()"
        }
        
        if response.data and len(response.data) > 0:
            # Update existing user
            supabase.table("users").update(user_data).eq("id", user_id).execute()
        else:
            # Insert new user
            user_data["created_at"] = "now()"
            supabase.table("users").insert(user_data).execute()
        
        return True
    
    except Exception as e:
        print(f"Error storing user in Supabase: {e}")
        return False

def delete_preset(preset_id, user_id):
    """Delete a preset from Supabase storage and database"""
    try:
        # First get the preset to verify ownership and get paths
        preset = get_preset(preset_id)
        if not preset:
            print(f"Preset {preset_id} not found")
            return False
            
        if preset['user_id'] != user_id:
            print(f"User {user_id} does not own preset {preset_id}")
            return False
            
        # Delete image from storage
        try:
            supabase.storage.from_("images").remove([f"{user_id}/{preset_id}/image.jpg"])
        except Exception as e:
            print(f"Error deleting image: {e}")
            
        # Delete XMP from storage
        try:
            supabase.storage.from_("presets").remove([f"{user_id}/{preset_id}/preset.xmp"])
        except Exception as e:
            print(f"Error deleting XMP: {e}")
            
        # Delete from database
        result = supabase.table("presets").delete().eq("id", preset_id).execute()
        print(f"Delete result: {result}")
        
        return True
        
    except Exception as e:
        print(f"Error deleting preset: {e}")
        return False