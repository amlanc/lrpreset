/**
 * Dashboard Module
 * Handles dashboard functionality and preset management
 */

// Cache for dashboard image proxy URLs
class DashboardImageCache {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

// Initialize dashboard image cache
const dashboardImageCache = new DashboardImageCache(50);

// Clean up cache when leaving dashboard page
window.addEventListener('unload', () => {
    dashboardImageCache.clear();
});

/**
 * Loads user presets for the dashboard
 */
async function loadUserPresets() {
    try {
        const loadingIndicator = document.getElementById('loading-presets');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }

        // Check if we have a valid auth token
        const token = window.auth.getAuthToken();
        if (!token) {
            throw new Error('No authentication token available');
        }

        const apiUrl = window.utils.getApiUrl('/api/presets/user');
        console.log('Fetching presets from:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const responseData = await response.json();

        if (response.status === 404 && responseData.error === 'Preset not found') {
            // When no presets are found, display empty table
            console.log('No presets found for user');
            displayPresetsTable([]);
            return;
        }

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication failed. Please try logging in again.');
            } else {
                throw new Error(`Server error: ${response.status} ${responseData.error || response.statusText}`);
            }
        }

        displayPresetsTable(responseData);

    } catch (error) {
        console.error('Error loading presets:', error);
        const loadingIndicator = document.getElementById('loading-presets');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Use the notification system for better user feedback
        if (window.utils && window.utils.createNotification) {
            window.utils.createNotification(
                error.message || 'Failed to load presets. Please try again.',
                'error',
                5000
            );
        } else {
            alert(error.message || 'Failed to load presets. Please try again.');
        }
    }
}

/**
 * Displays presets in a table
 * @param {Array} presets - Array of preset objects
 */
function displayPresetsTable(presets) {
    const presetContainer = document.getElementById('presets-table-body');
    if (!presetContainer) {
        console.error("[Dashboard] Presets table body not found");
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
        
        // Hide loading indicator
        const loadingPresets = document.getElementById('loading-presets');
        if (loadingPresets) {
            loadingPresets.style.display = 'none';
        }
        
        return;
    }
    
    // Hide empty state
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    // Hide loading indicator
    const loadingPresets = document.getElementById('loading-presets');
    if (loadingPresets) {
        loadingPresets.style.display = 'none';
    }
    
    // Debug the presets data structure
    console.log('Presets data received:', presets);
    
    // For each preset, create a table row
    presets.forEach((preset, index) => {
        // Map the 'id' property to 'preset_id' if needed
        if (preset.id && !preset.preset_id) {
            preset.preset_id = preset.id;
        }
        
        // Debug each preset object
        console.log(`Preset ${index}:`, preset);
        console.log(`Preset ${index} ID:`, preset.preset_id);
        
        const row = document.createElement('tr');
        
        // Create cells
        const cells = {
            preview: document.createElement('td'),
            name: document.createElement('td'),
            created: document.createElement('td'),
            actions: document.createElement('td')
        };

        // Apply cell classes
        cells.preview.className = 'preset-preview-cell';
        cells.name.className = 'preset-name-cell';
        cells.created.className = 'preset-created-cell';
        cells.actions.className = 'preset-actions-cell';
        
        // Preview cell - make it clickable
        const previewLink = document.createElement('a');
        // Use id property if preset_id is not available
        const presetId = preset.preset_id || preset.id || '';
        console.log(`Creating link with preset ID: ${presetId}`);
        previewLink.href = `preset-detail.html?id=${presetId}`;
        previewLink.onclick = (e) => {
            // Prevent navigation if preset_id is missing
            if (!presetId) {
                e.preventDefault();
                console.error('Cannot navigate to preset detail: preset_id is undefined');
                window.utils.createNotification('Error: Cannot view preset details', 'error', 3000);
                return false;
            }
        };
        previewLink.title = 'View preset details';
        
        const previewImg = document.createElement('img');
        previewImg.alt = preset.name || 'Preset';
        previewImg.className = 'preset-thumbnail';
        
        // Handle image URL with caching
        const imageUrl = preset.image_url?.trim() || '';
        if (imageUrl) {
            const cachedProxyUrl = dashboardImageCache.get(imageUrl);
            if (cachedProxyUrl) {
                previewImg.src = cachedProxyUrl;
            } else {
                const proxyUrl = window.utils.getApiUrl('/proxy/image') + '?url=' + encodeURIComponent(imageUrl);
                dashboardImageCache.set(imageUrl, proxyUrl);
                previewImg.src = proxyUrl;
            }
        } else {
            previewImg.src = '/img/placeholder.jpg';
        }
        
        previewLink.appendChild(previewImg);
        cells.preview.appendChild(previewLink);
        
        // Name cell
        cells.name.textContent = preset.name || `Preset ${preset.preset_id}`;
        
        // Created cell
        if (preset.created_at) {
            const createdDate = new Date(preset.created_at);
            cells.created.textContent = `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            cells.created.textContent = 'Unknown';
        }
        
        // Actions cell
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'action-buttons';
        
        // Create action buttons
        const buttons = [
            {
                icon: 'eye',
                title: 'View preset details',
                className: 'view-button',
                onClick: () => {
                    // Use id property if preset_id is not available
                    if (preset.preset_id || preset.id) {
                        const presetId = preset.preset_id || preset.id;
                        window.location.href = `preset-detail.html?id=${presetId}`;
                    } else {
                        console.error('Cannot navigate to preset detail: preset_id is undefined');
                        window.utils.createNotification('Error: Cannot view preset details', 'error', 3000);
                    }
                }
            },
            {
                icon: 'download',
                title: 'Download preset',
                className: 'download-button',
                onClick: () => {
                    // Ensure preset_id is defined before downloading
                    if (preset.preset_id) {
                        downloadPreset(preset.preset_id);
                    } else {
                        console.error('Cannot download preset: preset_id is undefined');
                        window.utils.createNotification('Error: Cannot download preset', 'error', 3000);
                    }
                }
            },
            {
                icon: 'trash',
                title: 'Delete preset',
                className: 'delete-button',
                onClick: () => {
                    // Ensure preset_id is defined before deleting
                    if (!preset.preset_id) {
                        console.error('Cannot delete preset: preset_id is undefined');
                        window.utils.createNotification('Error: Cannot delete preset', 'error', 3000);
                        return;
                    }
                    
                    if (confirm('Are you sure you want to delete this preset?')) {
                        deletePreset(preset.preset_id);
                    }
                }
            }
        ];
        
        // Add buttons to container
        buttons.forEach(({ icon, title, className, onClick }) => {
            const button = document.createElement('button');
            button.className = `dashboard-button ${className}`;
            button.innerHTML = `<i class="fas fa-${icon}"></i>`;
            button.title = title;
            button.onclick = onClick;
            actionsContainer.appendChild(button);
        });
        
        cells.actions.appendChild(actionsContainer);
        
        // Add cells to row
        Object.values(cells).forEach(cell => row.appendChild(cell));
        
        // Add row to table
        presetContainer.appendChild(row);
    });
}

/**
 * Downloads a preset
 * @param {string} presetId - ID of the preset to download
 */
async function downloadPreset(presetId) {
    try {
        const response = await fetch(window.utils.getApiUrl(`/api/presets/${presetId}/download`), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${window.auth.getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download preset');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preset_${presetId}.xmp`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Error downloading preset:', error);
        alert('Failed to download preset. Please try again.');
    }
}

/**
 * Deletes a preset
 * @param {string} presetId - ID of the preset to delete
 */
async function deletePreset(presetId) {
    try {
        const response = await fetch(window.utils.getApiUrl(`/api/presets/${presetId}`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${window.auth.getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete preset');
        }

        // Reload presets table
        loadUserPresets();

    } catch (error) {
        console.error('Error deleting preset:', error);
        alert('Failed to delete preset. Please try again.');
    }
}

/**
 * Validates file size
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum size in bytes
 * @returns {boolean} - Whether the file is valid
 */
function validateFileSize(file, maxSize = 10 * 1024 * 1024) { // 10MB max by default
    if (file.size > maxSize) {
        const sizeMB = Math.round(file.size / (1024 * 1024));
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        window.utils.createNotification(
            `File size (${sizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
            'error',
            5000
        );
        return false;
    }
    return true;
}

/**
 * Updates file input display
 * @param {HTMLInputElement} input - File input element
 * @param {HTMLElement} displayElement - Element to display file name
 */
function updateFileDisplay(input, displayElement) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        displayElement.textContent = file.name;
        displayElement.title = file.name;
        return validateFileSize(file);
    }
    displayElement.textContent = '';
    displayElement.title = '';
    return true;
}

/**
 * Creates a new preset
 * @param {File} xmpFile - The XMP file to create preset from
 * @param {File} imageFile - Optional preview image file
 */
async function createPreset(xmpFile, imageFile) {
    const createButton = document.getElementById('dashboard-create-preset-button');
    const loadingSpinner = createButton.querySelector('.loading-spinner');
    
    try {
        // Disable button and show loading state
        createButton.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        
        // Validate file sizes
        if (!validateFileSize(xmpFile) || (imageFile && !validateFileSize(imageFile))) {
            throw new Error('File size validation failed');
        }

        const formData = new FormData();
        formData.append('xmp_file', xmpFile);
        if (imageFile) {
            formData.append('image_file', imageFile);
        }

        const response = await fetch(window.utils.getApiUrl('/api/presets'), {

            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.auth.getAuthToken()}`,
                'Accept': 'application/json'
            },
            body: formData
        });

        console.log('Response status:', response.status);
        let responseData;

        try {
            responseData = await response.json();
            console.log('Response data:', responseData);
        } catch (e) {
            console.error('Failed to parse response as JSON:', e);
            throw new Error('Server returned an invalid response');
        }

        if (!response.ok) {
            const errorMessage = responseData.error || 'Failed to create preset';
            console.error('Server error:', errorMessage);
            throw new Error(errorMessage);
        }

        if (!responseData.preset_id) {
            console.error('Missing preset_id in response:', responseData);
            throw new Error('Server returned an invalid response');
        }

        // Reload presets table
        console.log('Reloading presets table...');
        await loadUserPresets();

        // Show success notification
        window.utils.createNotification(
            responseData.message || 'Preset created successfully!',
            'success',
            3000
        );

        // Reset form
        const form = document.getElementById('create-preset-form');
        form.reset();
        
        // Clear file name displays
        document.getElementById('xmp-file-name').textContent = '';
        document.getElementById('image-file-name').textContent = '';

    } catch (error) {
        console.error('Error creating preset:', error);
        window.utils.createNotification(
            error.message || 'Failed to create preset. Please try again.',
            'error',
            5000
        );
    } finally {
        // Re-enable button and hide loading state
        createButton.disabled = false;
        loadingSpinner.style.display = 'none';
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth module to be available
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!window.auth && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.auth) {
        console.error('Auth module failed to initialize');
        return;
    }
    
    // Check authentication
    if (!window.auth.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        window.location.href = '/index.html';
        return;
    }
    
    // Load user presets
    await loadUserPresets();

    // Setup create preset form
    const createPresetForm = document.getElementById('create-preset-form');
    const xmpFileInput = document.getElementById('xmp-file');
    const imageFileInput = document.getElementById('image-file');
    const xmpFileDisplay = document.getElementById('xmp-file-name');
    const imageFileDisplay = document.getElementById('image-file-name');

    if (createPresetForm) {
        // Handle file selection display
        xmpFileInput?.addEventListener('change', () => {
            updateFileDisplay(xmpFileInput, xmpFileDisplay);
        });

        imageFileInput?.addEventListener('change', () => {
            updateFileDisplay(imageFileInput, imageFileDisplay);
        });

        createPresetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const xmpFile = xmpFileInput?.files[0];
            const imageFile = imageFileInput?.files[0];

            if (!xmpFile) {
                window.utils.createNotification('Please select an XMP file', 'error', 3000);
                return;
            }

            await createPreset(xmpFile, imageFile);
        });
    }
});
