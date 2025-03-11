/**
 * Preset Creation Module
 * Handles preset creation and initial adjustment display
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
    
    // Store the preset ID in localStorage for the download button
    localStorage.setItem('lastCreatedPresetId', presetId);
    console.log('Stored preset ID in localStorage:', presetId);
    
    // Also store it on the window object for immediate access
    window.lastCreatedPresetId = presetId;
    console.log('Also stored preset ID on window object:', presetId);
    
    // Set the preset ID on the download button
    downloadButton.setAttribute('data-preset-id', presetId);
    console.log('Set preset ID on download button:', presetId);
    
    // Add a direct event listener to the download button
    downloadButton.addEventListener('click', function(e) {
        console.log('Download button clicked directly from preset-create.js');
        e.preventDefault(); // Prevent any default action
        
        // Get the preset ID directly from the button's data attribute
        const buttonPresetId = this.getAttribute('data-preset-id');
        console.log('Preset ID from button data attribute:', buttonPresetId);
        
        if (!buttonPresetId) {
            console.error('No preset ID found on download button');
            alert('Error: No preset ID found on download button');
            return;
        }
        
        // Disable button and show loading state
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
        
        // Make the download request
        console.log(`Attempting to download preset with ID: ${buttonPresetId}`);
        fetch(window.utils.getApiUrl(`/proxy/xmp-file/${buttonPresetId}`), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${window.auth.getAuthToken()}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `preset_${buttonPresetId}.xmp`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            console.log('Preset downloaded successfully');
        })
        .catch(error => {
            console.error('Error downloading preset:', error);
            alert('Error downloading preset: ' + error.message);
        })
        .finally(() => {
            // Reset button state
            this.disabled = false;
            this.innerHTML = 'Download Preset';
        });
    });
    
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
    
    // Display the preset data
    populateAdjustmentTabs(parsedPresetData);
}

/**
 * Populates an adjustment tab with data
 * @param {string} tabId - ID of the tab content element
 * @param {Object} adjustments - Adjustment data
 */
function populateAdjustmentTab(tabId, adjustments) {
    // Handle the case where tabId might be 'hsl-tab' instead of 'hsl'
    const normalizedTabId = tabId.replace('-tab', '');
    
    // Special handling for HSL data
    if (normalizedTabId === 'hsl') {
        console.log('Populating HSL tab with data:', adjustments);
        console.log('HSL adjustments type:', typeof adjustments);
        
        // Log detailed information about the adjustments
        if (adjustments) {
            console.log('HSL adjustments keys:', Object.keys(adjustments));
            
            // Check a sample color if available
            if (adjustments.red) {
                console.log('Red color data:', adjustments.red);
                console.log('Red color type:', typeof adjustments.red);
                if (adjustments.red.hue !== undefined) {
                    console.log('Red hue value:', adjustments.red.hue);
                    console.log('Red hue type:', typeof adjustments.red.hue);
                }
            }
        }
        
        // Get the main HSL tbody
        const hslTbody = document.getElementById('hsl-adjustments');
        if (!hslTbody) {
            console.error(`[Preset] HSL tbody not found: hsl-adjustments`);
            return;
        }
        
        // Clear the tbody
        hslTbody.innerHTML = '';
        
        // Define the colors we want to display and their order
        const colorOrder = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
        
        // Create rows for each color in the defined order
        for (const color of colorOrder) {
            // Create a row for this color
            const colorRow = document.createElement('tr');
            colorRow.className = 'hsl-color-row';
            
            // Create cells for each column
            const colorNameCell = document.createElement('td');
            const hueCell = document.createElement('td');
            const saturationCell = document.createElement('td');
            const luminanceCell = document.createElement('td');
            
            // Set the color name
            colorNameCell.textContent = window.utils.formatLabel(color);
            
            // Default values
            let hueValue = 0;
            let saturationValue = 0;
            let luminanceValue = 0;
            
            // Get the color data if it exists
            if (adjustments && color in adjustments) {
                const colorData = adjustments[color];
                
                // Log the actual data type and content for debugging
                console.log(`${color} data type:`, typeof colorData, colorData);
                
                // Handle different data formats
                if (typeof colorData === 'object' && colorData !== null) {
                    // Direct access to numeric properties
                    hueValue = typeof colorData.hue === 'number' ? colorData.hue : parseFloat(colorData.hue || 0);
                    saturationValue = typeof colorData.saturation === 'number' ? colorData.saturation : parseFloat(colorData.saturation || 0);
                    luminanceValue = typeof colorData.luminance === 'number' ? colorData.luminance : parseFloat(colorData.luminance || 0);
                    
                    // Log the extracted values
                    console.log(`Extracted values for ${color}:`, { hueValue, saturationValue, luminanceValue });
                } else if (typeof colorData === 'string') {
                    // Log the string data for debugging
                    console.log(`String data for ${color}:`, colorData);
                    
                    try {
                        // Try to parse as JSON
                        const parsed = JSON.parse(colorData.replace(/\\|\"/g, ''));
                        if (parsed) {
                            hueValue = parseFloat(parsed.hue || 0);
                            saturationValue = parseFloat(parsed.saturation || 0);
                            luminanceValue = parseFloat(parsed.luminance || 0);
                        }
                    } catch (e) {
                        // If JSON parsing fails, try regex
                        const hueMatch = colorData.match(/hue["']?\s*:\s*([\-0-9\.]+)/i);
                        const satMatch = colorData.match(/saturation["']?\s*:\s*([\-0-9\.]+)/i);
                        const lumMatch = colorData.match(/luminance["']?\s*:\s*([\-0-9\.]+)/i);
                        
                        if (hueMatch && hueMatch[1]) hueValue = parseFloat(hueMatch[1]);
                        if (satMatch && satMatch[1]) saturationValue = parseFloat(satMatch[1]);
                        if (lumMatch && lumMatch[1]) luminanceValue = parseFloat(lumMatch[1]);
                    }
                }
            }
            
            // Ensure values are valid numbers and convert to primitive numbers
            hueValue = isNaN(hueValue) ? 0 : Number(hueValue);
            saturationValue = isNaN(saturationValue) ? 0 : Number(saturationValue);
            luminanceValue = isNaN(luminanceValue) ? 0 : Number(luminanceValue);
            
            // Log the converted values
            console.log(`Converted ${color} values to primitives:`, {
                hue: hueValue,
                hueType: typeof hueValue,
                saturation: saturationValue,
                satType: typeof saturationValue,
                luminance: luminanceValue,
                lumType: typeof luminanceValue
            });
            
            // Log the final values we'll display with their types
            console.log(`Final values for ${color}:`, { 
                hue: hueValue, 
                hueType: typeof hueValue, 
                hueStringified: JSON.stringify(hueValue),
                saturation: saturationValue, 
                luminance: luminanceValue 
            });
            
            // Log the final values before formatting
            console.log(`FINAL VALUES for ${color} before display:`, {
                hue: hueValue,
                hueType: typeof hueValue,
                saturation: saturationValue,
                satType: typeof saturationValue,
                luminance: luminanceValue,
                lumType: typeof luminanceValue
            });
            
            // Format the numeric values to ensure they display correctly
            const formattedHue = window.utils.formatValue(Number(hueValue));
            const formattedSat = window.utils.formatValue(Number(saturationValue));
            const formattedLum = window.utils.formatValue(Number(luminanceValue));
            
            console.log(`FORMATTED VALUES for ${color}:`, {
                hue: formattedHue,
                saturation: formattedSat,
                luminance: formattedLum
            });
            
            // Set the cell content with formatted values
            hueCell.textContent = formattedHue;
            saturationCell.textContent = formattedSat;
            luminanceCell.textContent = formattedLum;
            
            // Style the cells
            colorNameCell.style.textAlign = 'left';
            colorNameCell.style.padding = '8px';
            hueCell.style.textAlign = 'center';
            hueCell.style.padding = '8px';
            hueCell.style.fontFamily = '"Roboto Mono", monospace';
            saturationCell.style.textAlign = 'center';
            saturationCell.style.padding = '8px';
            saturationCell.style.fontFamily = '"Roboto Mono", monospace';
            luminanceCell.style.textAlign = 'center';
            luminanceCell.style.padding = '8px';
            luminanceCell.style.fontFamily = '"Roboto Mono", monospace';
            
            // Add cells to the row
            colorRow.appendChild(colorNameCell);
            colorRow.appendChild(hueCell);
            colorRow.appendChild(saturationCell);
            colorRow.appendChild(luminanceCell);
            
            // Add the row to the tbody
            hslTbody.appendChild(colorRow);
        }
        return;
    }
    
    // Regular tab handling for non-HSL tabs
    const tbody = document.getElementById(`${normalizedTabId}-adjustments`);
    if (!tbody) {
        console.error(`[Preset] Tab content element not found: ${normalizedTabId}-adjustments`);
        return;
    }
    if (Object.keys(adjustments).length > 0) {
        tbody.innerHTML = '';

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

        // Store the data in the tbody's dataset for persistence
        tbody.dataset.adjustments = JSON.stringify(adjustments);
    } else if (!tbody.dataset.adjustments) {
        // If no data and no stored data, show a message
        tbody.innerHTML = '<tr><td colspan="2" class="text-center">No adjustments available</td></tr>';
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
        hsl: {},
        detail: {},
        effects: {}
    };
    
    // Handle different data structures
    if (presetData !== null && typeof presetData === 'object') {
        // Extract the data from the LLM response
        let processedData = presetData;
        
        // Check if we have a text field from Gemini API response
        if (presetData.candidates &&
            presetData.candidates[0] &&
            presetData.candidates[0].content &&
            presetData.candidates[0].content.parts &&
            presetData.candidates[0].content.parts[0] &&
            presetData.candidates[0].content.parts[0].text) {
            
            const text = presetData.candidates[0].content.parts[0].text;
            console.log('\nFound valid data in Gemini response:\n', text);
            
            // Extract JSON from markdown code block if present
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    processedData = JSON.parse(jsonMatch[1]);
                    console.log('Successfully extracted JSON from markdown code block:', processedData);
                } catch (e) {
                    console.error('Error parsing JSON from markdown code block:', e);
                }
            }
        }
        
        // Check if we have metadata as a string that needs parsing
        if (processedData.metadata !== null && typeof processedData.metadata === 'string') {
            try {
                const parsedMetadata = JSON.parse(processedData.metadata);
                console.log('\nSuccessfully parsed metadata from string:', parsedMetadata);
                processedData = parsedMetadata; // Use the parsed metadata as our data source
            } catch (e) {
                console.error('\nError parsing metadata:', e);
            }
        }
        
        // Now work with the processed data - Enhanced HSL data handling
        if (processedData.hsl) {
            console.log('HSL data found in preset, type:', typeof processedData.hsl);
            
            // Initialize the HSL object
            restructuredData.hsl = {};
            
            // Extract HSL data based on its type
            let hslData = processedData.hsl;
            
            // If HSL is a string, try to parse it
            if (typeof hslData === 'string') {
                try {
                    hslData = JSON.parse(hslData);
                    console.log('Successfully parsed HSL from string:', hslData);
                } catch (e) {
                    console.error('Error parsing HSL string:', e);
                    hslData = {}; // Reset to empty object if parsing fails
                }
            }
            
            // Define the colors we want to process
            const colorOrder = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
            
            // Process each color
            for (const color of colorOrder) {
                // Skip if the color doesn't exist in the data
                if (!hslData[color]) {
                    restructuredData.hsl[color] = { hue: 0, saturation: 0, luminance: 0 };
                    continue;
                }
                
                let colorData = hslData[color];
                let hue = 0, saturation = 0, luminance = 0;
                
                // Handle different data formats for color data
                if (typeof colorData === 'string') {
                    console.log(`Color data for ${color} is a string:`, colorData);
                    
                    // Try to parse as JSON if it looks like a JSON string
                    if (colorData.includes('"hue"') || colorData.includes('"saturation"') || colorData.includes('"luminance"')) {
                        try {
                            // Clean up any escaped characters
                            const cleanedData = colorData.replace(/\\\\|\\"/g, '');
                            
                            // Try direct JSON parsing first
                            try {
                                const parsedData = JSON.parse(cleanedData);
                                console.log(`Successfully parsed JSON for ${color}:`, parsedData);
                                
                                // Extract values from parsed object
                                if (parsedData.hue !== undefined) hue = parseFloat(parsedData.hue);
                                if (parsedData.saturation !== undefined) saturation = parseFloat(parsedData.saturation);
                                if (parsedData.luminance !== undefined) luminance = parseFloat(parsedData.luminance);
                            } catch (jsonError) {
                                console.warn(`JSON parsing failed for ${color}, trying regex:`, jsonError);
                                
                                // Fallback to regex extraction
                                const hueMatch = cleanedData.match(/"hue"\s*:\s*([\-0-9\.]+)/i);
                                const satMatch = cleanedData.match(/"saturation"\s*:\s*([\-0-9\.]+)/i);
                                const lumMatch = cleanedData.match(/"luminance"\s*:\s*([\-0-9\.]+)/i);
                                
                                if (hueMatch && hueMatch[1]) hue = parseFloat(hueMatch[1]);
                                if (satMatch && satMatch[1]) saturation = parseFloat(satMatch[1]);
                                if (lumMatch && lumMatch[1]) luminance = parseFloat(lumMatch[1]);
                                
                                console.log(`Extracted values using regex for ${color}:`, {
                                    hue, saturation, luminance
                                });
                            }
                        } catch (e) {
                            console.error(`Error processing string data for ${color}:`, e);
                        }
                    }
                }
                // Case 2: Color data is an object
                else if (typeof colorData === 'object' && colorData !== null) {
                    console.log(`Color data for ${color} is an object:`, colorData);
                    
                    // Direct extraction from object properties
                    if ('hue' in colorData) hue = parseFloat(colorData.hue);
                    else if ('Hue' in colorData) hue = parseFloat(colorData.Hue);
                    
                    if ('saturation' in colorData) saturation = parseFloat(colorData.saturation);
                    else if ('Saturation' in colorData) saturation = parseFloat(colorData.Saturation);
                    
                    if ('luminance' in colorData) luminance = parseFloat(colorData.luminance);
                    else if ('Luminance' in colorData) luminance = parseFloat(colorData.Luminance);
                    
                    console.log(`Extracted values from object for ${color}:`, {
                        hue, saturation, luminance
                    });
                }
                
                // Ensure values are numbers
                hue = isNaN(hue) ? 0 : hue;
                saturation = isNaN(saturation) ? 0 : saturation;
                luminance = isNaN(luminance) ? 0 : luminance;
                
                // Store the processed values as direct primitive properties
                // This ensures they won't be stringified when passed to the HSL tab
                if (!restructuredData.hsl[color]) {
                    restructuredData.hsl[color] = {};
                }
                
                // Convert to numbers and assign directly
                restructuredData.hsl[color].hue = Number(hue);
                restructuredData.hsl[color].saturation = Number(saturation);
                restructuredData.hsl[color].luminance = Number(luminance);
                
                // Force primitive values to prevent any JSON string issues
                restructuredData.hsl[color] = {
                    hue: +restructuredData.hsl[color].hue,
                    saturation: +restructuredData.hsl[color].saturation,
                    luminance: +restructuredData.hsl[color].luminance
                };
                
                // Debug: Verify the stored values are actual numbers
                console.log(`FINAL VALUES for ${color}:`, {
                    hue: typeof restructuredData.hsl[color].hue,
                    saturation: typeof restructuredData.hsl[color].saturation,
                    luminance: typeof restructuredData.hsl[color].luminance,
                    values: restructuredData.hsl[color]
                });
                
                // Log the stored values to verify they're numbers
                console.log(`Stored values for ${color}:`, restructuredData.hsl[color]);
            }
            
            console.log('Processed HSL data:', restructuredData.hsl);
        }
        
        // Case 1: Data is already structured with tabs
        if (processedData.basic || processedData.color || processedData.detail || processedData.effects) {
            if (processedData.basic) restructuredData.basic = processedData.basic;
            if (processedData.color) restructuredData.color = processedData.color;
            if (processedData.detail) restructuredData.detail = processedData.detail;
            if (processedData.effects) restructuredData.effects = processedData.effects;
        } 
        // Case 2: Data is a flat structure, need to organize into tabs
        else {
            // Categorize properties into appropriate tabs
            for (const [key, value] of Object.entries(processedData)) {
                // Skip HSL as it's already handled
                if (key.toLowerCase() === 'hsl') continue;
                
                // Handle regular properties
                const lowerKey = key.toLowerCase();
                if (['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'temperature'].includes(lowerKey)) {
                    restructuredData.basic[key] = value;
                } else if (['vibrance', 'saturation', 'tint'].includes(lowerKey)) {
                    restructuredData.color[key] = value;
                } else if (['texture', 'clarity', 'dehaze', 'sharpening', 'noise'].includes(lowerKey)) {
                    restructuredData.detail[key] = value;
                } else if (['vignette', 'grain'].includes(lowerKey)) {
                    restructuredData.effects[key] = value;
                }
            }
        }
    }
    
    // Store the restructured data for persistence
    window.currentPresetData = restructuredData;
        // Populate each tab with the restructured data
    const tabMappings = [
        { id: 'basic', adjustmentsId: 'basic-adjustments' },
        { id: 'color', adjustmentsId: 'color-adjustments' },
        { id: 'detail', adjustmentsId: 'detail-adjustments' },
        { id: 'effects', adjustmentsId: 'effects-adjustments' }
    ];
    
    // HSL tab is intentionally left empty
    
    // Populate all tabs
    tabMappings.forEach(mapping => {
        
        const tbody = document.getElementById(mapping.adjustmentsId);
        if (tbody) {
            console.log(`Found tbody for ${mapping.id}:`, tbody);
            // Store the data in the tbody's dataset
            tbody.dataset.adjustments = JSON.stringify(restructuredData[mapping.id] || {});
            // Populate all tabs with data to ensure it's available when switching
            populateAdjustmentTab(mapping.id, restructuredData[mapping.id]);
        } else {
            console.error(`Could not find tbody with ID: ${mapping.adjustmentsId}`);
        }
    });
}

/**
 * Sets up tab switching functionality
 */
function setupTabSwitching() {
    console.log('Setting up tab switching...');
    
    // Use a more specific selector to target only the tabs in the metadata section
    const tabs = document.querySelectorAll('#metadata-display .preset-tab');
    const tabContents = document.querySelectorAll('#metadata-display .preset-tab-content');

    console.log('Found tabs:', tabs.length, 'Tab contents:', tabContents.length);
    
    // Debug each tab
    tabs.forEach((tab, index) => {
        console.log(`Tab ${index}:`, tab.outerHTML);
        console.log(`  data-tab attribute:`, tab.getAttribute('data-tab'));
    });
    
    // Debug each tab content
    tabContents.forEach((content, index) => {
        console.log(`Tab content ${index}:`, content.id);
    });

    // Initialize the first tab as active
    const firstTab = tabs[0];
    if (firstTab) {
        firstTab.classList.add('active');
        const tabId = firstTab.getAttribute('data-tab');
        console.log('First tab data-tab attribute:', tabId);
        const firstTabContent = document.getElementById(tabId);
        if (firstTabContent) {
            firstTabContent.classList.add('active');
            console.log(`Activated first tab content: ${tabId}`);
        } else {
            console.error(`Could not find tab content with ID: ${tabId}`);
        }
    }

    // Handle tab switching with direct function
    tabs.forEach(tab => {
        console.log(`Adding click listener to tab:`, tab.textContent.trim());
        
        // Remove any existing click listeners
        tab.removeEventListener('click', tabClickHandler);
        
        // Add new click listener
        tab.addEventListener('click', tabClickHandler);
    });
}

/**
 * Handle tab click events
 * @param {Event} event - The click event
 */
function tabClickHandler(event) {
    event.preventDefault();
    console.log('Tab clicked:', event.target.textContent.trim());
    
    const tabs = document.querySelectorAll('#metadata-display .preset-tab');
    const tabContents = document.querySelectorAll('#metadata-display .preset-tab-content');
    const clickedTab = event.currentTarget;
    
    // Update active states
    tabs.forEach(t => t.classList.remove('active'));
    clickedTab.classList.add('active');
    console.log('Set active class on tab:', clickedTab.textContent.trim());

    // Show/hide tab content without clearing data
    const targetId = clickedTab.getAttribute('data-tab');
    console.log(`Tab data-tab attribute: ${targetId}`);
    
    // Find the tab content with matching ID
    let found = false;
    tabContents.forEach(content => {
        console.log(`Checking content with ID: ${content.id} against target: ${targetId}`);
        if (content.id === targetId) {
            content.classList.add('active');
            found = true;
            console.log(`Activated tab content: ${content.id}`);
        } else {
            content.classList.remove('active');
            console.log(`Deactivated tab content: ${content.id}`);
        }
    });
    
    if (!found) {
        console.error(`Could not find tab content with ID: ${targetId}`);
    }
}

/**
 * Resizes an image to a target size
 * @param {File} file - The original image file
 * @param {number} targetSize - Target size in bytes
 * @returns {Promise<File>} - Promise resolving to a resized File object
 */
function resizeImage(file, targetSize) {
    return new Promise((resolve, reject) => {
        // Create a FileReader to read the file
        const reader = new FileReader();
        
        reader.onload = function(event) {
            // Create an image element to load the file data
            const img = new Image();
            
            img.onload = function() {
                // Initial dimensions
                let width = img.width;
                let height = img.height;
                let quality = 0.85; // Initial quality (85%)
                let canvas, ctx, dataUrl, resizedBlob;
                
                // Create canvas
                canvas = document.createElement('canvas');
                ctx = canvas.getContext('2d');
                
                // Iteratively reduce size until we're under the target
                let resizeCount = 0;
                const maxAttempts = 5;
                
                // Function to check size and resize if needed
                const checkAndResize = (blob) => {
                    // If we have a blob, check its size
                    if (blob) {
                        console.log(`Resized image size: ${blob.size / (1024 * 1024).toFixed(2)}MB`);
                        
                        // If small enough or too many attempts, resolve
                        if (blob.size <= targetSize || resizeCount >= maxAttempts) {
                            // Create a new File object
                            const resizedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: new Date().getTime()
                            });
                            
                            console.log(`Final resized image: ${resizedFile.size / (1024 * 1024).toFixed(2)}MB`);
                            resolve(resizedFile);
                            return;
                        }
                    }
                    
                    // Reduce dimensions by 20% each time
                    width = Math.floor(width * 0.8);
                    height = Math.floor(height * 0.8);
                    
                    // If we're on the third attempt and still too big, reduce quality
                    if (resizeCount === 3) {
                        quality = Math.max(quality - 0.15, 0.6); // Reduce quality but not below 60%
                    }
                    
                    console.log(`Resizing to ${width}x${height} with quality ${quality * 100}%`);
                    
                    // Set canvas dimensions
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert canvas to blob directly (avoids CSP issues with data URLs)
                    canvas.toBlob(function(blob) {
                        if (blob) {
                            resizeCount++;
                            checkAndResize(blob);
                        } else {
                            console.error('Error creating blob from canvas');
                            reject(new Error('Failed to create blob from canvas'));
                        }
                    }, 'image/jpeg', quality);
                };
                
                // Start the resize process
                checkAndResize();
            };
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            
            // Set the source of the image
            img.src = event.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
        
        // Read the file as a data URL
        reader.readAsDataURL(file);
    });
}

// Track if an upload is in progress to prevent duplicates
let uploadInProgress = false;
let uploadRequestId = null;

/**
 * Uploads and processes an image file
 * @param {File} file - The image file to upload
 */
function uploadAndProcessImage(file) {
    console.log(`Uploading and processing image: ${file.name}, size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    
    // Prevent duplicate uploads
    if (uploadInProgress) {
        console.log('Upload already in progress, ignoring duplicate request');
        return;
    }
    
    // Set flag to prevent duplicate uploads
    uploadInProgress = true;
    
    // Clear any previous preset data to avoid conflicts
    // This ensures we don't have stale data when creating a new preset
    window.lastCreatedPresetId = null;
    localStorage.removeItem('lastCreatedPresetId');
    localStorage.removeItem('currentPresetId');
    localStorage.removeItem('preset_id');
    
    // Generate a unique request ID
    uploadRequestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    // Show the metadata display section
    const metadataDisplay = document.getElementById('metadata-display');
    if (metadataDisplay) {
        metadataDisplay.style.display = 'block';
    }
    
    // Show the AI processing steps
    const uploadStatus = document.getElementById('upload-status');
    if (uploadStatus) {
        uploadStatus.style.display = 'block';
    }
    
    // Update AI processing steps
    const aiSteps = document.querySelectorAll('.ai-step');
    aiSteps.forEach((step, index) => {
        setTimeout(() => {
            step.classList.add('active');
        }, index * 1000);
    });
    
    // Create FormData for the image
    const formData = new FormData();
    formData.append('image', file);
    
    // Send the image to the backend for processing
    fetch(window.utils.getApiUrl('/api/presets/analyze'), {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${window.auth.getAuthToken()}`,
            'X-Request-ID': uploadRequestId  // Add unique request ID to prevent duplicates
            // Don't set Content-Type header - browser will set it automatically with boundary
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            // Try to get more detailed error information if available
            return response.json().catch(() => {
                // If we can't parse JSON, just throw a generic error
                throw new Error(`HTTP error! status: ${response.status}`);
            }).then(errorData => {
                // If we got JSON error data, throw a more specific error
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Preset created successfully:', data);
        console.log('FULL BACKEND RESPONSE:', JSON.stringify(data, null, 2));
        console.log('Response properties:', Object.keys(data));
        console.log('Has preset_id property:', data.hasOwnProperty('preset_id'));
        console.log('Has id property:', data.hasOwnProperty('id'));
        
        // Log the actual preset ID values from the response
        console.log('data.preset_id value:', data.preset_id);
        console.log('data.id value:', data.id);
        
        // Log the current state of localStorage before we modify it
        console.log('localStorage before update:', {
            lastCreatedPresetId: localStorage.getItem('lastCreatedPresetId'),
            currentPresetId: localStorage.getItem('currentPresetId'),
            preset_id: localStorage.getItem('preset_id')
        });
        
        // Reset upload flag to allow new uploads
        uploadInProgress = false;
        
        // Show preset preview with data
        // Handle both property naming conventions (id or preset_id)
        const presetId = data.id || data.preset_id;
        const imageUrl = data.image_url;
        
        if (presetId && imageUrl) {
            console.log('Showing preset preview with data:', {
                preset_id: presetId,
                image_url: imageUrl,
                preset_data_type: typeof data.preset_data
            });
            
            // Store the preset ID using the global preset manager
            if (window.presetManager) {
                window.presetManager.setPresetId(presetId);
                console.log('Stored preset ID using global preset manager:', presetId);
            } else {
                console.error('Global preset manager not found! Falling back to localStorage');
                localStorage.setItem('lastCreatedPresetId', presetId);
                console.log('Stored preset ID in localStorage (fallback):', presetId);
            }
            
            // Also store in multiple localStorage keys for redundancy
            localStorage.setItem('lastCreatedPresetId', presetId);
            localStorage.setItem('currentPresetId', presetId);
            localStorage.setItem('preset_id', presetId);
            console.log('Stored preset ID in all localStorage keys:', presetId);
            
            // Also set it directly on the window object for immediate access
            window.lastCreatedPresetId = presetId;
            console.log('Also stored preset ID on window object:', presetId);
            
            // Add the preset ID to the URL
            const url = new URL(window.location.href);
            url.searchParams.set('preset_id', presetId);
            window.history.replaceState({}, '', url);
            console.log('Added preset ID to URL:', presetId);
            
            // Only update the download button on the index page (not dashboard or preview pages)
            // Check if we're on the index page by looking for specific elements
            const isIndexPage = document.querySelector('#upload-section') !== null;
            
            if (isIndexPage) {
                const downloadButton = document.querySelector('#download-button');
                if (downloadButton) {
                    // Store the preset ID as a data attribute
                    downloadButton.setAttribute('data-preset-id', presetId);
                    console.log('Set preset ID directly on index page download button:', presetId);
                } else {
                    console.log('Download button not found on index page');
                }
            } else {
                console.log('Not on index page, skipping download button update');
            }
            
            // Verify storage was successful
            console.log('VERIFICATION - After storing preset ID:');
            console.log('  - window.presetManager value:', window.presetManager ? window.presetManager.getPresetId() : 'not available');
            console.log('  - window.lastCreatedPresetId:', window.lastCreatedPresetId);
            console.log('  - localStorage.lastCreatedPresetId:', localStorage.getItem('lastCreatedPresetId'));
            console.log('  - localStorage.currentPresetId:', localStorage.getItem('currentPresetId'));
            
            // Add detailed logging before calling showPresetPreview
            console.log('ABOUT TO CALL showPresetPreview with:', {
                presetId: presetId,
                imageUrl: imageUrl,
                presetDataType: typeof data.preset_data
            });
            
            // Call the showPresetPreview function
            showPresetPreview(presetId, imageUrl, data.preset_data);
            
            // Verify after calling showPresetPreview
            console.log('AFTER calling showPresetPreview - checking storage:');
            console.log('localStorage.lastCreatedPresetId:', localStorage.getItem('lastCreatedPresetId'));
            console.log('window.lastCreatedPresetId:', window.lastCreatedPresetId);
            
            // Check if download button exists and has preset ID
            const downloadBtn = document.getElementById('download-button');
            if (downloadBtn) {
                console.log('Download button found, data-preset-id:', downloadBtn.getAttribute('data-preset-id'));
            } else {
                console.error('Download button not found after preset creation!');
            }
        } else {
            console.error('Invalid response data:', data);
            alert('An error occurred while creating the preset. Please try again.');
        }
        
        // Show the download section
        const downloadSection = document.getElementById('download');
        
        // Set the preset ID on the index page download button (if it exists)
        const indexDownloadButton = document.getElementById('download-button');
        if (indexDownloadButton) {
            indexDownloadButton.setAttribute('data-preset-id', presetId);
            console.log('Set preset ID on index page download button:', presetId);
        }
        if (downloadSection) {
            downloadSection.style.display = 'block';
        }
        
        // Set the preset ID on the download button
        const downloadButton = document.getElementById('download-button');
        if (downloadButton) {
            // Use either data.preset_id or presetId (which was already extracted earlier)
            const buttonPresetId = data.preset_id || presetId;
            if (buttonPresetId) {
                // Always update the data attribute with the latest preset ID
                downloadButton.setAttribute('data-preset-id', buttonPresetId);
                console.log('Set preset ID on download button:', buttonPresetId);
                
                // Remove any existing event listeners by cloning the button
                const newButton = downloadButton.cloneNode(true);
                downloadButton.parentNode.replaceChild(newButton, downloadButton);
                
                // Add a fresh click event listener to the new button
                newButton.setAttribute('data-listener-added', 'true');
                newButton.addEventListener('click', async function() {
                    const presetId = this.getAttribute('data-preset-id');
                    if (presetId) {
                        try {
                            console.log(`Attempting to download preset: ${presetId}`);
                            
                            // Make an authenticated fetch request
                            const response = await fetch(window.utils.getApiUrl(`/api/presets/${presetId}/download`), {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${window.auth.getAuthToken()}`
                                }
                            });
                            
                            if (!response.ok) {
                                if (response.status === 404) {
                                    // Special handling for 404 errors
                                    console.error(`Preset not found in database: ${presetId}`);
                                    alert('The preset could not be found in the database. This may happen if the preset was not properly saved. Please try creating a new preset.');
                                } else {
                                    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                                }
                                return;
                            }
                            
                            // Get the blob from the response
                            const blob = await response.blob();
                            
                            // Create a download link
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = `preset_${presetId}.xmp`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            console.log(`Preset ${presetId} downloaded successfully`);
                        } catch (error) {
                            console.error('Error downloading preset:', error);
                            alert(`Error downloading preset: ${error.message}`);
                        }
                    } else {
                        console.error('No preset ID found on download button');
                        alert('No preset ID found. Please try creating a new preset.');
                    }
                });
                downloadButton.setAttribute('data-listener-added', 'true');
            }
        } else {
            console.error('Could not set preset ID on download button:', {
                buttonExists: !!downloadButton,
                presetIdExists: !!data.preset_id,
                data: data
            });
        }
    })
    .catch(error => {
        console.error('Error analyzing image:', error);
        
        // Show user-friendly error message
        let errorMessage = error.message;
        
        // Hide the processing UI on error
        if (metadataDisplay) {
            metadataDisplay.style.display = 'none';
        }
        if (uploadStatus) {
            uploadStatus.style.display = 'none';
        }
        
        // Reset upload flag to allow new uploads after error
        uploadInProgress = false;
        console.log('Upload flag reset after error');
        
        alert('Error analyzing image: ' + errorMessage);
    })
    .finally(() => {
        // Ensure upload flag is reset in all cases
        if (uploadInProgress) {
            uploadInProgress = false;
            console.log('Upload flag reset in finally block');
        }
        
        // Re-enable the button
        const createPresetBtn = document.getElementById('createPresetBtn');
        if (createPresetBtn) {
            createPresetBtn.disabled = false;
            createPresetBtn.classList.remove('disabled');
        }
    });
}

/**
 * Handles the Create Preset button click
 */
function handleCreatePresetClick() {
    console.log('Create preset button clicked');
    
    // Prevent duplicate processing if upload is already in progress
    if (uploadInProgress) {
        console.log('Upload already in progress, ignoring duplicate click');
        return;
    }
    
    // Set flag to prevent duplicate uploads
    uploadInProgress = true;
    console.log('Setting uploadInProgress flag to true');
    
    // Disable the button to prevent multiple clicks
    const createPresetBtn = document.getElementById('createPresetBtn');
    if (createPresetBtn) {
        createPresetBtn.disabled = true;
        createPresetBtn.classList.add('disabled');
    }
    
    // Check if user is authenticated
    if (!window.auth.isAuthenticated()) {
        alert('Please sign in to create presets');
        return;
    }
    
    // Get the uploaded image
    const imageUpload = document.getElementById('imageUpload');
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) {
        alert('Please upload an image first');
        return;
    }
    
    // Check file size before uploading (50MB limit)
    const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250MB limit
    const TARGET_SIZE = 15 * 1024 * 1024; // 15 MB target size for resizing
    const file = imageUpload.files[0];
    const fileSize = file.size;
    
    if (fileSize > MAX_FILE_SIZE) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        alert(`Image size (${sizeMB}MB) exceeds the maximum allowed size of 50MB. The image will be automatically resized before uploading.`);
        
        // Resize the image
        resizeImage(file, TARGET_SIZE)
            .then(resizedFile => {
                // Continue with the upload using the resized file
                uploadAndProcessImage(resizedFile);
            })
            .catch(error => {
                console.error('Error resizing image:', error);
                alert('Error resizing image. Please try with a smaller image.');
            });
        return;
    }
    
    // For large files that are under the limit but still large, resize them
    if (fileSize > TARGET_SIZE) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        console.log(`Large image detected (${sizeMB}MB). Resizing before upload...`);
        
        // Show loading indicator
        const metadataDisplay = document.getElementById('metadata-display');
        if (metadataDisplay) {
            metadataDisplay.style.display = 'block';
        }
        
        const uploadStatus = document.getElementById('upload-status');
        if (uploadStatus) {
            uploadStatus.style.display = 'block';
        }
        
        // Resize the image
        resizeImage(file, TARGET_SIZE)
            .then(resizedFile => {
                // Continue with the upload using the resized file
                uploadAndProcessImage(resizedFile);
            })
            .catch(error => {
                console.error('Error resizing image:', error);
                // Continue with original file if resizing fails
                console.log('Continuing with original file after resize failure');
                uploadAndProcessImage(file);
            });
        return;
    }
    
    // If file is small enough, proceed with upload directly
    uploadAndProcessImage(file);
}

/**
 * Initializes the Create Preset form
 * Ensures only one event listener is attached by removing any existing ones
 */
function initializeCreatePresetButton() {
    const createPresetBtn = document.getElementById('createPresetBtn');
    if (createPresetBtn) {
        // Remove any existing event listeners by cloning the node
        const newButton = createPresetBtn.cloneNode(true);
        createPresetBtn.parentNode.replaceChild(newButton, createPresetBtn);
        
        // Add the event listener to the new button
        newButton.addEventListener('click', handleCreatePresetClick);
        console.log('Added click event listener to create preset button');
    }
}

/**
 * Downloads a preset XMP file
 * @param {string} presetId - ID of the preset to download
 * @param {string} sessionId - Checkout session ID (if applicable)
 */
function downloadPreset(presetId, sessionId = '') {
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
        alert('Error downloading preset. Please try again.');
    });
}

/**
 * Initializes the download link for presets
 */
function initializeDownloadLink() {
    console.log('Initializing download link');
    
    // Look for download button with either ID
    const downloadButton = document.getElementById('download-button');
    
    if (!downloadButton) {
        console.log('Download button not found on this page');
        return;
    }
    
    console.log('Found download button:', downloadButton);
    
    // Get preset ID from various sources
    let presetId = downloadButton.getAttribute('data-preset-id');
    
    // If no preset ID on button, try to get from URL parameter
    if (!presetId) {
        const urlParams = new URLSearchParams(window.location.search);
        presetId = urlParams.get('preset_id');
        console.log('Got preset ID from URL:', presetId);
    }
    
    // If still no preset ID, try localStorage
    if (!presetId) {
        presetId = localStorage.getItem('lastCreatedPresetId');
        console.log('Got preset ID from localStorage:', presetId);
    }
    
    if (presetId) {
        console.log(`Setting up download button with preset ID: ${presetId}`);
        
        // Set the preset ID as a data attribute
        downloadButton.setAttribute('data-preset-id', presetId);
        
        // Add click event listener
        downloadButton.addEventListener('click', function() {
            console.log('Download button clicked');
            
            // Get the preset ID from the button's data attribute
            const buttonPresetId = this.getAttribute('data-preset-id');
            
            if (!buttonPresetId) {
                console.error('No preset ID found for download');
                alert('No preset ID found. Please create a preset first.');
                return;
            }
            
            console.log(`Downloading preset with ID: ${buttonPresetId}`);
            
            // Disable the button and show loading state
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            
            // Call the download function
            downloadPreset(buttonPresetId);
            
            // Re-enable the button after a delay
            setTimeout(() => {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-download"></i> Download Preset';
            }, 2000);
        });
        
        console.log('Download button initialized successfully');
    } else {
        console.log('No preset ID available for download button');
        
        // Disable the button if no preset ID is available
        downloadButton.disabled = true;
        downloadButton.title = 'Create a preset first';
    }
}

// Keep track of whether we've already initialized
let hasInitialized = false;

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - checking page type');
    
    // Check if we're on the index page or the preset creation page
    const isIndexPage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
    const isPresetCreationPage = document.getElementById('createPresetBtn') !== null;
    
    console.log('Page type detection:', { isIndexPage, isPresetCreationPage });
    
    // Only add download button handler if we're NOT on the index page
    // This avoids conflicts with the index.html script
    if (!isIndexPage && document.getElementById('download-button')) {
        console.log('Found download button on non-index page - adding click handler');
        
        // Remove any existing listeners by cloning the button
        const downloadButton = document.getElementById('download-button');
        const newButton = downloadButton.cloneNode(true);
        downloadButton.parentNode.replaceChild(newButton, downloadButton);
        
        // Add direct click handler
        newButton.addEventListener('click', function() {
            console.log('Download button clicked (direct handler)');
            console.log('Button properties:', {
                id: this.id,
                className: this.className,
                disabled: this.disabled,
                innerHTML: this.innerHTML,
                dataPresetId: this.getAttribute('data-preset-id')
            });
            
            // First check window object (most immediate source)
            let presetId = window.lastCreatedPresetId;
            console.log('Got preset ID from window object:', presetId);
            
            // Then check localStorage (persistent storage)
            if (!presetId) {
                presetId = localStorage.getItem('lastCreatedPresetId');
                console.log('Got preset ID from localStorage:', presetId);
            }
            
            // If still no preset ID, try data attribute
            if (!presetId) {
                presetId = this.getAttribute('data-preset-id');
                console.log('Got preset ID from data attribute:', presetId);
            }
            
            // If still no preset ID, try URL parameter
            if (!presetId) {
                const urlParams = new URLSearchParams(window.location.search);
                presetId = urlParams.get('preset_id');
                console.log('Got preset ID from URL:', presetId);
            }
            
            // Debug localStorage contents
            console.log('All localStorage keys:', Object.keys(localStorage));
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                console.log(`localStorage[${key}] =`, localStorage.getItem(key));
            }
            
            if (!presetId) {
                console.error('No preset ID found for download');
                alert('No preset ID found. Please create a preset first.');
                return;
            }
            
            console.log(`Downloading preset with ID: ${presetId}`);
            
            // Disable the button and show loading state
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            
            // Call the download function directly with fetch
            fetch(window.utils.getApiUrl(`/api/presets/${presetId}/download`), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
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
                
                console.log(`Preset downloaded successfully`);
            })
            .catch(error => {
                console.error('Error downloading preset:', error);
                alert('Error downloading preset. Please try again.');
            })
            .finally(() => {
                // Re-enable the button
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-download"></i> Download Preset';
            });
        });
    }
    
    if (isPresetCreationPage && !hasInitialized) {
        console.log('Initializing preset creation page');
        setupTabSwitching();
        initializeCreatePresetButton();
        hasInitialized = true;
    } else {
        console.log('Not on preset creation page or already initialized, skipping initialization');
    }
});

// Expose functions to the window object, but only if we're on the preset creation page
if (document.getElementById('createPresetBtn') !== null) {
    // Clear any existing preset create functions
    if (window.presetCreate) {
        console.log('Clearing existing preset create functions');
        window.presetCreate = null;
    }
    
    window.presetCreate = {
        handleCreatePresetClick,
        downloadPreset,
        initializeDownloadLink
    };
}
