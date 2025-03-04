"""
Gemini-specific MCP configuration for image analysis and preset generation.
Optimized for Gemini's vision capabilities and structured output.
Primary LLM for image analysis.
"""

GEMINI_MCP = {
    "context": {
        "role": "Expert photographer and Adobe Lightroom specialist",
        "task": "Analyze images and generate professional Lightroom presets",
        "model": "gemini-2.0-flash",
        "output_format": "JSON",
        "priority": 1
    },
    "analysis_steps": [
        {
            "step": "Basic Analysis",
            "focus": ["Overall exposure", "Contrast", "Highlights", "Shadows"],
            "output": "basic_adjustments"
        },
        {
            "step": "Color Analysis",
            "focus": ["Color temperature", "Tint", "Color balance"],
            "output": "color_adjustments"
        }
    ],
    "examples": [
        {
            "scenario": "Night urban photo",
            "scene_type": "City nightscape with neon lights",
            "adjustments": {
                "exposure": 1.2,
                "shadows": 60,
                "highlights": -40,
                "temperature": 6500,
                "tint": 5
            }
        },
        {
            "scenario": "Bright daylight landscape",
            "scene_type": "Mountain vista with snow",
            "adjustments": {
                "exposure": -0.3,
                "highlights": -30,
                "shadows": 20,
                "clarity": 15,
                "dehaze": 10
            }
        },
        {
            "scenario": "Indoor low light",
            "scene_type": "Restaurant interior",
            "adjustments": {
                "exposure": 1.5,
                "shadows": 70,
                "noise_reduction": 35,
                "temperature": 3200,
                "tint": -5
            }
        },
        {
            "scenario": "Golden hour portrait",
            "scene_type": "Outdoor portrait at sunset",
            "adjustments": {
                "exposure": 0.0,
                "highlights": -20,
                "shadows": 30,
                "temperature": 7000,
                "clarity": -10
            }
        }
    ],
    "fallback": "gpt4v_mcp_config"  # Specify next LLM to try if Gemini fails
}
