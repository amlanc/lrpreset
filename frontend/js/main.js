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
    
    // Initialize image upload after a short delay to ensure auth is initialized
    setTimeout(() => {
        if (typeof window.upload !== 'undefined' && window.upload.initializeImageUpload) {
            window.upload.initializeImageUpload();
        }
        
        // Check for last uploaded image
        if (typeof window.upload !== 'undefined' && window.upload.checkForLastUpload) {
            window.upload.checkForLastUpload();
        }
        
        // Initialize create preset button
        if (typeof window.preset !== 'undefined' && typeof window.preset.initializeCreatePresetButton === 'function') {
            window.preset.initializeCreatePresetButton();
        }
    }, 200);
    
    // Initialize dashboard if on dashboard page
    if (window.location.pathname.includes('dashboard')) {
        if (typeof window.preset !== 'undefined' && window.preset.loadUserPresets) {
            window.preset.loadUserPresets();
        }
    }
    
    // Initialize preset page if on preset page
    if (window.location.pathname.includes('preset.html')) {
        const presetId = window.utils.getUrlParameter('id');
        if (presetId) {
            loadPresetDetails(presetId);
        }
    }
    
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
 * Loads preset details for the preset page
 * @param {string} presetId - ID of the preset
 */
function loadPresetDetails(presetId) {
    // Check if user is authenticated
    if (!window.auth.isAuthenticated()) {
        alert('Please sign in to view preset details');
        window.location.href = 'index.html';
        return;
    }
    
    // Show loading state
    const presetContainer = document.getElementById('preset-details-container');
    if (presetContainer) {
        presetContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading preset details...</div>';
    }
    
    // Add auth token to headers
    const headers = {};
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Load preset details
    fetch(window.utils.getApiUrl(`/preset/${presetId}`), {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Preset details loaded:', data);
        
        // Display preset details
        displayPresetDetails(data.preset);
    })
    .catch(error => {
        console.error('Error loading preset details:', error);
        
        if (presetContainer) {
            presetContainer.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i> Error loading preset details: ${error.message}</div>`;
        }
    });
}

/**
 * Displays preset details
 * @param {Object} preset - Preset object
 */
function displayPresetDetails(preset) {
    const presetContainer = document.getElementById('preset-details-container');
    if (!presetContainer) {
        console.error("[Main] Preset details container not found");
        return;
    }
    
    // Clear container
    presetContainer.innerHTML = '';
    
    // Create preset details
    const presetDetails = document.createElement('div');
    presetDetails.className = 'preset-details';
    
    // Create preset image
    const presetImage = document.createElement('div');
    presetImage.className = 'preset-image';
    const img = document.createElement('img');
    img.src = preset.image_url;
    img.alt = preset.name || 'Preset';
    presetImage.appendChild(img);
    presetDetails.appendChild(presetImage);
    
    // Create preset info
    const presetInfo = document.createElement('div');
    presetInfo.className = 'preset-info';
    
    // Preset name
    const presetName = document.createElement('h2');
    presetName.textContent = preset.name || `Preset ${preset.id}`;
    presetInfo.appendChild(presetName);
    
    // Preset date
    const presetDate = document.createElement('p');
    presetDate.className = 'preset-date';
    presetDate.textContent = `Created on ${window.utils.formatDate(preset.created_at)}`;
    presetInfo.appendChild(presetDate);
    
    // Preset description
    if (preset.description) {
        const presetDescription = document.createElement('p');
        presetDescription.className = 'preset-description';
        presetDescription.textContent = preset.description;
        presetInfo.appendChild(presetDescription);
    }
    
    // Preset actions
    const presetActions = document.createElement('div');
    presetActions.className = 'preset-actions';
    
    // Download button
    const downloadButton = document.createElement('button');
    downloadButton.className = 'primary-button';
    downloadButton.innerHTML = '<i class="fas fa-download"></i> Download Preset';
    downloadButton.onclick = function() {
        window.preset.downloadPreset(preset.id);
    };
    presetActions.appendChild(downloadButton);
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'secondary-button';
    deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete Preset';
    deleteButton.onclick = function() {
        if (confirm('Are you sure you want to delete this preset?')) {
            window.preset.deletePreset(preset.id);
            window.location.href = 'dashboard.html';
        }
    };
    presetActions.appendChild(deleteButton);
    
    presetInfo.appendChild(presetActions);
    presetDetails.appendChild(presetInfo);
    
    // Add preset details to container
    presetContainer.appendChild(presetDetails);
    
    // Add preset adjustments
    if (preset.preset_data) {
        const presetAdjustments = document.createElement('div');
        presetAdjustments.className = 'preset-adjustments';
        
        // Create tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'preset-tabs';
        
        const tabs = ['Basic', 'Color', 'Detail', 'Effects'];
        tabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'preset-tab';
            tabElement.dataset.tab = tab.toLowerCase();
            tabElement.textContent = tab;
            tabsContainer.appendChild(tabElement);
        });
        
        presetAdjustments.appendChild(tabsContainer);
        
        // Create tab contents
        const tabContentsContainer = document.createElement('div');
        tabContentsContainer.className = 'preset-tab-contents';
        
        tabs.forEach(tab => {
            const tabContent = document.createElement('div');
            tabContent.className = 'preset-tab-content';
            tabContent.id = `${tab.toLowerCase()}-tab`;
            
            // Create table
            const table = document.createElement('table');
            table.id = `${tab.toLowerCase()}-adjustments`;
            tabContent.appendChild(table);
            
            tabContentsContainer.appendChild(tabContent);
        });
        
        presetAdjustments.appendChild(tabContentsContainer);
        presetContainer.appendChild(presetAdjustments);
        
        // Populate tabs
        window.preset.populateAdjustmentTabs(preset.preset_data, preset.id);
        window.preset.setupTabSwitching();
        
        // Activate first tab
        const firstTab = document.querySelector('.preset-tab');
        if (firstTab) {
            firstTab.click();
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
