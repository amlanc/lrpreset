from flask import Flask, request, jsonify, send_file, Response, send_from_directory, render_template
from flask_cors import CORS
import os
import datetime
import uuid
import base64
import hashlib
import time
from werkzeug.utils import secure_filename
import llm_handler
import xmp_generator
import auth
import payment
import supabase_client
import credit_system
import json
from dotenv import load_dotenv
import requests
from urllib.parse import quote_plus
import sys
import shutil
from functools import wraps

# Load environment variables - try multiple possible locations for .env
# First try the current directory
load_dotenv()

# If credentials not found, try parent directory (project root)
if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
    parent_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(parent_env_path):
        print(f"Loading environment from: {parent_env_path}")
        load_dotenv(parent_env_path)

# Initialize Flask app with frontend directory as static folder
app = Flask(__name__, static_folder='../frontend', static_url_path='', template_folder='../frontend')

# Allow all origins for development
# This is not needed for production since frontend and backend are served from the same origin
# but we keep it for development flexibility
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = 'uploads'
PRESET_FOLDER = 'presets'
THUMBNAIL_CACHE_FOLDER = 'thumbnail_cache'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PRESET_FOLDER'] = PRESET_FOLDER
app.config['THUMBNAIL_CACHE_FOLDER'] = THUMBNAIL_CACHE_FOLDER

# Create necessary directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PRESET_FOLDER, exist_ok=True)
os.makedirs(THUMBNAIL_CACHE_FOLDER, exist_ok=True)

# Initialize credit system tables
credit_system.initialize_credit_tables()

# Set maximum content length for file uploads (164MB)
app.config['MAX_CONTENT_LENGTH'] = 164 * 1024 * 1024

# Create necessary directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PRESET_FOLDER, exist_ok=True)

# Serve frontend files
@app.route('/')
def serve_frontend():
    """Serve the main index.html file"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/preset.html')
def serve_preset():
    """Serve the preset.html file with the preset ID"""
    preset_id = request.args.get('id')
    if not preset_id:
        return "Preset ID is required", 400
    return render_template('preset-detail.html', preset_id=preset_id)

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the frontend directory"""
    if path == 'preset.html':
        return serve_preset()
    return send_from_directory(app.static_folder, path)

@app.route('/google-callback')
def serve_google_callback():
    """Serve the Google callback page"""
    return send_from_directory(app.static_folder, 'google-callback.html')

def allowed_file(filename):
    allowed_extensions = {'jpg', 'jpeg', 'png', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def require_auth(f):
    """Decorator to require authentication for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the ID token from the Authorization header
        auth_header = request.headers.get('Authorization')
        # print(f"Auth header: {auth_header[:20] + '...' if auth_header and len(auth_header) > 20 else auth_header}")
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No authentication token provided'}), 401
            
        id_token = auth_header.split(' ')[1]
        
        try:
            # Use PyJWT to decode and verify the token
            import jwt
            import time
            
            # For now, we're just decoding without verification
            # In production, you should verify the signature with Google's public keys
            token_parts = id_token.split('.')

            
            if len(token_parts) != 3:
                raise ValueError('Invalid token format')
                
            # Decode the token without verification for now
            payload = jwt.decode(id_token, options={"verify_signature": False})

            
            # Check if token is expired
            current_time = int(time.time())
            if 'exp' in payload and current_time > payload['exp']:
                # Token expired
                raise ValueError('Token expired')
                
            # Add the user ID and email to the request
            request.user_id = payload.get('sub')
            request.user_email = payload.get('email')
            if not request.user_id:
                # No user ID in token
                raise ValueError('No user ID in token')
                
            # Authentication successful
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Auth error: {str(e)}")
            return jsonify({'error': 'Invalid authentication token'}), 401
            
    return decorated_function


def require_admin(f):
    """Decorator to require admin privileges for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # First check if user is authenticated (this should be handled by require_auth)
        if not hasattr(request, 'user_email'):
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check if the user is an admin
        try:
            if not credit_system.is_admin_user(request.user_email):
                return jsonify({'error': 'Admin privileges required'}), 403
                
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Admin authorization error: {e}")
            return jsonify({'error': 'Admin authorization failed', 'details': str(e)}), 403
            
    return decorated_function


@app.route('/api/user/is_admin', methods=['GET'])
@require_auth
def check_admin_status():
    """Check if the current user has admin privileges"""
    try:
        email = request.user_email
        is_admin = credit_system.is_admin_user(email)
        
        return jsonify({
            'is_admin': is_admin
        }), 200
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
@require_auth
def upload_image():
    """
    Handle image upload, process with LLM, and store the preset
    """
    # Upload endpoint called
    
    try:
        # Get user ID from the authenticated request
        user_id = request.user_id
        
        # Check if the post request has the file part
        if 'image' not in request.files:
            # No image part in request
            return jsonify({'error': 'No image part'}), 400
        
        file = request.files['image']
        # File information
        
        # If user does not select file, browser also
        # submit an empty part without filename
        if file.filename == '':
            # No selected file
            return jsonify({'error': 'No selected file'}), 400
        
        # Check if the file is allowed
        if not allowed_file(file.filename):
            # Invalid file type
            return jsonify({'error': 'Invalid file type. Please upload a JPG, PNG or WebP image'}), 400
        
        # Generate a unique ID for this preset
        preset_id = str(uuid.uuid4())
        # Generated preset ID
        
        # Read the image data directly from the uploaded file
        image_data = file.read()
        # Read image data
        
        # Process the image with the LLM directly using the image data
        # Processing image with LLM
        metadata = llm_handler.generate_preset_from_image(image_data)
        
        if not metadata:
            return jsonify({'error': 'Failed to process image with LLM'}), 500
        
        # Metadata extracted successfully
        
        # 2. Generate XMP file
        # Generating XMP file
        xmp_content = xmp_generator.generate_xmp(metadata)
        
        if not xmp_content:
            return jsonify({'error': 'Failed to generate XMP file'}), 500
        
        # XMP generated successfully
        
        # 3. Store in Supabase
        # Storing in Supabase
        # The store_preset function now returns None if there's a database error
        # This helps prevent duplicate uploads by not proceeding with incomplete presets
        preset_id = supabase_client.store_preset(user_id, image_data, metadata, xmp_content, original_filename=file.filename)
        
        if not preset_id:
            app.logger.error(f"Failed to store preset in database for user {user_id}")
            # Check if we have a service role key available
            if not os.environ.get("SUPABASE_SERVICE_KEY"):
                return jsonify({
                    'error': 'Failed to store preset in database. This may be due to Row-Level Security (RLS) restrictions. Please add a SUPABASE_SERVICE_KEY to bypass RLS.'
                }), 500
            else:
                return jsonify({
                    'error': 'Failed to store preset in database. The image files may have been uploaded, but the database entry could not be created. Please try again.'
                }), 500
        
        # Get the image URL
        image_url = supabase_client.get_image_url(preset_id)
        
        # Return the preset ID and image URL
        response_data = {
            'preset_id': preset_id,
            'image_url': image_url,
            'preset_data': metadata
        }
        # Returning response
        # Create response with CORS headers
        response = Response(
            json.dumps(response_data),
            mimetype='application/json'
        )
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
        return response
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/preset/<preset_id>/preview', methods=['GET'])
def get_preset_preview(preset_id):
    """Get a preview of the preset without purchasing"""
    print(f"Getting preset from Supabase: {preset_id}")
    preset = supabase_client.get_preset(preset_id)
    if not preset:
        return jsonify({'error': 'Preset not found'}), 404
    
    # Check if the preset exists in storage
    user_id = preset.get('user_id')
    if user_id:
        try:
            storage_path = f"{user_id}/{preset_id}"
            # Use the supabase client from the supabase_client module
            from backend.supabase_client import supabase
            storage_files = supabase.storage.from_("images").list(storage_path)
            print(f"Storage check for preset images at path {storage_path}: {storage_files}")
        except Exception as e:
            print(f"Error checking storage: {e}")
    
    # Return the full preset data
    return jsonify(preset), 200

@app.route('/preset/<preset_id>/checkout', methods=['POST'])
def create_checkout(preset_id):
    """Create a checkout session for purchasing a preset"""
    preset = supabase_client.get_preset(preset_id)
    if not preset:
        return jsonify({'error': 'Preset not found'}), 404
    
    # Get user ID from request
    user_id = request.json.get('user_id', 'anonymous')
    
    # Create Stripe checkout session
    checkout_data = payment.create_checkout_session(preset_id, user_id)
    
    if 'error' in checkout_data:
        return jsonify({'error': checkout_data['error']}), 400
    
    return jsonify(checkout_data), 200

@app.route('/api/presets/<preset_id>/download', methods=['GET'])
@require_auth
def download_preset(preset_id):
    """Download a preset XMP file after verifying purchase"""
    print(f"Download request for preset: {preset_id}")
    
    # Get user ID and email from the JWT token
    user_id = request.user_id
    user_email = request.user_email
    print(f"User ID from JWT: {user_id}, Email: {user_email}")
    
    # Check if this is a test account or admin user
    is_test = user_email and credit_system.is_test_account(user_email)
    is_admin = user_email and credit_system.is_admin_user(user_email)
    
    print(f"Is test account: {is_test}, Is admin: {is_admin}")
    
    # If not a test account or admin, check if the user has enough credits
    if not is_test and not is_admin:
        # Use a credit for this download
        success, error = credit_system.use_credit(user_id, user_email)
        if not success:
            return jsonify({
                'error': error or 'Insufficient credits',
                'credits_required': True
            }), 402  # 402 Payment Required
    
    # Get the preset from Supabase
    print(f"Getting preset from Supabase: {preset_id}")
    preset = supabase_client.get_preset(preset_id)
    
    # Debug: Check if preset exists and log available presets
    if not preset:
        print(f"Preset not found: {preset_id}")
        
        # Get all presets for debugging
        try:
            all_presets = supabase_client.get_all_presets()
            preset_ids = [p.get('id') for p in all_presets if p.get('id')]
            print(f"Available preset IDs: {preset_ids}")
            
            # Check if the requested preset ID is similar to any available IDs (typo check)
            for pid in preset_ids:
                if len(pid) == len(preset_id) and sum(a != b for a, b in zip(pid, preset_id)) <= 3:
                    print(f"Possible match found: {pid} is similar to requested {preset_id}")
        except Exception as e:
            print(f"Error getting all presets: {e}")
        return jsonify({'error': 'Preset not found'}), 404
    
    # For testing purposes, skip payment verification
    
    # Get a signed URL for the XMP file
    signed_xmp_url = supabase_client.get_signed_xmp_url(preset_id)
    print(f"Signed XMP URL: {signed_xmp_url}")
    
    # Check if the XMP file exists by making a HEAD request
    if signed_xmp_url:
        try:
            import requests
            response = requests.head(signed_xmp_url)
            if response.status_code != 200:
                print(f"XMP file not found at URL: {signed_xmp_url}, status code: {response.status_code}")
                signed_xmp_url = None
        except Exception as e:
            print(f"Error checking XMP URL: {e}")
            signed_xmp_url = None
    
    # If XMP URL is missing or file doesn't exist, generate a temporary XMP file
    if not signed_xmp_url:
        print("XMP URL missing or file not found, generating temporary XMP file")
        
        # Get metadata from the preset
        metadata_str = preset.get('metadata', '{}')
        try:
            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else metadata_str
        except:
            metadata = {}
        
        # Generate XMP content
        xmp_content = xmp_generator.generate_xmp(metadata)
        
        # Create a temporary file
        import tempfile
        import os
        
        temp_dir = tempfile.gettempdir()
        temp_xmp_path = os.path.join(temp_dir, f"preset_{preset_id}.xmp")
        
        with open(temp_xmp_path, 'w') as f:
            f.write(xmp_content)
        
        # Return the file as an attachment
        return send_file(
            temp_xmp_path,
            as_attachment=True,
            download_name=f"preset_{preset_id}.xmp",
            mimetype="application/xml"
        )
    
    # Instead of returning the signed URL, return a proxy URL
    proxy_url = f"/proxy/xmp-file?url={quote_plus(signed_xmp_url)}"
    
    # Return the proxy URL
    return jsonify({
        'xmp_url': proxy_url,
        'direct_url': signed_xmp_url  # Include the direct URL as well for debugging
    }), 200

@app.route('/user/<user_id>/presets', methods=['GET'])
def get_user_presets(user_id):
    """Get all presets for a user"""
    presets = supabase_client.get_user_presets(user_id)
    return jsonify(presets), 200

@app.route('/api/presets/user', methods=['GET'])
@require_auth
def get_presets():
    """Get all presets for the authenticated user"""
    print(f"Getting presets for authenticated user: {request.user_id}")
    presets = supabase_client.get_user_presets(request.user_id)
    print(f"Supabase response: {presets}")
    
    # Make sure we're returning a list, even if Supabase returns None
    if presets is None:
        presets = []
    
    # Return the presets in a consistent format with a 'presets' key
    # This ensures the frontend always receives data in the same structure
    app.logger.info(f"Returning {len(presets)} presets for user {request.user_id}")
    return jsonify({"presets": presets}), 200

@app.route('/api/presets/latest', methods=['GET'])
@require_auth
def get_latest_preset():
    """Get the most recent preset for the authenticated user"""
    # Getting latest preset for authenticated user
    presets = supabase_client.get_user_presets(request.user_id)
    
    if not presets or len(presets) == 0:
        # No presets found for user
        return jsonify({"error": "No presets found for user"}), 404
    
    # Found presets for user
    
    # Sort presets by created_at in descending order (newest first)
    # First check if created_at exists, if not use id as fallback
    if presets[0].get('created_at'):
        sorted_presets = sorted(presets, key=lambda x: x.get('created_at', ''), reverse=True)
    else:
        # If no created_at field, assume the first preset is the latest
        sorted_presets = presets
    
    latest_preset = sorted_presets[0]
    # Latest preset identified
    
    # Ensure the preset has an id property
    if not latest_preset.get('id') and not latest_preset.get('preset_id'):
        # Warning: Latest preset has no id or preset_id property
        return jsonify({"error": "Invalid preset data"}), 500
    
    return jsonify(latest_preset), 200

@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events"""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    return payment.handle_webhook(payload, sig_header)

@app.route('/auth/google-callback', methods=['POST'])
def google_callback():
    """Handle Google OAuth callback"""
    try:
        # Get the authorization code from the request
        data = request.get_json()
        if not data or 'code' not in data:
            return jsonify({'error': 'No authorization code provided'}), 400
            
        code = data['code']
        
        # Exchange the code for tokens
        tokens, error = auth.exchange_code_for_tokens(code)
        if error:
            return jsonify({'error': f'Failed to exchange code: {error}'}), 400
            
        # Get the ID token
        id_token = tokens.get('id_token')
        if not id_token:
            return jsonify({'error': 'No ID token in response'}), 400
            
        # Get user info from the ID token
        user_info, error = auth.get_user_info_from_token(id_token)
        if error:
            return jsonify({'error': f'Failed to get user info: {error}'}), 400
            
        # Store the user in Supabase
        stored_user = supabase_client.store_user(user_info['id'], user_info)
        
        # Check if this is a new user and add initial credit if needed
        if stored_user and stored_user.get('is_new_user', False):
            credit_system.add_credits_for_new_user(user_info['id'], user_info.get('email'))
        
        # Get user's credit balance
        user_credits = credit_system.get_user_credits(user_info['id'])
        is_test_account = user_info.get('email') and credit_system.is_test_account(user_info.get('email'))
        
        # Return the tokens, user info, and credit information
        return jsonify({
            'tokens': tokens,
            'user': user_info,
            'credits': {
                'balance': user_credits.get('credits_balance', 0) if user_credits else 0,
                'is_test_account': is_test_account
            }
        })
    except Exception as e:
        print(f"Error in Google callback: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({"status": "success", "message": "Backend is running"}), 200



@app.route('/api/presets/<preset_id>', methods=['GET', 'DELETE'])
@require_auth
def preset_endpoint(preset_id):
    """Handle GET and DELETE operations for a preset"""
    try:
        # Get the preset first to verify it exists and check ownership
        preset = supabase_client.get_preset(preset_id)
        if not preset:
            return jsonify({'error': 'Preset not found'}), 404
            
        # For both GET and DELETE, verify the user owns this preset
        if preset['user_id'] != request.user_id:
            return jsonify({'error': 'Unauthorized'}), 403
            
        if request.method == 'DELETE':
            # Delete the preset and all associated files
            success = supabase_client.delete_preset(preset_id, request.user_id)
            
            if success:
                return jsonify({'message': 'Preset deleted successfully'}), 200
            else:
                return jsonify({'error': 'Failed to delete preset'}), 500
        
        # GET method - retrieve preset details
        # Extract preset data from the database record
        metadata_str = preset.get('metadata', '{}')
        try:
            preset_data = json.loads(metadata_str) if isinstance(metadata_str, str) else metadata_str
        except Exception as e:
            print(f"Error parsing preset metadata: {e}")
            preset_data = {}
        
        # Get the image URL
        image_url = supabase_client.get_image_url(preset_id)
        
        # Return the preset data
        response = {
            'preset_id': preset_id,
            'image_url': image_url,
            'preset_data': preset_data,
            'file_name': preset.get('file_name', ''),
            'name': preset_data.get('name', ''),
            'created_at': preset.get('created_at', '')
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        print(f"Error in preset endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/config', methods=['GET'])
def get_config():
    """Get public configuration values"""
    backend_url = os.environ.get('BACKEND_URL', 'http://localhost:8000')
    return jsonify({
        'googleClientId': os.environ.get('GOOGLE_CLIENT_ID'),
        'env': os.environ.get('FLASK_ENV', 'development'),
        'backendUrl': backend_url
    }), 200

# Add a route to proxy Google profile images
@app.route('/proxy/profile-image', methods=['GET'])
def proxy_profile_image():
    """
    Proxy for Google profile images to avoid rate limiting.
    The URL is passed as a query parameter 'url'.
    """
    try:
        image_url = request.args.get('url')
        if not image_url:
            return jsonify({'error': 'No URL provided'}), 400
            
        # Only allow Google URLs
        if not image_url.startswith('https://lh3.googleusercontent.com/'):
            return jsonify({'error': 'Only Google profile images are allowed'}), 400
            
        # Fetch the image
        response = requests.get(image_url, stream=True)
        
        if response.status_code != 200:
            return jsonify({'error': f'Failed to fetch image: {response.status_code}'}), response.status_code
            
        # Return the image with appropriate headers
        return Response(
            response.content, 
            mimetype=response.headers.get('Content-Type', 'image/jpeg'),
            headers={
                'Cache-Control': 'public, max-age=86400',  # Cache for 24 hours
                'Pragma': 'cache'
            }
        )
    except Exception as e:
        print(f"Error proxying profile image: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/proxy/supabase-image', methods=['GET'])
@require_auth
def proxy_supabase_image():
    """Proxy for Supabase images to avoid CORS issues with authentication"""
    image_url = request.args.get('url')
    user_id = request.user_id
    
    app.logger.info(f"Proxying Supabase image for user {user_id}: {image_url}")
    
    if not image_url:
        app.logger.error(f"Invalid image URL: {image_url}")
        return jsonify({'error': 'Invalid image URL'}), 400
        
    # Log that we're attempting to fetch this image
    app.logger.info(f"Attempting to fetch image from: {image_url}")
        
    try:
        # Check if this is a signed URL (contains token parameter)
        token = None
        if 'token=' in image_url and '?' in image_url:
            # Extract the token from the URL
            query_params = image_url.split('?')[1]
            params = {p.split('=')[0]: p.split('=')[1] for p in query_params.split('&') if '=' in p}
            token = params.get('token')
            app.logger.info(f"Found token in URL: {token[:10]}..." if token and len(token) > 10 else f"Found token in URL: {token}")
            
        # Clean up the URL by removing any query parameters
        clean_url = image_url.split('?')[0] if '?' in image_url else image_url
        app.logger.info(f"Cleaned Supabase URL: {clean_url}")
        
        # Extract the bucket and path from the URL
        # Handle all URL formats consistently
        if '/object/sign/' in clean_url:
            parts = clean_url.split('/storage/v1/object/sign/')
        elif '/object/public/' in clean_url:
            parts = clean_url.split('/storage/v1/object/public/')
        elif '/object/' in clean_url:
            parts = clean_url.split('/storage/v1/object/')
        else:
            app.logger.error(f"Invalid Supabase URL format: {clean_url}")
            return jsonify({'error': 'Invalid Supabase URL format'}), 400
            
        if len(parts) != 2:
            app.logger.error(f"Invalid Supabase URL format: {clean_url}")
            return jsonify({'error': 'Invalid Supabase URL format'}), 400
            
        bucket_path = parts[1]
        
        # Determine which bucket we're accessing
        bucket_parts = bucket_path.split('/')
        bucket_name = bucket_parts[0] if len(bucket_parts) > 0 else ''
        object_path = '/'.join(bucket_parts[1:]) if len(bucket_parts) > 1 else ''
        app.logger.info(f"Accessing bucket: {bucket_name}, object path: {object_path}")
        
        # Use the Supabase service key if available, otherwise use the anon key
        auth_token = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
        
        # Add authorization header with appropriate key
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Accept': 'image/jpeg,image/png,image/*',
            'User-Agent': 'Mozilla/5.0 LRPreset Image Proxy'
        }
        
        # Create a hash of the URL to use as the filename for caching
        url_hash = hashlib.md5(image_url.encode()).hexdigest()
        
        # Create user-specific cache directory if it doesn't exist
        user_cache_dir = os.path.join(app.config['THUMBNAIL_CACHE_FOLDER'], user_id) if user_id else app.config['THUMBNAIL_CACHE_FOLDER']
        os.makedirs(user_cache_dir, exist_ok=True)
        
        # Check if we have a cached version
        cache_path = os.path.join(user_cache_dir, f"{url_hash}.jpg")
        
        if os.path.exists(cache_path):
            app.logger.info(f"Serving cached image for: {image_url}")
            with open(cache_path, 'rb') as f:
                image_data = f.read()
                
            # Create a Flask response with the cached image data
            return Response(
                image_data,
                content_type='image/jpeg',
                headers={
                    'Cache-Control': 'public, max-age=31536000',  # Cache for 1 year
                    'Access-Control-Allow-Origin': '*'
                }
            )
        
        # Construct the API URL for all Supabase storage access
        base_url = os.environ.get("SUPABASE_URL", 'https://azdohxmxldahvebnkekd.supabase.co')
        
        # Use a consistent format for all URLs
        if '/object/sign/' in clean_url and token:
            # For signed URLs, we need to include the token
            api_url = f"{base_url}/storage/v1/object/sign/{bucket_name}/{object_path}?token={token}"
            app.logger.info(f"Using signed URL with token: {api_url}")
        # We don't use public URLs anymore
        # All URLs should be either signed or standard with auth headers
        else:
            # For regular URLs, use the standard format
            api_url = f"{base_url}/storage/v1/object/{bucket_name}/{object_path}"
            app.logger.info(f"Using standard URL: {api_url}")
        
        # Fetch the image from Supabase
        app.logger.info(f"Fetching image from Supabase API: {api_url}")
        response = requests.get(api_url, headers=headers, stream=True, timeout=10)
        
        if not response.ok:
            app.logger.error(f"Failed to fetch image: {response.status_code}, {response.text}")
            return jsonify({'error': f'Failed to fetch image: {response.status_code}'}), response.status_code
        
        # Get the content type from the response
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        app.logger.info(f"Image content type: {content_type}")
        
        # Save the image to the cache
        with open(cache_path, 'wb') as f:
            f.write(response.content)
            
        app.logger.info(f"Cached image at: {cache_path}")
        
        # Create a Flask response with the image data
        proxy_response = Response(
            response.content,
            content_type=content_type,
            headers={
                'Cache-Control': 'public, max-age=31536000',  # Cache for 1 year
                'Access-Control-Allow-Origin': '*'
            }
        )
        
        return proxy_response
    
    except Exception as e:
        app.logger.error(f"Error proxying Supabase image: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to proxy image: {str(e)}'}), 500

@app.route('/proxy/image', methods=['GET'])
def proxy_image():
    """Proxy for images to avoid CORS and Content Security Policy issues with local caching"""
    try:
        url = request.args.get('url')
        user_id = request.args.get('user_id')  # Get user_id from query params for caching
        
        if not url:
            return jsonify({'error': 'No URL provided'}), 400
            
        # Check if this is a base64 data URL
        if url.startswith('data:'):
            app.logger.info(f"Detected base64 data URL, returning directly")
            # Parse the data URL
            try:
                # Extract content type and base64 data
                content_type = url.split(',')[0].split(':')[1].split(';')[0]
                base64_data = url.split(',')[1]
                # Decode the base64 data
                image_data = base64.b64decode(base64_data)
                
                # Return the decoded image data directly
                return Response(
                    image_data,
                    content_type=content_type,
                    headers={
                        'Cache-Control': 'public, max-age=31536000',  # Cache for 1 year
                        'Access-Control-Allow-Origin': '*'
                    }
                )
            except Exception as e:
                app.logger.error(f"Error processing base64 data URL: {str(e)}")
                return jsonify({'error': 'Invalid base64 data URL'}), 400
            
        # Clean up the URL - remove trailing question mark if present
        if url.endswith('?'):
            url = url[:-1]
            
        # Check if the URL is a Supabase URL and fix any issues
        if 'supabase' in url:
            app.logger.info(f"Processing Supabase URL: {url}")
            
            # For signed URLs, preserve the query parameters which contain the token
            if 'token=' in url:
                app.logger.info(f"Detected signed URL with token")
                # Keep the URL as is since it's a signed URL with a token
                pass
            else:
                # For non-signed URLs, remove query parameters that might cause issues
                if '?' in url and not url.endswith('?'):
                    url = url.split('?')[0]
                    app.logger.info(f"Removed query parameters from URL: {url}")
                
                # For Supabase URLs, if they contain 'public', remove it
                if '/storage/v1/object/public/' in url:
                    url = url.replace('/storage/v1/object/public/', '/storage/v1/object/')
                    app.logger.info(f"Removed 'public' from Supabase URL: {url}")
            
        # Create a hash of the URL to use as the filename
        url_hash = hashlib.md5(url.encode()).hexdigest()
        
        # Create user-specific cache directory if it doesn't exist
        user_cache_dir = os.path.join(app.config['THUMBNAIL_CACHE_FOLDER'], user_id) if user_id else app.config['THUMBNAIL_CACHE_FOLDER']
        os.makedirs(user_cache_dir, exist_ok=True)
        
        # Check if we have a cached version
        cache_path = os.path.join(user_cache_dir, f"{url_hash}.jpg")
        
        if os.path.exists(cache_path):
            print(f"Serving cached image for: {url}")
            with open(cache_path, 'rb') as f:
                image_data = f.read()
                
            # Create a Flask response with the cached image data
            return Response(
                image_data,
                content_type='image/jpeg',
                headers={
                    'Cache-Control': 'public, max-age=31536000',  # Cache for 1 year
                    'Access-Control-Allow-Origin': '*'
                }
            )
        
        print(f"Proxying image from: {url}")
        
        # Get the image with proper error handling
        try:
            # Add proper headers to avoid potential issues with Supabase
            headers = {
                'Accept': 'image/jpeg, image/png, image/webp, image/*',
                'User-Agent': 'Mozilla/5.0 LRPreset Image Proxy'
            }
            
            app.logger.info(f"Attempting to fetch image from: {url}")
            response = requests.get(url, stream=True, timeout=10, headers=headers)  # Add timeout for safety
            
            if not response.ok:
                app.logger.error(f"Failed to fetch image: {response.status_code}, {response.text}")
                
                # Log additional details for Supabase URLs to help with debugging
                if 'supabase' in url:
                    app.logger.error(f"Supabase URL failed: {url}")
                    # Check if URL has query parameters that might be causing issues
                    if '?' in url:
                        app.logger.info(f"URL contains query parameters which might be causing issues")
                    
                    # Log headers that might be helpful for debugging
                    app.logger.info(f"Response headers: {response.headers}")
                
                # Return the error directly without any fallbacks
                return jsonify({'error': f'Failed to fetch image: {response.status_code}'}), response.status_code
            
            # Get content type from response or default to image/jpeg
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            
            # Save the image to the cache
            with open(cache_path, 'wb') as f:
                f.write(response.content)
                
            print(f"Cached image at: {cache_path}")
            
            # Create a Flask response with the image data
            proxy_response = Response(
                response.content,
                content_type=content_type,
                headers={
                    'Cache-Control': 'public, max-age=31536000',  # Cache for 1 year
                    'Access-Control-Allow-Origin': '*'
                }
            )
            
            return proxy_response
            
        except requests.RequestException as e:
            print(f"Request error when proxying image: {str(e)}")
            return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 400
        
    except Exception as e:
        print(f"Error proxying image: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Dictionary to track recently processed requests to prevent duplicates
recent_requests = {}
# Maximum age of request IDs to keep in memory (in seconds)
REQUEST_ID_MAX_AGE = 300  # Increased to 5 minutes for better protection against duplicates

@app.route('/api/presets', methods=['POST'])
@require_auth
def create_preset():
    """Create a new preset from an XMP file"""
    try:
        print("Starting create_preset function")
        # Get user ID from the authenticated request
        user_id = request.user_id
        user_email = request.args.get('email') or request.user_email
        print(f"User ID: {user_id}, Email: {user_email}")
        
        # Check if user has sufficient credits
        is_test_account = user_email and credit_system.is_test_account(user_email)
        
        if not is_test_account:
            # Check if user has enough credits
            credit_result, error_message = credit_system.use_credit(user_id, user_email)
            if not credit_result:
                print(f"Insufficient credits for user {user_id}: {error_message}")
                return jsonify({
                    'error': 'Insufficient credits',
                    'message': error_message or 'You need at least 1 credit to create a preset. Please purchase more credits.',
                    'code': 'INSUFFICIENT_CREDITS'
                }), 402  # 402 Payment Required
        
        # Check for request ID in headers to prevent duplicate processing
        request_id = request.headers.get('X-Request-ID')
        if not request_id:
            # Generate a request ID if not provided
            request_id = str(uuid.uuid4())
            print(f"Generated request ID: {request_id}")
        else:
            print(f"Received request ID: {request_id}")
            
        # Check if this request was recently processed
        current_time = time.time()
        # Clean up old request IDs
        for req_id in list(recent_requests.keys()):
            if current_time - recent_requests[req_id]['timestamp'] > REQUEST_ID_MAX_AGE:
                del recent_requests[req_id]
                
        if request_id in recent_requests:
            print(f"Duplicate request detected with ID: {request_id}")
            # Return the cached response for this request ID
            cached_response = recent_requests[request_id]['response']
            print(f"Returning cached response: {cached_response}")
            return jsonify(cached_response), 200

        # Check if XMP file is provided
        if 'xmp_file' not in request.files:
            print("No XMP file in request")
            return jsonify({'error': 'No XMP file provided'}), 400

        xmp_file = request.files['xmp_file']
        print(f"XMP file name: {xmp_file.filename}")

        if xmp_file.filename == '':
            print("Empty XMP filename")
            return jsonify({'error': 'No XMP file selected'}), 400

        # Validate XMP file extension
        if not xmp_file.filename.lower().endswith('.xmp'):
            print(f"Invalid file extension: {xmp_file.filename}")
            return jsonify({'error': 'Invalid file type. Only XMP files are allowed.'}), 400

        # Read and validate XMP file content
        try:
            print("Reading XMP file content")
            xmp_content = xmp_file.read()
            print(f"XMP content length: {len(xmp_content)} bytes")

            # Check file size (10MB limit)
            max_size = 10 * 1024 * 1024  # 10MB in bytes
            if len(xmp_content) > max_size:
                print(f"XMP file too large: {len(xmp_content)} bytes")
                return jsonify({'error': f'XMP file size exceeds maximum allowed size of 10MB'}), 400

            # Validate XMP content
            print("Validating XMP content")
            xmp_text = xmp_content.decode('utf-8')
            if not xmp_text.strip():
                print("Empty XMP content")
                return jsonify({'error': 'XMP file is empty'}), 400
            if '<?xpacket' not in xmp_text:
                print("Invalid XMP format - missing <?xpacket tag")
                return jsonify({'error': 'Invalid XMP file format'}), 400
            print("XMP content validation successful")

            # Seek back to start of file for re-reading
            xmp_file.seek(0)
            xmp_content = xmp_file.read()
        except Exception as e:
            print(f"Error reading/validating XMP file: {str(e)}")
            return jsonify({'error': 'Failed to read or validate XMP file'}), 400
        except UnicodeDecodeError as e:
            print(f"XMP decode error: {str(e)}")
            return jsonify({'error': 'XMP file must be valid UTF-8 text'}), 400

        # Handle optional image file
        image_data = None
        if 'image' in request.files:
            image_file = request.files['image']
            print(f"Image file name: {image_file.filename}")

            if image_file.filename != '':
                # Validate image file
                if not allowed_file(image_file.filename):
                    print(f"Invalid image file type: {image_file.filename}")
                    return jsonify({'error': 'Invalid image file type. Allowed types are: jpg, jpeg, png, webp'}), 400

                try:
                    print("Reading image file content")
                    image_data = image_file.read()
                    print(f"Image content length: {len(image_data)} bytes")

                    if len(image_data) > max_size:
                        print(f"Image file too large: {len(image_data)} bytes")
                        return jsonify({'error': f'Image file size exceeds maximum allowed size of 10MB'}), 400
                except Exception as e:
                    print(f"Error reading image file: {str(e)}")
                    return jsonify({'error': 'Failed to read image file'}), 400

        # Get preset name from form data or use XMP filename
        preset_name = request.form.get('name')
        if not preset_name:
            preset_name = os.path.splitext(xmp_file.filename)[0]
        
        # Format the filename with timestamp
        current_time = datetime.datetime.now()
        timestamp = current_time.strftime("%Y_%m_%d_%H_%M")
        
        # Replace spaces with underscores in the preset name
        formatted_preset_name = preset_name.replace(' ', '_')
        
        # Create the final filename format: [Photograph_Name]_[YYYY]_[MM]_[DD]_[HH]_[MM].xmp
        formatted_filename = f"{formatted_preset_name}_{timestamp}.xmp"
        
        print(f"Original preset name: {preset_name}")
        print(f"Formatted filename: {formatted_filename}")

        # Store in Supabase
        try:
            print("Storing preset in Supabase")
            metadata = {
                'name': preset_name,
                'created_at': datetime.datetime.utcnow().isoformat(),
                'file_size': len(xmp_content),
                'has_image': image_data is not None,
                'file_name': formatted_filename,  # Use our new formatted filename
                'created_by': user_id,
                'type': 'xmp',
                'status': 'active'
            }
            print(f"Metadata: {metadata}")

            preset_id = supabase_client.store_preset(
                user_id=user_id,
                image_data=image_data,
                metadata=metadata,
                xmp_content=xmp_content,  # Use original binary content
                original_filename=xmp_file.filename
            )
            print(f"Successfully stored preset with ID: {preset_id}")

            if not preset_id:
                print("No preset ID returned from Supabase")
                return jsonify({'error': 'Failed to store preset - no ID returned'}), 500

            # Get the preset details from Supabase
            preset_data = supabase_client.get_preset(preset_id)
            if not preset_data:
                print("Failed to get preset data after creation")
                return jsonify({
                    'error': 'Failed to get preset data after creation'
                }), 500

            response_data = {
                'preset_id': preset_id,  # Use consistent key naming
                'preset_data': preset_data,
                'image_url': preset_data.get('image_url'),
                'message': 'Preset created successfully'
            }
            
            # Store the response in our tracking dictionary
            if request_id:
                recent_requests[request_id] = {
                    'timestamp': time.time(),
                    'response': response_data
                }
                print(f"Cached response for request ID: {request_id}")
            
            return jsonify(response_data), 201

        except Exception as e:
            print(f"Supabase storage error: {str(e)}")
            return jsonify({'error': f'Failed to store preset: {str(e)}'}), 500

    except Exception as e:
        print(f"Unexpected error in create_preset: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/proxy/xmp-file', methods=['GET'])
def proxy_xmp_file():
    """Proxy for XMP files to avoid CORS issues"""
    xmp_url = request.args.get('url')
    print(f"Proxying XMP file: {xmp_url}")
    
    if not xmp_url:
        return jsonify({'error': 'No URL provided'}), 400
        
    try:
        # Add authorization header if needed
        headers = {
            'Accept': 'application/xml,text/xml,*/*'
        }
        
        # Fetch the XMP file
        response = requests.get(xmp_url, headers=headers, stream=True)
        
        if not response.ok:
            print(f"Failed to fetch XMP file: {response.status_code}, {response.text}")
            return jsonify({'error': f'Failed to fetch XMP file: {response.status_code}'}), response.status_code
        
        # Get the content type from the response
        content_type = response.headers.get('Content-Type', 'application/xml')
        print(f"XMP content type: {content_type}")
        
        # Create a Flask response with the XMP data
        proxy_response = Response(
            response.content, 
            content_type=content_type,
            headers={
                'Content-Disposition': f'attachment; filename="preset.xmp"',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
        return proxy_response
        
    except Exception as e:
        print(f"Error proxying XMP file: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/presets/analyze', methods=['POST'])
@require_auth
def analyze_image():
    """Analyze an image and return adjustment parameters"""
    try:
        # Get user ID from the authenticated request
        user_id = request.user_id
        
        # Check for request ID in headers to prevent duplicate processing
        request_id = request.headers.get('X-Request-ID')
        if not request_id:
            # Generate a request ID if not provided
            request_id = str(uuid.uuid4())
            print(f"Generated request ID for analyze: {request_id}")
        else:
            print(f"Received request ID for analyze: {request_id}")
            
        # Check if this request was recently processed
        current_time = time.time()
        # Clean up old request IDs
        for req_id in list(recent_requests.keys()):
            if current_time - recent_requests[req_id]['timestamp'] > REQUEST_ID_MAX_AGE:
                del recent_requests[req_id]
                
        if request_id in recent_requests:
            print(f"Duplicate analyze request detected with ID: {request_id}")
            # Return the cached response for this request ID
            cached_response = recent_requests[request_id]['response']
            print(f"Returning cached analyze response for request ID: {request_id}")
            return jsonify(cached_response), 200
        
        # Check if the post request has the file part
        if 'image' not in request.files:
            app.logger.error(f"[User {user_id}] No image file in request")
            return jsonify({'error': 'Please select an image to upload'}), 400
        
        file = request.files['image']
        
        # If user does not select file, browser also submit an empty part without filename
        if file.filename == '':
            app.logger.error(f"[User {user_id}] Empty filename in request")
            return jsonify({'error': 'Please select an image to upload'}), 400
        
        # Check if the file is allowed
        if not allowed_file(file.filename):
            app.logger.error(f"[User {user_id}] Invalid file type: {file.filename}")
            return jsonify({'error': 'Please upload a JPG, PNG or WebP image'}), 400
        
        # Check file size (max 50MB for initial upload)
        file.seek(0, os.SEEK_END)
        size = file.tell()
        if size > 50 * 1024 * 1024:  # 50MB
            app.logger.error(f"[User {user_id}] File too large: {size} bytes")
            return jsonify({'error': 'Image size must be less than 50MB'}), 400
        
        # Log if the file is large but acceptable (will be resized later)
        if size > 10 * 1024 * 1024:  # 10MB
            app.logger.info(f"[User {user_id}] Large file detected: {size} bytes. Will be resized automatically.")
        
        # Reset file pointer
        file.seek(0)
        
        # Read the image data
        try:
            image_data = file.read()
            app.logger.info(f"[User {user_id}] Read {len(image_data)} bytes from {file.filename}")
        except Exception as e:
            app.logger.error(f"[User {user_id}] Failed to read image data: {str(e)}")
            return jsonify({'error': 'Failed to read image data'}), 500
        
        # Resize large images before processing
        if len(image_data) > 10 * 1024 * 1024:  # 10MB
            try:
                app.logger.info(f"[User {user_id}] Resizing large image before processing")
                image_data = llm_handler.resize_image_if_needed(image_data)
                app.logger.info(f"[User {user_id}] Image resized to {len(image_data)} bytes")
            except Exception as e:
                app.logger.error(f"[User {user_id}] Image resizing failed: {str(e)}")
                # Continue with original image if resizing fails
        
        # Process with LLM
        try:
            app.logger.info(f"[User {user_id}] Processing image with LLM")
            metadata = llm_handler.generate_preset_from_image(image_data)
            
            if not metadata:
                app.logger.error(f"[User {user_id}] LLM returned no metadata")
                return jsonify({'error': 'Failed to analyze image. Please try again.'}), 500
            
            app.logger.info(f"[User {user_id}] Successfully analyzed image")
            
            # Save the preset to the database
            try:
                # Generate a unique preset ID
                preset_id = str(uuid.uuid4())
                
                # Upload the image to Supabase storage first
                try:
                    image_path = f"{user_id}/{preset_id}/image.jpg"
                    app.logger.info(f"[User {user_id}] Uploading image to Supabase storage: {image_path}")
                    
                    # Upload with explicit content type
                    upload_response = supabase_client.supabase.storage.from_("images").upload(
                        path=image_path,
                        file=image_data,
                        file_options={"content-type": "image/jpeg"}
                    )
                    app.logger.info(f"[User {user_id}] Image upload successful")
                    
                    # Generate a signed URL for the image that expires in 24 hours
                    signed_url_response = supabase_client.supabase.storage.from_("images").create_signed_url(image_path, 86400)
                    if isinstance(signed_url_response, dict) and 'signedURL' in signed_url_response:
                        image_url = signed_url_response['signedURL']
                    else:
                        app.logger.error(f"[User {user_id}] Failed to generate signed URL: {signed_url_response}")
                        # Fallback to direct URL
                        image_url = supabase_client.supabase.storage.from_("images").get_public_url(image_path)
                        # Remove 'public' from URL if present
                        if '/object/public/' in image_url:
                            image_url = image_url.replace('/storage/v1/object/public/', '/storage/v1/object/')
                    # Remove any trailing question mark that might cause issues with proxying
                    if image_url.endswith('?'):
                        image_url = image_url[:-1]
                    app.logger.info(f"[User {user_id}] Image URL: {image_url}")
                except Exception as img_err:
                    app.logger.error(f"[User {user_id}] Failed to upload image: {str(img_err)}")
                        # Use a placeholder URL if upload fails
                    # This is a base64 encoded 1x1 transparent pixel
                    image_url = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                    app.logger.info(f"[User {user_id}] Using base64 placeholder image for preset {preset_id}")
                
                # Create a preset record
                # Generate a basic XMP file from metadata
                try:
                    # Generate XMP content using the xmp_generator module
                    xmp_content = xmp_generator.generate_xmp(metadata)
                    
                    # Get the original filename without extension
                    original_filename = os.path.splitext(file.filename)[0]
                    
                    # Log the preset ID we're using to ensure consistency
                    app.logger.info(f"[User {user_id}] Using preset ID: {preset_id} for all operations")
                    
                    # Create XMP file path using the original filename
                    xmp_path = f"{user_id}/{preset_id}/{original_filename}.xmp"
                    app.logger.info(f"[User {user_id}] Uploading XMP to Supabase storage: {xmp_path}")
                    
                    # Upload XMP file
                    upload_xmp_response = supabase_client.supabase.storage.from_("presets").upload(
                        path=xmp_path,
                        file=xmp_content.encode('utf-8'),
                        file_options={"content-type": "application/xml"}
                    )
                    app.logger.info(f"[User {user_id}] XMP upload successful")
                    
                    # Generate a signed URL for the XMP that expires in 24 hours
                    signed_url_response = supabase_client.supabase.storage.from_("presets").create_signed_url(xmp_path, 86400)
                    if isinstance(signed_url_response, dict) and 'signedURL' in signed_url_response:
                        xmp_url = signed_url_response['signedURL']
                    else:
                        app.logger.error(f"[User {user_id}] Failed to generate signed URL for XMP: {signed_url_response}")
                        # Fallback to direct URL
                        xmp_url = supabase_client.supabase.storage.from_("presets").get_public_url(xmp_path)
                        # Remove 'public' from URL if present
                        if '/object/public/' in xmp_url:
                            xmp_url = xmp_url.replace('/storage/v1/object/public/', '/storage/v1/object/')
                    # Remove any trailing question mark that might cause issues with proxying
                    if xmp_url.endswith('?'):
                        xmp_url = xmp_url[:-1]
                    app.logger.info(f"[User {user_id}] XMP URL: {xmp_url}")
                except Exception as xmp_err:
                    app.logger.error(f"[User {user_id}] Failed to upload XMP: {str(xmp_err)}")
                    # Create a simple placeholder XMP file if upload fails
                    try:
                        # Create a basic placeholder XMP file
                        placeholder_xmp = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<x:xmpmeta xmlns:x=\"adobe:ns:meta/\"/>\n"
                        placeholder_path = "placeholder.xmp"
                        
                        # Try to upload the placeholder if it doesn't exist
                        try:
                            # First check if the file exists
                            try:
                                # Try to get the file info - will throw an exception if it doesn't exist
                                # Get URL and remove 'public' if present
                                placeholder_url = supabase_client.supabase.storage.from_("presets").get_public_url(placeholder_path)
                                if '/object/public/' in placeholder_url:
                                    placeholder_url = placeholder_url.replace('/storage/v1/object/public/', '/storage/v1/object/')
                                placeholder_url
                                app.logger.info(f"[User {user_id}] Placeholder XMP already exists")
                            except Exception:
                                # File doesn't exist, so upload it
                                supabase_client.supabase.storage.from_("presets").upload(
                                    path=placeholder_path,
                                    file=placeholder_xmp.encode('utf-8'),
                                    file_options={"content-type": "application/xml"}
                                )
                                app.logger.info(f"[User {user_id}] Uploaded placeholder XMP")
                        except Exception as placeholder_err:
                            app.logger.warning(f"[User {user_id}] Failed to handle placeholder XMP: {str(placeholder_err)}")
                        
                        # Generate a signed URL for the placeholder XMP that expires in 24 hours
                        signed_url_response = supabase_client.supabase.storage.from_("presets").create_signed_url(placeholder_path, 86400)
                        if isinstance(signed_url_response, dict) and 'signedURL' in signed_url_response:
                            xmp_url = signed_url_response['signedURL']
                        else:
                            app.logger.error(f"[User {user_id}] Failed to generate signed URL for placeholder XMP: {signed_url_response}")
                            # Fallback to direct URL
                            xmp_url = supabase_client.supabase.storage.from_("presets").get_public_url(placeholder_path)
                            # Remove 'public' from URL if present
                            if '/object/public/' in xmp_url:
                                xmp_url = xmp_url.replace('/storage/v1/object/public/', '/storage/v1/object/')
                        # Remove any trailing question mark that might cause issues with proxying
                        if xmp_url.endswith('?'):
                            xmp_url = xmp_url[:-1]
                    except Exception as placeholder_err:
                        app.logger.error(f"[User {user_id}] Failed to create placeholder XMP: {str(placeholder_err)}")
                        # Last resort - hardcoded URL
                        xmp_url = "https://azdohxmxldahvebnkekd.supabase.co/storage/v1/object/presets/placeholder.xmp"
                
                preset_data = {
                    "id": preset_id,
                    "user_id": user_id,
                    "name": f"Preset {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    "metadata": json.dumps(metadata),
                    "created_at": datetime.datetime.now().isoformat(),
                    "image_url": image_url,  # Now we have an image URL
                    "xmp_url": xmp_url       # Add XMP URL to satisfy database constraint
                }
                
                # Save to database
                app.logger.info(f"[User {user_id}] Attempting to save preset with ID: {preset_id}")
                preset_saved = supabase_client.create_preset(preset_data)
                
                if preset_saved:
                    app.logger.info(f"[User {user_id}] Successfully saved preset with ID: {preset_id}")
                else:
                    app.logger.warning(f"[User {user_id}] Failed to save preset with ID: {preset_id} to database, but continuing")
                    # Log detailed preset data for debugging (excluding potentially large fields)
                    debug_data = {k: v for k, v in preset_data.items() if k not in ['metadata']}
                    app.logger.debug(f"Preset data that failed to save: {debug_data}")
                
                # Add preset_id to metadata response
                metadata["preset_id"] = preset_id
                metadata["saved_to_database"] = preset_saved
                
                # Store response in cache to prevent duplicate processing
                recent_requests[request_id] = {
                    'timestamp': time.time(),
                    'response': metadata
                }
                print(f"Stored analyze response in cache with request ID: {request_id}")
                
                return jsonify(metadata)
            except Exception as e:
                app.logger.error(f"[User {user_id}] Failed to save preset: {str(e)}")
                # Still return metadata with preset_id even if saving to database fails
                # Use the existing preset_id that was already generated at the beginning of the function
                metadata["preset_id"] = preset_id
                app.logger.info(f"[User {user_id}] Using existing preset ID: {preset_id}")
                
                # Store response in cache to prevent duplicate processing
                recent_requests[request_id] = {
                    'timestamp': time.time(),
                    'response': metadata
                }
                print(f"Stored analyze response in cache with request ID: {request_id} (after database save error)")
                
                return jsonify(metadata)
            
        except Exception as e:
            app.logger.error(f"[User {user_id}] LLM processing failed: {str(e)}")
            error_response = {'error': 'Failed to analyze image. Please try again.'}
            
            # Store error response in cache to prevent duplicate processing
            recent_requests[request_id] = {
                'timestamp': time.time(),
                'response': error_response
            }
            print(f"Stored error response in cache with request ID: {request_id} (LLM processing failed)")
            
            return jsonify(error_response), 500
        
    except Exception as e:
        app.logger.error(f"Unexpected error in analyze_image: {str(e)}")
        error_response = {'error': 'An unexpected error occurred. Please try again.'}
        
        # Only store in cache if request_id exists (might not exist if error occurred before request_id was set)
        if 'request_id' in locals():
            recent_requests[request_id] = {
                'timestamp': time.time(),
                'response': error_response
            }
            print(f"Stored error response in cache with request ID: {request_id} (unexpected error)")
        
        return jsonify(error_response), 500

# Credit system endpoints
@app.route('/api/credits', methods=['GET'])
@require_auth
def get_user_credit_balance():
    """Get the current credit balance for the authenticated user"""
    try:
        # Get user ID from request
        user_id = request.args.get('user_id')
        user_email = request.args.get('email')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
            
        # Check if this is a test account
        is_test_account = user_email and credit_system.is_test_account(user_email)
        
        if is_test_account:
            # Test accounts have unlimited credits
            return jsonify({
                'credits': {
                    'balance': 'unlimited',
                    'is_test_account': True
                }
            })
            
        # Get the user's credit balance
        user_credits = credit_system.get_user_credits(user_id)
        
        # If user has no credits, add the default credits for new users
        if user_credits and user_credits.get('credits_balance', 0) == 0:
            credit_system.add_credits_for_new_user(user_id, user_email)
            # Get updated credits
            user_credits = credit_system.get_user_credits(user_id)
        
        return jsonify({
            'credits': {
                'balance': user_credits.get('credits_balance', 0) if user_credits else 0,
                'total_earned': user_credits.get('total_credits_earned', 0) if user_credits else 0,
                'last_update': user_credits.get('last_credit_update', '') if user_credits else '',
                'is_test_account': False
            }
        })
    except Exception as e:
        print(f"Error getting credit balance: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/credits/add', methods=['GET'])
def add_user_credits():
    """Add credits for a specific user (development/testing only)"""
    try:
        # Get user ID from request
        user_id = request.args.get('user_id')
        user_email = request.args.get('email')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
            
        # Add credits for the user
        success = credit_system.add_credits_for_new_user(user_id, user_email)
        
        if success:
            # Get updated credits
            user_credits = credit_system.get_user_credits(user_id)
            
            return jsonify({
                'success': True,
                'message': 'Credits added successfully',
                'credits': {
                    'balance': user_credits.get('credits_balance', 0) if user_credits else 0,
                    'total_earned': user_credits.get('total_credits_earned', 0) if user_credits else 0,
                    'last_update': user_credits.get('last_credit_update', '') if user_credits else ''
                }
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to add credits'
            }), 500
    except Exception as e:
        print(f"Error adding credits: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/credits/purchase', methods=['POST'])
@require_auth
def purchase_credits():
    """Create a checkout session for purchasing credits"""
    try:
        # Get user ID and number of credit packs from request
        data = request.get_json()
        user_id = data.get('user_id')
        credit_packs = int(data.get('credit_packs', 1))
        success_url = data.get('success_url')
        cancel_url = data.get('cancel_url')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
            
        # Create a checkout session
        checkout_data = payment.create_credit_checkout_session(
            user_id, 
            credit_packs,
            success_url,
            cancel_url
        )
        
        if 'error' in checkout_data:
            return jsonify({'error': checkout_data['error']}), 400
            
        return jsonify(checkout_data), 200
    except Exception as e:
        print(f"Error creating credit purchase: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/credits/verify', methods=['GET'])
@require_auth
def verify_credit_purchase():
    """Verify a credit purchase"""
    try:
        # Get the session ID from the request
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400
            
        # Verify the payment
        success, _ = payment.verify_payment(session_id)
        
        if not success:
            return jsonify({'error': 'Payment verification failed'}), 400
            
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error verifying credit purchase: {e}")
        return jsonify({'error': str(e)}), 500

# Admin endpoints for test accounts
@app.route('/api/admin/test-accounts', methods=['GET'])
@require_auth
@require_admin
def get_test_accounts():
    """Get all test accounts (admin only)"""
    try:
        test_accounts = credit_system.get_all_test_accounts()
        
        return jsonify({'test_accounts': test_accounts})
    except Exception as e:
        print(f"Error getting test accounts: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/test-accounts', methods=['POST'])
@require_auth
@require_admin
def add_test_account():
    """Add a new test account (admin only)"""
    try:
        data = request.get_json()
        email = data.get('email')
        created_by = request.user_email
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        success = credit_system.add_test_account(email, created_by)
        
        if not success:
            return jsonify({'error': 'Failed to add test account'}), 500
            
        return jsonify({'success': True, 'message': f'Added {email} as a test account'}), 200
    except Exception as e:
        print(f"Error adding test account: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/test-accounts/<email>', methods=['DELETE'])
@require_auth
@require_admin
def remove_test_account(email):
    """Remove a test account (admin only)"""
    try:
        success = credit_system.remove_test_account(email)
        
        if not success:
            return jsonify({'error': 'Failed to remove test account'}), 500
            
        return jsonify({'success': True, 'message': f'Removed {email} from test accounts'}), 200
    except Exception as e:
        print(f"Error removing test account: {e}")
        return jsonify({'error': str(e)}), 500

# Admin endpoints for user management
@app.route('/api/admin/users', methods=['GET'])
@require_auth
@require_admin
def get_all_users():
    """Get all users with their information (admin only)"""
    try:
        include_credits = request.args.get('include_credits', 'true').lower() == 'true'
        users = credit_system.get_all_users(include_credits=include_credits)
        
        return jsonify({'users': users})
    except Exception as e:
        print(f"Error getting all users: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/credits', methods=['POST'])
@require_auth
@require_admin
def admin_add_user_credits(user_id):
    """Add credits to a user's account (admin only)"""
    try:
        data = request.get_json()
        if not data or 'credits_amount' not in data:
            return jsonify({'error': 'Credits amount is required'}), 400
            
        try:
            credits_amount = int(data['credits_amount'])
            if credits_amount <= 0:
                return jsonify({'error': 'Credits amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Credits amount must be a number'}), 400
            
        success = credit_system.admin_add_credits(user_id, credits_amount, request.user_email)
        if success:
            return jsonify({
                'success': True, 
                'message': f'Added {credits_amount} credits to user {user_id}'
            })
        else:
            return jsonify({'error': 'Failed to add credits'}), 500
    except Exception as e:
        print(f"Error adding admin credits: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/admins', methods=['POST'])
@require_auth
@require_admin
def add_admin_user():
    """Add a new admin user (admin only)"""
    try:
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({'error': 'Email is required'}), 400
            
        email = data['email']
        
        success = credit_system.add_admin_user(email, request.user_email)
        if success:
            return jsonify({'success': True, 'message': f'Added {email} as an admin user'})
        else:
            return jsonify({'error': 'Failed to add admin user'}), 500
    except Exception as e:
        print(f"Error adding admin user: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/admins/<email>', methods=['DELETE'])
@require_auth
@require_admin
def remove_admin_user(email):
    """Remove an admin user (admin only)"""
    try:
        success = credit_system.remove_admin_user(email)
        if success:
            return jsonify({'success': True, 'message': f'Removed {email} from admin users'})
        else:
            return jsonify({'error': 'Failed to remove admin user'}), 500
    except Exception as e:
        print(f"Error removing admin user: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/transactions', methods=['GET'])
@require_auth
@require_admin
def get_transaction_history():
    """Get transaction history for all users (admin only)"""
    try:
        try:
            days = int(request.args.get('days', '30'))
        except ValueError:
            days = 30
            
        transaction_type = request.args.get('type')
        
        transactions = credit_system.get_transaction_history(days, transaction_type)
        return jsonify({'transactions': transactions})
    except Exception as e:
        print(f"Error getting transaction history: {e}")
        return jsonify({'error': str(e)}), 500

# Run the application
if __name__ == "__main__":
    # Initialize credit system tables
    print("Initializing credit system...")
    credit_system.initialize_credit_tables()
    
    # Run the app on localhost:8000
    print("Starting server on http://localhost:8000")
    app.run(host='localhost', port=8000, debug=True)
