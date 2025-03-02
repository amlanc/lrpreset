import os
import base64
import requests
import json
from PIL import Image
import io
import random
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API keys from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Choose which model to use
USE_GEMINI = True  # Set to False to use GPT-4V instead
GEMINI_MODEL = "gemini-2.0-flash"  # Updated to use the newer model

def get_image_metadata(image_path):
    """
    Extract metadata from an image using LLM.
    For development, return mock data.
    """
    print(f"Getting metadata for image: {image_path}")
    
    # For development, return mock data
    mock_metadata = {
        "basic": {
            "exposure": 0.3,
            "contrast": 15,
            "highlights": -30,
            "shadows": 20,
            "whites": 0,
            "blacks": 10,
            "clarity": 5,
            "vibrance": 0,
            "saturation": 5,
            "dehaze": 10
        },
        "color": {
            "temperature": 6600,
            "tint": 5,
            "vibrance": 0,
            "saturation": 5
        },
        "detail": {
            "sharpness": 40,
            "noise_reduction": 5,
            "color_noise_reduction": 10,
            "detail": 50,
            "masking": 20,
            "radius": 1
        },
        "effects": {
            "amount": 0,
            "feather": 50,
            "midpoint": 50,
            "roundness": 0
        }
    }
    
    print("Generated mock metadata")
    return mock_metadata

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
        print("Gemini API response:", json.dumps(result, indent=2))
        
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
                    return metadata
                else:
                    raise ValueError("No JSON found in response")
                    
            except json.JSONDecodeError as e:
                print(f"Error parsing JSON: {e}")
                print(f"Response text: {text_response}")
                # Fall back to mock data
                return mock_image_analysis(image_path)
        else:
            raise ValueError("No text content in response")
            
    except Exception as e:
        print(f"Gemini API error: {e}")
        print(f"Response: {response.status_code} - {response.text}")
        # Fall back to mock data
        return mock_image_analysis(image_path)

def process_with_gpt4v(image_data, image_path):
    """Process the image with OpenAI's GPT-4V model"""
    # Load API key from environment variable
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    # Encode image to base64
    base64_image = base64.b64encode(image_data).decode("utf-8")
    
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
            # Parse the text response into structured data
            metadata = parse_text_response(text_response)
    except Exception as e:
        print(f"Error parsing LLM response: {e}")
        # Fallback to default values
        metadata = generate_default_metadata(image_path)
    
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
    """Generate default metadata based on image analysis when LLM fails"""
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
        # Return very basic default values
        return {
            "basic": {
                "exposure": 0.0,
                "contrast": 0.0,
                "highlights": 0,
                "shadows": 0,
                "whites": 0,
                "blacks": 0,
                "clarity": 10,
                "vibrance": 10,
                "saturation": 0,
                "temperature": 0,
                "tint": 0
            },
            "toneCurve": {},
            "hsl": {},
            "detail": {
                "sharpness": 40
            },
            "effects": {}
        }

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

# Add this function for mock LLM processing
def mock_image_analysis(image_path):
    """Generate mock metadata for development without API keys"""
    from PIL import Image
    img = Image.open(image_path)
    
    # Calculate some basic image properties
    brightness = calculate_brightness(img)
    r, g, b = calculate_color_balance(img)
    
    # Generate mock metadata based on image properties
    metadata = {
        "basic": {
            "exposure": round((brightness - 0.5) * 2, 2),
            "contrast": round(random.uniform(5, 25), 0),
            "highlights": round(random.uniform(-30, -10), 0) if brightness > 0.6 else 0,
            "shadows": round(random.uniform(10, 30), 0) if brightness < 0.4 else 0,
            "whites": round(random.uniform(-10, 10), 0),
            "blacks": round(random.uniform(-10, 10), 0),
            "texture": round(random.uniform(10, 30), 0),
            "clarity": round(random.uniform(10, 30), 0),
            "dehaze": round(random.uniform(0, 15), 0),
            "vibrance": round(random.uniform(10, 30), 0),
            "saturation": round(random.uniform(5, 20), 0),
        },
        "color": {
            "temperature": round(6500 + (b - r) * 2000),
            "tint": round((g - (r + b) / 2) * 50),
        },
        "hsl": {
            "red": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "orange": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "yellow": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "green": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "aqua": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "blue": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "purple": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0},
            "magenta": {"hue": 0, "saturation": round(random.uniform(-10, 10), 0), "luminance": 0}
        },
        "detail": {
            "sharpness": round(random.uniform(30, 60), 0),
            "radius": round(random.uniform(0.8, 1.2), 1),
            "detail": round(random.uniform(20, 40), 0),
            "masking": 0,
            "noiseReduction": round(random.uniform(10, 30), 0),
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

def generate_preset_from_image(image_path):
    """Generate a Lightroom preset from an image using an LLM."""
    
    # Check if we have API keys
    if not OPENAI_API_KEY and not ANTHROPIC_API_KEY:
        print("WARNING: No API keys found for OpenAI or Anthropic. Using mock preset data.")
        return generate_mock_preset()
    
    # Try to use Anthropic first (Claude has better vision capabilities)
    if ANTHROPIC_API_KEY:
        try:
            return generate_preset_with_anthropic(image_path)
        except Exception as e:
            print(f"Error using Anthropic API: {e}")
            # Fall back to OpenAI if available
            if OPENAI_API_KEY:
                return generate_preset_with_openai(image_path)
            else:
                return generate_mock_preset()
    
    # Use OpenAI if Anthropic is not available
    elif OPENAI_API_KEY:
        try:
            return generate_preset_with_openai(image_path)
        except Exception as e:
            print(f"Error using OpenAI API: {e}")
            return generate_mock_preset()
    
    # Use mock data if no APIs are available
    else:
        return generate_mock_preset()

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
            "noise_reduction": float
        },
        "effects": {
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
            return generate_mock_preset()
    else:
        print(f"Error from Anthropic API: {response.status_code} - {response.text}")
        return generate_mock_preset()

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
            "noise_reduction": float
        },
        "effects": {
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
            return generate_mock_preset()
    else:
        print(f"Error from OpenAI API: {response.status_code} - {response.text}")
        return generate_mock_preset()

def generate_mock_preset():
    """Generate mock preset data for testing."""
    return {
        "basic": {
            "exposure": 0.5,
            "contrast": 15,
            "highlights": -20,
            "shadows": 30,
            "whites": -10,
            "blacks": -5,
            "clarity": 10,
            "vibrance": 15,
            "saturation": 5
        },
        "color": {
            "temperature": 5,
            "tint": -3,
            "hue_red": 0,
            "hue_orange": 5,
            "hue_yellow": 0,
            "hue_green": -5,
            "hue_aqua": 0,
            "hue_blue": 0,
            "hue_purple": 0,
            "hue_magenta": 0,
            "saturation_red": 5,
            "saturation_orange": 10,
            "saturation_yellow": 5,
            "saturation_green": 0,
            "saturation_aqua": 0,
            "saturation_blue": 5,
            "saturation_purple": 0,
            "saturation_magenta": 0,
            "luminance_red": 0,
            "luminance_orange": 0,
            "luminance_yellow": 5,
            "luminance_green": 0,
            "luminance_aqua": 0,
            "luminance_blue": -5,
            "luminance_purple": 0,
            "luminance_magenta": 0
        },
        "detail": {
            "sharpness": 40,
            "noise_reduction": 25
        },
        "effects": {
            "vignette": -15,
            "grain": 10
        }
    }

if __name__ == '__main__':
    # Example usage (replace with your image path)
    image_path = 'uploads/example.jpg'  # Example
    metadata = get_image_metadata(image_path)

    if metadata:
        print("Metadata from Vision LLM:")
        print(json.dumps(metadata, indent=4))
    else:
        print("Failed to retrieve metadata.") 