/**
 * Authentication and upload protection functions
 */

// Check if user is authenticated
function isAuthenticated() {
    const token = localStorage.getItem('authToken');
    return !!token;
}

// Update UI based on authentication status
function updateUploadUI() {
    const uploadBtn = document.querySelector('.upload-button');
    const createPresetBtn = document.getElementById('createPresetBtn');
    
    if (!uploadBtn) return;
    
    if (!isAuthenticated()) {
        // Disable upload button
        uploadBtn.style.opacity = '0.5';
        uploadBtn.style.cursor = 'not-allowed';
        uploadBtn.title = 'Please sign in to upload images';
        
        // Disable file input
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.disabled = true;
        }
        
        // Disable create preset button if it exists
        if (createPresetBtn) {
            createPresetBtn.style.opacity = '0.5';
            createPresetBtn.style.cursor = 'not-allowed';
            createPresetBtn.title = 'Please sign in to create presets';
        }
    } else {
        // Enable upload button
        uploadBtn.style.opacity = '1';
        uploadBtn.style.cursor = 'pointer';
        uploadBtn.title = 'Upload Image';
        
        // Enable file input
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.disabled = false;
        }
        
        // Enable create preset button if it exists
        if (createPresetBtn) {
            createPresetBtn.style.opacity = '1';
            createPresetBtn.style.cursor = 'pointer';
            createPresetBtn.title = 'Create Preset';
        }
    }
}

// Secure the upload button click
function secureUploadButton() {
    const uploadBtn = document.querySelector('.upload-button');
    const imageUpload = document.getElementById('imageUpload');
    
    if (uploadBtn && imageUpload) {
        // Remove any existing click listeners (to avoid duplicates)
        const newUploadBtn = uploadBtn.cloneNode(true);
        uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
        
        // Add secure click handler
        newUploadBtn.addEventListener('click', function(e) {
            if (!isAuthenticated()) {
                e.preventDefault();
                alert('Please sign in to upload images');
                return;
            }
            imageUpload.click();
        });
    }
}

// Secure the file input change event
function secureFileInput() {
    const imageUpload = document.getElementById('imageUpload');
    
    if (imageUpload) {
        // Remove any existing change listeners (to avoid duplicates)
        const newImageUpload = imageUpload.cloneNode(true);
        imageUpload.parentNode.replaceChild(newImageUpload, imageUpload);
        
        // Add secure change handler
        newImageUpload.addEventListener('change', function(event) {
            if (!isAuthenticated()) {
                event.preventDefault();
                alert('Please sign in to upload images');
                return;
            }
            // Call the original handler if it exists
            if (typeof handleFileSelect === 'function') {
                handleFileSelect(event);
            }
        });
    }
}

// Secure the create preset button
function secureCreatePresetButton() {
    const createPresetBtn = document.getElementById('createPresetBtn');
    
    if (createPresetBtn) {
        // Remove any existing click listeners (to avoid duplicates)
        const newCreatePresetBtn = createPresetBtn.cloneNode(true);
        createPresetBtn.parentNode.replaceChild(newCreatePresetBtn, createPresetBtn);
        
        // Add secure click handler
        newCreatePresetBtn.addEventListener('click', function(e) {
            if (!isAuthenticated()) {
                e.preventDefault();
                alert('Please sign in to create presets');
                return;
            }
            // Call the original handler if it exists
            if (typeof handleCreatePresetClick === 'function') {
                handleCreatePresetClick();
            }
        });
    }
}

// Initialize all secure elements
function initializeSecureUploads() {
    // Initial UI update
    updateUploadUI();
    
    // Secure all upload-related elements
    secureUploadButton();
    secureFileInput();
    secureCreatePresetButton();
    
    // Listen for auth state changes
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken') {
            updateUploadUI();
            
            // Re-secure all elements when auth state changes
            secureUploadButton();
            secureFileInput();
            secureCreatePresetButton();
        }
    });
}

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSecureUploads();
});
