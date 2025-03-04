"""
Anthropic Claude-specific MCP configuration for image analysis and preset generation.
Optimized for Claude's analytical capabilities and detailed reasoning.
Tertiary LLM for image analysis.
"""

ANTHROPIC_MCP = {
    "context": {
        "role": "Expert photographer and Adobe Lightroom specialist",
        "task": "Analyze images and generate professional Lightroom presets",
        "model": "claude-3-opus",
        "output_format": "JSON",
        "priority": 3
    },
    "analysis_steps": [
        {
            "step": "Compositional Analysis",
            "focus": ["Image composition", "Subject emphasis", "Mood"],
            "output": "composition_context"
        },
        {
            "step": "Style Analysis",
            "focus": ["Photographic style", "Color treatment", "Processing approach"],
            "output": "style_adjustments"
        }
    ],
    "examples": [
        {
            "scenario": "Portrait in natural light",
            "style_context": {
                "mood": "Soft and intimate",
                "color_palette": "Neutral, skin-focused",
                "artistic_intent": "Natural beauty emphasis"
            },
            "adjustments": {
                "exposure": 0.3,
                "temperature": 5600,
                "tint": 5,
                "highlights": -20,
                "shadows": 15,
                "whites": 10,
                "blacks": -5,
                "texture": -10,
                "clarity": -15,
                "dehaze": -5,
                "vibrance": 10,
                "saturation": -5
            }
        },
        {
            "scenario": "Film emulation",
            "style_context": {
                "mood": "Nostalgic and timeless",
                "color_palette": "Muted with rich shadows",
                "artistic_intent": "Classic film look"
            },
            "adjustments": {
                "exposure": 0.0,
                "contrast": 15,
                "highlights": -30,
                "shadows": 40,
                "whites": -15,
                "blacks": 10,
                "tone_curve": "medium_contrast",
                "grain": 25,
                "saturation": -15,
                "calibration": {
                    "shadows_tint": 10,
                    "primary_red": -5,
                    "primary_blue": 5
                }
            }
        },
        {
            "scenario": "Fashion editorial",
            "style_context": {
                "mood": "Bold and contemporary",
                "color_palette": "High contrast, selective color",
                "artistic_intent": "Magazine style"
            },
            "adjustments": {
                "exposure": 0.2,
                "contrast": 30,
                "highlights": -40,
                "shadows": -20,
                "whites": 20,
                "blacks": -20,
                "clarity": 20,
                "texture": 15,
                "saturation": 10,
                "color_grading": {
                    "shadows": [220, 15, 0],
                    "highlights": [50, 10, 0]
                }
            }
        },
        {
            "scenario": "Fine art black and white",
            "style_context": {
                "mood": "Dramatic and timeless",
                "tonal_range": "Full dynamic range",
                "artistic_intent": "Gallery print"
            },
            "adjustments": {
                "exposure": 0.1,
                "contrast": 40,
                "highlights": -60,
                "shadows": 30,
                "whites": 20,
                "blacks": -25,
                "clarity": 25,
                "texture": 20,
                "grain": 15,
                "sharpening": 50,
                "black_and_white_mix": {
                    "red": 60,
                    "yellow": 40,
                    "green": 40,
                    "blue": 70,
                    "magenta": 50
                }
            }
        }
    ],
    "fallback": None  # Last in the chain, no fallback
}
