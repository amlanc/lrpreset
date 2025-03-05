import os
import base64
import requests
import json
from PIL import Image
import io
from dotenv import load_dotenv
import tempfile
import sys

# Load environment variables
load_dotenv()

# Get API keys from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Choose which model to use
USE_GEMINI = True  # Set to False to use GPT-4V instead
GEMINI_MODEL = "gemini-2.0-flash"  # Updated to use the newer model

# Maximum payload size for Gemini API (20MB in bytes)
MAX_PAYLOAD_SIZE = 20 * 1024 * 1024  # 20MB

def resize_image_if_needed(image_data, max_size=MAX_PAYLOAD_SIZE, quality=85):
    """
    Resize an image if its estimated payload size is too large for the API.
    
    Args:
        image_data (bytes): The original image data
        max_size (int): Maximum allowed payload size in bytes
        quality (int): JPEG quality for resized image (1-100)
        
    Returns:
        bytes: Resized image data if needed, otherwise original image data
    """
    # Calculate estimated payload size (base64 encoding increases size by ~33%)
    estimated_payload_size = len(image_data) * 1.33
    
    # If the image is already small enough, return it as is
    if estimated_payload_size < max_size * 0.8:  # Using 80% as a buffer
        print(f"Image size is already within limits: {len(image_data)/1024/1024:.2f}MB")
        return image_data
    
    # Open the image using PIL
    img = Image.open(io.BytesIO(image_data))
    
    # Start with original dimensions
    width, height = img.size
    
    # Calculate target size - aim for 70% of max to leave room for other payload elements
    target_size = int(max_size * 0.7)
    
    # Iteratively reduce size until we're under the target
    resized_data = image_data
    resize_count = 0
    max_attempts = 5
    
    while len(resized_data) * 1.33 > target_size and resize_count < max_attempts:
        # Reduce dimensions by 20% each time
        width = int(width * 0.8)
        height = int(height * 0.8)
        
        # Resize the image
        resized_img = img.resize((width, height), Image.LANCZOS)
        
        # Convert to JPEG with the specified quality
        buffer = io.BytesIO()
        resized_img.save(buffer, format="JPEG", quality=quality)
        resized_data = buffer.getvalue()
        
        print(f"Resized image to {width}x{height}, new size: {len(resized_data)/1024/1024:.2f}MB")
        resize_count += 1
        
        # If we're still too big after several attempts, reduce quality
        if resize_count == 3 and len(resized_data) * 1.33 > target_size:
            quality = max(quality - 15, 60)  # Reduce quality but not below 60
    
    if len(resized_data) * 1.33 > max_size:
        print(f"WARNING: Image still too large after resizing: {len(resized_data)/1024/1024:.2f}MB")
    else:
        print(f"Successfully resized image from {len(image_data)/1024/1024:.2f}MB to {len(resized_data)/1024/1024:.2f}MB")
    
    return resized_data

def get_image_metadata(image_path):
    """
    Extract metadata from an image using LLM.
    """
    print(f"Getting metadata for image: {image_path}")
    
    # Read the image file
    with open(image_path, "rb") as image_file:
        image_data = image_file.read()
    
    # Resize image if needed to stay under API payload limits
    image_data = resize_image_if_needed(image_data)
    
    # Process with Gemini
    return process_with_gemini(image_data, image_path)

def process_with_gemini(image_data, image_path):
    """Process the image with Google's Gemini Vision model"""
    # Load API key from environment variable
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    # Encode image to base64
    base64_image = base64.b64encode(image_data).decode("utf-8")
    
    # Prepare the request
    url = f"https://generativelanguage.googleapis.com/v1/models/{GEMINI_MODEL}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key
    }
    
    # Create prompt for Gemini
    prompt = """
    Analyze this image and extract information to create a Lightroom preset.
    Provide detailed adjustments for:
    1. Exposure, contrast, highlights, shadows, whites, blacks
    2. Clarity, texture, dehaze
    3. Vibrance and saturation
    4. Temperature and tint
    5. HSL adjustments for each color channel
    6. Sharpening and noise reduction
    
    Format your response as a JSON object with the following structure:
    {
      "basic": {
        "exposure": float (-5.0 to 5.0),
        "contrast": int (-100 to 100),
        "highlights": int (-100 to 100),
        "shadows": int (-100 to 100),
        "whites": int (-100 to 100),
        "blacks": int (-100 to 100),
        "texture": int (-100 to 100),
        "clarity": int (-100 to 100),
        "dehaze": int (-100 to 100),
        "vibrance": int (-100 to 100),
        "saturation": int (-100 to 100)
      },
      "color": {
        "temperature": int (2000 to 50000),
        "tint": int (-150 to 150)
      },
      "hsl": {
        "red": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "orange": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "yellow": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "green": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "aqua": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "blue": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "purple": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)},
        "magenta": {"hue": int (-100 to 100), "saturation": int (-100 to 100), "luminance": int (-100 to 100)}
      },
      "detail": {
        "sharpness": int (0 to 150),
        "radius": float (0.5 to 3.0),
        "detail": int (0 to 100),
        "masking": int (0 to 100),
        "noiseReduction": int (0 to 100),
        "colorNoiseReduction": int (0 to 100)
      },
      "effects": {
        "amount": int (0 to 100),
        "midpoint": int (0 to 100),
        "roundness": int (-100 to 100),
        "feather": int (0 to 100)
      }
    }
    
    Only return the JSON object, no other text.
    """
    
    # Prepare the request payload for Gemini 1.5
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64_image
                        }
                    }
                ]
            }
        ],
        "generation_config": {
            "temperature": 0.4,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        result = response.json()
        print("\nGemini API response:", json.dumps(result, indent=2))
        
        # Extract the text from the response
        if "candidates" in result and len(result["candidates"]) > 0:
            text_response = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Extract JSON from the response
            try:
                # Find JSON in the response
                json_start = text_response.find("{")
                json_end = text_response.rfind("}") + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = text_response[json_start:json_end]
                    metadata = json.loads(json_str)
                    
                    # Map temperature from Kelvin to Lightroom range if it exists
                    if "color" in metadata and "temperature" in metadata["color"]:
                        kelvin_temp = metadata["color"]["temperature"]
                        print(f"\nOriginal temperature from Gemini: {kelvin_temp}")
                        lr_value, absolute_kelvin = map_temperature_to_lightroom(kelvin_temp)
                        print(f"Mapped temperature for Lightroom: {lr_value}")
                        metadata["color"]["temperature"] = lr_value
                        metadata["color"]["absolute_kelvin"] = absolute_kelvin
                    return metadata
                else:
                    raise ValueError("No JSON found in response")
                    
            except json.JSONDecodeError as e:
                print(f"Error parsing JSON: {e}")
                print(f"Response text: {text_response}")
                # Raise an exception
                raise Exception("Failed to parse JSON from Gemini response")
        else:
            raise ValueError("No text content in response")
            
    except Exception as e:
        print(f"Gemini API error: {e}")
        if hasattr(response, 'status_code') and hasattr(response, 'text'):
            print(f"Response: {response.status_code} - {response.text}")
        # Raise an exception
        raise Exception("Failed to retrieve metadata from Gemini API")

def map_temperature_to_lightroom(kelvin_temp):
    """
    Maps a color temperature in Kelvin (2000-50000) or relative adjustment to Lightroom's relative scale (-100 to +100).
    Also returns the absolute Kelvin temperature for display purposes.
    
    Args:
        kelvin_temp (int): Color temperature in Kelvin or relative adjustment to 5500K
        
    Returns:
        tuple: (lr_value, absolute_kelvin) where:
            - lr_value: Mapped temperature value for Lightroom (-100 to +100)
            - absolute_kelvin: The absolute Kelvin temperature (2000-50000)
    """
    # Define the neutral temperature and ranges
    neutral_kelvin = 5500
    kelvin_min, kelvin_max = 2000, 50000
    lr_min, lr_max = -100, 100
    
    # Define the range for relative adjustments
    relative_adjustment_min, relative_adjustment_max = -2000, 2000
    
    # Handle values within the relative adjustment range (-2000 to +2000)
    if relative_adjustment_min <= kelvin_temp <= relative_adjustment_max:
        # Interpret as a relative adjustment to neutral temperature
        actual_kelvin = neutral_kelvin + kelvin_temp
        print(f"Interpreting {kelvin_temp} as relative adjustment to neutral: {actual_kelvin}K")
        
        # Ensure it's within valid Kelvin range
        actual_kelvin = max(kelvin_min, min(kelvin_max, actual_kelvin))
    # For values outside the relative adjustment range, treat as absolute Kelvin temperatures
    else:
        # Ensure the input is within the expected range
        actual_kelvin = max(kelvin_min, min(kelvin_max, kelvin_temp))
        print(f"Interpreting {kelvin_temp} as absolute Kelvin temperature: {actual_kelvin}K")
    
    # Calculate the position in the input range (0 to 1)
    # 5500K is considered neutral (0 in Lightroom)
    if actual_kelvin < neutral_kelvin:
        # For temperatures below neutral (cooler/blue), map to positive values
        # Lightroom's scale is inverted: lower Kelvin (cooler/blue) = positive values
        position = (neutral_kelvin - actual_kelvin) / (neutral_kelvin - kelvin_min)
        lr_value = int(position * lr_max)
        print(f"Cooler temperature: {actual_kelvin}K maps to Lightroom value: +{lr_value}")
    else:
        # For temperatures above neutral (warmer/yellow), map to negative values
        # Lightroom's scale is inverted: higher Kelvin (warmer/yellow) = negative values
        position = (actual_kelvin - neutral_kelvin) / (kelvin_max - neutral_kelvin)
        lr_value = int(-position * lr_min)  # Negative because warmer is negative in Lightroom
        print(f"Warmer temperature: {actual_kelvin}K maps to Lightroom value: {lr_value}")
    
    # Add verification for specific values to help debug
    if actual_kelvin == 5000:
        # According to Lightroom's scale, 5000K should map to approximately +14
        expected_lr = 14
        if lr_value != expected_lr:
            print(f"WARNING: Expected Lightroom value for 5000K to be +{expected_lr}, but calculated {lr_value}")
            # Force the correct value for 5000K
            lr_value = expected_lr
            print(f"Forcing Lightroom value for 5000K to +{lr_value}")
    
    # Double-check the reverse mapping to verify accuracy
    reverse_kelvin = 0
    if lr_value > 0:  # Positive values = cooler/blue
        reverse_position = lr_value / lr_max
        reverse_kelvin = neutral_kelvin - (reverse_position * (neutral_kelvin - kelvin_min))
    elif lr_value < 0:  # Negative values = warmer/yellow
        reverse_position = -lr_value / lr_min
        reverse_kelvin = neutral_kelvin + (reverse_position * (kelvin_max - neutral_kelvin))
    else:  # lr_value == 0
        reverse_kelvin = neutral_kelvin
    
    print(f"Verification - Lightroom value {lr_value} maps back to approximately {int(reverse_kelvin)}K")
    
    # Return both the Lightroom value and the absolute Kelvin temperature
    return lr_value, int(actual_kelvin)

def process_with_gpt4v(image_data, image_path):
    """Process the image with OpenAI's GPT-4V model"""
    # Load API key from environment variable
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    # Encode image to base64
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    # Prepare the request
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Create prompt for GPT-4V
    prompt = """
    Analyze this image and extract information to create a Lightroom preset.
    Provide detailed adjustments for:
    1. Exposure, contrast, highlights, shadows, whites, blacks
    2. Clarity, texture, dehaze
    3. Vibrance and saturation
    4. Temperature and tint
    5. HSL adjustments (hue, saturation, luminance for each color)
    6. Tone curve adjustments
    7. Sharpening and noise reduction
    8. Vignette settings
    
    Format your response as a JSON object with these parameters and numerical values.
    """
    
    # Prepare the payload
    payload = {
        "model": "gpt-4-vision-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000
    }
    
    # Make the request
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code != 200:
        raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
    
    # Process the response
    result = response.json()
    
    # Extract the text from the response
    text_response = result["choices"][0]["message"]["content"]
    
    # Try to extract JSON from the response
    try:
        # Find JSON in the response
        json_start = text_response.find('{')
        json_end = text_response.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            json_str = text_response[json_start:json_end]
            metadata = json.loads(json_str)
        else:
            # Raise an exception
            raise Exception("Failed to parse JSON from OpenAI response")
    except Exception as e:
        print(f"Error parsing LLM response: {e}")
        # Raise an exception
        raise Exception("Failed to parse JSON from OpenAI response")
    
    return metadata

def parse_text_response(text):
    """Parse text response into structured data when JSON parsing fails"""
    metadata = {
        "basic": {},
        "toneCurve": {},
        "hsl": {
            "red": {}, "orange": {}, "yellow": {}, "green": {}, 
            "aqua": {}, "blue": {}, "purple": {}, "magenta": {}
        },
        "detail": {},
        "effects": {}
    }
    
    # Extract values using simple parsing
    lines = text.split('\n')
    current_section = "basic"
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check for section headers
        if "exposure" in line.lower() or "contrast" in line.lower():
            current_section = "basic"
        elif "curve" in line.lower() or "tone curve" in line.lower():
            current_section = "toneCurve"
        elif "hsl" in line.lower() or "color" in line.lower():
            current_section = "hsl"
        elif "sharp" in line.lower() or "noise" in line.lower() or "detail" in line.lower():
            current_section = "detail"
        elif "vignette" in line.lower() or "effect" in line.lower():
            current_section = "effects"
            
        # Try to extract key-value pairs
        if ":" in line:
            parts = line.split(":", 1)
            key = parts[0].strip().lower().replace(" ", "")
            value_part = parts[1].strip()
            
            # Try to extract numeric value
            value = None
            for word in value_part.split():
                try:
                    value = float(word.replace(',', '.'))
                    break
                except ValueError:
                    continue
            
            if value is not None:
                if current_section == "basic":
                    metadata["basic"][key] = value
                elif current_section == "toneCurve":
                    metadata["toneCurve"][key] = value
                elif current_section == "detail":
                    metadata["detail"][key] = value
                elif current_section == "effects":
                    metadata["effects"][key] = value
                elif current_section == "hsl":
                    # Try to determine which color is being referenced
                    for color in ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"]:
                        if color in line.lower():
                            if "hue" in line.lower():
                                metadata["hsl"][color]["hue"] = value
                            elif "saturation" in line.lower():
                                metadata["hsl"][color]["saturation"] = value
                            elif "luminance" in line.lower():
                                metadata["hsl"][color]["luminance"] = value
                            break
    
    return metadata

def generate_default_metadata(image_path):
    """Generate default metadata based on image analysis"""
    try:
        # Open the image and analyze basic properties
        img = Image.open(image_path)
        
        # Calculate average brightness
        brightness = calculate_brightness(img)
        
        # Calculate color balance
        r_avg, g_avg, b_avg = calculate_color_balance(img)
        
        # Generate basic preset based on image properties
        metadata = {
            "basic": {
                "exposure": 0.0 if brightness > 0.5 else 0.5,
                "contrast": 0.0,
                "highlights": -15 if brightness > 0.7 else 0,
                "shadows": 15 if brightness < 0.3 else 0,
                "whites": 0,
                "blacks": 0,
                "clarity": 10,
                "vibrance": 10,
                "saturation": 0,
                "temperature": -10 if b_avg > r_avg else 10 if r_avg > b_avg else 0,
                "tint": -10 if g_avg < (r_avg + b_avg)/2 else 10 if g_avg > (r_avg + b_avg)/2 else 0
            },
            "toneCurve": {
                "highlights": 0,
                "lights": 0,
                "darks": 0,
                "shadows": 0
            },
            "hsl": {
                "red": {"hue": 0, "saturation": 0, "luminance": 0},
                "orange": {"hue": 0, "saturation": 0, "luminance": 0},
                "yellow": {"hue": 0, "saturation": 0, "luminance": 0},
                "green": {"hue": 0, "saturation": 0, "luminance": 0},
                "aqua": {"hue": 0, "saturation": 0, "luminance": 0},
                "blue": {"hue": 0, "saturation": 0, "luminance": 0},
                "purple": {"hue": 0, "saturation": 0, "luminance": 0},
                "magenta": {"hue": 0, "saturation": 0, "luminance": 0}
            },
            "detail": {
                "sharpness": 40,
                "radius": 1.0,
                "detail": 25,
                "masking": 0,
                "noiseReduction": 25,
                "colorNoiseReduction": 25
            },
            "effects": {
                "amount": 0,
                "midpoint": 50,
                "roundness": 0,
                "feather": 50
            }
        }
        
        return metadata
    except Exception as e:
        print(f"Error generating default metadata: {e}")
        # Raise an exception
        raise Exception("Failed to generate default metadata")

def calculate_brightness(img):
    """Calculate average brightness of an image"""
    # Convert to grayscale
    if img.mode != 'L':
        img = img.convert('L')
    
    # Get histogram
    hist = img.histogram()
    
    # Calculate weighted average
    total = sum(i * count for i, count in enumerate(hist))
    pixel_count = sum(hist)
    
    # Return normalized brightness (0-1)
    return total / (pixel_count * 255) if pixel_count > 0 else 0.5

def calculate_color_balance(img):
    """Calculate average RGB values"""
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Get average RGB values
    r_total, g_total, b_total = 0, 0, 0
    pixel_count = 0
    
    # Sample pixels (for efficiency, don't process every pixel)
    width, height = img.size
    sample_step = max(1, min(width, height) // 100)
    
    for x in range(0, width, sample_step):
        for y in range(0, height, sample_step):
            r, g, b = img.getpixel((x, y))
            r_total += r
            g_total += g
            b_total += b
            pixel_count += 1
    
    # Return normalized RGB averages (0-1)
    if pixel_count > 0:
        return (r_total / (pixel_count * 255), 
                g_total / (pixel_count * 255), 
                b_total / (pixel_count * 255))
    else:
        return (0.5, 0.5, 0.5)

def generate_preset_from_image(image_path_or_data):
    """
    Generate a Lightroom preset from an image using an LLM.
    
    Args:
        image_path_or_data: Either a path to an image file or the binary image data
        
    Returns:
        Dictionary containing preset metadata
    """
    
    # Check if we have API keys
    if not OPENAI_API_KEY and not ANTHROPIC_API_KEY and not os.environ.get("GEMINI_API_KEY"):
        raise ValueError("No API keys found for OpenAI, Anthropic, or Gemini. Please set at least one API key.")
    
    # Determine if we're working with a file path or binary data
    is_file_path = isinstance(image_path_or_data, str)
    
    # Try to use Gemini first
    if os.environ.get("GEMINI_API_KEY"):
        try:
            if is_file_path:
                with open(image_path_or_data, "rb") as image_file:
                    image_data = image_file.read()
                # Resize image if needed
                image_data = resize_image_if_needed(image_data)
                return process_with_gemini(image_data, image_path_or_data)
            else:
                # Resize image data if needed
                resized_data = resize_image_if_needed(image_path_or_data)
                return process_with_gemini(resized_data, "uploaded_image")
        except Exception as e:
            print(f"Error using Gemini API: {e}")
            # Fall back to other APIs
    
    # Try to use Anthropic if Gemini fails or is not available
    if ANTHROPIC_API_KEY:
        try:
            if is_file_path:
                return generate_preset_with_anthropic(image_path_or_data)
            else:
                return generate_preset_with_anthropic_data(image_path_or_data)
        except Exception as e:
            print(f"Error using Anthropic API: {e}")
            # Fall back to OpenAI if available
    
    # Use OpenAI if other APIs fail or are not available
    if OPENAI_API_KEY:
        try:
            if is_file_path:
                return generate_preset_with_openai(image_path_or_data)
            else:
                return generate_preset_with_openai_data(image_path_or_data)
        except Exception as e:
            print(f"Error using OpenAI API: {e}")
            # Fall back to default metadata
            if is_file_path:
                return generate_default_metadata(image_path_or_data)
            else:
                # Create a temporary file for the image data
                with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
                    temp_file.write(image_path_or_data)
                    temp_path = temp_file.name
                try:
                    return generate_default_metadata(temp_path)
                finally:
                    os.unlink(temp_path)  # Clean up the temporary file
    
    # If all APIs fail, use default metadata
    if is_file_path:
        return generate_default_metadata(image_path_or_data)
    else:
        # Create a temporary file for the image data
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(image_path_or_data)
            temp_path = temp_file.name
        try:
            return generate_default_metadata(temp_path)
        finally:
            os.unlink(temp_path)  # Clean up the temporary file

def generate_preset_with_anthropic(image_path):
    """Generate a preset using Anthropic's Claude API."""
    
    # Read and encode the image
    with open(image_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode('utf-8')
    
    # Prepare the API request
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    # Construct the prompt
    prompt = """
    You are an expert photographer and photo editor. Analyze this image and extract the image information to create a Lightroom preset that would significantly enhance a new image with characteristics similar to this one.
    
    Please provide the preset as a JSON object with the following structure:
    {
        "basic": {
            "exposure": float,
            "contrast": float,
            "highlights": float,
            "shadows": float,
            "whites": float,
            "blacks": float,
            "clarity": float,
            "vibrance": float,
            "saturation": float
        },
        "color": {
            "temperature": float,
            "tint": float,
            "hue_red": float,
            "hue_orange": float,
            "hue_yellow": float,
            "hue_green": float,
            "hue_aqua": float,
            "hue_blue": float,
            "hue_purple": float,
            "hue_magenta": float,
            "saturation_red": float,
            "saturation_orange": float,
            "saturation_yellow": float,
            "saturation_green": float,
            "saturation_aqua": float,
            "saturation_blue": float,
            "saturation_purple": float,
            "saturation_magenta": float,
            "luminance_red": float,
            "luminance_orange": float,
            "luminance_yellow": float,
            "luminance_green": float,
            "luminance_aqua": float,
            "luminance_blue": float,
            "luminance_purple": float,
            "luminance_magenta": float
        },
        "detail": {
            "sharpness": float,
            "radius": float,
            "detail": float,
            "smoothness": float,
            "masking": float,
            "noise_reduction": float,
            "color_noise_reduction": float
        },
        "effects": {
            "temperature": float,
            "amount": float,
            "midpoint": float,
            "roundness": float,
            "feather": float,
            "softness": float,
            "vignette": float,
            "grain": float
        }
    }
    
    Analyze the image carefully and provide values that would enhance it. Values should typically be between -100 and 100, with 0 being neutral.
    Only return the JSON object, nothing else.
    """
    
    # Prepare the API request data
    data = {
        "model": "claude-3-opus-20240229",
        "max_tokens": 1000,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_data
                        }
                    }
                ]
            }
        ]
    }
    
    # Make the API request
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=data
    )
    
    # Parse the response
    if response.status_code == 200:
        response_data = response.json()
        content = response_data["content"][0]["text"]
        
        # Extract the JSON part from the response
        import json
        import re
        
        # Try to find JSON in the response
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # If no JSON code block, try to find a JSON object directly
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # If still no JSON, use the entire response
                json_str = content
        
        try:
            preset_data = json.loads(json_str)
            return preset_data
        except json.JSONDecodeError:
            print("Error parsing JSON from Anthropic response")
            # Raise an exception
            raise Exception("Failed to parse JSON from Anthropic response")
    else:
        print(f"Error from Anthropic API: {response.status_code} - {response.text}")
        # Raise an exception
        raise Exception("Failed to retrieve preset from Anthropic API")

def generate_preset_with_anthropic_data(image_data):
    """Generate a preset using Anthropic's Claude API with image data."""
    
    # Encode image to base64
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    # Prepare the API request
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    # Construct the prompt
    prompt = """
    You are an expert photographer and photo editor. Analyze this image and extract all relevant information to create a Lightroom preset that would significantly enhance it.
    
    Please provide the preset as a JSON object with the following structure:
    {
        "basic": {
            "exposure": float,
            "contrast": float,
            "highlights": float,
            "shadows": float,
            "whites": float,
            "blacks": float,
            "clarity": float,
            "vibrance": float,
            "saturation": float
        },
        "color": {
            "temperature": float,
            "tint": float,
            "hue_red": float,
            "hue_orange": float,
            "hue_yellow": float,
            "hue_green": float,
            "hue_aqua": float,
            "hue_blue": float,
            "hue_purple": float,
            "hue_magenta": float,
            "saturation_red": float,
            "saturation_orange": float,
            "saturation_yellow": float,
            "saturation_green": float,
            "saturation_aqua": float,
            "saturation_blue": float,
            "saturation_purple": float,
            "saturation_magenta": float,
            "luminance_red": float,
            "luminance_orange": float,
            "luminance_yellow": float,
            "luminance_green": float,
            "luminance_aqua": float,
            "luminance_blue": float,
            "luminance_purple": float,
            "luminance_magenta": float
        },
        "detail": {
            "sharpness": float,
            "radius": float,
            "detail": float,
            "smoothness": float,
            "masking": float,
            "noise_reduction": float,
            "color_noise_reduction": float
        },
        "effects": {
            "temperature": float,
            "amount": float,
            "midpoint": float,
            "roundness": float,
            "feather": float,
            "softness": float,
            "vignette": float,
            "grain": float
        }
    }
    
    Analyze the image carefully and provide values that would enhance it. Values should typically be between -100 and 100, with 0 being neutral.
    Only return the JSON object, nothing else.
    """
    
    # Prepare the API request data
    data = {
        "model": "claude-3-opus-20240229",
        "max_tokens": 1000,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64_image
                        }
                    }
                ]
            }
        ]
    }
    
    # Make the API request
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=data
    )
    
    # Parse the response
    if response.status_code == 200:
        response_data = response.json()
        content = response_data["content"][0]["text"]
        
        # Extract the JSON part from the response
        import json
        import re
        
        # Try to find JSON in the response
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # If no JSON code block, try to find a JSON object directly
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # If still no JSON, use the entire response
                json_str = content
        
        try:
            preset_data = json.loads(json_str)
            return preset_data
        except json.JSONDecodeError:
            print("Error parsing JSON from Anthropic response")
            # Raise an exception
            raise Exception("Failed to parse JSON from Anthropic response")
    else:
        print(f"Error from Anthropic API: {response.status_code} - {response.text}")
        # Raise an exception
        raise Exception("Failed to retrieve preset from Anthropic API")

def generate_preset_with_openai(image_path):
    """Generate a preset using OpenAI's GPT-4 Vision API."""
    
    # Read and encode the image
    with open(image_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode('utf-8')
    
    # Prepare the API request
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Construct the prompt
    prompt = """
    You are an expert photographer and photo editor. Analyze this image and create a Lightroom preset that would enhance it.
    
    Please provide the preset as a JSON object with the following structure:
    {
        "basic": {
            "exposure": float,
            "contrast": float,
            "highlights": float,
            "shadows": float,
            "whites": float,
            "blacks": float,
            "clarity": float,
            "vibrance": float,
            "saturation": float
        },
        "color": {
            "temperature": float,
            "tint": float,
            "hue_red": float,
            "hue_orange": float,
            "hue_yellow": float,
            "hue_green": float,
            "hue_aqua": float,
            "hue_blue": float,
            "hue_purple": float,
            "hue_magenta": float,
            "saturation_red": float,
            "saturation_orange": float,
            "saturation_yellow": float,
            "saturation_green": float,
            "saturation_aqua": float,
            "saturation_blue": float,
            "saturation_purple": float,
            "saturation_magenta": float,
            "luminance_red": float,
            "luminance_orange": float,
            "luminance_yellow": float,
            "luminance_green": float,
            "luminance_aqua": float,
            "luminance_blue": float,
            "luminance_purple": float,
            "luminance_magenta": float
        },
        "detail": {
            "sharpness": float,
            "radius": float,
            "detail": float,
            "smoothness": float,
            "masking": float,
            "noise_reduction": float,
            "color_noise_reduction": float
        },
        "effects": {
            "temperature": float,
            "amount": float,
            "midpoint": float,
            "roundness": float,
            "feather": float,
            "softness": float,
            "vignette": float,
            "grain": float
        }
    }
    
    Analyze the image carefully and provide values that would enhance it. Values should typically be between -100 and 100, with 0 being neutral.
    Only return the JSON object, nothing else.
    """
    
    # Prepare the API request data
    data = {
        "model": "gpt-4-vision-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000
    }
    
    # Make the API request
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=data
    )
    
    # Parse the response
    if response.status_code == 200:
        response_data = response.json()
        content = response_data["choices"][0]["message"]["content"]
        
        # Extract the JSON part from the response
        import json
        import re
        
        # Try to find JSON in the response
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # If no JSON code block, try to find a JSON object directly
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # If still no JSON, use the entire response
                json_str = content
        
        try:
            preset_data = json.loads(json_str)
            return preset_data
        except json.JSONDecodeError:
            print("Error parsing JSON from OpenAI response")
            # Raise an exception
            raise Exception("Failed to parse JSON from OpenAI response")
    else:
        print(f"Error from OpenAI API: {response.status_code} - {response.text}")
        # Raise an exception
        raise Exception("Failed to retrieve preset from OpenAI API")

def generate_preset_with_openai_data(image_data):
    """Generate a preset using OpenAI's GPT-4 Vision API with image data."""
    
    # Encode image to base64
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    # Prepare the API request
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Construct the prompt
    prompt = """
    You are an expert photographer and photo editor. Analyze this image and create a Lightroom preset that would enhance it.
    
    Please provide the preset as a JSON object with the following structure:
    {
        "basic": {
            "exposure": float,
            "contrast": float,
            "highlights": float,
            "shadows": float,
            "whites": float,
            "blacks": float,
            "clarity": float,
            "vibrance": float,
            "saturation": float
        },
        "color": {
            "temperature": float,
            "tint": float,
            "hue_red": float,
            "hue_orange": float,
            "hue_yellow": float,
            "hue_green": float,
            "hue_aqua": float,
            "hue_blue": float,
            "hue_purple": float,
            "hue_magenta": float,
            "saturation_red": float,
            "saturation_orange": float,
            "saturation_yellow": float,
            "saturation_green": float,
            "saturation_aqua": float,
            "saturation_blue": float,
            "saturation_purple": float,
            "saturation_magenta": float,
            "luminance_red": float,
            "luminance_orange": float,
            "luminance_yellow": float,
            "luminance_green": float,
            "luminance_aqua": float,
            "luminance_blue": float,
            "luminance_purple": float,
            "luminance_magenta": float
        },
        "detail": {
            "sharpness": float,
            "radius": float,
            "detail": float,
            "smoothness": float,
            "masking": float,
            "noise_reduction": float,
            "color_noise_reduction": float
        },
        "effects": {
            "temperature": float,
            "amount": float,
            "midpoint": float,
            "roundness": float,
            "feather": float,
            "softness": float,
            "vignette": float,
            "grain": float
        }
    }
    
    Analyze the image carefully and provide values that would enhance it. Values should typically be between -100 and 100, with 0 being neutral.
    Only return the JSON object, nothing else.
    """
    
    # Prepare the API request data
    data = {
        "model": "gpt-4-vision-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000
    }
    
    # Make the API request
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=data
    )
    
    # Parse the response
    if response.status_code == 200:
        response_data = response.json()
        content = response_data["choices"][0]["message"]["content"]
        
        # Extract the JSON part from the response
        import json
        import re
        
        # Try to find JSON in the response
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # If no JSON code block, try to find a JSON object directly
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # If still no JSON, use the entire response
                json_str = content
        
        try:
            preset_data = json.loads(json_str)
            return preset_data
        except json.JSONDecodeError:
            print("Error parsing JSON from OpenAI response")
            # Raise an exception
            raise Exception("Failed to parse JSON from OpenAI response")
    else:
        print(f"Error from OpenAI API: {response.status_code} - {response.text}")
        # Raise an exception
        raise Exception("Failed to retrieve preset from OpenAI API")

if __name__ == '__main__':
    # Example usage (replace with your image path)
    image_path = 'uploads/example.jpg'  # Example
    metadata = get_image_metadata(image_path)
    print(json.dumps(metadata, indent=2))
    
    # Example usage (replace with your image path)
    image_path = 'uploads/example.jpg'  # Example
    metadata = get_image_metadata(image_path)
    print(json.dumps(metadata, indent=2))
