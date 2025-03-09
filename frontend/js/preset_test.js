// Unit tests for preset.js functions
// This file tests the data extraction functions for temperature and HSL

// No DOM manipulation in this test file - pure Node.js compatible

// Sample Gemini API response with extracted adjustments
const sampleGeminiResponse = {
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "```json\n{\n  \"basic\": {\n    \"exposure\": 0.5,\n    \"contrast\": 15,\n    \"highlights\": -50,\n    \"shadows\": 35,\n    \"whites\": -15,\n    \"blacks\": -10,\n    \"texture\": 20,\n    \"clarity\": 10,\n    \"dehaze\": 15,\n    \"vibrance\": 5,\n    \"saturation\": 0\n  },\n  \"color\": {\n    \"temperature\": 3200,\n    \"tint\": 5\n  },\n  \"hsl\": {\n    \"red\": {\n      \"hue\": 0,\n      \"saturation\": 0,\n      \"luminance\": 0\n    },\n    \"orange\": {\n      \"hue\": 5,\n      \"saturation\": 10,\n      \"luminance\": 5\n    },\n    \"yellow\": {\n      \"hue\": 10,\n      \"saturation\": 15,\n      \"luminance\": 10\n    },\n    \"green\": {\n      \"hue\": -10,\n      \"saturation\": 5,\n      \"luminance\": 0\n    },\n    \"aqua\": {\n      \"hue\": 0,\n      \"saturation\": 0,\n      \"luminance\": 0\n    },\n    \"blue\": {\n      \"hue\": 0,\n      \"saturation\": 0,\n      \"luminance\": 0\n    },\n    \"purple\": {\n      \"hue\": 0,\n      \"saturation\": 0,\n      \"luminance\": 0\n    },\n    \"magenta\": {\n      \"hue\": 0,\n      \"saturation\": 0,\n      \"luminance\": 0\n    }\n  },\n  \"detail\": {\n    \"sharpness\": 30,\n    \"radius\": 1.0,\n    \"detail\": 25,\n    \"masking\": 20,\n    \"noiseReduction\": 5,\n    \"colorNoiseReduction\": 5\n  },\n  \"effects\": {\n    \"amount\": 10,\n    \"midpoint\": 50,\n    \"roundness\": 0,\n    \"feather\": 50\n  }\n}\n```"
          }
        ],
        "role": "model"
      }
    }
  ]
};

// Extract the preset data from the Gemini response
function extractPresetDataFromGemini(response) {
  try {
    const jsonText = response.candidates[0].content.parts[0].text;
    // Extract the JSON part from the markdown code block
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return null;
  } catch (error) {
    console.error('Error extracting preset data:', error);
    return null;
  }
}

// Test the findTemperature function
function testFindTemperature() {
  console.log('Testing findTemperature function...');
  
  // Define the findTemperature function from preset.js
  const findTemperature = (data) => {
    // Look for temperature in any property at any level
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase() === 'temperature' || key.toLowerCase() === 'temp') {
        return value;
      } else if (typeof value === 'object' && value !== null) {
        // Check nested objects
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedKey.toLowerCase() === 'temperature' || nestedKey.toLowerCase() === 'temp') {
            return nestedValue;
          }
        }
      }
    }
    return null;
  };
  
  // Test cases
  const testCases = [
    {
      name: 'Temperature in color object',
      data: { color: { temperature: 3200 } },
      expected: 3200
    },
    {
      name: 'Temperature at root level',
      data: { temperature: 5500 },
      expected: 5500
    },
    {
      name: 'Temperature with capitalization',
      data: { Temperature: 4000 },
      expected: 4000
    },
    {
      name: 'No temperature',
      data: { exposure: 0.5 },
      expected: null
    }
  ];
  
  // Run tests
  let passed = 0;
  for (const testCase of testCases) {
    const result = findTemperature(testCase.data);
    const success = result === testCase.expected;
    console.log(`  ${testCase.name}: ${success ? 'PASSED' : 'FAILED'} (got ${result}, expected ${testCase.expected})`);
    if (success) passed++;
  }
  
  console.log(`  ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

// Test the findAbsoluteKelvin function
function testFindAbsoluteKelvin() {
  console.log('Testing findAbsoluteKelvin function...');
  
  // Define the findAbsoluteKelvin function from preset.js
  const findAbsoluteKelvin = (data) => {
    // Look for absolute_kelvin in any property at any level
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('kelvin')) {
        return value;
      } else if (typeof value === 'object' && value !== null) {
        // Check nested objects
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedKey.toLowerCase().includes('kelvin')) {
            return nestedValue;
          }
        }
      }
    }
    return null;
  };
  
  // Test cases
  const testCases = [
    {
      name: 'absolute_kelvin in basic object',
      data: { basic: { absolute_kelvin: 5500 } },
      expected: 5500
    },
    {
      name: 'absoluteKelvin at root level',
      data: { absoluteKelvin: 3200 },
      expected: 3200
    },
    {
      name: 'Kelvin with capitalization',
      data: { Absolute_Kelvin: 4000 },
      expected: 4000
    },
    {
      name: 'No kelvin value',
      data: { exposure: 0.5 },
      expected: null
    }
  ];
  
  // Run tests
  let passed = 0;
  for (const testCase of testCases) {
    const result = findAbsoluteKelvin(testCase.data);
    const success = result === testCase.expected;
    console.log(`  ${testCase.name}: ${success ? 'PASSED' : 'FAILED'} (got ${result}, expected ${testCase.expected})`);
    if (success) passed++;
  }
  
  console.log(`  ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

// Test the findHSL function
function testFindHSL() {
  console.log('Testing findHSL function...');
  
  // Define the findHSL function from preset.js
  const findHSL = (data) => {
    // Look for HSL in any property at any level
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase() === 'hsl') {
        return value;
      } else if (typeof value === 'object' && value !== null) {
        // Check nested objects
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedKey.toLowerCase() === 'hsl') {
            return nestedValue;
          }
        }
      }
    }
    return null;
  };
  
  // Test cases
  const testCases = [
    {
      name: 'HSL at root level',
      data: { 
        hsl: { 
          red: { hue: 0, saturation: 0, luminance: 0 },
          blue: { hue: 5, saturation: 10, luminance: 5 }
        } 
      },
      expected: { 
        red: { hue: 0, saturation: 0, luminance: 0 },
        blue: { hue: 5, saturation: 10, luminance: 5 }
      }
    },
    {
      name: 'HSL in color object',
      data: { 
        color: { 
          hsl: { 
            red: { hue: 0, saturation: 0, luminance: 0 } 
          } 
        } 
      },
      expected: { 
        red: { hue: 0, saturation: 0, luminance: 0 } 
      }
    },
    {
      name: 'HSL with capitalization',
      data: { 
        HSL: { 
          red: { hue: 5, saturation: 10, luminance: 5 } 
        } 
      },
      expected: { 
        red: { hue: 5, saturation: 10, luminance: 5 } 
      }
    },
    {
      name: 'No HSL data',
      data: { exposure: 0.5 },
      expected: null
    }
  ];
  
  // Run tests
  let passed = 0;
  for (const testCase of testCases) {
    const result = findHSL(testCase.data);
    // For objects, we need to compare stringified versions
    const resultStr = JSON.stringify(result);
    const expectedStr = JSON.stringify(testCase.expected);
    const success = resultStr === expectedStr;
    console.log(`  ${testCase.name}: ${success ? 'PASSED' : 'FAILED'}`);
    if (!success) {
      console.log(`    Got: ${resultStr}`);
      console.log(`    Expected: ${expectedStr}`);
    }
    if (success) passed++;
  }
  
  console.log(`  ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

// Test with the sample Gemini response
function testWithGeminiResponse() {
  console.log('Testing with sample Gemini response...');
  
  // Extract the preset data
  const presetData = extractPresetDataFromGemini(sampleGeminiResponse);
  console.log('Extracted preset data:', presetData);
  
  if (!presetData) {
    console.error('Failed to extract preset data from Gemini response');
    return false;
  }
  
  // Define the functions from preset.js
  const findTemperature = (data) => {
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase() === 'temperature' || key.toLowerCase() === 'temp') {
        return value;
      } else if (typeof value === 'object' && value !== null) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedKey.toLowerCase() === 'temperature' || nestedKey.toLowerCase() === 'temp') {
            return nestedValue;
          }
        }
      }
    }
    return null;
  };
  
  const findHSL = (data) => {
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase() === 'hsl') {
        return value;
      } else if (typeof value === 'object' && value !== null) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedKey.toLowerCase() === 'hsl') {
            return nestedValue;
          }
        }
      }
    }
    return null;
  };
  
  // Test temperature extraction
  const temperature = findTemperature(presetData);
  console.log('  Found temperature:', temperature);
  const temperatureSuccess = temperature === 3200;
  console.log(`  Temperature extraction: ${temperatureSuccess ? 'PASSED' : 'FAILED'}`);
  
  // Test HSL extraction
  const hsl = findHSL(presetData);
  console.log('  Found HSL data:', hsl ? 'Yes' : 'No');
  const hslSuccess = hsl && hsl.red && hsl.orange && hsl.yellow && hsl.green;
  console.log(`  HSL extraction: ${hslSuccess ? 'PASSED' : 'FAILED'}`);
  
  return temperatureSuccess && hslSuccess;
}

// Run all tests
function runAllTests() {
  console.log('Running all tests for preset.js data extraction functions...\n');
  
  const temperatureTestPassed = testFindTemperature();
  const kelvinTestPassed = testFindAbsoluteKelvin();
  const hslTestPassed = testFindHSL();
  const geminiTestPassed = testWithGeminiResponse();
  
  const allPassed = temperatureTestPassed && kelvinTestPassed && hslTestPassed && geminiTestPassed;
  
  console.log(`\nTest Summary:`);
  console.log(`  findTemperature: ${temperatureTestPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`  findAbsoluteKelvin: ${kelvinTestPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`  findHSL: ${hslTestPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Gemini Response Test: ${geminiTestPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run the tests
runAllTests();
