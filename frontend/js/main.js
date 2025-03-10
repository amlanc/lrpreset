/**
 * Main Application Module
 * Initializes the application and coordinates between modules
 */

// Use utility functions directly from window.utils
// No need to redeclare them as constants

/**
 * Initializes the application
 */
function initializeApp() {
    console.log('Initializing application...');
    
    // Check for authentication response in URL
    const authResponseHandled = window.auth.checkUrlForAuthResponse();
    
    // Initialize authentication
    window.auth.startGoogleAuth();
    
    // Wait for auth to be ready before initializing features
    const initializeFeatures = () => {
        console.log('Initializing features...');
        
        // Initialize image upload
        if (typeof window.upload !== 'undefined' && window.upload.initializeImageUpload) {
            window.upload.initializeImageUpload();
        }
        
        // Check for last uploaded image
        if (typeof window.upload !== 'undefined' && window.upload.checkForLastUpload) {
            window.upload.checkForLastUpload();
        }
        
        // Initialize create preset button
        const createPresetBtn = document.getElementById('createPresetBtn');
        if (createPresetBtn) {
            createPresetBtn.addEventListener('click', () => {
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
                
                // Show the metadata display section
                const metadataDisplay = document.getElementById('metadata-display');
                if (metadataDisplay) {
                    metadataDisplay.style.display = 'block';
                }
                
                // Show and animate the AI processing steps
                const uploadStatus = document.getElementById('upload-status');
                if (uploadStatus) {
                    uploadStatus.style.display = 'block';
                    
                    // Start the AI progress animation
                    const aiSteps = document.querySelectorAll('.ai-step');
                    aiSteps.forEach((step, index) => {
                        setTimeout(() => {
                            step.classList.add('active');
                        }, index * 1000);
                    });
                }
                
                // Create FormData for the image
                const formData = new FormData();
                formData.append('image', imageUpload.files[0]);
                
                // Send the image to the backend for processing
                fetch(window.utils.getApiUrl('/api/presets/analyze'), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${window.auth.getAuthToken()}`
                    },
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Populate the adjustment tabs with the real data
                    populateAdjustmentTabs(data);
                })
                .catch(error => {
                    console.error('Error analyzing image:', error);
                    alert('Error analyzing image: ' + error.message);
                    
                    // Hide the processing UI on error
                    if (metadataDisplay) {
                        metadataDisplay.style.display = 'none';
                    }
                    if (uploadStatus) {
                        uploadStatus.style.display = 'none';
                    }
                });
            });
        }
        
        // Initialize dashboard if on dashboard page
        if (window.location.pathname.includes('dashboard')) {
            if (typeof window.preset !== 'undefined' && window.preset.loadUserPresets) {
                window.preset.loadUserPresets();
            }
        }
        
        // Initialize preset page if on preset page
        if (window.location.pathname.includes('preset.html')) {
            const presetId = window.utils.getUrlParameter('id');
            if (presetId && window.preset && window.preset.loadPresetDetails) {
                window.preset.loadPresetDetails(presetId);
            }
        }
    };
    
    // Check auth status periodically until ready
    const checkAuthAndInit = () => {
        if (window.auth.isAuthenticated()) {
            initializeFeatures();
        } else {
            setTimeout(checkAuthAndInit, 100); // Check every 100ms
        }
    };
    
    // Start checking auth status
    checkAuthAndInit();
    
    // Add event listeners for global elements
    addGlobalEventListeners();
}

/**
 * Adds event listeners for global elements
 */
function addGlobalEventListeners() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const dropdowns = document.querySelectorAll('.dropdown-content.show');
        dropdowns.forEach(dropdown => {
            if (!event.target.closest('.dropdown')) {
                dropdown.classList.remove('show');
            }
        });
    });
    
    // Handle mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenu) {
                mobileMenu.classList.toggle('show');
            }
        });
    }
}

/**
 * Populates an adjustment tab with data
 * @param {string} tabId - ID of the tab content element
 * @param {Object} adjustments - Adjustment data
 */
function populateAdjustmentTab(tabId, adjustments) {
    const tbody = document.getElementById(`${tabId}-adjustments`);
    if (!tbody) {
        console.error(`Tab content element not found: ${tabId}`);
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
        hsl: {},
        detail: {},
        effects: {}
    };
    
    // Handle different data structures
    if (typeof presetData === 'object' && presetData !== null) {
        // Case 1: Data is already structured with tabs
        if (presetData.basic || presetData.color || presetData.hsl || presetData.detail || presetData.effects) {
            if (presetData.basic) restructuredData.basic = presetData.basic;
            if (presetData.color) restructuredData.color = presetData.color;
            if (presetData.hsl) restructuredData.hsl = presetData.hsl;
            if (presetData.detail) restructuredData.detail = presetData.detail;
            if (presetData.effects) restructuredData.effects = presetData.effects;
        } 
        // Case 2: Data is a flat structure, need to organize into tabs
        else {
            // Categorize properties into appropriate tabs
            for (const [key, value] of Object.entries(presetData)) {
                if (['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'temperature'].includes(key.toLowerCase())) {
                    restructuredData.basic[key] = value;
                } else if (['vibrance', 'saturation', 'tint'].includes(key.toLowerCase())) {
                    restructuredData.color[key] = value;
                } else if (['texture', 'clarity', 'dehaze', 'sharpening', 'noise'].includes(key.toLowerCase())) {
                    restructuredData.detail[key] = value;
                } else if (['vignette', 'grain'].includes(key.toLowerCase())) {
                    restructuredData.effects[key] = value;
                }
            }
        }
    }
    
    // Populate regular tabs with the restructured data
    populateAdjustmentTab('basic', restructuredData.basic);
    populateAdjustmentTab('color', restructuredData.color);
    populateAdjustmentTab('detail', restructuredData.detail);
    populateAdjustmentTab('effects', restructuredData.effects);
    
    // Special handling for HSL adjustments since they have a different structure
    const hslTbody = document.getElementById('hsl-adjustments');
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

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
