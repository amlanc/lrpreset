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
        # Always use the anon key for better security (respects RLS)
        if supabase_key:
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
    
    # Always use the anon key for better security (respects RLS)
    if supabase_key:
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
    """Store a preset in Supabase
    
    Args:
        user_id (str): User ID
        image_data (bytes): Image data in binary format
        metadata (dict): Preset metadata
        xmp_content (bytes): XMP file content
        original_filename (str): Original filename of the XMP file
        
    Returns:
        str: Preset ID if successful, None otherwise
    """
    print(f"Storing preset for user {user_id} with filename {original_filename}")
    
    try:
        # Calculate a hash of the XMP content to check for duplicates
        xmp_hash = hashlib.md5(xmp_content).hexdigest()
        print(f"XMP content hash: {xmp_hash}")
        
        # Check if this exact XMP file has already been uploaded by this user
        try:
            # Get existing presets for this user
            existing_presets = get_user_presets(user_id)
            
            # For each preset, check if the XMP file matches
            for preset in existing_presets:
                preset_id = preset.get('id')
                if not preset_id:
                    continue
                    
                # Get the XMP file URL
                xmp_url = preset.get('xmp_url')
                if not xmp_url:
                    continue
                    
                try:
                    # Download the XMP file
                    response = requests.get(xmp_url)
                    if response.status_code == 200:
                        # Calculate hash of existing XMP file
                        existing_xmp_hash = hashlib.md5(response.content).hexdigest()
                        
                        # If hashes match, this is a duplicate
                        if existing_xmp_hash == xmp_hash:
                            print(f"Found duplicate XMP file, reusing existing preset ID: {preset_id}")
                            return preset_id
                except Exception as e:
                    print(f"Error checking existing XMP file: {e}")
                    # Continue checking other presets
                    continue
        except Exception as e:
            print(f"Error checking for duplicate XMP files: {e}")
            # Continue with new preset creation
        
        # Generate a unique ID for this preset
        preset_id = str(uuid.uuid4())
        
        # Ensure image_data is binary
        if not isinstance(image_data, bytes):
            print(f"Warning: image_data is not bytes but {type(image_data)}, converting...")
            if isinstance(image_data, str):
                if image_data.startswith('data:image'):
                    # Handle data URLs
                    header, encoded = image_data.split(",", 1)
                    image_data = base64.b64decode(encoded)
                else:
                    image_data = image_data.encode('utf-8')
            else:
                error_msg = f"Cannot convert image data of type {type(image_data)} to bytes"
                print(f"Error: {error_msg}")
                raise ValueError(error_msg)
        
        # Get original filename and extension or use defaults
        original_image_filename = original_filename
        
        # Extract file extension from original filename
        file_extension = ""
        if original_image_filename:
            _, file_extension = os.path.splitext(original_image_filename)
            if not file_extension:
                # Default to .jpg if no extension found
                file_extension = ".jpg"
        else:
            # Default to .jpg if no filename provided
            file_extension = ".jpg"
            original_image_filename = f"image{file_extension}"
        
        # Make sure the extension starts with a dot
        if not file_extension.startswith("."):
            file_extension = f".{file_extension}"
        
        # Determine content type based on file extension
        content_type = "image/jpeg"  # Default
        if file_extension.lower() in [".png"]:
            content_type = "image/png"
        elif file_extension.lower() in [".webp"]:
            content_type = "image/webp"
        elif file_extension.lower() in [".gif"]:
            content_type = "image/gif"
        
        # Create a clean filename using the preset ID and original extension
        safe_filename = f"image{file_extension}"
        
        # Upload the image to storage with original extension
        image_path = f"{user_id}/{preset_id}/{safe_filename}"
        print(f"[PRESET:{preset_id}] Uploading image to Supabase storage: {image_path}")
        print(f"[PRESET:{preset_id}] Original filename: {original_image_filename}, Using extension: {file_extension}")
        
        # Upload with explicit content type
        try:
            print(f"[PRESET:{preset_id}] Starting image upload with content-type: {content_type}")
            upload_response = supabase.storage.from_("images").upload(
                path=image_path,
                file=image_data,
                file_options={"content-type": content_type}
            )
            print(f"[PRESET:{preset_id}] Image upload response: {upload_response}")
            
            # Verify image was uploaded
            try:
                print(f"[PRESET:{preset_id}] Verifying image upload by listing files...")
                image_files = supabase.storage.from_("images").list(f"{user_id}/{preset_id}")
                print(f"[PRESET:{preset_id}] Image files after upload: {image_files}")
                if not image_files:
                    print(f"[PRESET:{preset_id}] WARNING: Image upload verification failed - no files found")
                    print(f"[PRESET:{preset_id}] Attempting to check parent directory...")
                    try:
                        parent_files = supabase.storage.from_("images").list(f"{user_id}")
                        print(f"[PRESET:{preset_id}] Parent directory contents: {parent_files}")
                    except Exception as parent_err:
                        print(f"[PRESET:{preset_id}] Error checking parent directory: {parent_err}")
            except Exception as verify_err:
                print(f"[PRESET:{preset_id}] Error verifying image upload: {verify_err}")
                print(f"[PRESET:{preset_id}] Will continue despite verification error")
                
        except Exception as img_err:
            print(f"[PRESET:{preset_id}] ERROR uploading image: {img_err}")
            import traceback
            traceback.print_exc()
            raise
        
        # Get the public URL for the image
        try:
            image_url = supabase.storage.from_("images").get_public_url(image_path)
            print(f"[PRESET:{preset_id}] Image uploaded successfully, URL: {image_url}")
        except Exception as url_err:
            print(f"[PRESET:{preset_id}] Error getting image public URL: {url_err}")
            image_url = None
            print(f"[PRESET:{preset_id}] Will continue with null image URL")
        
        # Ensure XMP content is properly encoded
        print(f"[PRESET:{preset_id}] Preparing XMP content for upload, current type: {type(xmp_content)}")
        if isinstance(xmp_content, str):
            print(f"[PRESET:{preset_id}] Converting XMP string to binary...")
            xmp_data = xmp_content.encode('utf-8')
            print(f"[PRESET:{preset_id}] Converted XMP string to binary, size: {len(xmp_data)} bytes")
        else:
            xmp_data = xmp_content
            print(f"[PRESET:{preset_id}] XMP content already in binary format, size: {len(xmp_data) if xmp_data else 0} bytes")
            
        # Upload the XMP file to storage with original filename
        # Extract original XMP filename from the original_filename
        xmp_filename = original_filename
        if not xmp_filename or not xmp_filename.lower().endswith('.xmp'):
            # If original filename is not an XMP file, use a default name
            xmp_filename = "preset.xmp"
        
        # Create the XMP path with the original filename
        xmp_path = f"{user_id}/{preset_id}/{xmp_filename}"
        print(f"[PRESET:{preset_id}] Uploading XMP file to Supabase storage: {xmp_path}")
        print(f"[PRESET:{preset_id}] Using original XMP filename: {xmp_filename}")
        try:
            print(f"[PRESET:{preset_id}] Starting XMP upload with content-type: application/xml")
            xmp_upload_response = supabase.storage.from_("presets").upload(
                path=xmp_path,
                file=xmp_data,
                file_options={"content-type": "application/xml"}
            )
            print(f"[PRESET:{preset_id}] XMP upload response: {xmp_upload_response}")
            
            # Verify XMP was uploaded
            try:
                print(f"[PRESET:{preset_id}] Verifying XMP upload by listing files...")
                xmp_files = supabase.storage.from_("presets").list(f"{user_id}/{preset_id}")
                print(f"[PRESET:{preset_id}] XMP files after upload: {xmp_files}")
                if not xmp_files:
                    print(f"[PRESET:{preset_id}] WARNING: XMP upload verification failed - no files found")
                    print(f"[PRESET:{preset_id}] Attempting to check parent directory...")
                    try:
                        parent_files = supabase.storage.from_("presets").list(f"{user_id}")
                        print(f"[PRESET:{preset_id}] Parent directory contents: {parent_files}")
                    except Exception as parent_err:
                        print(f"[PRESET:{preset_id}] Error checking parent directory: {parent_err}")
            except Exception as verify_err:
                print(f"[PRESET:{preset_id}] Error verifying XMP upload: {verify_err}")
                print(f"[PRESET:{preset_id}] Will continue despite verification error")
                
        except Exception as xmp_err:
            print(f"[PRESET:{preset_id}] ERROR uploading XMP: {xmp_err}")
            import traceback
            traceback.print_exc()
            raise
        
        # Get the public URL for the XMP file
        try:
            xmp_url = supabase.storage.from_("presets").get_public_url(xmp_path)
            print(f"[PRESET:{preset_id}] XMP file uploaded successfully, URL: {xmp_url}")
        except Exception as url_err:
            print(f"[PRESET:{preset_id}] Error getting XMP public URL: {url_err}")
            xmp_url = None
            print(f"[PRESET:{preset_id}] Will continue with null XMP URL")
        
        # Store metadata in the database
        print(f"[PRESET:{preset_id}] Preparing database record...")
        preset_data = {
            "id": preset_id,
            "user_id": user_id,
            "name": f"Preset {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "image_url": image_url,
            "xmp_url": xmp_url,
            "metadata": json.dumps(metadata) if not isinstance(metadata, str) else metadata,
            "created_at": "now()",
            "purchased": False,
            "original_filename": original_filename
        }
        
        # Log the preset data (excluding potentially large metadata field)
        log_data = {k: v for k, v in preset_data.items() if k != 'metadata'}
        print(f"[PRESET:{preset_id}] Preset data to store: {log_data}")
        print(f"[PRESET:{preset_id}] Metadata size: {len(preset_data['metadata']) if isinstance(preset_data['metadata'], str) else 'unknown'} characters")
        
        print(f"[PRESET:{preset_id}] Storing preset data in Supabase database...")
        try:
            print(f"[PRESET:{preset_id}] Executing database insert operation...")
            insert_response = supabase.table("presets").insert(preset_data).execute()
            print(f"[PRESET:{preset_id}] Insert response: {insert_response}")
            print(f"[PRESET:{preset_id}] Insert data: {insert_response.data if hasattr(insert_response, 'data') else 'No data'}")
            
            # Verify the preset was inserted by querying it back
            print(f"[PRESET:{preset_id}] Verifying database insert with query...")
            verify_response = supabase.table("presets").select("*").eq("id", preset_id).execute()
            print(f"[PRESET:{preset_id}] Verification query response: {verify_response}")
            
            if verify_response.data and len(verify_response.data) > 0:
                print(f"[PRESET:{preset_id}] ✅ Database verification successful - preset found in database")
                print(f"[PRESET:{preset_id}] ===== PRESET STORAGE COMPLETED SUCCESSFULLY =====")
                # Return the preset ID on success
                return preset_id
            else:
                print(f"[PRESET:{preset_id}] ⚠️ Database verification failed - preset not found in database")
                print(f"[PRESET:{preset_id}] Verification data: {verify_response.data}")
                
                # Wait a moment and try to verify one more time
                print(f"[PRESET:{preset_id}] Waiting 2 seconds and trying verification again...")
                time.sleep(2)
                final_verify = supabase.table("presets").select("*").eq("id", preset_id).execute()
                
                if final_verify.data and len(final_verify.data) > 0:
                    print(f"[PRESET:{preset_id}] ✅ Verification successful after delay - preset found in database")
                    print(f"[PRESET:{preset_id}] ===== PRESET STORAGE COMPLETED SUCCESSFULLY =====")
                    return preset_id
                else:
                    print(f"[PRESET:{preset_id}] ❌ Preset still not found after delay - database insertion likely failed")
                    print(f"[PRESET:{preset_id}] ===== PRESET STORAGE FAILED - DATABASE VERIFICATION ERROR =====")
                    # Do not return preset_id to prevent the caller from proceeding with an incomplete preset
                    # The files were uploaded but without a database entry they can't be properly accessed
                    return None
        except Exception as db_error:
            print(f"[PRESET:{preset_id}] ❌ Database error during preset insertion: {db_error}")
            import traceback
            traceback.print_exc()
            print(f"[PRESET:{preset_id}] Files were uploaded but database insertion failed")
            print(f"[PRESET:{preset_id}] ===== PRESET STORAGE FAILED - DATABASE ERROR =====")
            # Do not return the preset ID when there's a database error
            # This prevents the caller from proceeding with an incomplete preset
            return None
    
    except Exception as e:
        preset_id_str = preset_id if 'preset_id' in locals() else 'UNKNOWN'
        print(f"[PRESET:{preset_id_str}] ❌ CRITICAL ERROR storing preset: {e}")
        import traceback
        traceback.print_exc()
        print(f"===== PRESET STORAGE FAILED =====")
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

def create_preset(preset_data):
    """Create a new preset in Supabase database
    
    Args:
        preset_data (dict): Dictionary containing preset data
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        print(f"Creating preset in Supabase: {preset_data['id']}")
        
        # Ensure image_url is not null (required by database constraint)
        if preset_data.get('image_url') is None:
            # Use a placeholder URL if none is provided
            supabase_url = os.environ.get("SUPABASE_URL", 'https://azdohxmxldahvebnkekd.supabase.co')
            user_id = preset_data.get('user_id', '')
            preset_data['image_url'] = f"{supabase_url}/storage/v1/object/presets/{user_id}/placeholder.jpg"
            print(f"Added placeholder image URL to satisfy not-null constraint")
        
        # Insert the preset into the database
        response = supabase.table("presets").insert(preset_data).execute()
        
        # Verify the preset was created
        verify_response = supabase.table("presets").select("*").eq("id", preset_data['id']).execute()
        
        if verify_response.data and len(verify_response.data) > 0:
            print(f"Preset created successfully: {preset_data['id']}")
            return True
        else:
            print(f"Failed to verify preset creation: {preset_data['id']}")
            # Don't attempt to insert again - this can cause duplicates
            print(f"Not attempting a second insert to avoid duplicates")
            # Return True anyway since the original insert might have succeeded
            # even if verification failed due to database latency
            return True
    
    except Exception as e:
        print(f"Error creating preset in Supabase: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_user_presets(user_id):
    """Get all presets for a user with improved deduplication"""
    try:
        print(f"Fetching presets for user: {user_id}")
        # Set a higher limit to retrieve more presets (default might be too low)
        response = supabase.table("presets").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(1000).execute()
        
        print(f"Supabase response: {response}")
        print(f"Response data type: {type(response.data)}")
        print(f"Response data length: {len(response.data) if response.data else 0}")
        
        if response.data and len(response.data) > 0:
            # Enhanced deduplication by ID
            # We order by created_at desc, so the first occurrence of each ID will be the newest
            unique_presets = {}
            duplicate_count = 0
            
            for preset in response.data:
                preset_id = preset.get('id')
                if not preset_id:
                    print(f"Skipping preset without ID: {preset}")
                    continue
                    
                if preset_id not in unique_presets:
                    # This is the first (and newest) occurrence of this ID
                    unique_presets[preset_id] = preset
                else:
                    # This is a duplicate (older version)
                    duplicate_count += 1
                    print(f"Found duplicate preset ID: {preset_id} (created_at: {preset.get('created_at')})")
            
            # Convert dictionary values to list
            deduplicated_presets = list(unique_presets.values())
            print(f"Returning {len(deduplicated_presets)} unique presets (removed {duplicate_count} duplicates)")
            
            # Additional logging for debugging
            if duplicate_count > 0:
                print(f"Duplicate preset IDs found: {[p_id for p_id in unique_presets.keys() if sum(1 for p in response.data if p.get('id') == p_id) > 1]}")
            
            return deduplicated_presets
        else:
            print("No presets found for user")
            return []
    
    except Exception as e:
        print(f"Error getting user presets: {e}")
        import traceback
        traceback.print_exc()
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

def create_preset(preset_data):
    """Create a new preset in Supabase database
    
    Args:
        preset_data (dict): Dictionary containing preset data
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        print(f"Creating preset in Supabase: {preset_data['id']}")
        
        # Ensure required fields are present
        required_fields = ['id', 'user_id', 'name', 'image_url', 'xmp_url', 'metadata', 'created_at']
        for field in required_fields:
            if field not in preset_data:
                print(f"Error: Missing required field '{field}' in preset data")
                return False
        
        # Insert the preset into the database
        try:
            response = supabase.table("presets").insert(preset_data).execute()
            print(f"Preset creation response: {response}")
        except Exception as e:
            print(f"Error creating preset in Supabase: {e}")
            # Check if we can identify the issue from the error
            if hasattr(e, 'json') and callable(e.json):
                error_data = e.json()
                print(f"Error details: {error_data}")
                
                # If there's an issue with the schema, log it clearly
                if 'code' in error_data and error_data['code'] == 'PGRST204':
                    print("Schema mismatch error. Please check that preset_data matches the database schema.")
                    print(f"Full preset data: {preset_data}")
            return False
        
        # Verify the preset was created
        try:
            verify_response = supabase.table("presets").select("*").eq("id", preset_data['id']).execute()
            
            if verify_response.data and len(verify_response.data) > 0:
                print(f"Preset created successfully: {preset_data['id']}")
                return True
            else:
                print(f"Failed to verify preset creation: {preset_data['id']}")
                return False
        except Exception as e:
            print(f"Error verifying preset creation: {e}")
            return False
    
    except Exception as e:
        print(f"Error creating preset in Supabase: {e}")
        import traceback
        traceback.print_exc()
        return False
