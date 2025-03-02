import json
import time

def generate_xmp(metadata):
    """
    Generate an XMP file from metadata.
    For development, return a mock XMP file.
    """
    print("Generating XMP from metadata")
    
    # Basic XMP template
    xmp_template = """<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 6.0.0">
   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about=""
            xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/">
         <crs:Version>14.0</crs:Version>
         <crs:ProcessVersion>11.0</crs:ProcessVersion>
         <crs:WhiteBalance>As Shot</crs:WhiteBalance>
         <crs:Exposure>{exposure}</crs:Exposure>
         <crs:Contrast>{contrast}</crs:Contrast>
         <crs:Highlights>{highlights}</crs:Highlights>
         <crs:Shadows>{shadows}</crs:Shadows>
         <crs:Whites>{whites}</crs:Whites>
         <crs:Blacks>{blacks}</crs:Blacks>
         <crs:Clarity>{clarity}</crs:Clarity>
         <crs:Vibrance>{vibrance}</crs:Vibrance>
         <crs:Saturation>{saturation}</crs:Saturation>
         <crs:Dehaze>{dehaze}</crs:Dehaze>
         <crs:Temperature>{temperature}</crs:Temperature>
         <crs:Tint>{tint}</crs:Tint>
         <crs:Sharpness>{sharpness}</crs:Sharpness>
         <crs:LuminanceNoiseReductionDetail>{noise_reduction}</crs:LuminanceNoiseReductionDetail>
         <crs:ColorNoiseReduction>{color_noise_reduction}</crs:ColorNoiseReduction>
         <crs:HueAdjustmentRed>0</crs:HueAdjustmentRed>
         <crs:HueAdjustmentOrange>0</crs:HueAdjustmentOrange>
         <crs:HueAdjustmentYellow>0</crs:HueAdjustmentYellow>
         <crs:HueAdjustmentGreen>0</crs:HueAdjustmentGreen>
         <crs:HueAdjustmentAqua>0</crs:HueAdjustmentAqua>
         <crs:HueAdjustmentBlue>0</crs:HueAdjustmentBlue>
         <crs:HueAdjustmentPurple>0</crs:HueAdjustmentPurple>
         <crs:HueAdjustmentMagenta>0</crs:HueAdjustmentMagenta>
         <crs:SaturationAdjustmentRed>0</crs:SaturationAdjustmentRed>
         <crs:SaturationAdjustmentOrange>0</crs:SaturationAdjustmentOrange>
         <crs:SaturationAdjustmentYellow>0</crs:SaturationAdjustmentYellow>
         <crs:SaturationAdjustmentGreen>0</crs:SaturationAdjustmentGreen>
         <crs:SaturationAdjustmentAqua>0</crs:SaturationAdjustmentAqua>
         <crs:SaturationAdjustmentBlue>0</crs:SaturationAdjustmentBlue>
         <crs:SaturationAdjustmentPurple>0</crs:SaturationAdjustmentPurple>
         <crs:SaturationAdjustmentMagenta>0</crs:SaturationAdjustmentMagenta>
         <crs:LuminanceAdjustmentRed>0</crs:LuminanceAdjustmentRed>
         <crs:LuminanceAdjustmentOrange>0</crs:LuminanceAdjustmentOrange>
         <crs:LuminanceAdjustmentYellow>0</crs:LuminanceAdjustmentYellow>
         <crs:LuminanceAdjustmentGreen>0</crs:LuminanceAdjustmentGreen>
         <crs:LuminanceAdjustmentAqua>0</crs:LuminanceAdjustmentAqua>
         <crs:LuminanceAdjustmentBlue>0</crs:LuminanceAdjustmentBlue>
         <crs:LuminanceAdjustmentPurple>0</crs:LuminanceAdjustmentPurple>
         <crs:LuminanceAdjustmentMagenta>0</crs:LuminanceAdjustmentMagenta>
         <crs:ParametricShadows>0</crs:ParametricShadows>
         <crs:ParametricDarks>0</crs:ParametricDarks>
         <crs:ParametricLights>0</crs:ParametricLights>
         <crs:ParametricHighlights>0</crs:ParametricHighlights>
         <crs:ParametricShadowSplit>25</crs:ParametricShadowSplit>
         <crs:ParametricMidtoneSplit>50</crs:ParametricMidtoneSplit>
         <crs:ParametricHighlightSplit>75</crs:ParametricHighlightSplit>
         <crs:SharpenRadius>{radius}</crs:SharpenRadius>
         <crs:SharpenDetail>{detail}</crs:SharpenDetail>
         <crs:SharpenEdgeMasking>{masking}</crs:SharpenEdgeMasking>
         <crs:PostCropVignetteAmount>{amount}</crs:PostCropVignetteAmount>
         <crs:PostCropVignetteFeather>{feather}</crs:PostCropVignetteFeather>
         <crs:PostCropVignetteMidpoint>{midpoint}</crs:PostCropVignetteMidpoint>
         <crs:PostCropVignetteRoundness>{roundness}</crs:PostCropVignetteRoundness>
         <crs:PostCropVignetteStyle>1</crs:PostCropVignetteStyle>
         <crs:PostCropVignetteHighlightContrast>0</crs:PostCropVignetteHighlightContrast>
      </rdf:Description>
   </rdf:RDF>
</x:xmpmeta>
"""
    
    # Extract values from metadata
    basic = metadata.get('basic', {})
    color = metadata.get('color', {})
    detail = metadata.get('detail', {})
    effects = metadata.get('effects', {})
    
    # Format XMP with metadata values
    xmp_content = xmp_template.format(
        exposure=basic.get('exposure', 0),
        contrast=basic.get('contrast', 0),
        highlights=basic.get('highlights', 0),
        shadows=basic.get('shadows', 0),
        whites=basic.get('whites', 0),
        blacks=basic.get('blacks', 0),
        clarity=basic.get('clarity', 0),
        vibrance=basic.get('vibrance', 0),
        saturation=basic.get('saturation', 0),
        dehaze=basic.get('dehaze', 0),
        temperature=color.get('temperature', 5500),
        tint=color.get('tint', 0),
        sharpness=detail.get('sharpness', 0),
        noise_reduction=detail.get('noise_reduction', 0),
        color_noise_reduction=detail.get('color_noise_reduction', 0),
        detail=detail.get('detail', 0),
        masking=detail.get('masking', 0),
        radius=detail.get('radius', 1.0),
        amount=effects.get('amount', 0),
        feather=effects.get('feather', 50),
        midpoint=effects.get('midpoint', 50),
        roundness=effects.get('roundness', 0)
    )
    
    print("XMP generated successfully")
    return xmp_content

if __name__ == '__main__':
    # Example usage:
    example_metadata = {
        "Temperature": 5200,
        "Exposure": 0.5,
        "Contrast": 20,
        "Highlights": -50,
        "Shadows": 30
    }

    xmp_file_content = generate_xmp(example_metadata)
    print(xmp_file_content)

    # To save to a file:
    # with open("example.xmp", "w") as f:
    #     f.write(xmp_file_content) 