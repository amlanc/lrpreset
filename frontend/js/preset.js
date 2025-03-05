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
        const row = document.createElement('tr');
        
        // Create label cell
        const labelCell = document.createElement('td');
        labelCell.className = 'adjustment-label';
        labelCell.textContent = formatLabel(key);
        row.appendChild(labelCell);
        
        // Create value cell
        const valueCell = document.createElement('td');
        valueCell.className = 'adjustment-value';
        valueCell.textContent = formatValue(value);
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
        
        // Preview cell
        const previewCell = document.createElement('td');
        const previewImg = document.createElement('img');
        
        console.log('Preset:', preset.id);
        console.log('Preset image URL:', preset.image_url);
        
        // Check if image_url exists and is not empty
        if (preset.image_url && preset.image_url.trim() !== '') {
            // Try to load the image with the original URL
            const originalUrl = preset.image_url;
            
            // Remove any query parameters if present
            const cleanUrl = preset.image_url.split('?')[0];
            
            console.log('Original URL:', originalUrl);
            console.log('Clean URL:', cleanUrl);
            
            // Use the original URL first
            previewImg.src = originalUrl;
            
            // Add error handling to try the clean URL if the original fails
            previewImg.onerror = function() {
                console.log('Error loading image with original URL, trying clean URL');
                previewImg.src = cleanUrl;
                
                // If clean URL also fails, use placeholder
                previewImg.onerror = function() {
                    console.log('Error loading image with clean URL, using placeholder');
                    previewImg.src = '/img/placeholder.jpg';
                };
            };
        } else {
            console.warn('Missing or empty image URL for preset:', preset.id);
            previewImg.src = '/img/placeholder.jpg'; // Use a placeholder image
        }
        
        previewImg.alt = preset.name || 'Preset';
        previewImg.className = 'preset-thumbnail';
        previewCell.appendChild(previewImg);
        row.appendChild(previewCell);
        
        // Name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = preset.name || `Preset ${preset.id}`;
        row.appendChild(nameCell);
        
        // Created cell
        const createdCell = document.createElement('td');
        const createdDate = new Date(preset.created_at);
        createdCell.textContent = createdDate.toLocaleDateString();
        row.appendChild(createdCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'preset-actions';
        
        // View button
        const viewButton = document.createElement('a');
        viewButton.href = `preset.html?id=${preset.id}`;
        viewButton.className = 'action-button view-button';
        viewButton.innerHTML = '<i class="fas fa-eye"></i>';
        viewButton.title = 'View preset details';
        actionsCell.appendChild(viewButton);
        
        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.className = 'action-button download-button';
        downloadButton.innerHTML = '<i class="fas fa-download"></i>';
        downloadButton.title = 'Download preset';
        downloadButton.onclick = function() {
            window.preset.downloadPreset(preset.id);
        };
        actionsCell.appendChild(downloadButton);
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button delete-button';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = 'Delete preset';
        deleteButton.onclick = function() {
            if (confirm('Are you sure you want to delete this preset?')) {
                window.preset.deletePreset(preset.id);
            }
        };
        actionsCell.appendChild(deleteButton);
        
        row.appendChild(actionsCell);
        
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
