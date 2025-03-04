"""
GPT-4V specific MCP configuration for image analysis and preset generation.
Optimized for GPT-4V's detailed vision analysis capabilities.
Secondary LLM for image analysis.
"""

GPT4V_MCP = {
    "context": {
        "role": "Expert photographer and Adobe Lightroom specialist",
        "task": "Analyze images and generate professional Lightroom presets",
        "model": "gpt-4-vision-preview",
        "output_format": "JSON",
        "priority": 2
    },
    "analysis_steps": [
        {
            "step": "Scene Analysis",
            "focus": ["Lighting conditions", "Subject type", "Color palette"],
            "output": "scene_context"
        },
        {
            "step": "Technical Analysis",
            "focus": ["Exposure settings", "Color balance", "Detail levels"],
            "output": "technical_adjustments"
        }
    ],
    "examples": [
        {
            "scenario": "Sunset landscape",
            "technical_details": {
                "lighting": "Back-lit, high dynamic range",
                "color_temp": "Warm, golden hour",
                "challenges": "High contrast, detail preservation"
            },
            "adjustments": {
                "exposure": -0.5,
                "temperature": 7500,
                "highlights": -80,
                "shadows": 50,
                "vibrance": 20,
                "clarity": 15,
                "dehaze": 15
            }
        },
        {
            "scenario": "Studio portrait",
            "technical_details": {
                "lighting": "Three-point lighting setup",
                "color_temp": "Controlled studio environment",
                "challenges": "Skin tone preservation"
            },
            "adjustments": {
                "exposure": 0.0,
                "temperature": 5500,
                "highlights": -15,
                "shadows": 10,
                "clarity": -10,
                "texture": -15,
                "sharpening": 40
            }
        },
        {
            "scenario": "Astro photography",
            "technical_details": {
                "lighting": "Extremely low light",
                "color_temp": "Night sky",
                "challenges": "Noise reduction, star detail"
            },
            "adjustments": {
                "exposure": 2.0,
                "temperature": 4000,
                "highlights": -30,
                "shadows": 100,
                "noise_reduction": 50,
                "clarity": 30,
                "dehaze": 40
            }
        },
        {
            "scenario": "Product photography",
            "technical_details": {
                "lighting": "Controlled product lighting",
                "color_temp": "Product-accurate colors",
                "challenges": "Texture detail, color accuracy"
            },
            "adjustments": {
                "exposure": 0.2,
                "temperature": 5200,
                "highlights": -10,
                "shadows": 15,
                "clarity": 25,
                "sharpening": 60,
                "saturation": -5
            }
        }
    ],
    "fallback": "anthropic_mcp_config"  # Specify next LLM to try if GPT-4V fails
}
