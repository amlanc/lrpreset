from flask import Flask, request, jsonify, send_file, Response, send_from_directory
from flask_cors import CORS
import os
import datetime
import uuid
from werkzeug.utils import secure_filename
import llm_handler
import xmp_generator
import auth
import payment
import supabase_client
import json
from dotenv import load_dotenv
import requests
from urllib.parse import quote_plus
import sys
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
app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Allow all origins for development
# This is not needed for production since frontend and backend are served from the same origin
# but we keep it for development flexibility
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = 'uploads'
PRESET_FOLDER = 'presets'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PRESET_FOLDER'] = PRESET_FOLDER

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

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the frontend directory"""
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
        print(f"Auth header: {auth_header[:20] + '...' if auth_header and len(auth_header) > 20 else auth_header}")
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No authentication token provided'}), 401
            
        id_token = auth_header.split(' ')[1]
        print(f"Token length: {len(id_token)}")
        
        try:
            # Use PyJWT to decode and verify the token
            import jwt
            import time
            
            # For now, we're just decoding without verification
            # In production, you should verify the signature with Google's public keys
            token_parts = id_token.split('.')
            print(f"Token parts: {len(token_parts)}")
            
            if len(token_parts) != 3:
                raise ValueError('Invalid token format')
                
            # Decode the token without verification for now
            payload = jwt.decode(id_token, options={"verify_signature": False})
            print(f"Decoded payload: {payload.keys()}")
            
            # Check if token is expired
            current_time = int(time.time())
            if 'exp' in payload and current_time > payload['exp']:
                print(f"Token expired: {payload['exp']} < {current_time}")
                raise ValueError('Token expired')
                
            # Add the user ID to the request
            request.user_id = payload.get('sub')
            if not request.user_id:
                print("No user ID in token")
                raise ValueError('No user ID in token')
                
            print(f"Authentication successful for user: {request.user_id}")
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Auth error: {str(e)}")
            return jsonify({'error': 'Invalid authentication token'}), 401
            
    return decorated_function

@app.route('/upload', methods=['POST'])
@require_auth
def upload_image():
    """
    Handle image upload, process with LLM, and store the preset
    """
    print("Upload endpoint called")
    print("Request files:", request.files)
    print("Request form:", request.form)
    
    try:
        # Get user ID from the authenticated request
        user_id = request.user_id
        
        # Check if the post request has the file part
        if 'image' not in request.files:
            print("No image part in request")
            return jsonify({'error': 'No image part'}), 400
        
        file = request.files['image']
        print("File object:", file)
        print("File name:", file.filename)
        print("File content type:", file.content_type)
        
        # If user does not select file, browser also
        # submit an empty part without filename
        if file.filename == '':
            print("No selected file")
            return jsonify({'error': 'No selected file'}), 400
        
        # Check if the file is allowed
        if not allowed_file(file.filename):
            print("Invalid file type")
            return jsonify({'error': 'Invalid file type. Please upload a JPG, PNG or WebP image'}), 400
        
        # Generate a unique ID for this preset
        preset_id = str(uuid.uuid4())
        print(f"Generated preset ID: {preset_id}")
        
        # Read the image data directly from the uploaded file
        image_data = file.read()
        print(f"Read {len(image_data)} bytes of image data")
        
        # Process the image with the LLM directly using the image data
        print(f"Processing image with LLM")
        metadata = llm_handler.generate_preset_from_image(image_data)
        
        if not metadata:
            return jsonify({'error': 'Failed to process image with LLM'}), 500
        
        print("Metadata extracted successfully:", metadata)
        
        # 2. Generate XMP file
        print("Generating XMP file...")
        xmp_content = xmp_generator.generate_xmp(metadata)
        
        if not xmp_content:
            return jsonify({'error': 'Failed to generate XMP file'}), 500
        
        print("XMP generated successfully, length:", len(xmp_content))
        
        # 3. Store in Supabase
        print("Storing in Supabase...")
        preset_id = supabase_client.store_preset(user_id, image_data, metadata, xmp_content, original_filename=file.filename)
        
        if not preset_id:
            # Check if we have a service role key available
            if not os.environ.get("SUPABASE_SERVICE_KEY"):
                return jsonify({
                    'error': 'Failed to store preset. This may be due to Row-Level Security (RLS) restrictions. Please add a SUPABASE_SERVICE_KEY to bypass RLS.'
                }), 500
            else:
                return jsonify({
                    'error': 'Failed to store preset despite using service role key. Check Supabase logs for details.'
                }), 500
        
        # Get the image URL
        image_url = supabase_client.get_image_url(preset_id)
        
        # Return the preset ID and image URL
        response_data = {
            'preset_id': preset_id,
            'image_url': image_url,
            'preset_data': metadata
        }
        print(f"Returning response: {response_data}")
        return jsonify(response_data)
        
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

@app.route('/preset/<preset_id>/download', methods=['GET'])
def download_preset(preset_id):
    """Download a preset XMP file after verifying purchase"""
    print(f"Download request for preset: {preset_id}")
    
    # Get user ID from request
    user_id = request.args.get('user_id', 'anonymous')
    print(f"User ID: {user_id}")
    
    # Get the preset from Supabase
    preset = supabase_client.get_preset(preset_id)
    if not preset:
        print(f"Preset not found: {preset_id}")
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

@app.route('/presets', methods=['GET'])
@require_auth
def get_presets():
    """Get all presets for the authenticated user"""
    print(f"Getting presets for authenticated user: {request.user_id}")
    presets = supabase_client.get_user_presets(request.user_id)
    print(f"Supabase response: {presets}")
    
    # Make sure we're returning a list, even if Supabase returns None
    if presets is None:
        presets = []
    
    # Explicitly create a dictionary with the presets key
    response_data = {"presets": presets}
    
    # Debug the response structure
    print(f"Response data type: {type(response_data)}")
    print(f"Response data: {response_data}")
    
    # Return the response
    return jsonify(response_data), 200

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
        # This is just a placeholder for now
        
        # Return the tokens and user info
        return jsonify({
            'tokens': tokens,
            'user': user_info
        })
    except Exception as e:
        print(f"Error in Google callback: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({"status": "success", "message": "Backend is running"}), 200

@app.route('/preset/<preset_id>', methods=['DELETE'])
def delete_preset(preset_id):
    """Delete a preset and its associated files"""
    try:
        # Get the preset first to verify it exists
        preset = supabase_client.get_preset(preset_id)
        if not preset:
            return jsonify({'error': 'Preset not found'}), 404
            
        # Delete the preset and all associated files
        success = supabase_client.delete_preset(preset_id, preset['user_id'])
        
        if success:
            # Delete the original uploaded image if it exists
            upload_path = os.path.join('uploads', preset_id)
            if os.path.exists(upload_path):
                try:
                    import shutil
                    shutil.rmtree(upload_path)
                except Exception as e:
                    print(f"Error deleting upload directory: {e}")
            
            return jsonify({'message': 'Preset deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete preset'}), 500
            
    except Exception as e:
        print(f"Error deleting preset: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/preset/<preset_id>', methods=['GET'])
def get_preset(preset_id):
    """Get a preset by ID"""
    print(f"Getting preset: {preset_id}")
    
    # Get user ID from request
    user_id = request.args.get('user_id', 'anonymous')
    print(f"User ID: {user_id}")
    
    # Get the preset from Supabase
    preset = supabase_client.get_preset(preset_id)
    
    if not preset:
        print(f"Preset not found: {preset_id}")
        return jsonify({'error': 'Preset not found'}), 404
    
    print(f"Preset found: {preset}")
    
    # Return the preset data
    return jsonify(preset), 200

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
def proxy_supabase_image():
    """Proxy for Supabase images to avoid CORS issues"""
    image_url = request.args.get('url')
    print(f"Proxying Supabase image: {image_url}")
    
    if not image_url:
        print(f"Invalid image URL: {image_url}")
        return jsonify({'error': 'Invalid image URL'}), 400
        
    try:
        # Extract the bucket and path from the URL
        # URL format: https://azdohxmxldahvebnkekd.supabase.co/storage/v1/object/public/images/user_id/preset_id/image.jpg
        parts = image_url.split('/storage/v1/object/public/')
        if len(parts) != 2:
            return jsonify({'error': 'Invalid Supabase URL format'}), 400
            
        bucket_path = parts[1]
        if '?' in bucket_path:
            bucket_path = bucket_path.split('?')[0]
            
        # Add authorization header with service key
        headers = {
            'Authorization': f'Bearer {os.environ.get("SUPABASE_SERVICE_KEY")}',
            'Accept': 'image/jpeg,image/png,image/*'
        }
        
        # Construct the private API URL
        base_url = 'https://azdohxmxldahvebnkekd.supabase.co'
        private_url = f"{base_url}/storage/v1/object/{bucket_path}"
        
        # Fetch the image from Supabase
        print(f"Fetching image from: {private_url}")
        response = requests.get(private_url, headers=headers, stream=True)
        
        if not response.ok:
            print(f"Failed to fetch image: {response.status_code}, {response.text}")
            return jsonify({'error': f'Failed to fetch image: {response.status_code}'}), response.status_code
        
        # Get the content type from the response
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        print(f"Image content type: {content_type}")
        
        # Create a Flask response with the image data
        proxy_response = Response(response.content, content_type=content_type)
        
        # Add cache headers (cache for 24 hours)
        proxy_response.headers['Cache-Control'] = 'public, max-age=86400'
        
        return proxy_response
    
    except Exception as e:
        print(f"Error proxying Supabase image: {e}")
        return jsonify({'error': f'Failed to proxy image: {str(e)}'}), 500

@app.route('/proxy/image', methods=['GET'])
def proxy_image():
    """Proxy for images to avoid CORS and Content Security Policy issues"""
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400
            
        print(f"Proxying image from: {url}")
        
        # Get the image
        response = requests.get(url, stream=True)
        if not response.ok:
            print(f"Failed to fetch image: {response.status_code}, {response.text}")
            return jsonify({'error': f'Failed to fetch image: {response.status_code}'}), response.status_code
            
        # Get content type from response or default to image/jpeg
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        
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
        print(f"Error proxying image: {str(e)}")
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

# Run the application
if __name__ == "__main__":
    # Run the app on port 8000
    print("Starting server on http://localhost:8000")
    app.run(debug=True, host='0.0.0.0', port=8000)
