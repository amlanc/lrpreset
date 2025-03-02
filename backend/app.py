from flask import Flask, request, jsonify, send_file, Response
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
import base64

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
# Allow all origins for development
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
    
    # Check if we're in development mode
    dev_mode = request.args.get('FLASK_ENV') == 'development' or os.environ.get('FLASK_ENV') == 'development'
    print(f"Development mode: {dev_mode}")
    
    # Check if preset has been purchased
    session_id = request.args.get('session_id')
    if session_id:
        # Verify payment with Stripe
        is_paid, _ = payment.verify_payment(session_id)
        if is_paid:
            # Mark as purchased in Supabase
            supabase_client.mark_preset_as_purchased(preset_id, session_id)
    
    # Check if the preset is purchased or if we're in development mode
    if preset.get('purchased') or dev_mode:
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

@app.route('/mock-storage/<bucket>/<user_id>/<preset_id>/<filename>', methods=['GET'])
def mock_storage(bucket, user_id, preset_id, filename):
    """Serve mock storage files for development"""
    url = f"http://localhost:8000/mock-storage/{bucket}/{user_id}/{preset_id}/{filename}"
    
    print(f"Attempting to serve mock file: {url}")
    print(f"Available mock URLs: {list(supabase_client.mock_storage_urls.keys())}")
    
    if url in supabase_client.mock_storage_urls:
        data = supabase_client.mock_storage_urls[url]
        print(f"Found data for URL: {url}, data type: {type(data)}, data length: {len(data) if data else 'None'}")
        
        # Determine content type
        content_type = 'application/octet-stream'
        if filename.endswith('.jpg') or filename.endswith('.jpeg'):
            content_type = 'image/jpeg'
        elif filename.endswith('.png'):
            content_type = 'image/png'
        elif filename.endswith('.webp'):
            content_type = 'image/webp'
        elif filename.endswith('.xmp'):
            content_type = 'application/xml'
        
        print(f"Serving mock file with content type: {content_type}")
        
        # Ensure data is bytes
        if isinstance(data, str):
            if data.startswith('data:'):
                # Handle data URLs
                header, encoded = data.split(",", 1)
                data = base64.b64decode(encoded)
            else:
                data = data.encode('utf-8')
        
        return Response(data, mimetype=content_type)
    else:
        print(f"Mock file not found: {url}")
        print(f"Available URLs: {list(supabase_client.mock_storage_urls.keys())}")
        return jsonify({'error': 'File not found'}), 404

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
    return jsonify({
        'googleClientId': os.environ.get('GOOGLE_CLIENT_ID'),
        'env': os.environ.get('FLASK_ENV', 'development')
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000) 
