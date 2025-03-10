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

        // Always expect the response in the format {presets: [...]} as we've standardized the backend
        let presetsToDisplay = [];
        
        if (responseData && responseData.presets) {
            console.log('Received presets in object format:', responseData.presets.length);
            presetsToDisplay = responseData.presets;
        } else if (Array.isArray(responseData)) {
            // For backward compatibility, handle array format
            console.log('Received presets in array format:', responseData.length);
            presetsToDisplay = responseData;
            console.warn('Backend returned array format instead of {presets: [...]} format');
        } else {
            console.error('Unexpected response format:', responseData);
            // Return empty array in case of unexpected format
            presetsToDisplay = [];
        }
        
        // Enhanced deduplication logic - use a Map to track by ID for better performance
        const presetMap = new Map();
        
        // First pass: collect all presets by ID, keeping only the most recent version
        presetsToDisplay.forEach(preset => {
            const id = preset.id || preset.preset_id;
            if (!id) {
                console.warn('Preset without ID:', preset);
                return; // Skip presets without ID
            }
            
            // If we already have this ID, check which one is newer
            if (presetMap.has(id)) {
                const existingPreset = presetMap.get(id);
                const existingDate = existingPreset.created_at ? new Date(existingPreset.created_at) : new Date(0);
                const currentDate = preset.created_at ? new Date(preset.created_at) : new Date(0);
                
                console.log(`Found duplicate preset with ID: ${id}`);
                console.log(`  Existing date: ${existingDate.toISOString()}`);
                console.log(`  Current date: ${currentDate.toISOString()}`);
                
                // Only replace if this preset is newer
                if (currentDate > existingDate) {
                    console.log(`  Replacing with newer version`);
                    presetMap.set(id, preset);
                } else {
                    console.log(`  Keeping existing version (newer)`);
                }
            } else {
                // First time seeing this ID
                presetMap.set(id, preset);
            }
        });
        
        // Convert map values to array
        const uniquePresets = Array.from(presetMap.values());
        
        // Sort by created_at date, newest first
        uniquePresets.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA; // Descending order (newest first)
        });
        
        console.log(`Displaying ${uniquePresets.length} unique presets out of ${presetsToDisplay.length} total`);
        displayPresetsTable(uniquePresets);

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
    console.log('Response data type:', typeof presets);
    console.log('Response data length:', presets.length);
    if (presets.length > 0) {
        console.log('First preset:', presets[0]);
    }
    
    // Make sure presets is an array before iterating
    const presetsArray = Array.isArray(presets) ? presets : [];
    
    // Log each preset ID before display
    console.log('Presets to display:', presetsArray);
    console.log('Number of presets to display:', presetsArray.length);
    
    // We'll use the presets directly since they were already deduplicated in loadUserPresets
    const uniquePresets = presetsArray;
    
    // For each unique preset, create a table row
    uniquePresets.forEach((preset, index) => {
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
        
        // Create a container div for the preset thumbnail
        const previewContainer = document.createElement('div');
        previewContainer.className = 'preset-thumbnail-container';
        previewContainer.style.width = '100%';
        previewContainer.style.height = '100%';
        previewContainer.style.display = 'flex';
        previewContainer.style.alignItems = 'center';
        previewContainer.style.justifyContent = 'center';
        previewContainer.style.backgroundColor = '#f0f0f0';
        previewContainer.style.borderRadius = '4px';
        
        // Create the image element
        const previewImg = document.createElement('img');
        previewImg.alt = preset.name || 'Preset';
        previewImg.className = 'preset-thumbnail';
        previewImg.style.maxWidth = '100%';
        previewImg.style.maxHeight = '100%';
        
        // Add the image to the container
        previewContainer.appendChild(previewImg);
        
        // Add the container to the link
        previewLink.appendChild(previewContainer);
        
        // Handle image URL with caching
        const imageUrl = preset.image_url?.trim() || '';
        console.log(`Preset ${index} image URL:`, imageUrl);
        
        if (imageUrl) {
            // Check if this is a base64 data URL
            if (imageUrl.startsWith('data:')) {
                console.log(`Preset ${index}: Detected base64 data URL`);
                
                // Check if this is a 1x1 transparent GIF placeholder
                if (imageUrl === 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7') {
                    console.log(`Preset ${index}: Detected 1x1 transparent GIF placeholder, using text placeholder instead`);
                    useTextPlaceholder();
                } else {
                    // Use the base64 data URL directly without proxying
                    console.log(`Preset ${index}: Using non-placeholder base64 data URL`);
                    previewImg.src = imageUrl;
                    
                    // Add onload handler to check dimensions after loading
                    previewImg.onload = function() {
                        // Check if this is a very small image (likely a placeholder)
                        if (this.naturalWidth <= 1 || this.naturalHeight <= 1) {
                            console.log(`Preset ${index}: Detected small image (${this.naturalWidth}x${this.naturalHeight}), using text placeholder instead`);
                            useTextPlaceholder();
                        }
                    };
                }
                
                // Helper function to create text placeholder
                function useTextPlaceholder() {
                    // Don't set the src, we'll use a text placeholder instead
                    previewImg.style.display = 'none';
                    
                    // Add a text placeholder
                    const textPlaceholder = document.createElement('div');
                    textPlaceholder.className = 'preset-text-placeholder';
                    textPlaceholder.textContent = preset.name || 'Preset';
                    textPlaceholder.style.width = '100%';
                    textPlaceholder.style.height = '100%';
                    textPlaceholder.style.display = 'flex';
                    textPlaceholder.style.alignItems = 'center';
                    textPlaceholder.style.justifyContent = 'center';
                    textPlaceholder.style.backgroundColor = '#f0f0f0';
                    textPlaceholder.style.color = '#666';
                    textPlaceholder.style.fontSize = '12px';
                    textPlaceholder.style.fontWeight = 'bold';
                    textPlaceholder.style.borderRadius = '4px';
                    
                    // Add the text placeholder to the container
                    // Make sure the parent node exists before inserting
                    if (previewImg.parentNode === previewContainer) {
                        previewContainer.insertBefore(textPlaceholder, previewImg);
                    } else {
                        // If the image isn't in the container yet, just append to container
                        previewContainer.appendChild(textPlaceholder);
                    }
                }
            } else {
                // Handle regular URLs
                // Determine if this is a signed URL (contains token parameter)
                const isSignedUrl = imageUrl.includes('token=');
                
                // For signed URLs, keep the original URL with the token
                // For non-signed URLs, clean up as before
                let cleanImageUrl = imageUrl;
                
                if (!isSignedUrl) {
                    // Remove trailing question mark if present
                    if (cleanImageUrl.endsWith('?')) {
                        cleanImageUrl = cleanImageUrl.slice(0, -1);
                        console.log(`Preset ${index}: Removed trailing question mark from URL:`, cleanImageUrl);
                    }
                    
                    // For Supabase URLs, remove any query parameters
                    if (cleanImageUrl.includes('supabase') && cleanImageUrl.includes('?')) {
                        cleanImageUrl = cleanImageUrl.split('?')[0];
                        console.log(`Preset ${index}: Removed query parameters from Supabase URL:`, cleanImageUrl);
                    }
                } else {
                    console.log(`Preset ${index}: Using signed URL with token:`, cleanImageUrl);
                }
                
                // Get user ID for user-specific caching
                const userId = window.auth.getUserId();
                console.log(`Preset ${index}: User ID for caching:`, userId);
                
                // Create cache key that includes the user ID
                const cacheKey = `${userId}:${cleanImageUrl}`;
                
                // Create the proxy URL directly without caching for now to debug
                const proxyUrl = window.utils.getApiUrl('/proxy/image') + 
                    '?url=' + encodeURIComponent(cleanImageUrl) + 
                    '&user_id=' + encodeURIComponent(userId);
                
                console.log(`Preset ${index}: Setting image src to:`, proxyUrl);
                previewImg.src = proxyUrl;
                
                // Store in cache for future use
                dashboardImageCache.set(cacheKey, proxyUrl);
            }
            
            // Only add a general onload handler for non-base64 images
            // (base64 images already have specific handlers)
            if (!imageUrl.startsWith('data:')) {
                previewImg.onload = function() {
                    console.log(`Preset ${index}: Image loaded successfully`);
                    
                    // Check if this is a very small image (likely a placeholder)
                    if (this.naturalWidth <= 1 || this.naturalHeight <= 1) {
                        console.log(`Preset ${index}: Detected small image (${this.naturalWidth}x${this.naturalHeight}), using text placeholder`);
                        
                        // Use our existing helper function
                        useTextPlaceholder();
                    }
                };
            }
            
            // Store the URL for error handling reference
            const imageUrlForErrorHandling = imageUrl;
            
            // Add error handling for image loading
            previewImg.onerror = function() {
                console.error(`Preset ${index}: Failed to load image:`, imageUrlForErrorHandling);
                
                // Just hide the image if it fails to load
                this.style.display = 'none';
                
                // Add a text placeholder instead
                const textPlaceholder = document.createElement('div');
                textPlaceholder.className = 'preset-text-placeholder';
                textPlaceholder.textContent = preset.name || 'Preset';
                textPlaceholder.style.width = '100%';
                textPlaceholder.style.height = '100%';
                textPlaceholder.style.display = 'flex';
                textPlaceholder.style.alignItems = 'center';
                textPlaceholder.style.justifyContent = 'center';
                textPlaceholder.style.backgroundColor = '#f0f0f0';
                textPlaceholder.style.color = '#666';
                textPlaceholder.style.fontSize = '12px';
                textPlaceholder.style.fontWeight = 'bold';
                textPlaceholder.style.borderRadius = '4px';
                
                // Insert the text placeholder before the image
                this.parentNode.insertBefore(textPlaceholder, this);
                
                // Try a fallback approach - attempt to load directly from Supabase
                console.log(`Preset ${index}: Attempting fallback image load`);
                
                // Remove the src attribute entirely to prevent broken image icons
                this.removeAttribute('src');
                
                // Add a class to indicate the image failed to load
                this.classList.add('image-load-failed');
                
                // Add a title attribute to explain the issue on hover
                this.title = 'Image failed to load';
                
                // Remove the error handler to prevent further attempts
                this.onerror = null;
            };
        } else {
            // No image URL provided, don't show any image
            previewImg.classList.add('no-image');
            previewImg.title = 'No image available';
        }
        
        previewLink.appendChild(previewImg);
        cells.preview.appendChild(previewLink);
        
        // Name cell
        cells.name.textContent = preset.name || `Preset ${preset.preset_id}`;
        
        // Created cell
        if (preset.created_at) {
            const createdDate = new Date(preset.created_at);
            // Format date in a user-friendly way that matches the preset name format
            const formattedDate = createdDate.toLocaleString(undefined, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            cells.created.textContent = formattedDate;
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

// File validation and display functions have been removed as they should only be in preset-create.js

// This function has been removed as preset creation should only be handled in preset-create.js

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

    // Dashboard should only focus on displaying and managing existing presets
    // Preset creation functionality has been moved to preset-create.js
});
