/**
 * Preset Module
 * Handles preset creation, display, and management
 */



/**
 * Shows the preset preview
 * @param {string} presetId - ID of the preset
 * @param {string} imageUrl - URL of the image
 * @param {Object|string} presetData - Preset data (can be object or JSON string)
 */
function showPresetPreview(presetId, imageUrl, presetData) {
    console.log('Showing preset metadata:', { presetId });
    
    // Show the metadata-display section
    const metadataSection = document.getElementById('metadata-display');
    if (metadataSection) {
        metadataSection.style.display = 'block';
    } else {
        console.error('Metadata display section not found');
        return;
    }
    
    // Get elements
    const metadataContainer = document.querySelector('.metadata-container');
    const downloadButton = document.getElementById('download-button');
    
    if (!metadataContainer || !downloadButton) {
        console.error("[Preset] Metadata elements not found:", {
            container: !!metadataContainer,
            button: !!downloadButton
        });
        return;
    }
    
    // Parse preset data if it's a string
    let parsedPresetData = presetData;
    if (typeof presetData === 'string') {
        try {
            parsedPresetData = JSON.parse(presetData);
            console.log('Parsed preset data:', parsedPresetData);
        } catch (e) {
            console.error('Error parsing preset data:', e);
            alert('Error parsing preset data. Please try again.');
            return;
        }
    }
    
    // CRITICAL: Ensure the data structure has the necessary properties for temperature and HSL
    if (!parsedPresetData.basic) parsedPresetData.basic = {};
    if (!parsedPresetData.color) parsedPresetData.color = {};
    
    // Extract temperature data from any location and ensure it's in the basic tab
    const findTemperature = (data) => {
        // Look for temperature in any property at any level
        for (const [key, value] of Object.entries(data)) {
            if (key.toLowerCase() === 'temperature' || key.toLowerCase() === 'temp') {
                console.log('Found temperature value:', value, 'in key:', key);
                return value;
            } else if (typeof value === 'object' && value !== null) {
                // Check nested objects
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (nestedKey.toLowerCase() === 'temperature' || nestedKey.toLowerCase() === 'temp') {
                        console.log('Found nested temperature value:', nestedValue, 'in key:', key + '.' + nestedKey);
                        return nestedValue;
                    }
                }
            }
        }
        console.log('No temperature value found in data');
        return null;
    };
    
    // Extract absolute kelvin value from any location
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
    
    // Extract HSL data from any location
    const findHSL = (data) => {
        // Look for HSL in any property at any level
        for (const [key, value] of Object.entries(data)) {
            if (key.toLowerCase() === 'hsl') {
                console.log('[findHSL] Found HSL at root level:', value);
                return value;
            } else if (typeof value === 'object' && value !== null) {
                // Check nested objects
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (nestedKey.toLowerCase() === 'hsl') {
                        console.log('[findHSL] Found HSL in nested object:', nestedValue);
                        return nestedValue;
                    }
                }
            }
        }
        
        // Check for color-specific HSL data (red, orange, etc.)
        const colorKeys = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
        const hslData = {};
        let foundColorData = false;
        
        // Look for color objects at root level or in color object
        for (const colorKey of colorKeys) {
            // Check at root level
            if (data[colorKey] && typeof data[colorKey] === 'object') {
                hslData[colorKey] = data[colorKey];
                foundColorData = true;
            }
            // Check in color object
            else if (data.color && data.color[colorKey] && typeof data.color[colorKey] === 'object') {
                hslData[colorKey] = data.color[colorKey];
                foundColorData = true;
            }
        }
        
        if (foundColorData) {
            console.log('[findHSL] Found color-specific HSL data:', hslData);
            return hslData;
        }
        
        // If no HSL data found, return null so we can use data from the LLM response
        console.log('[findHSL] No HSL data found in preset, will use data from LLM response');
        return null;
    };
    
    // Set temperature in both basic and color tabs
    const temperature = findTemperature(parsedPresetData);
    if (temperature !== null) {
        parsedPresetData.basic.temperature = temperature;
        parsedPresetData.color.temperature = temperature; // Also add to color tab
        console.log('Setting temperature in tabs:', temperature);
    } else {
        // If no temperature found, set a default value to ensure it appears in the color tab
        parsedPresetData.color.temperature = 5500;
        console.log('No temperature found, setting default value in color tab: 5500');
    }
    
    // Set absolute_kelvin in basic tab
    const absoluteKelvin = findAbsoluteKelvin(parsedPresetData);
    if (absoluteKelvin !== null) {
        parsedPresetData.basic.absolute_kelvin = absoluteKelvin;
        console.log('Setting absolute_kelvin in basic tab:', absoluteKelvin);
    }
    
    // Set HSL at the root level (not in color tab)
    const hsl = findHSL(parsedPresetData);
    if (hsl !== null) {
        parsedPresetData.hsl = hsl;
        console.log('Setting HSL at root level:', hsl);
    }
    
    // If we still don't have temperature data, add a default
    if (!parsedPresetData.basic.temperature && !parsedPresetData.basic.absolute_kelvin) {
        parsedPresetData.basic.temperature = 0;
        parsedPresetData.basic.absolute_kelvin = 5500;
    }
    
    // We'll let the HSL data come from the LLM response
    // Don't add default values here as they should come from the API response
    if (!parsedPresetData.hsl) {
        console.log('[Preset] No HSL data found in preset. Will use data from LLM response.');
    } else {
        console.log('[Preset] Using HSL data from preset:', parsedPresetData.hsl);
    }
    
    // Debug: Log the structure of the data to understand what we're working with
    console.log('Preset data structure:', {
        type: typeof parsedPresetData,
        hasBasic: parsedPresetData.hasOwnProperty('basic'),
        hasColor: parsedPresetData.hasOwnProperty('color'),
        hasDetail: parsedPresetData.hasOwnProperty('detail'),
        hasEffects: parsedPresetData.hasOwnProperty('effects'),
        keys: Object.keys(parsedPresetData)
    });
    
    if (parsedPresetData.basic) {
        console.log('Basic adjustments:', parsedPresetData.basic);
        console.log('Has temperature:', parsedPresetData.basic.hasOwnProperty('temperature'));
        console.log('Has absolute_kelvin:', parsedPresetData.basic.hasOwnProperty('absolute_kelvin'));
    }
    
    if (parsedPresetData.color) {
        console.log('Color adjustments:', parsedPresetData.color);
        console.log('Has hsl:', parsedPresetData.color.hasOwnProperty('hsl'));
    }
    
    // Populate adjustment tabs
    populateAdjustmentTabs(parsedPresetData, presetId);
    
    // Set up tab switching
    setupTabSwitching();
    
    // Set up download button
    downloadButton.onclick = function() {
        initiateCheckout(presetId);
    };
    
    // Scroll to the metadata display
    metadataContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Populates all adjustment tabs
 * @param {Object} presetData - Preset data
 * @param {string} presetId - ID of the preset
 */
function populateAdjustmentTabs(presetData, presetId) {
    console.log('Raw preset data for tabs:', presetData);
    
    // Create a restructured data object to ensure consistent tab population
    const restructuredData = {
        basic: {},
        color: {},
        detail: {},
        effects: {}
    };
    
    // Store preset ID and data
    const metadataContainer = document.querySelector('.metadata-container');
    if (metadataContainer) {
        metadataContainer.dataset.presetId = presetId;
        
        // Ensure HSL data is properly included in restructuredData
        if (presetData.hsl && !restructuredData.hsl) {
            restructuredData.hsl = presetData.hsl;
            console.log('[Preset] Added HSL data from original preset to restructured data');
        }
        
        // Store both the original and restructured data for tab switching
        metadataContainer.dataset.presetData = JSON.stringify(restructuredData);
        metadataContainer.dataset.originalPresetData = JSON.stringify(presetData);
        console.log('[Preset] Stored preset data in metadata container for tab switching');
        
        // We don't need to recreate the structure - it already exists in the HTML
        console.log('[Preset] Using existing HTML structure for tabs and tables');
    } else {
        console.error('Metadata container not found');
    }
    
    // Handle different data structures that might come from the backend or LLM
    if (typeof presetData === 'object' && presetData !== null) {
        // Case 1: Data is already structured with tabs (basic, color, detail, effects)
        if (presetData.basic || presetData.color || presetData.detail || presetData.effects) {
            if (presetData.basic) restructuredData.basic = presetData.basic;
            if (presetData.color) restructuredData.color = presetData.color;
            if (presetData.detail) restructuredData.detail = presetData.detail;
            if (presetData.effects) restructuredData.effects = presetData.effects;
        } 
        // Case 2: Data is a flat structure, need to organize into tabs
        else {
            // Temperature and related values go to basic tab
            if (presetData.temperature !== undefined || 
                presetData.Temperature !== undefined || 
                presetData.absolute_kelvin !== undefined || 
                presetData.absoluteKelvin !== undefined) {
                
                restructuredData.basic.temperature = presetData.temperature || presetData.Temperature;
                restructuredData.basic.absolute_kelvin = presetData.absolute_kelvin || presetData.absoluteKelvin;
            }
            
            // Move HSL data to its own property at the root level
            if (presetData.hsl || presetData.HSL) {
                restructuredData.hsl = presetData.hsl || presetData.HSL;
                console.log('[Preset] Found HSL data at root level:', restructuredData.hsl);
            }
            
            // Also check for HSL data using the findHSL helper function
            const hslData = findHSL(presetData);
            if (hslData && !restructuredData.hsl) {
                restructuredData.hsl = hslData;
                console.log('[Preset] Found HSL data using helper function:', hslData);
            } 
            
            // Check for HSL in the color object
            if (presetData.color) {
                if (presetData.color.hsl || presetData.color.HSL) {
                    restructuredData.hsl = presetData.color.hsl || presetData.color.HSL;
                    console.log('[Preset] Found HSL data in color object:', restructuredData.hsl);
                    // Remove it from color to avoid duplication
                    if (presetData.color.hsl) delete presetData.color.hsl;
                    if (presetData.color.HSL) delete presetData.color.HSL;
                }
                
                // No HSL handling in original version
            }
            
            // Distribute other properties to appropriate tabs based on their nature
            for (const [key, value] of Object.entries(presetData)) {
                // Skip already processed properties
                if (key.toLowerCase() === 'temperature' || 
                    key.toLowerCase() === 'absolute_kelvin' || 
                    key.toLowerCase() === 'absolutekelvin' || 
                    key.toLowerCase() === 'hsl') {
                    continue;
                }
                
                // Categorize remaining properties
                if (['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'].includes(key.toLowerCase())) {
                    restructuredData.basic[key] = value;
                } else if (['vibrance', 'saturation', 'tint', 'colorgrading'].includes(key.toLowerCase())) {
                    restructuredData.color[key] = value;
                } else if (['texture', 'clarity', 'dehaze', 'sharpening', 'noise'].includes(key.toLowerCase())) {
                    restructuredData.detail[key] = value;
                } else if (['vignette', 'grain', 'split', 'toning'].includes(key.toLowerCase())) {
                    restructuredData.effects[key] = value;
                } else {
                    // Default to basic for unknown properties
                    restructuredData.basic[key] = value;
                }
            }
        }
    }
    
    console.log('Restructured data for tabs:', restructuredData);
    
    // Populate each tab with the restructured data
    populateAdjustmentTab('basic-adjustments', restructuredData.basic);
    populateAdjustmentTab('color-adjustments', restructuredData.color);
    populateAdjustmentTab('detail-adjustments', restructuredData.detail);
    populateAdjustmentTab('effects-adjustments', restructuredData.effects);
    

}

/**
 * Sets up tab switching functionality
 */
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.preset-tab');
    const tabContents = document.querySelectorAll('.preset-tab-content');
    
    console.log(`[Preset] Setting up tab switching for ${tabs.length} tabs and ${tabContents.length} tab contents`);
    
    // Log all tabs and their data-tab attributes for debugging
    tabs.forEach((tab, index) => {
        console.log(`[Preset] Tab ${index}: data-tab=${tab.getAttribute('data-tab')}`);
    });
    
    // Log all tab contents and their IDs for debugging
    tabContents.forEach((content, index) => {
        console.log(`[Preset] Tab content ${index}: id=${content.id}`);
    });
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Show the corresponding tab content
            const tabId = tab.getAttribute('data-tab');
            console.log(`[Preset] Activating tab content with ID: ${tabId}`);
            
            // Find the corresponding tab content element
            // Try different ID formats since there might be inconsistency
            let tabContent = document.getElementById(tabId);
            
            // If not found, try with -tab suffix
            if (!tabContent && !tabId.endsWith('-tab') && !tabId.endsWith('-adjustments')) {
                tabContent = document.getElementById(`${tabId}-tab`);
                console.log(`[Preset] Trying alternate tab ID: ${tabId}-tab`);
            }
            
            // If still not found, try with -adjustments suffix
            if (!tabContent && !tabId.endsWith('-adjustments')) {
                tabContent = document.getElementById(`${tabId}-adjustments`);
                console.log(`[Preset] Trying alternate tab ID: ${tabId}-adjustments`);
            }
            
            if (tabContent) {
                tabContent.classList.add('active');
                console.log(`[Preset] Successfully activated tab content: ${tabContent.id}`);
                
                // Check if the tab content is empty (might have been cleared)
                const table = tabContent.querySelector('.adjustments-table');
                if (!table || !table.querySelector('tbody') || table.querySelector('tbody').children.length === 0) {
                    console.log(`[Preset] Tab content appears empty, repopulating: ${tabId}`);
                    
                    // Get the preset data from the metadata container
                    const metadataContainer = document.querySelector('.metadata-container');
                    if (metadataContainer && metadataContainer.dataset.presetId) {
                        const presetId = metadataContainer.dataset.presetId;
                        console.log(`[Preset] Retrieving data for preset ID: ${presetId}`);
                        
                        // We don't need to fetch the data again, as it should be in the DOM
                        // Just repopulate the current tab
                        const presetData = JSON.parse(metadataContainer.dataset.presetData || '{}');
                        
                        if (Object.keys(presetData).length > 0) {
                            console.log(`[Preset] Found preset data, repopulating tab: ${tabId}`);
                            
                            // Determine which tab we're on and populate accordingly
                            // Check for both -tab and -adjustments suffix since there might be inconsistency
                            if (tabId === 'basic' || tabId === 'basic-tab' || tabId === 'basic-adjustments') {
                                populateAdjustmentTab('basic-adjustments', presetData.basic || {});
                            } else if (tabId === 'color' || tabId === 'color-tab' || tabId === 'color-adjustments') {
                                populateAdjustmentTab('color-adjustments', presetData.color || {});
                            } else if (tabId === 'detail' || tabId === 'detail-tab' || tabId === 'detail-adjustments') {
                                populateAdjustmentTab('detail-adjustments', presetData.detail || {});
                            } else if (tabId === 'effects' || tabId === 'effects-tab' || tabId === 'effects-adjustments') {
                                populateAdjustmentTab('effects-adjustments', presetData.effects || {});
                            } else if (tabId === 'hsl' || tabId === 'hsl-tab' || tabId === 'hsl-adjustments') {
                                // Use the correct tab ID for HSL tab
                                const hslTabElement = document.getElementById('hsl-tab') || document.getElementById('hsl-adjustments');
                                if (hslTabElement) {
                                    // Log the HSL data for debugging
                                    console.log('[Preset] HSL data for repopulation:', presetData.hsl);
                                    
                                    // Always use HSL data from the LLM response
                                    if (!presetData.hsl) {
                                        console.log('[Preset] No HSL data found in preset, will use data from LLM response');
                                        presetData.hsl = {};
                                    } else {
                                        console.log('[Preset] Using HSL data from preset for tab repopulation:', presetData.hsl);
                                    }
                                    
                                    populateHSLTab(hslTabElement.id, presetData.hsl || {});
                                } else {
                                    console.error('[Preset] Could not find HSL tab element');
                                }
                            }
                        }
                    }
                }
            } else {
                console.error(`[Preset] Tab content not found for tab ID: ${tabId}`);
            }
        });
    });
}

/**
 * Converts a Lightroom temperature slider value to Kelvin
 * @param {number} lrValue - Lightroom temperature slider value (-100 to +100)
 * @returns {number} - Temperature in Kelvin
 */
function convertLightroomTemperatureToKelvin(lrValue) {
    // Constants from backend
    const neutralKelvin = 5500;
    const kelvinMin = 2000;
    const kelvinMax = 50000;
    const lrMin = -100;
    const lrMax = 100;
    
    let kelvin = 0;
    
    if (lrValue > 0) { // Positive values = cooler/blue
        const position = lrValue / lrMax;
        kelvin = neutralKelvin - (position * (neutralKelvin - kelvinMin));
    } else if (lrValue < 0) { // Negative values = warmer/yellow
        const position = -lrValue / lrMin;
        kelvin = neutralKelvin + (position * (kelvinMax - neutralKelvin));
    } else { // lrValue == 0
        kelvin = neutralKelvin;
    }
    
    return Math.round(kelvin);
}

/**
 * Populates an HSL tab with color adjustments
 * @param {string} tabId - ID of the tab
 * @param {Object} hslData - HSL data with color adjustments
 */
function populateHSLTab(tabId, hslData) {
    // Convert tab ID to match the structure in index.html
    let tabContentId;
    if (tabId === 'hsl-adjustments') {
        tabContentId = 'hsl-tab';
    } else if (tabId === 'hsl') {
        tabContentId = 'hsl-tab';
    } else {
        tabContentId = tabId;
    }
    
    const tabElement = document.getElementById(tabContentId);
    if (!tabElement) {
        console.error(`[Preset] HSL tab element not found: ${tabContentId}`);
        return;
    }
    
    console.log(`Populating HSL tab ${tabContentId} with data:`, hslData);
    
    // Add more detailed debugging for HSL data
    console.log(`[Preset] HSL data type: ${typeof hslData}`);
    console.log(`[Preset] HSL data keys: ${Object.keys(hslData)}`);
    console.log(`[Preset] HSL data stringified: ${JSON.stringify(hslData)}`);
    
    // Always use the HSL data from the LLM response
    if (!hslData || typeof hslData !== 'object') {
        console.log(`[Preset] No valid HSL data to display for tab: ${tabContentId}`);
        // Initialize as empty object - don't create default values
        hslData = {};
        console.log(`[Preset] Using empty HSL data object, will be populated from LLM response`);
    } else {
        // Even if the object is empty, use it as is - don't create default values
        console.log(`[Preset] Using provided HSL data for display:`, hslData);
        
        // Debug the HSL data structure in detail
        console.log(`[Preset] HSL data keys: ${Object.keys(hslData)}`);
        for (const key of Object.keys(hslData)) {
            console.log(`[Preset] HSL data for ${key}:`, hslData[key]);
        }
    }
    
    // Always create a fresh table structure
    console.log(`[Preset] Creating new table for HSL tab: ${tabContentId}`);
    tabElement.innerHTML = '';
    
    // Create a new table with proper structure
    const table = document.createElement('table');
    table.className = 'adjustments-table';
    
    // Create column group for consistent widths
    const colgroup = document.createElement('colgroup');
    const col1 = document.createElement('col');
    col1.style.width = '60%'; // Parameter column
    const col2 = document.createElement('col');
    col2.style.width = '40%'; // Value column
    colgroup.appendChild(col1);
    colgroup.appendChild(col2);
    table.appendChild(colgroup);
    
    // Create table header
    // const thead = document.createElement('thead');
    // const headerRow = document.createElement('tr');
    
    // const th1 = document.createElement('th');
    // th1.style.textAlign = 'left';
    // th1.style.paddingLeft = '1.25rem';
    // th1.textContent = 'Parameter';
    
    // const th2 = document.createElement('th');
    // th2.style.textAlign = 'right';
    // th2.style.paddingRight = '1.75rem';
    // th2.textContent = 'Value';
    
    // headerRow.appendChild(th1);
    // headerRow.appendChild(th2);
    // thead.appendChild(headerRow);
    // table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    
    // Add table to tab content
    tabElement.appendChild(table);
    
    // Log that we're populating the tbody
    console.log(`[Preset] Populating HSL tab tbody: ${tabContentId}`);
    
    // Create a header row for HSL
    const hslHeaderRow = document.createElement('tr');
    hslHeaderRow.className = 'adjustment-group-header';
    
    const headerCell = document.createElement('td');
    headerCell.colSpan = 2;
    headerCell.textContent = 'HSL Color Adjustments';
    
    console.log('[Preset] Creating HSL header row');
    // Let CSS handle the styling
    hslHeaderRow.appendChild(headerCell);
    tbody.appendChild(hslHeaderRow);
    
    // Check if HSL has the backend structure (with color keys)
    const colorKeys = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
    const hasColorStructure = colorKeys.some(color => hslData[color] !== undefined);
    
    console.log('[Preset] HSL structure check:', {
        hasColorStructure,
        foundColors: colorKeys.filter(color => hslData[color] !== undefined),
        hslDataKeys: Object.keys(hslData)
    });
    
    // Force display of HSL data if it exists but isn't being detected properly
    if (!hasColorStructure && Object.keys(hslData).length > 0) {
        console.log('[Preset] HSL data exists but not in expected structure, forcing display');
        // Check if we have a nested structure
        if (hslData.hsl && typeof hslData.hsl === 'object') {
            hslData = hslData.hsl;
            console.log('[Preset] Found nested HSL data, using:', hslData);
        }
    }
    
    if (hasColorStructure) {
        // Process each color that has adjustments
        for (const [colorName, colorAdjustments] of Object.entries(hslData)) {
            // Skip empty color adjustments
            if (!colorAdjustments || Object.keys(colorAdjustments).length === 0) continue;
            
            // Create a subheader for the color
            const colorHeaderRow = document.createElement('tr');
            colorHeaderRow.className = 'adjustment-color-header';
            
            const colorHeaderCell = document.createElement('td');
            colorHeaderCell.colSpan = 2;
            colorHeaderCell.textContent = formatLabel(colorName) + ' Adjustments';
            // Let CSS handle the styling
            colorHeaderRow.appendChild(colorHeaderCell);
            tbody.appendChild(colorHeaderRow);
            
            // Create rows for each HSL component for this color
            for (const [hslKey, hslValue] of Object.entries(colorAdjustments)) {
                const hslRow = document.createElement('tr');
                hslRow.className = 'adjustment-subitem';
                
                // Create label cell
                const hslLabelCell = document.createElement('td');
                hslLabelCell.className = 'adjustment-sublabel';
                hslLabelCell.textContent = formatLabel(hslKey);
                // Let CSS handle the styling
                hslRow.appendChild(hslLabelCell);
                
                // Create value cell
                const hslValueCell = document.createElement('td');
                hslValueCell.className = 'adjustment-value';
                hslValueCell.textContent = formatValue(hslValue);
                // Let CSS handle the styling
                
                hslRow.appendChild(hslValueCell);
                tbody.appendChild(hslRow);
            }
        }
    } else {
        // Handle simple HSL object (with h, s, l properties)
        for (const [hslKey, hslValue] of Object.entries(hslData)) {
            // Skip if the value is an empty object
            if (typeof hslValue === 'object' && Object.keys(hslValue).length === 0) continue;
            
            const hslRow = document.createElement('tr');
            hslRow.className = 'adjustment-subitem';
            
            // Create label cell
            const hslLabelCell = document.createElement('td');
            hslLabelCell.className = 'adjustment-sublabel';
            hslLabelCell.textContent = formatLabel(hslKey);
            hslRow.appendChild(hslLabelCell);
            
            // Create value cell
            const hslValueCell = document.createElement('td');
            hslValueCell.className = 'adjustment-value';
            
            if (typeof hslValue === 'object' && hslValue !== null) {
                // If it's an object with h, s, l properties
                if (hslValue.h !== undefined && hslValue.s !== undefined && hslValue.l !== undefined) {
                    hslValueCell.textContent = `H: ${hslValue.h}, S: ${hslValue.s}, L: ${hslValue.l}`;
                } else {
                    hslValueCell.textContent = JSON.stringify(hslValue);
                }
            } else {
                hslValueCell.textContent = formatValue(hslValue);
            }
            
            hslRow.appendChild(hslValueCell);
            tbody.appendChild(hslRow);
        }
    }
}

/**
 * Populates an adjustment tab
 * @param {string} tabId - ID of the tab
 * @param {Object} adjustments - Adjustment data
 */
function populateAdjustmentTab(tabId, adjustments) {
    // Get the correct tbody ID based on the tab ID
    let tbodyId;
    if (tabId.endsWith('-adjustments')) {
        tbodyId = tabId;
    } else if (tabId.endsWith('-tab')) {
        // For index.html, the tbody has the same ID as the tab
        tbodyId = tabId.replace('-tab', '-adjustments');
    } else {
        tbodyId = `${tabId}-adjustments`;
    }
    
    console.log(`[Preset] Looking for tbody with ID: ${tbodyId}`);
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        // Try finding the tbody directly in the tab content
        const tabContent = document.getElementById(tabId);
        if (!tabContent) {
            console.error(`[Preset] Tab content element not found: ${tabId}`);
            return;
        }
        const tbodyInTab = tabContent.querySelector('tbody');
        if (!tbodyInTab) {
            console.error(`[Preset] Could not find tbody in tab: ${tabId}`);
            return;
        }
        // Use the tbody we found
        console.log(`[Preset] Found tbody in tab content: ${tabId}`);
        tbodyId = tbodyInTab.id || tabId;
    }
    
    // Clear the tbody to prevent duplicate rows
    console.log(`[Preset] Clearing tbody for: ${tbodyId}`);
    tbody.innerHTML = '';
    
    console.log(`[Preset] Populating adjustments for tab: ${tbodyId}`, adjustments);
    
    // For color tab, ensure temperature is included
    if (tabId === 'color' && !adjustments.temperature) {
        adjustments.temperature = 5500; // Default temperature
        console.log(`[Preset] Adding default temperature to color tab:`, adjustments);
    }
    
    // Check if we have any adjustments to display
    if (!adjustments || Object.keys(adjustments).length === 0) {
        console.log(`[Preset] No adjustments to display for tab: ${tbodyId}`);
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'adjustment-row';
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 2;
        emptyCell.className = 'empty-adjustments';
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '1rem';
        emptyCell.textContent = 'No adjustments available';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }
    
    // We're now working directly with the existing tbody element
    // No need to create a new table structure
    
    // Add each adjustment
    for (const [key, value] of Object.entries(adjustments)) {
        // Skip the absolute_kelvin entry as we'll use it for temperature display
        if (key === 'absolute_kelvin' || key === 'absoluteKelvin' || key === 'Absolute_Kelvin') continue;
        
        // Skip HSL data in regular tabs - it will be shown in its own tab
        if ((key === 'hsl' || key === 'HSL') && typeof value === 'object' && value !== null) {
            console.log('Skipping HSL data in regular tab - will be shown in HSL tab');
            continue;
        }
        
        const row = document.createElement('tr');
        row.className = 'adjustment-row';
        
        // Create label cell
        const labelCell = document.createElement('td');
        labelCell.className = 'adjustment-label';
        labelCell.style.textAlign = 'left';
        labelCell.style.paddingLeft = '1.25rem';
        labelCell.textContent = key === 'temperature' ? 'Temperature' : formatLabel(key);
        row.appendChild(labelCell);
        
        // Create value cell
        const valueCell = document.createElement('td');
        valueCell.className = 'adjustment-value';
        valueCell.style.textAlign = 'right';
        valueCell.style.paddingRight = '1.75rem';
        
        // Special handling for temperature
        if (key.toLowerCase() === 'temperature') {
            let kelvinValue;
            
            // Log all temperature-related values for debugging
            console.log('[Preset] Temperature handling:', {
                key,
                value,
                absolute_kelvin: adjustments.absolute_kelvin,
                absoluteKelvin: adjustments.absoluteKelvin,
                Absolute_Kelvin: adjustments.Absolute_Kelvin,
                valueType: typeof value,
                valueIsObject: typeof value === 'object' && value !== null
            });
            
            // Case 1: We have an absolute_kelvin value directly available
            if (adjustments.absolute_kelvin || adjustments.absoluteKelvin || adjustments.Absolute_Kelvin) {
                kelvinValue = adjustments.absolute_kelvin || adjustments.absoluteKelvin || adjustments.Absolute_Kelvin;
                console.log('[Preset] Using absolute_kelvin value:', kelvinValue);
            }
            // Case 2: Temperature is an object with a kelvin property
            else if (typeof value === 'object' && value !== null && (value.kelvin || value.Kelvin)) {
                kelvinValue = value.kelvin || value.Kelvin;
                console.log('[Preset] Using kelvin property from object:', kelvinValue);
            }
            // Case 3: Temperature is a Lightroom slider value (-100 to +100)
            else if (typeof value === 'number' && value >= -100 && value <= 100) {
                kelvinValue = convertLightroomTemperatureToKelvin(value);
                console.log('[Preset] Converted Lightroom slider value to Kelvin:', value, '->', kelvinValue);
            }
            // Case 4: Temperature is a direct Kelvin value
            else if (typeof value === 'number' && value >= 2000 && value <= 50000) {
                kelvinValue = value;
                console.log('[Preset] Using direct Kelvin value:', kelvinValue);
            }
            // Case 5: String that might be a number
            else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                const numValue = parseFloat(value);
                if (numValue >= -100 && numValue <= 100) {
                    // Likely a Lightroom slider value
                    kelvinValue = convertLightroomTemperatureToKelvin(numValue);
                    console.log('[Preset] Converted string Lightroom slider value to Kelvin:', numValue, '->', kelvinValue);
                } else if (numValue >= 2000 && numValue <= 50000) {
                    // Likely a direct Kelvin value
                    kelvinValue = numValue;
                    console.log('[Preset] Using string Kelvin value:', kelvinValue);
                }
            }
            // Case 6: Check if there's a temperature property in the parent object
            else if (adjustments.temperature !== undefined) {
                const tempValue = adjustments.temperature;
                if (typeof tempValue === 'number') {
                    if (tempValue >= -100 && tempValue <= 100) {
                        kelvinValue = convertLightroomTemperatureToKelvin(tempValue);
                        console.log('[Preset] Converted parent temperature to Kelvin:', tempValue, '->', kelvinValue);
                    } else if (tempValue >= 2000 && tempValue <= 50000) {
                        kelvinValue = tempValue;
                        console.log('[Preset] Using parent Kelvin value:', kelvinValue);
                    }
                }
            }
            
            // Display the temperature in Kelvin
            if (kelvinValue) {
                valueCell.textContent = `${Math.round(kelvinValue)}K`;
                console.log('[Preset] Temperature displayed as:', valueCell.textContent);
            } else {
                // Fallback to the original value if we couldn't determine a Kelvin value
                valueCell.textContent = formatValue(value);
                console.log('[Preset] Temperature displayed without conversion:', valueCell.textContent);
            }
        }
        // Handle other nested objects (not arrays)
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Check if it's a color object with RGB or HSL properties
            if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
                valueCell.textContent = `RGB(${value.r}, ${value.g}, ${value.b})`;
            } else if (value.h !== undefined && value.s !== undefined && value.l !== undefined) {
                valueCell.textContent = `HSL(${value.h}, ${value.s}, ${value.l})`;
            } else {
                valueCell.textContent = JSON.stringify(value);
            }
        } else {
            valueCell.textContent = formatValue(value);
        }
        
        row.appendChild(valueCell);
        
        // Add row directly to the existing tbody
        tbody.appendChild(row);
    }
}

/**
 * Formats an adjustment label
 * @param {string} key - Adjustment key
 * @returns {string} Formatted label
 */
function formatLabel(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Formats an adjustment value
 * @param {any} value - Adjustment value
 * @returns {string} Formatted value
 */
function formatValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    
    // Handle numbers with decimal precision
    if (typeof value === 'number') {
        // If it's a whole number or close to it
        if (Math.abs(value - Math.round(value)) < 0.001) {
            return Math.round(value).toString();
        }
        // Otherwise format with up to 2 decimal places
        return value.toFixed(2);
    }
    
    // Handle booleans
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    
    // Handle objects (shouldn't happen, but just in case)
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return '[Object]';
        }
    }
    
    // Default: convert to string
    return value.toString();
}

/**
 * Initiates checkout process
 * @param {string} presetId - ID of the preset
 */
function initiateCheckout(presetId) {
    // Check if user is authenticated
    if (!window.auth.isAuthenticated()) {
        alert('Please sign in to download presets');
        return;
    }
    
    // Show loading state
    const downloadButton = document.getElementById('download-button');
    if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    // Add auth token to headers
    const headers = {
        'Content-Type': 'application/json'
    };
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Create checkout session
    fetch(window.utils.getApiUrl(`/preset/${presetId}/checkout`), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ user_id: window.auth.getUserId() })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Checkout successful:', data);
        
        // Download the preset using the session ID from the response
        if (data && data.id) {
            downloadPreset(presetId, data.id);
        } else {
            throw new Error('Invalid checkout response: missing session ID');
        }
        
        // Reset button
        if (downloadButton) {
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<i class="fas fa-download"></i> Download Preset';
        }
    })
    .catch(error => {
        console.error('Error creating checkout:', error);
        alert('Error creating checkout: ' + error.message);
        
        // Reset button
        if (downloadButton) {
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<i class="fas fa-download"></i> Download Preset';
        }
    });
}

/**
 * Downloads a preset XMP file
 * @param {string} presetId - ID of the preset to download
 * @param {string} sessionId - Checkout session ID (if applicable)
 */
function downloadPreset(presetId, sessionId) {
    console.log(`Downloading preset: ${presetId}, session: ${sessionId}`);
    
    // Add auth token to headers
    const headers = {};
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Download the preset
    fetch(window.utils.getApiUrl(`/preset/${presetId}/download?session_id=${sessionId}`), {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check the content type to determine if it's a direct file or JSON with URL
        const contentType = response.headers.get('content-type');
        console.log(`Response content type: ${contentType}`);
        
        if (contentType && contentType.includes('application/json')) {
            // It's JSON with a URL
            return response.json().then(data => {
                console.log(`Received JSON data:`, data);
                
                if (!data.xmp_url) {
                    throw new Error('No XMP URL found in response');
                }
                
                console.log(`Fetching XMP from URL: ${data.xmp_url}`);
                
                // For signed URLs, fetch the content instead of opening directly
                return fetch(data.xmp_url)
                    .then(response => {
                        console.log(`XMP fetch response status: ${response.status}`);
                        console.log(`XMP fetch response headers:`, response.headers);
                        
                        if (!response.ok) {
                            throw new Error(`Failed to fetch XMP file: ${response.status}`);
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        console.log(`Received blob:`, blob);
                        
                        // Create download link for the blob
                        const url = window.URL.createObjectURL(blob);
                        console.log(`Created object URL: ${url}`);
                        
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `preset_${presetId}.xmp`;
                        document.body.appendChild(a);
                        
                        console.log(`Triggering download click`);
                        a.click();
                        
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        
                        return { success: true, method: 'url-to-blob' };
                    })
                    .catch(error => {
                        console.error(`Error fetching XMP file:`, error);
                        
                        // Try direct download as fallback
                        console.log(`Trying direct download as fallback`);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = data.xmp_url;
                        a.download = `preset_${presetId}.xmp`;
                        a.target = '_blank'; // Open in new tab to avoid CORS issues
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        return { success: true, method: 'direct-url-fallback' };
                    });
            });
        } else {
            // It's a direct file download
            console.log(`Handling direct file download`);
            
            return response.blob().then(blob => {
                console.log(`Received direct blob:`, blob);
                
                // Create download link for the blob
                const url = window.URL.createObjectURL(blob);
                console.log(`Created object URL for direct download: ${url}`);
                
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `preset_${presetId}.xmp`;
                document.body.appendChild(a);
                
                console.log(`Triggering direct download click`);
                a.click();
                
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                return { success: true, method: 'blob' };
            });
        }
    })
    .then(result => {
        console.log(`Preset downloaded successfully via ${result.method}`);
        // Success message in console only, no alert
    })
    .catch(error => {
        console.error('Error downloading preset:', error);
        // Show error in console only, no alert
    });
}

/**
 * Loads user presets for the dashboard
 */
function loadUserPresets() {
    console.log('Loading user presets...');
    
    // Show loading indicator if it exists
    const loadingPresets = document.getElementById('loading-presets');
    if (loadingPresets) {
        loadingPresets.style.display = 'flex';
    }
    
    // Get the authentication token
    const token = window.auth.getAuthToken();
    if (!token) {
        console.error('No authentication token found');
        
        // Hide loading indicator
        if (loadingPresets) {
            loadingPresets.style.display = 'none';
        }
        
        // Show empty state
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = '<i class="fas fa-lock"></i><h2>Authentication Required</h2><p>Please sign in to view your presets</p>';
        }
        
        return;
    }
    
    // Set up headers with authentication
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    // Fetch presets from the API
    fetch(window.utils.getApiUrl('/presets'), {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return response.json();
    })
    .then(data => {
        console.log('Presets loaded (raw data):', data);
        console.log('Data type:', typeof data);
        console.log('Has presets property:', data.hasOwnProperty('presets'));
        
        // Get presets array, handling different response formats
        let presets = [];
        if (data && data.hasOwnProperty('presets')) {
            presets = data.presets;
            console.log('Presets array from data.presets, length:', presets.length);
        } else if (data && Array.isArray(data)) {
            presets = data;
            console.log('Data is already an array, length:', presets.length);
        } else {
            console.log('No presets found in response');
        }
        
        // Display presets
        displayPresetsTable(presets);
    })
    .catch(error => {
        console.error('Error loading presets:', error);
        
        // Hide loading indicator
        if (loadingPresets) {
            loadingPresets.style.display = 'none';
        }
        
        // Show error message
        const presetContainer = document.getElementById('presets-table-body');
        if (presetContainer) {
            presetContainer.innerHTML = '';
        }
        
        // Show empty state with error
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = '<i class="fas fa-exclamation-triangle"></i><h2>Error Loading Presets</h2><p>Please try again later</p>';
        }
    });
}



/**
 * Deletes a preset
 * @param {string} presetId - ID of the preset
 */
function deletePreset(presetId) {
    // Check if user is authenticated
    if (!window.auth.isAuthenticated()) {
        alert('Please sign in to delete presets');
        return;
    }
    
    // Add auth token to headers
    const headers = {
        'Content-Type': 'application/json'
    };
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Delete the preset
    fetch(window.utils.getApiUrl(`/preset/${presetId}`), {
        method: 'DELETE',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Preset deleted:', data);
        
        // Reload presets
        loadUserPresets();
    })
    .catch(error => {
        console.error('Error deleting preset:', error);
        alert('Error deleting preset: ' + error.message);
    });
}

/**
 * Handles the Create Preset button click
 */
function handleCreatePresetClick() {
    console.log('Create Preset button clicked');
    
    // Check if an image is selected
    const previewImage = document.getElementById('previewImage');
    if (!previewImage || !previewImage.src || previewImage.src === '') {
        alert('Please upload an image first');
        return;
    }
    
    // Check if user is authenticated
    if (!window.auth.isAuthenticated()) {
        alert('Please sign in to create presets');
        return;
    }
    
    // Get the file from the upload module
    const file = window.upload.getSelectedFile();
    if (!file) {
        alert('Please upload an image first');
        return;
    }
    
    console.log('File selected:', file.name);
    
    // Show progress container
    const progressContainer = document.getElementById('upload-status');
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    
    // Start AI progress animation
    if (typeof window.utils !== 'undefined' && typeof window.utils.startAIProgressAnimation === 'function') {
        window.utils.startAIProgressAnimation();
    }
    
    // Get auth token
    const authToken = window.auth.getAuthToken();
    console.log('Auth token available:', !!authToken);
    
    // Create form data
    const formData = new FormData();
    formData.append('image', file);
    
    // Add auth token to headers
    const headers = {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    console.log('Uploading image to server...');
    
    // Get the base URL for API calls
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? 'http://localhost:8000' : '';
    const apiUrl = `${baseUrl}/upload`;
    
    console.log('Using API URL:', apiUrl);
    
    // Upload image
    fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: formData
    })
    .then(response => {
        console.log('Server response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        
        // Stop AI progress animation
        if (typeof window.utils !== 'undefined' && typeof window.utils.stopAIProgressAnimation === 'function') {
            window.utils.stopAIProgressAnimation();
        }
        
        // Hide progress container
        const progressContainer = document.getElementById('upload-status');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        // Show preset preview
        if (data.preset_id && data.image_url) {
            console.log('Showing preset preview with data:', {
                preset_id: data.preset_id,
                image_url: data.image_url,
                preset_data_type: typeof data.preset_data
            });
            showPresetPreview(data.preset_id, data.image_url, data.preset_data);
        } else {
            console.error('Invalid response data:', data);
            alert('An error occurred while creating the preset. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error uploading image:', error);
        console.error('Error details:', error.stack);
        console.error('Error message:', error.message);
        console.error('Error name:', error.name);
        
        // Stop AI progress animation
        if (typeof window.utils !== 'undefined' && typeof window.utils.stopAIProgressAnimation === 'function') {
            window.utils.stopAIProgressAnimation();
        }
        
        // Hide progress container
        const progressContainer = document.getElementById('upload-status');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        // Show a more specific error message if possible
        if (error.message) {
            alert(`Error: ${error.message}`);
        } else {
            alert('An error occurred while uploading the image. Please try again.');
        }
    });
}

/**
 * Initializes the Create Preset button
 */
function initializeCreatePresetButton() {
    const createPresetBtn = document.getElementById('createPresetBtn');
    if (createPresetBtn) {
        console.log('Initializing Create Preset button');
        
        // Remove any existing event listeners by cloning and replacing
        const newCreatePresetBtn = createPresetBtn.cloneNode(true);
        createPresetBtn.parentNode.replaceChild(newCreatePresetBtn, createPresetBtn);
        
        // Check authentication state
        const isAuth = typeof window.auth !== 'undefined' && 
                      typeof window.auth.isAuthenticated === 'function' && 
                      window.auth.isAuthenticated();
        
        if (isAuth) {
            // Enable the button
            newCreatePresetBtn.style.opacity = '1';
            newCreatePresetBtn.style.cursor = 'pointer';
            newCreatePresetBtn.title = 'Create Preset';
            
            // Add event listener for the Create Preset button
            newCreatePresetBtn.addEventListener('click', handleCreatePresetClick);
            console.log('Added event listener to Create Preset button');
        } else {
            // Disable the button
            newCreatePresetBtn.style.opacity = '0.5';
            newCreatePresetBtn.style.cursor = 'not-allowed';
            newCreatePresetBtn.title = 'Please sign in to create presets';
            
            // Add event listener that shows a message
            newCreatePresetBtn.addEventListener('click', function() {
                alert('Please sign in to create presets');
            });
            console.log('Disabled Create Preset button due to authentication state');
        }
    } else {
        console.log('Create Preset button not found on this page');
    }
}

/**
 * Loads preset details from the server
 * @param {string} presetId - ID of the preset to load
 */
function loadPresetDetails(presetId) {
    console.log(`Loading preset details for ID: ${presetId}`);
    
    // Show loading state
    const presetName = document.getElementById('preset-name');
    if (presetName) {
        presetName.textContent = 'Loading preset...';
    }
    
    // Get the authentication token
    const token = window.auth.getAuthToken();
    if (!token) {
        console.error('No authentication token found');
        if (presetName) {
            presetName.textContent = 'Authentication Required';
        }
        return;
    }
    
    // Set up headers with authentication
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    // Fetch preset details from the API
    fetch(window.utils.getApiUrl(`/preset/${presetId}`), {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Preset details loaded:', data);
        
        // Update preset name and date
        if (presetName) {
            presetName.textContent = data.name || `Preset ${data.id}`;
        }
        
        const presetDate = document.getElementById('preset-date');
        if (presetDate && data.created_at) {
            presetDate.textContent = `Created on ${new Date(data.created_at).toLocaleDateString()}`;
        }
        
        // Update preset image
        const presetImage = document.getElementById('preset-image');
        if (presetImage && data.image_url) {
            // Create the proxy URL for the image
            const proxyUrl = window.utils.getApiUrl('/proxy/image') + '?url=' + encodeURIComponent(data.image_url);
            presetImage.src = proxyUrl;
            presetImage.alt = data.name || `Preset ${data.id}`;
        }
        
        // Show preset data
        showPresetPreview(data.id, data.image_url, data.preset_data);
    })
    .catch(error => {
        console.error('Error loading preset details:', error);
        
        // Show error message
        if (presetName) {
            presetName.textContent = 'Error Loading Preset';
        }
    });
}

// Export functions to the global namespace
window.preset = {
    showPresetPreview,
    populateAdjustmentTabs,
    setupTabSwitching,
    handleCreatePresetClick,
    initializeCreatePresetButton,
    loadUserPresets,
    downloadPreset,
    deletePreset,
    loadPresetDetails
};
