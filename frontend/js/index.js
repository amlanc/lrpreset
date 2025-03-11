/**
 * Index Page Module
 * Handles landing page functionality
 */

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
 * Initializes the landing page
 */
function initializeLandingPage() {
    console.log('Initializing landing page...');
    
    // Initialize the create preset button
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
            
            // Call the handleCreatePresetClick function from preset-create.js
            if (window.presetCreate && window.presetCreate.handleCreatePresetClick) {
                window.presetCreate.handleCreatePresetClick();
            } else {
                console.log('Preset create functions not available, using direct implementation');
                
                // Direct implementation of create preset functionality
                const file = imageUpload.files[0];
                if (file) {
                    // Create a FormData object to send the file
                    const formData = new FormData();
                    formData.append('image', file);
                    
                    // Show loading state
                    const createPresetBtn = document.getElementById('createPresetBtn');
                    if (createPresetBtn) {
                        createPresetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                        createPresetBtn.disabled = true;
                    }
                    
                    // Make the API request
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
                        console.log('Preset created successfully:', data);
                        
                        // Reset button state
                        if (createPresetBtn) {
                            createPresetBtn.innerHTML = '<i class="fas fa-plus"></i> Create Preset';
                            createPresetBtn.disabled = false;
                        }
                        
                        // Store preset ID for reference
                        console.log('Preset created with ID:', data.preset_id);
                    })
                    .catch(error => {
                        console.error('Error creating preset:', error);
                        alert('Error creating preset: ' + error.message);
                        
                        // Reset button state
                        if (createPresetBtn) {
                            createPresetBtn.innerHTML = '<i class="fas fa-plus"></i> Create Preset';
                            createPresetBtn.disabled = false;
                        }
                    });
                }
            }
        });
    }
}

// Initialize the landing page when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the landing page
    const isLandingPage = document.getElementById('hero') !== null;
    
    if (isLandingPage) {
        initializeLandingPage();
    }
});

// Export functions to the global namespace
window.index = {
    switchPresetTab
};
