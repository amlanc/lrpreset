/**
 * Preset Module
 * Handles preset creation, display, and management
 */

// Cache for dashboard image proxy URLs
class DashboardImageCache {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        
        // Get the value and refresh its position
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove oldest entry
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

// Initialize dashboard image cache only if we're on the dashboard page
const dashboardImageCache = window.location.pathname.endsWith('dashboard.html') ? new DashboardImageCache(50) : null;

// Clean up cache when leaving dashboard page
if (dashboardImageCache) {
    window.addEventListener('unload', () => {
        dashboardImageCache.clear();
    });
}

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
    // Store preset ID
    const metadataContainer = document.querySelector('.metadata-container');
    if (metadataContainer) {
        metadataContainer.dataset.presetId = presetId;
    } else {
        console.error('Metadata container not found');
    }
    
    // Populate each tab
    if (presetData.basic) {
        populateAdjustmentTab('basic-adjustments', presetData.basic);
    }
    
    if (presetData.color) {
        populateAdjustmentTab('color-adjustments', presetData.color);
    }
    
    if (presetData.detail) {
        populateAdjustmentTab('detail-adjustments', presetData.detail);
    }
    
    if (presetData.effects) {
        populateAdjustmentTab('effects-adjustments', presetData.effects);
    }
}

/**
 * Sets up tab switching functionality
 */
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.preset-tab');
    const tabContents = document.querySelectorAll('.preset-tab-content');
    
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
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
}

/**
 * Populates an adjustment tab
 * @param {string} tabId - ID of the tab
 * @param {Object} adjustments - Adjustment data
 */
function populateAdjustmentTab(tabId, adjustments) {
    const tabElement = document.getElementById(tabId);
    if (!tabElement) {
        console.error(`[Preset] Tab element not found: ${tabId}`);
        return;
    }
    
    // Clear existing content
    tabElement.innerHTML = '';
    
    // Add each adjustment
    for (const [key, value] of Object.entries(adjustments)) {
        // Skip the absolute_kelvin entry as we'll use it for temperature display
        if (key === 'absolute_kelvin') continue;
        
        const row = document.createElement('tr');
        
        // Create label cell
        const labelCell = document.createElement('td');
        labelCell.className = 'adjustment-label';
        labelCell.textContent = formatLabel(key);
        row.appendChild(labelCell);
        
        // Create value cell
        const valueCell = document.createElement('td');
        valueCell.className = 'adjustment-value';
        
        // Special handling for temperature - show absolute Kelvin value if available
        if (key === 'temperature' && adjustments.absolute_kelvin) {
            valueCell.textContent = `${adjustments.absolute_kelvin}K (${formatValue(value)})`;
        } else {
            valueCell.textContent = formatValue(value);
        }
        
        row.appendChild(valueCell);
        
        // Add row to table
        tabElement.appendChild(row);
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
 * Displays presets in a table
 * @param {Array} presets - Array of preset objects
 */
function displayPresetsTable(presets) {
    const presetContainer = document.getElementById('presets-table-body');
    if (!presetContainer) {
        console.error("[Preset] Presets table body not found");
        return;
    }
    
    // Clear container
    presetContainer.innerHTML = '';
    
    if (!presets || presets.length === 0) {
        // Show empty state
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
        return;
    }
    
    // Hide empty state if it exists
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    console.log('Displaying presets:', presets);
    
    // Hide loading indicator if it exists
    const loadingPresets = document.getElementById('loading-presets');
    if (loadingPresets) {
        loadingPresets.style.display = 'none';
    }
    
    // For each preset, create a table row
    presets.forEach(preset => {
        const row = document.createElement('tr');
        
        // Create cells with consistent structure
        const cells = {
            preview: document.createElement('td'),
            name: document.createElement('td'),
            created: document.createElement('td'),
            actions: document.createElement('td')
        };

        // Apply consistent cell classes
        cells.preview.className = 'preset-preview-cell';
        cells.name.className = 'preset-name-cell';
        cells.created.className = 'preset-created-cell';
        cells.actions.className = 'preset-actions-cell';
        
        // Preview cell
        const previewImg = document.createElement('img');
        previewImg.alt = preset.name || 'Preset';
        previewImg.className = 'preset-thumbnail';
        
        // Handle image URL with caching
        const imageUrl = preset.image_url?.trim() || '';
        if (imageUrl) {
            // Check cache first (only if we're on dashboard)
            if (dashboardImageCache) {
                const cachedProxyUrl = dashboardImageCache.get(imageUrl);
                if (cachedProxyUrl) {
                    previewImg.src = cachedProxyUrl;
                    return;
                }
            }

            // Create the proxy URL
            const proxyUrl = window.utils.getApiUrl('/proxy/image') + '?url=' + encodeURIComponent(imageUrl);
            
            // Cache and use the proxy URL
            if (dashboardImageCache) {
                dashboardImageCache.set(imageUrl, proxyUrl);
            }
            previewImg.src = proxyUrl;
        } else {
            previewImg.src = '/img/placeholder.jpg';
        }
        
        cells.preview.appendChild(previewImg);
        
        // Name cell
        cells.name.textContent = preset.name || `Preset ${preset.id}`;
        
        // Created cell
        cells.created.textContent = new Date(preset.created_at).toLocaleDateString();
        
        // Actions cell
        cells.actions.className = 'preset-actions-cell';
        
        // Create action buttons container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'action-buttons';
        
        // Create buttons with consistent structure
        const buttons = [
            {
                icon: 'eye',
                title: 'View preset details',
                className: 'view-button',
                onClick: () => window.location.href = `preset.html?id=${preset.id}`
            },
            {
                icon: 'download',
                title: 'Download preset',
                className: 'download-button',
                onClick: () => window.preset.downloadPreset(preset.id)
            },
            {
                icon: 'trash',
                title: 'Delete preset',
                className: 'delete-button',
                onClick: () => {
                    if (confirm('Are you sure you want to delete this preset?')) {
                        window.preset.deletePreset(preset.id);
                    }
                }
            }
        ];
        
        // Create and append buttons
        buttons.forEach(({ icon, title, className, onClick }) => {
            const button = document.createElement('button');
            button.className = `dashboard-button ${className}`;
            button.innerHTML = `<i class="fas fa-${icon}"></i>`;
            button.title = title;
            button.onclick = onClick;
            actionsContainer.appendChild(button);
        });
        
        // Add the container to the actions cell
        cells.actions.appendChild(actionsContainer);
        
        // Append all cells to the row in order
        Object.values(cells).forEach(cell => row.appendChild(cell));
        
        // Add row to container
        presetContainer.appendChild(row);
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
    
    // Upload image
    fetch(window.utils.getApiUrl('/upload'), {
        method: 'POST',
        headers: headers,
        body: formData
    })
    .then(response => {
        console.log('Server response status:', response.status);
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

// Export functions to the global namespace
window.preset = {
    showPresetPreview,
    populateAdjustmentTabs,
    setupTabSwitching,
    handleCreatePresetClick,
    initializeCreatePresetButton,
    loadUserPresets,
    downloadPreset,
    deletePreset
};
