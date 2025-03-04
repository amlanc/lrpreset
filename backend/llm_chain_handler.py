"""
LLM Chain Handler for managing the sequence of LLM calls for image analysis.
Implements chain of responsibility pattern with fallback mechanisms.
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path
import google.generativeai as genai
from openai import OpenAI
from anthropic import Anthropic
from .config import gemini_mcp_config, gpt4v_mcp_config, anthropic_mcp_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMChainHandler:
    def __init__(self):
        """Initialize the LLM chain handler with API keys and configurations."""
        # Load API keys
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
        
        # Load configurations
        self.gemini_config = gemini_mcp_config.GEMINI_MCP
        self.gpt4v_config = gpt4v_mcp_config.GPT4V_MCP
        self.anthropic_config = anthropic_mcp_config.ANTHROPIC_MCP
        
        # Initialize clients
        self._init_clients()

    def _init_clients(self):
        """Initialize API clients for each LLM."""
        try:
            if self.gemini_api_key:
                genai.configure(api_key=self.gemini_api_key)
                self.gemini_model = genai.GenerativeModel('gemini-pro-vision')
            
            if self.openai_api_key:
                self.openai_client = OpenAI(api_key=self.openai_api_key)
            
            if self.anthropic_api_key:
                self.anthropic_client = Anthropic(api_key=self.anthropic_api_key)
        
        except Exception as e:
            logger.error(f"Error initializing LLM clients: {str(e)}")
            raise

    async def process_image(self, image_path: str) -> Dict[str, Any]:
        """
        Process an image through the LLM chain.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dict containing the analysis results and preset adjustments
        """
        try:
            # Try Gemini first
            result = await self._try_gemini(image_path)
            if result:
                return result
            
            # Fallback to GPT-4V
            result = await self._try_gpt4v(image_path)
            if result:
                return result
            
            # Final fallback to Claude
            result = await self._try_claude(image_path)
            if result:
                return result
            
            raise Exception("All LLM attempts failed")
            
        except Exception as e:
            logger.error(f"Error in LLM chain: {str(e)}")
            raise

    async def _try_gemini(self, image_path: str) -> Optional[Dict[str, Any]]:
        """Attempt to process image with Gemini."""
        try:
            if not self.gemini_api_key:
                return None
                
            with open(image_path, 'rb') as img_file:
                image_data = img_file.read()
            
            prompt = self._create_gemini_prompt()
            response = await self.gemini_model.generate_content([prompt, image_data])
            
            if response and response.text:
                return self._parse_gemini_response(response.text)
                
        except Exception as e:
            logger.warning(f"Gemini attempt failed: {str(e)}")
            return None

    async def _try_gpt4v(self, image_path: str) -> Optional[Dict[str, Any]]:
        """Attempt to process image with GPT-4V."""
        try:
            if not self.openai_api_key:
                return None
                
            with open(image_path, 'rb') as img_file:
                image_data = img_file.read()
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": self._create_gpt4v_prompt()},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                        ]
                    }
                ]
            )
            
            if response and response.choices:
                return self._parse_gpt4v_response(response.choices[0].message.content)
                
        except Exception as e:
            logger.warning(f"GPT-4V attempt failed: {str(e)}")
            return None

    async def _try_claude(self, image_path: str) -> Optional[Dict[str, Any]]:
        """Attempt to process image with Claude."""
        try:
            if not self.anthropic_api_key:
                return None
                
            with open(image_path, 'rb') as img_file:
                image_data = img_file.read()
            
            response = await self.anthropic_client.messages.create(
                model="claude-3-opus",
                max_tokens=1000,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": self._create_claude_prompt()
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
                }]
            )
            
            if response and response.content:
                return self._parse_claude_response(response.content[0].text)
                
        except Exception as e:
            logger.warning(f"Claude attempt failed: {str(e)}")
            return None

    def _create_gemini_prompt(self) -> str:
        """Create a prompt for Gemini based on its MCP config."""
        return json.dumps({
            "task": self.gemini_config["context"]["task"],
            "role": self.gemini_config["context"]["role"],
            "steps": self.gemini_config["analysis_steps"],
            "output_format": "JSON"
        })

    def _create_gpt4v_prompt(self) -> str:
        """Create a prompt for GPT-4V based on its MCP config."""
        return json.dumps({
            "task": self.gpt4v_config["context"]["task"],
            "role": self.gpt4v_config["context"]["role"],
            "steps": self.gpt4v_config["analysis_steps"],
            "output_format": "JSON"
        })

    def _create_claude_prompt(self) -> str:
        """Create a prompt for Claude based on its MCP config."""
        return json.dumps({
            "task": self.anthropic_config["context"]["task"],
            "role": self.anthropic_config["context"]["role"],
            "steps": self.anthropic_config["analysis_steps"],
            "output_format": "JSON"
        })

    def _parse_gemini_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate Gemini's response."""
        try:
            data = json.loads(response)
            return self._validate_preset_data(data)
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {str(e)}")
            raise

    def _parse_gpt4v_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate GPT-4V's response."""
        try:
            data = json.loads(response)
            return self._validate_preset_data(data)
        except Exception as e:
            logger.error(f"Error parsing GPT-4V response: {str(e)}")
            raise

    def _parse_claude_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate Claude's response."""
        try:
            data = json.loads(response)
            return self._validate_preset_data(data)
        except Exception as e:
            logger.error(f"Error parsing Claude response: {str(e)}")
            raise

    def _validate_preset_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the preset data structure."""
        required_fields = ['basic_adjustments', 'color_adjustments']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
        return data
