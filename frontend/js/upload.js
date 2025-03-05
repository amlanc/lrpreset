// Function to handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, or WebP).');
        return;
    }
    
    // Check file size (max 164MB)
    const maxSize = 164 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File size exceeds 164MB. Please select a smaller image.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImage = document.getElementById('previewImage');
        const previewContainer = document.querySelector('.preview-image-container');
        const previewPlaceholder = document.querySelector('.preview-placeholder');
        const previewDetails = document.querySelector('.preview-details');
        
        if (!previewImage || !previewContainer || !previewPlaceholder) {
            console.error("[Upload] Preview elements not found");
            return;
        }
        
        previewImage.src = e.target.result;
        previewContainer.style.display = 'block';
        previewPlaceholder.style.display = 'none';
        
        if (previewDetails) {
            const fileNameDisplay = document.getElementById('fileNameDisplay');
            const fileSizeDisplay = document.getElementById('fileSizeDisplay');
            if (fileNameDisplay && fileSizeDisplay) {
                fileNameDisplay.textContent = file.name;
                fileSizeDisplay.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
                previewDetails.style.display = 'block';
            }
        }
    };
    reader.readAsDataURL(file);
}

/**
 * Checks if the auth module is ready
 * @returns {boolean} True if auth module is ready
 */
function isAuthModuleReady() {
    return typeof window.auth !== 'undefined' && 
           typeof window.auth.isAuthenticated === 'function';
}

/**
 * Updates UI based on authentication status
 */
function updateUploadUI() {
    const uploadBtn = document.querySelector('.upload-button');
    const imageUpload = document.getElementById('imageUpload');
    
    // Ensure auth module is loaded
    if (typeof window.auth === 'undefined' || typeof window.auth.isAuthenticated !== 'function') {
        console.error('Auth module not loaded properly');
        return;
    }
    
    const isAuth = window.auth.isAuthenticated();
    console.log('Updating upload UI based on auth status:', isAuth);
    
    if (!isAuth) {
        // Disable upload button
        if (uploadBtn) {
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.cursor = 'not-allowed';
            uploadBtn.title = 'Please sign in to upload images';
        }
        
        // Disable file input
        if (imageUpload) {
            imageUpload.disabled = true;
        }
    } else {
        // Enable upload button
        if (uploadBtn) {
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
            uploadBtn.title = 'Upload Image';
        }
        
        // Enable file input
        if (imageUpload) {
            imageUpload.disabled = false;
        }
    }
}

/**
 * Initializes image upload functionality
 */
function initializeImageUpload() {
    // Get elements
    const uploadBtn = document.querySelector('.upload-button');
    const imageUpload = document.getElementById('imageUpload');
    const createPresetBtn = document.getElementById('createPresetBtn');
    
    console.log('Initializing image upload...');
    
    // Check if auth module is ready
    if (!isAuthModuleReady()) {
        console.log('Auth module not ready, waiting...');
        setTimeout(initializeImageUpload, 100);
        return;
    }
    
    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        if (imageUpload) {
            imageUpload.addEventListener('change', handleFileSelect);
        }
        
        updateUploadUI();
    });
}

/**
 * Gets the currently selected file
 * @returns {File|null} The selected file or null if no file is selected
 */
function getSelectedFile() {
    const imageUpload = document.getElementById('imageUpload');
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) {
        console.error('No file selected');
        return null;
    }
    return imageUpload.files[0];
}

// Export functions to window namespace
window.upload = {
    handleFileSelect,
    updateUploadUI,
    initializeImageUpload,
    getSelectedFile
};

initializeImageUpload();
