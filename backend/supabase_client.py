import os
import json
import base64
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv
import datetime

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_API_KEY")

print(f"Supabase URL: {supabase_url}")
print(f"Supabase Key: {supabase_key[:10]}..." if supabase_key else "None")

# Always use real Supabase
USE_REAL_SUPABASE = True
print(f"Using real Supabase: {USE_REAL_SUPABASE}")

# Initialize the client
supabase = None
if supabase_url and supabase_key:
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("Supabase client initialized successfully")
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        raise RuntimeError(f"Failed to initialize Supabase client: {e}")
else:
    raise ValueError("Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_API_KEY environment variables.")

# In-memory storage for users and presets (temporary until DB operations complete)
mock_users = {}
mock_presets = {}

def get_supabase_client() -> Client:
    """Get a Supabase client instance"""
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_API_KEY environment variables.")
    
    return create_client(supabase_url, supabase_key)

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

def store_preset(user_id, image_data, metadata, xmp_content):
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
        supabase.storage.from_("images").upload(
            path=image_path,
            file=image_data,
            file_options={"content-type": "image/jpeg"}
        )
        
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
        supabase.storage.from_("presets").upload(
            path=xmp_path,
            file=xmp_data,
            file_options={"content-type": "application/xml"}
        )
        
        # Get the public URL for the XMP file
        xmp_url = supabase.storage.from_("presets").get_public_url(xmp_path)
        print(f"XMP file uploaded successfully, URL: {xmp_url}")
        
        # Store metadata in the database
        preset_data = {
            "id": preset_id,
            "user_id": user_id,
            "image_url": image_url,
            "xmp_url": xmp_url,
            "metadata": json.dumps(metadata) if not isinstance(metadata, str) else metadata,
            "created_at": "now()",
            "purchased": False,
            "original_filename": f"preset_{preset_id}.xmp"  # Add original filename for better UX
        }
        
        print(f"Storing preset data in Supabase database")
        supabase.table("presets").insert(preset_data).execute()
        
        return preset_id
    
    except Exception as e:
        print(f"Error storing preset in Supabase: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_preset(preset_id):
    """Get a preset by ID"""
    print(f"Getting preset from Supabase: {preset_id}")
    
    try:
        response = supabase.table("presets").select("*").eq("id", preset_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        else:
            print(f"Preset not found in Supabase: {preset_id}")
            return None
    
    except Exception as e:
        print(f"Error getting preset from Supabase: {e}")
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
        response = supabase.table("presets").select("*").eq("user_id", user_id).execute()
        
        if response.data:
            return response.data
        else:
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