/**
 * Test script for HSL tab functionality
 * This script tests that the HSL tab is properly created and populated
 * and validates the HSL data parsing logic
 */

// Create a test function to run in the browser console
function testHSLTabPopulation() {
    console.log('=== STARTING HSL TAB POPULATION TEST ===');
    
    // Create a test container in the DOM
    const testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    testContainer.id = 'metadata-display'; // This ID is expected by the tab switching code
    document.body.appendChild(testContainer);
    
    // Create tab content container
    const tabContentContainer = document.createElement('div');
    tabContentContainer.className = 'tab-content';
    testContainer.appendChild(tabContentContainer);
    
    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs';
    testContainer.appendChild(tabsContainer);
    
    // Create tab buttons
    const tabIds = ['basic', 'color', 'hsl', 'detail', 'effects'];
    tabIds.forEach(tabId => {
        const tab = document.createElement('div');
        tab.className = 'preset-tab';
        tab.setAttribute('data-tab', tabId);
        tab.textContent = tabId.toUpperCase();
        tabsContainer.appendChild(tab);
    });
    
    // Create tab content divs
    tabIds.forEach(tabId => {
        const tabContent = document.createElement('div');
        tabContent.id = tabId;
        tabContent.className = 'preset-tab-content';
        tabContentContainer.appendChild(tabContent);
        
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.className = `${tabId}-table-container`;
        tabContent.appendChild(tableContainer);
        
        // Create table
        const table = document.createElement('table');
        table.className = 'adjustments-table';
        if (tabId === 'hsl') {
            table.classList.add('hsl-table');
        }
        table.setAttribute('cellspacing', '0');
        table.setAttribute('cellpadding', '0');
        table.style.tableLayout = 'fixed';
        table.style.width = '100%';
        tableContainer.appendChild(table);
        
        // Create table header
        const thead = document.createElement('thead');
        table.appendChild(thead);
        
        // Create table header row
        const headerRow = document.createElement('tr');
        thead.appendChild(headerRow);
        
        // Create header cells (different for HSL vs other tabs)
        if (tabId === 'hsl') {
            ['COLOR', 'HUE', 'SATURATION', 'LUMINANCE'].forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                headerRow.appendChild(th);
            });
        } else {
            ['PARAMETER', 'VALUE'].forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                headerRow.appendChild(th);
            });
        }
        
        // Create table body
        const tbody = document.createElement('tbody');
        tbody.id = `${tabId}-adjustments`;
        table.appendChild(tbody);
    });
    
    // Create a mock window.utils object if it doesn't exist
    if (!window.utils) {
        window.utils = {
            formatLabel: (label) => {
                return label.charAt(0).toUpperCase() + label.slice(1);
            },
            formatValue: (value) => {
                return typeof value === 'number' ? value.toString() : value;
            }
        };
    }
    
    console.log('=== TESTING DIFFERENT HSL DATA FORMATS ===');
    
    // Test Case 1: Standard HSL data format
    testHSLDataFormat('Standard HSL Object Format', {
        name: 'Test Preset',
        hsl: {
            red: { hue: 10, saturation: 20, luminance: 30 },
            orange: { hue: 15, saturation: 25, luminance: 35 },
            yellow: { hue: 20, saturation: 30, luminance: 40 },
            green: { hue: 25, saturation: 35, luminance: 45 }
        }
    });
    
    // Test Case 2: HSL data with string values that need parsing
    testHSLDataFormat('HSL with String Values', {
        name: 'Test Preset',
        hsl: {
            red: '{"hue": 10, "saturation": 20, "luminance": 30}',
            orange: '{"hue": 15, "saturation": 25, "luminance": 35}',
            yellow: '{"hue": 20, "saturation": 30, "luminance": 40}',
            green: '{"hue": 25, "saturation": 35, "luminance": 45}'
        }
    });
    
    // Test Case 3: Gemini API response format
    testHSLDataFormat('Gemini API Response Format', {
        candidates: [{
            content: {
                parts: [{
                    text: '```json\n{\n  "hsl": {\n    "red": {\n      "hue": 10,\n      "saturation": 20,\n      "luminance": 30\n    },\n    "orange": {\n      "hue": 15,\n      "saturation": 25,\n      "luminance": 35\n    }\n  }\n}\n```'
                }]
            }
        }]
    });
    
    // Test Case 4: Metadata string format
    testHSLDataFormat('Metadata String Format', {
        metadata: '{"hsl": {"red": {"hue": 10, "saturation": 20, "luminance": 30}, "orange": {"hue": 15, "saturation": 25, "luminance": 35}}}'
    });
    
    console.log('=== HSL TAB POPULATION TEST COMPLETE ===');
    
    // Clean up test container
    document.body.removeChild(testContainer);
    
    return 'Test completed. Check console for results.';
}

/**
 * Test HSL data parsing with different data formats
 * @param {string} testName - Name of the test case
 * @param {Object} testData - Test data to use
 */
function testHSLDataFormat(testName, testData) {
    console.log(`\n--- Testing ${testName} ---`);
    console.log('Input data:', JSON.stringify(testData, null, 2));
    
    // Clear the HSL table before each test
    const hslTbody = document.getElementById('hsl-adjustments');
    if (hslTbody) {
        hslTbody.innerHTML = '';
    }
    
    // Call populateAdjustmentTabs with test data
    populateAdjustmentTabs(testData);
    
    // Verify the HSL table content
    verifyHSLTableContent();
}

/**
 * Verify the content of the HSL table
 */
function verifyHSLTableContent() {
    const hslTbody = document.getElementById('hsl-adjustments');
    if (!hslTbody) {
        console.error('HSL table body not found');
        return;
    }
    
    // Check if tbody has rows
    const rows = hslTbody.querySelectorAll('tr');
    console.log('HSL tbody has rows:', rows.length > 0);
    console.log('Number of rows in HSL table:', rows.length);
    
    if (rows.length === 0) {
        console.log('No rows found in HSL table. This could be because:');
        console.log('1. The HSL data was not correctly parsed');
        console.log('2. The HSL data was empty');
        console.log('3. There was an error in the populateAdjustmentTab function');
        
        // Check the current preset data to see if HSL data was extracted
        if (window.currentPresetData && window.currentPresetData.hsl) {
            console.log('HSL data in currentPresetData:', JSON.stringify(window.currentPresetData.hsl, null, 2));
        } else {
            console.log('No HSL data found in currentPresetData');
        }
        return;
    }
    
    // Log the content of each row for verification
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
            console.log(`Row ${index}: Color=${cells[0].textContent}, Hue=${cells[1].textContent}, Saturation=${cells[2].textContent}, Luminance=${cells[3].textContent}`);
            
            // Validate that the values are numbers, not JSON strings
            const hue = cells[1].textContent;
            const saturation = cells[2].textContent;
            const luminance = cells[3].textContent;
            
            const isHueValid = !isNaN(parseFloat(hue)) || hue === '0';
            const isSaturationValid = !isNaN(parseFloat(saturation)) || saturation === '0';
            const isLuminanceValid = !isNaN(parseFloat(luminance)) || luminance === '0';
            
            console.log(`  Validation: Hue=${isHueValid ? '✓' : '✗'}, Saturation=${isSaturationValid ? '✓' : '✗'}, Luminance=${isLuminanceValid ? '✓' : '✗'}`);
            
            if (!isHueValid || !isSaturationValid || !isLuminanceValid) {
                console.error('  Invalid values detected! Values should be numbers, not JSON strings.');
            }
        } else {
            console.log(`Row ${index} has insufficient cells:`, row.textContent);
        }
    });
}

// Export the test functions to be available in the global scope
window.testHSLTabPopulation = testHSLTabPopulation;
window.testHSLDataFormat = testHSLDataFormat;
window.verifyHSLTableContent = verifyHSLTableContent;

// Log that the test script has been loaded
console.log('HSL tab test script loaded. Run testHSLTabPopulation() to execute the test.');
