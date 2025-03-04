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

# Load environment variables from .env file
load_dotenv()

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

@app.route('/upload', methods=['POST'])
def upload_image():
    print("Upload endpoint called")
    print("Request files:", request.files)
    print("Request form:", request.form)

    if 'image' not in request.files:
        print("No image part in request")
        return jsonify({'error': 'No image part'}), 400

    file = request.files['image']
    print("File object:", file)
    print("File name:", file.filename)
    print("File content type:", file.content_type)

    if file.filename == '':
        print("No selected file")
        return jsonify({'error': 'No selected image'}), 400

    # Check file type
    allowed_extensions = {'jpg', 'jpeg', 'png', 'webp'}
    if not '.' in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
        print("Invalid file type")
        return jsonify({'error': 'Invalid file type. Please upload a JPG, PNG or WebP image'}), 400

    try:
        # Get user ID from request (assuming it's sent in headers or form data)
        user_id = request.form.get('user_id', 'anonymous')
        print(f"User ID: {user_id}")
        
        # Generate a unique ID for this preset
        preset_id = str(uuid.uuid4())
        print(f"Generated preset ID: {preset_id}")
        
        # Create a directory for this preset if it doesn't exist
        preset_dir = os.path.join(app.config['UPLOAD_FOLDER'], preset_id)
        os.makedirs(preset_dir, exist_ok=True)
        
        # Save the uploaded image temporarily with a more unique filename
        filename = secure_filename(f"{preset_id}_{file.filename}")
        image_path = os.path.join(preset_dir, filename)
        file.save(image_path)
        print("File saved successfully to", image_path)

        # Read the image data for storage
        with open(image_path, 'rb') as f:
            image_data = f.read()
        print(f"Read {len(image_data)} bytes of image data")

        # 1. Call LLM handler to get metadata
        print("Calling LLM handler to get metadata...")
        metadata = llm_handler.generate_preset_from_image(image_path)
        print("Metadata extracted successfully:", metadata)

        # 2. Generate XMP file
        print("Generating XMP file...")
        xmp_content = xmp_generator.generate_xmp(metadata)
        print("XMP generated successfully, length:", len(xmp_content))

        # 3. Store in Supabase with proper user association
        print("Storing in Supabase...")
        preset_id = supabase_client.store_preset(user_id, image_data, metadata, xmp_content)
        if not preset_id:
            print("Failed to store preset")
            return jsonify({'error': 'Failed to store preset'}), 500
        
        # Get the preset data from Supabase
        print("Getting preset data from Supabase...")
        preset = supabase_client.get_preset(preset_id)
        print("Preset data:", preset)
        
        # Clean up temporary files
        try:
            os.remove(image_path)
            os.rmdir(preset_dir)
        except Exception as e:
            print(f"Warning: Could not clean up temporary files: {e}")
        
        # 4. Return preset ID and preview data
        response_data = {
            'preset_id': preset_id,
            'image_url': preset.get('image_url'),
            'xmp_url': preset.get('xmp_url'),
            'preset_data': metadata,
            'message': 'Preset created successfully'
        }
        print("Returning response:", response_data)
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Error processing image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/preset/<preset_id>/preview', methods=['GET'])
def get_preset_preview(preset_id):
    """Get a preview of the preset without purchasing"""
    preset = supabase_client.get_preset(preset_id)
    if not preset:
        return jsonify({'error': 'Preset not found'}), 404
    
    # Parse the stored metadata
    metadata = json.loads(preset.get('metadata', '{}'))
    
    # Return limited metadata for preview
    preview_data = {
        'basic': {
            'exposure': metadata.get('basic', {}).get('exposure', 0),
            'contrast': metadata.get('basic', {}).get('contrast', 0),
            'vibrance': metadata.get('basic', {}).get('vibrance', 0),
            'saturation': metadata.get('basic', {}).get('saturation', 0)
        },
        'image_url': preset.get('image_url')
    }
    
    return jsonify(preview_data), 200

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
    
    # Check if preset has been purchased
    session_id = request.args.get('session_id')
    if session_id:
        # Verify payment with Stripe
        is_paid, _ = payment.verify_payment(session_id)
        if is_paid:
            # Mark as purchased in Supabase
            supabase_client.mark_preset_as_purchased(preset_id, session_id)
    
    # Check if the preset is purchased or if we're in development mode
    if preset.get('purchased'):
        # Get the XMP URL
        xmp_url = preset.get('xmp_url')
        print(f"Returning XMP URL: {xmp_url}")
        
        # Return the XMP file URL
        return jsonify({'xmp_url': xmp_url}), 200
    else:
        print("Payment required for this preset")
        return jsonify({'error': 'Payment required to download this preset'}), 402

@app.route('/user/<user_id>/presets', methods=['GET'])
def get_user_presets(user_id):
    """Get all presets for a user"""
    presets = supabase_client.get_user_presets(user_id)
    return jsonify(presets), 200

@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events"""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    return payment.handle_webhook(payload, sig_header)

@app.route('/auth/google-callback', methods=['POST'])
def google_callback():
    """Handle Google OAuth callback"""
    code = request.json.get('code')
    if not code:
        return jsonify({'error': 'No authorization code provided'}), 400
    
    # Exchange code for tokens
    tokens = auth.exchange_code_for_tokens(code)
    if 'error' in tokens:
        return jsonify(tokens), 400
    
    # Get user info from ID token
    user_info = auth.get_user_info_from_token(tokens.get('id_token'))
    
    # Store user in Supabase
    if user_info:
        supabase_client.store_user(user_info.get('sub'), user_info)
    
    return jsonify(tokens), 200

@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({"status": "success", "message": "Backend is running"}), 200

@app.route('/preset/<preset_id>', methods=['DELETE'])
def delete_preset(preset_id):
    """Delete a preset"""
    # Get user ID from request
    user_id = request.args.get('user_id', 'anonymous')
    
    # Delete the preset
    success = supabase_client.delete_preset(preset_id, user_id)
    
    if success:
        return jsonify({'message': 'Preset deleted successfully'}), 200
    else:
        return jsonify({'error': 'Failed to delete preset'}), 500

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

# Run the application
if __name__ == "__main__":
    # Run the app on port 8000
    print("Starting server on http://localhost:8000")
    app.run(debug=True, host='0.0.0.0', port=8000)
