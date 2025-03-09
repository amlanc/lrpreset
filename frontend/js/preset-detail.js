/**
 * Preset Detail Page Module
 * Handles preset detail display and management
 */



/**
 * Populates an adjustment tab with data
 * @param {string} tabId - ID of the tab content element
 * @param {Object} adjustments - Adjustment data
 */
function populateAdjustmentTab(tabId, adjustments) {
    const tbody = document.querySelector(`#${tabId} tbody`);
    if (!tbody) {
        console.error(`[Preset] Tab content element not found: ${tabId}`);
        return;
    }

    tbody.innerHTML = ''; // Clear existing content

    for (const [key, value] of Object.entries(adjustments)) {
        const row = document.createElement('tr');
        const paramCell = document.createElement('td');
        const valueCell = document.createElement('td');

        paramCell.textContent = window.utils.formatLabel(key);
        valueCell.textContent = window.utils.formatValue(value);

        row.appendChild(paramCell);
        row.appendChild(valueCell);
        tbody.appendChild(row);
    }
}

/**
 * Populates all adjustment tabs
 * @param {Object} presetData - Preset data
 */
function populateAdjustmentTabs(presetData) {
    console.log('Raw preset data for tabs:', presetData);
    
    // Create a restructured data object to ensure consistent tab population
    const restructuredData = {
        basic: {},
        color: {},
        detail: {},
        effects: {},
        hsl: {}
    };
    
    // Handle different data structures
    if (typeof presetData === 'object' && presetData !== null) {
        // Copy over the structured data
        if (presetData.basic) restructuredData.basic = presetData.basic;
        if (presetData.color) restructuredData.color = presetData.color;
        if (presetData.detail) restructuredData.detail = presetData.detail;
        if (presetData.effects) restructuredData.effects = presetData.effects;
        if (presetData.hsl) restructuredData.hsl = presetData.hsl;
    }
    
    // Populate each tab with the restructured data
    populateAdjustmentTab('basic-adjustments', restructuredData.basic);
    populateAdjustmentTab('color-adjustments', restructuredData.color);
    populateAdjustmentTab('detail-adjustments', restructuredData.detail);
    populateAdjustmentTab('effects-adjustments', restructuredData.effects);
    
    // Special handling for HSL adjustments since they have a different structure
    const hslTbody = document.querySelector('#hsl-adjustments tbody');
    if (hslTbody && restructuredData.hsl) {
        hslTbody.innerHTML = ''; // Clear existing content
        
        // Create header row
        const headerRow = document.createElement('tr');
        ['Color', 'Hue', 'Saturation', 'Luminance'].forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        hslTbody.appendChild(headerRow);
        
        // Add each color's HSL values
        Object.entries(restructuredData.hsl).forEach(([color, values]) => {
            const row = document.createElement('tr');
            
            // Color name cell
            const colorCell = document.createElement('td');
            colorCell.textContent = window.utils.formatLabel(color);
            row.appendChild(colorCell);
            
            // HSL value cells
            ['hue', 'saturation', 'luminance'].forEach(prop => {
                const cell = document.createElement('td');
                cell.textContent = window.utils.formatValue(values[prop]);
                row.appendChild(cell);
            });
            
            hslTbody.appendChild(row);
        });
    }
}

/**
 * Global function to switch between preset tabs
 * @param {string} tabId - ID of the tab content to activate
 */
function switchPresetTab(tabId) {
    console.log(`Tab switch function called for: ${tabId}`);
    
    // Get all tabs and tab contents
    const tabs = document.querySelectorAll('.preset-tab');
    const tabContents = document.querySelectorAll('.preset-tab-content');
    
    // Deactivate all tabs and contents
    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('data-active', 'false');
    });
    
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate the selected tab
    const selectedTab = document.querySelector(`.preset-tab[data-tab="${tabId}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.setAttribute('data-active', 'true');
        console.log(`Activated tab: ${tabId}`);
    } else {
        console.error(`Tab not found: ${tabId}`);
    }
    
    // Activate the selected content
    const selectedContent = document.getElementById(tabId);
    if (selectedContent) {
        selectedContent.classList.add('active');
        console.log(`Activated content: ${tabId}`);
    } else {
        console.error(`Tab content not found: ${tabId}`);
    }
    
    return false; // Prevent default button action
}

/**
 * Sets up tab switching functionality
 * This is kept for backward compatibility but not used directly anymore
 * since we're using inline onclick handlers
 */
function setupTabSwitching() {
    console.log('Tab switching is now handled by inline onclick handlers');
    // No need to set up event listeners as they are now inline in the HTML
}

/**
 * Loads preset details from the server
 * @param {string} presetId - ID of the preset to load
 */
async function loadPresetDetails(presetId) {
    try {
        const response = await fetch(window.utils.getApiUrl(`/api/presets/${presetId}`), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${window.auth.getAuthToken()}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to load preset details');
        }

        const data = await response.json();
        
        // Update preset name
        const presetName = document.getElementById('preset-name');
        if (presetName) {
            presetName.textContent = data.preset_id ? 
                `Preset ${data.preset_id.slice(0, 8)}` : 
                'Untitled Preset';
        }
        
        // Update preset image
        const presetImage = document.getElementById('preset-image');
        if (presetImage && data.image_url) {
            // Use the proxy URL for the image
            const proxyUrl = window.utils.getApiUrl('/proxy/image') + '?url=' + encodeURIComponent(data.image_url);
            presetImage.src = proxyUrl;
            presetImage.alt = data.preset_id || 'Preset Preview';
        }

        // Populate adjustment tabs with preset data
        if (data.preset_data) {
            populateAdjustmentTabs(data.preset_data);
        } else {
            console.warn('No preset data found');
        }

        // Setup tab switching
        setupTabSwitching();

    } catch (error) {
        console.error('Error loading preset details:', error);
        alert('Failed to load preset details. Please try again.');
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth module to be available
    let attempts = 0;
    const maxAttempts = 10;
    const waitForAuth = async () => {
        if (window.auth && window.auth.isAuthenticated()) {
            // Get preset ID from URL with improved debugging
            const urlParams = new URLSearchParams(window.location.search);
            const presetId = urlParams.get('id');
            
            console.log('URL search params:', window.location.search);
            console.log('Extracted preset ID:', presetId);
            
            if (presetId && presetId !== 'undefined' && presetId !== 'null') {
                // Set up the download button with the preset ID
                const downloadButton = document.getElementById('download-button');
                if (downloadButton) {
                    // Remove the inline onclick handler and add an event listener
                    downloadButton.removeAttribute('onclick');
                    downloadButton.addEventListener('click', () => {
                        window.payments.initiateCheckout(presetId);
                    });
                }
                
                await loadPresetDetails(presetId);
            } else {
                console.error('Invalid preset ID provided:', presetId);
                // Display a more user-friendly error message
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error-message';
                errorMessage.innerHTML = `
                    <div class="error-container">
                        <i class="fas fa-exclamation-circle"></i>
                        <h2>Preset Not Found</h2>
                        <p>We couldn't find the preset you're looking for. The preset ID may be invalid or missing.</p>
                        <a href="dashboard.html" class="button">Return to Dashboard</a>
                    </div>
                `;
                
                // Insert the error message into the page
                const presetContent = document.querySelector('.preset-content');
                if (presetContent) {
                    presetContent.innerHTML = '';
                    presetContent.appendChild(errorMessage);
                }
            }
        } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(waitForAuth, 500);
        } else {
            console.error('Auth module not available');
            window.location.href = '/index.html';
        }
    };
    
    await waitForAuth();
});

/**
 * Shows the preset preview and metadata
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
        const kelvinTemp = window.utils.convertLightroomTemperatureToKelvin(temperature);
        parsedPresetData.basic.temperature = temperature;
        parsedPresetData.basic.absolute_kelvin = kelvinTemp;
        parsedPresetData.color.temperature = temperature; // Also add to color tab
        console.log('Setting temperature in tabs:', temperature, 'Kelvin:', kelvinTemp);
    } else {
        // If no temperature found, set a default value to ensure it appears in the color tab
        parsedPresetData.color.temperature = 0;
        parsedPresetData.basic.absolute_kelvin = 5500;
        console.log('No temperature found, setting default values');
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
        window.hslUtils.populateHSLTab('hsl-adjustments', hsl);
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
    
    // Populate adjustment tabs with the parsed data
    populateAdjustmentTabs(parsedPresetData);
}

/**
 * Converts a Lightroom temperature slider value to Kelvin
 * @param {number} lrValue - Lightroom temperature slider value (-100 to +100)
 * @returns {number} - Temperature in Kelvin
 */




document.addEventListener('DOMContentLoaded', () => {
    // Get preset ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const presetId = urlParams.get('id');

    if (presetId) {
        loadPresetDetails(presetId);
    } else {
        console.error('No preset ID provided');
        window.location.href = '/dashboard.html';
    }
});
