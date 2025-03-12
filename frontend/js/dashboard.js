/**
 * Dashboard Module
 * Handles dashboard functionality and preset management
 */

// Dashboard configuration
const DASHBOARD_CONFIG = {
    itemsPerPage: 5,      // Number of presets to display per page (table view)
    gridItemsPerPage: 12, // Number of presets to display per page (grid view)
    currentPage: 1,       // Current page being viewed
    currentView: 'grid', // Current view mode ('table' or 'grid')
    totalPages: 1         // Total number of pages
};

/**
 * Calculates the optimal number of grid items per page based on browser size
 * @returns {number} Number of items to display per page in grid view
 */
function calculateGridItemsPerPage() {
    const viewportWidth = window.innerWidth;
    
    // Base calculations on viewport size
    if (viewportWidth >= 1600) {
        return 16; // 4x4 grid for large screens
    } else if (viewportWidth >= 1200) {
        return 12; // 4x3 grid for medium-large screens
    } else if (viewportWidth >= 768) {
        return 9; // 3x3 grid for medium screens
    } else {
        return 6; // 2x3 grid for small screens
    }
}

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

        const apiUrl = getApiUrl('/api/presets/user');
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
                
                // Only replace if this preset is newer
                if (currentDate > existingDate) {
                    presetMap.set(id, preset);
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
        
        // Store all presets in a global variable for pagination
        window.allPresets = uniquePresets;
        
        // Update grid items per page based on browser size
        DASHBOARD_CONFIG.gridItemsPerPage = calculateGridItemsPerPage();
        
        // Calculate total pages based on current view
        const itemsPerPage = DASHBOARD_CONFIG.currentView === 'grid' 
            ? DASHBOARD_CONFIG.gridItemsPerPage 
            : DASHBOARD_CONFIG.itemsPerPage;
            
        DASHBOARD_CONFIG.totalPages = Math.ceil(uniquePresets.length / itemsPerPage);
        DASHBOARD_CONFIG.currentPage = 1; // Reset to first page when loading presets
        
        // Display presets based on current view mode
        if (DASHBOARD_CONFIG.currentView === 'grid') {
            displayPresetsGrid(getPaginatedPresets());
        } else {
            displayPresetsTable(getPaginatedPresets());
        }
        
        // Update pagination UI
        updatePaginationControls();

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
    // Log only essential information for monitoring
    console.log('Response data length:', presets.length);
    
    // Make sure presets is an array before iterating
    const presetsArray = Array.isArray(presets) ? presets : [];
    
    // Log each preset ID before display
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
        // Preset processing

        
        const row = document.createElement('tr');
        row.className = 'preset-row';
        
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
        previewLink.className = 'preset-preview-link';
        // Use id property if preset_id is not available
        const presetId = preset.preset_id || preset.id || '';

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
        
        // Create a container div for the preset thumbnail with fixed dimensions
        const previewContainer = document.createElement('div');
        previewContainer.className = 'preset-thumbnail-container';
        // Let CSS handle the styling
        
        // Create the image element
        const previewImg = document.createElement('img');
        previewImg.alt = preset.name || 'Preset';
        previewImg.className = 'preset-thumbnail';
        // Let CSS handle the styling
        
        // Add the image to the container
        previewContainer.appendChild(previewImg);
        
        // Add the container to the link
        previewLink.appendChild(previewContainer);
        
        // Handle image URL with caching
        const imageUrl = preset.image_url?.trim() || '';
        // console.log(`Preset ${index} image URL:`, imageUrl);
        
        if (imageUrl) {
            // Check if this is a base64 data URL
            if (imageUrl.startsWith('data:')) {
                // console.log(`Preset ${index}: Detected base64 data URL`);
                
                // Check if this is a 1x1 transparent GIF placeholder
                if (imageUrl === 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7') {

                    useTextPlaceholder();
                } else {
                    // Use the base64 data URL directly without proxying
                    previewImg.src = imageUrl;
                    
                    // Add onload handler to check dimensions after loading
                    previewImg.onload = function() {
                        // Check if this is a very small image (likely a placeholder)
                        if (this.naturalWidth <= 1 || this.naturalHeight <= 1) {
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

                    }
                    
                    // For Supabase URLs, remove any query parameters
                    if (cleanImageUrl.includes('supabase') && cleanImageUrl.includes('?')) {
                        cleanImageUrl = cleanImageUrl.split('?')[0];

                    }
                } else {

                }
                
                // Get user ID for user-specific caching
                const userId = localStorage.getItem('userId') || (window.auth && window.auth.getUserId ? window.auth.getUserId() : 'anonymous');

                
                // Create cache key that includes the user ID
                const cacheKey = `${userId}:${cleanImageUrl}`;
                
                // Create the proxy URL directly without caching for now to debug
                const proxyUrl = getApiUrl('/proxy/image') + 
                    '?url=' + encodeURIComponent(cleanImageUrl) + 
                    '&user_id=' + encodeURIComponent(userId);
                

                previewImg.src = proxyUrl;
                
                // Store in cache for future use
                dashboardImageCache.set(cacheKey, proxyUrl);
            }
            
            // Only add a general onload handler for non-base64 images
            // (base64 images already have specific handlers)
            if (!imageUrl.startsWith('data:')) {
                previewImg.onload = function() {
                    // Check if this is a very small image (likely a placeholder)
                    if (this.naturalWidth <= 1 || this.naturalHeight <= 1) {
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
                
                // Insert the text placeholder before the image
                this.parentNode.insertBefore(textPlaceholder, this);
                
                // Try a fallback approach - attempt to load directly from Supabase
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
        // If preset.name is available, use it; otherwise use the file_name without .xmp extension
        let displayName = preset.name;
        
        // If we have a file_name in the [Photograph_Name]_[YYYY]_[MM]_[DD]_[HH]_[MM].xmp format
        if (preset.file_name) {
            // Remove .xmp extension for display
            const filenameWithoutExt = preset.file_name.replace(/\.xmp$/i, '');
            
            // Parse the filename to extract photograph name and timestamp
            // Format: [Photograph_Name]_[YYYY]_[MM]_[DD]_[HH]_[MM]
            const parts = filenameWithoutExt.split('_');
            
            if (parts.length >= 6) {
                // Extract timestamp parts (last 5 elements)
                const timestampParts = parts.slice(-5);
                
                // Extract photograph name (everything before the timestamp)
                const photoNameParts = parts.slice(0, parts.length - 5);
                const photoName = photoNameParts.join('_').replace(/_/g, ' ');
                
                // Format the date: YYYY_MM_DD_HH_MM -> YYYY-MM-DD HH:MM
                const year = timestampParts[0];
                const month = timestampParts[1];
                const day = timestampParts[2];
                const hour = timestampParts[3];
                const minute = timestampParts[4];
                
                const formattedDate = `${year}-${month}-${day} ${hour}:${minute}`;
                
                // Create the final display name: Photograph Name (YYYY-MM-DD HH:MM)
                displayName = `${photoName} (${formattedDate})`;
            } else {
                // Fallback if the filename doesn't match the expected format
                displayName = filenameWithoutExt.replace(/_/g, ' ');
            }
        }
        
        cells.name.textContent = displayName || `Preset ${preset.preset_id}`;
        
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
                        alert('Error: Cannot download preset');
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
        // Get the auth token directly from localStorage
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No auth token found, redirecting to login');
            window.location.href = '/login.html';
            return;
        }
        
        // Make the download request
        const downloadUrl = getApiUrl(`/api/presets/${presetId}/download`);
        console.log('Download URL:', downloadUrl);
        
        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
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
/**
 * Returns the presets for the current page based on pagination settings and current view
 * @returns {Array} Array of preset objects for the current page
 */
function getPaginatedPresets() {
    if (!window.allPresets || !Array.isArray(window.allPresets)) {
        console.error('No presets available for pagination');
        return [];
    }
    
    // Use different items per page based on view mode
    const itemsPerPage = DASHBOARD_CONFIG.currentView === 'grid' 
        ? DASHBOARD_CONFIG.gridItemsPerPage 
        : DASHBOARD_CONFIG.itemsPerPage;
    
    const startIndex = (DASHBOARD_CONFIG.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return window.allPresets.slice(startIndex, endIndex);
}

/**
 * Updates the pagination controls UI based on current pagination state
 */
function updatePaginationControls() {
    const paginationControls = document.getElementById('pagination-controls');
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (!paginationControls || !currentPageEl || !totalPagesEl || !prevBtn || !nextBtn) {
        console.error('Pagination controls not found in the DOM');
        return;
    }
    
    // Only show pagination if we have presets and more than one page
    if (!window.allPresets || window.allPresets.length === 0 || DASHBOARD_CONFIG.totalPages <= 1) {
        paginationControls.style.display = 'none';
        return;
    }
    
    // Update page numbers
    currentPageEl.textContent = DASHBOARD_CONFIG.currentPage;
    totalPagesEl.textContent = DASHBOARD_CONFIG.totalPages;
    
    // Update button states
    prevBtn.disabled = DASHBOARD_CONFIG.currentPage <= 1;
    nextBtn.disabled = DASHBOARD_CONFIG.currentPage >= DASHBOARD_CONFIG.totalPages;
    
    // Show the pagination controls for both views
    paginationControls.style.display = 'flex';
}

/**
 * Handles pagination navigation
 * @param {string} direction - Direction to navigate ('prev' or 'next')
 */
function navigatePage(direction) {
    if (direction === 'prev' && DASHBOARD_CONFIG.currentPage > 1) {
        DASHBOARD_CONFIG.currentPage--;
    } else if (direction === 'next' && DASHBOARD_CONFIG.currentPage < DASHBOARD_CONFIG.totalPages) {
        DASHBOARD_CONFIG.currentPage++;
    } else {
        return; // Invalid navigation
    }
    
    // Update pagination controls
    updatePaginationControls();
    
    // Refresh the display based on current view mode
    if (DASHBOARD_CONFIG.currentView === 'grid') {
        displayPresetsGrid(getPaginatedPresets());
    } else {
        displayPresetsTable(getPaginatedPresets());
    }
}

/**
 * Toggles between table and grid view
 * @param {string} viewMode - The view mode to switch to ('table' or 'grid')
 */
function toggleView(viewMode) {
    if (viewMode !== 'table' && viewMode !== 'grid') {
        console.error('Invalid view mode:', viewMode);
        return;
    }
    
    // Update the current view mode
    DASHBOARD_CONFIG.currentView = viewMode;
    
    // Update UI buttons
    const tableBtn = document.getElementById('table-view-btn');
    const gridBtn = document.getElementById('grid-view-btn');
    
    if (tableBtn && gridBtn) {
        if (viewMode === 'table') {
            tableBtn.classList.add('active');
            gridBtn.classList.remove('active');
        } else {
            gridBtn.classList.add('active');
            tableBtn.classList.remove('active');
        }
    }
    
    // Show/hide the appropriate containers
    const tableContainer = document.getElementById('presets-table');
    const gridContainer = document.getElementById('grid-view');
    
    if (tableContainer && gridContainer) {
        if (viewMode === 'table') {
            tableContainer.style.display = 'table';
            gridContainer.style.display = 'none';
        } else {
            tableContainer.style.display = 'none';
            gridContainer.style.display = 'grid';
            
            // Recalculate grid items per page based on current browser size
            DASHBOARD_CONFIG.gridItemsPerPage = calculateGridItemsPerPage();
            
            // Recalculate total pages for grid view
            if (window.allPresets && window.allPresets.length > 0) {
                DASHBOARD_CONFIG.totalPages = Math.ceil(window.allPresets.length / DASHBOARD_CONFIG.gridItemsPerPage);
                
                // Ensure current page is valid
                if (DASHBOARD_CONFIG.currentPage > DASHBOARD_CONFIG.totalPages) {
                    DASHBOARD_CONFIG.currentPage = DASHBOARD_CONFIG.totalPages;
                }
            }
        }
        
        // Display content based on current view mode
        if (viewMode === 'table') {
            displayPresetsTable(getPaginatedPresets());
        } else {
            displayPresetsGrid(getPaginatedPresets());
        }
        
        // Update pagination controls for both views
        updatePaginationControls();
    }
}

/**
 * Displays presets in a grid layout
 * @param {Array} presets - Array of preset objects
 */
function displayPresetsGrid(presets) {
    const gridContainer = document.getElementById('grid-view');
    if (!gridContainer) {
        console.error('[Dashboard] Grid container not found');
        return;
    }
    
    // Clear container
    gridContainer.innerHTML = '';
    
    // Hide loading indicator
    const loadingPresets = document.getElementById('loading-presets');
    if (loadingPresets) {
        loadingPresets.style.display = 'none';
    }
    
    if (!presets || presets.length === 0) {
        // Show empty state
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
        return;
    }
    
    // Hide empty state
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    // Create grid items for each preset
    presets.forEach(preset => {
        // Map the 'id' property to 'preset_id' if needed
        if (preset.id && !preset.preset_id) {
            preset.preset_id = preset.id;
        }
        
        const presetId = preset.preset_id || preset.id || '';
        if (!presetId) {
            console.warn('Preset without ID, skipping:', preset);
            return;
        }
        
        // Create grid item
        const gridItem = document.createElement('div');
        gridItem.className = 'preset-grid-item';
        
        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'preset-grid-image';
        
        // Create image element
        const img = document.createElement('img');
        img.alt = preset.name || 'Preset';
        
        // Handle image URL with similar logic to table view
        const imageUrl = preset.image_url?.trim() || '';
        
        if (imageUrl) {
            if (imageUrl.startsWith('data:')) {
                // Handle base64 images
                if (imageUrl === 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7') {
                    useTextPlaceholder();
                } else {
                    img.src = imageUrl;
                    img.onload = function() {
                        if (this.naturalWidth <= 1 || this.naturalHeight <= 1) {
                            useTextPlaceholder();
                        }
                    };
                }
            } else {
                // Handle regular URLs
                const isSignedUrl = imageUrl.includes('token=');
                let cleanImageUrl = imageUrl;
                
                if (!isSignedUrl) {
                    if (cleanImageUrl.endsWith('?')) {
                        cleanImageUrl = cleanImageUrl.slice(0, -1);
                    }
                    
                    if (cleanImageUrl.includes('supabase') && cleanImageUrl.includes('?')) {
                        cleanImageUrl = cleanImageUrl.split('?')[0];
                    }
                }
                
                const userId = localStorage.getItem('userId') || (window.auth && window.auth.getUserId ? window.auth.getUserId() : 'anonymous');
                const proxyUrl = getApiUrl('/proxy/image') + 
                    '?url=' + encodeURIComponent(cleanImageUrl) + 
                    '&user_id=' + encodeURIComponent(userId);
                
                img.src = proxyUrl;
                
                // Store in cache for future use
                const cacheKey = `${userId}:${cleanImageUrl}`;
                dashboardImageCache.set(cacheKey, proxyUrl);
            }
            
            // Add error handling
            img.onerror = function() {
                this.style.display = 'none';
                useTextPlaceholder();
            };
        } else {
            useTextPlaceholder();
        }
        
        // Helper function for text placeholder
        function useTextPlaceholder() {
            img.style.display = 'none';
            
            const textPlaceholder = document.createElement('div');
            textPlaceholder.className = 'preset-text-placeholder';
            textPlaceholder.textContent = preset.name || 'Preset';
            textPlaceholder.style.width = '100%';
            textPlaceholder.style.height = '100%';
            textPlaceholder.style.display = 'flex';
            textPlaceholder.style.alignItems = 'center';
            textPlaceholder.style.justifyContent = 'center';
            
            imageContainer.appendChild(textPlaceholder);
        }
        
        // Add image to container
        imageContainer.appendChild(img);
        
        // Make image container clickable
        imageContainer.style.cursor = 'pointer';
        imageContainer.onclick = () => {
            if (presetId) {
                window.location.href = `preset-detail.html?id=${presetId}`;
            } else {
                console.error('Cannot navigate to preset detail: preset_id is undefined');
                window.utils.createNotification('Error: Cannot view preset details', 'error', 3000);
            }
        };
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'preset-grid-content';
        
        // Add preset title
        const title = document.createElement('div');
        title.className = 'preset-grid-title';
        title.textContent = preset.name || `Preset ${presetId}`;
        contentContainer.appendChild(title);
        
        // Add creation date
        const date = document.createElement('div');
        date.className = 'preset-grid-date';
        if (preset.created_at) {
            const createdDate = new Date(preset.created_at);
            date.textContent = createdDate.toLocaleString(undefined, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } else {
            date.textContent = 'Unknown date';
        }
        contentContainer.appendChild(date);
        
        // Add action buttons
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'preset-grid-actions';
        
        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'preset-grid-btn view';
        viewBtn.innerHTML = '<i class="fas fa-eye"></i> View';
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            if (presetId) {
                window.location.href = `preset-detail.html?id=${presetId}`;
            } else {
                console.error('Cannot navigate to preset detail: preset_id is undefined');
                window.utils.createNotification('Error: Cannot view preset details', 'error', 3000);
            }
        };
        actionsContainer.appendChild(viewBtn);
        
        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'preset-grid-btn download';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            if (presetId) {
                downloadPreset(presetId);
            } else {
                console.error('Cannot download preset: preset_id is undefined');
                alert('Error: Cannot download preset');
            }
        };
        actionsContainer.appendChild(downloadBtn);
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'preset-grid-btn delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (presetId) {
                if (confirm('Are you sure you want to delete this preset?')) {
                    deletePreset(presetId);
                }
            } else {
                console.error('Cannot delete preset: preset_id is undefined');
                window.utils.createNotification('Error: Cannot delete preset', 'error', 3000);
            }
        };
        actionsContainer.appendChild(deleteBtn);
        
        // Add actions to content container
        contentContainer.appendChild(actionsContainer);
        
        // Add containers to grid item
        gridItem.appendChild(imageContainer);
        gridItem.appendChild(contentContainer);
        
        // Add grid item to container
        gridContainer.appendChild(gridItem);
    });
}

async function deletePreset(presetId) {
    try {
        const response = await fetch(getApiUrl(`/api/presets/${presetId}`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken') || (window.auth && window.auth.getAuthToken ? window.auth.getAuthToken() : '')}`
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
    
    // Set up pagination event listeners
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => navigatePage('prev'));
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => navigatePage('next'));
    }
    
    // Add window resize event listener to adjust grid pagination
    window.addEventListener('resize', function() {
        if (DASHBOARD_CONFIG.currentView === 'grid' && window.allPresets && window.allPresets.length > 0) {
            // Recalculate grid items per page
            const oldGridItemsPerPage = DASHBOARD_CONFIG.gridItemsPerPage;
            DASHBOARD_CONFIG.gridItemsPerPage = calculateGridItemsPerPage();
            
            // Only update if the number of items per page has changed
            if (oldGridItemsPerPage !== DASHBOARD_CONFIG.gridItemsPerPage) {
                // Recalculate total pages
                DASHBOARD_CONFIG.totalPages = Math.ceil(window.allPresets.length / DASHBOARD_CONFIG.gridItemsPerPage);
                
                // Ensure current page is valid
                if (DASHBOARD_CONFIG.currentPage > DASHBOARD_CONFIG.totalPages) {
                    DASHBOARD_CONFIG.currentPage = DASHBOARD_CONFIG.totalPages;
                }
                
                // Update UI
                updatePaginationControls();
                displayPresetsGrid(getPaginatedPresets());
            }
        }
    });
    
    // Set up view toggle event listeners
    const tableViewBtn = document.getElementById('table-view-btn');
    const gridViewBtn = document.getElementById('grid-view-btn');
    
    if (tableViewBtn) {
        tableViewBtn.addEventListener('click', () => toggleView('table'));
    }
    
    if (gridViewBtn) {
        gridViewBtn.addEventListener('click', () => toggleView('grid'));
        // Set as active by default
        gridViewBtn.classList.add('active');
    }
    
    // Load user presets
    await loadUserPresets();

    // Dashboard should only focus on displaying and managing existing presets
    // Preset creation functionality has been moved to preset-create.js
});
