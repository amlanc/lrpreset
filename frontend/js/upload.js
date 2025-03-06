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
        const previewDetails = document.getElementById('previewDetails'); // Using ID instead of class
        const uploadPreview = document.getElementById('uploadPreview');
        
        if (!previewImage || !previewContainer || !previewPlaceholder || !previewDetails) {
            console.error("[Upload] Preview elements not found");
            return;
        }
        
        console.log('[Upload] Found all preview elements');
        
        // Create a temporary image to get dimensions
        const img = new Image();
        img.onload = function() {
            // Show the preview container and hide placeholder
            previewContainer.classList.add('visible');
            previewPlaceholder.style.display = 'none';
            
            // Keep the border but change its color to match the background
            if (uploadPreview) {
                uploadPreview.style.borderColor = 'transparent';
            }
            
            // Update and show details
            const fileNameDisplay = document.getElementById('fileNameDisplay');
            const fileSizeDisplay = document.getElementById('fileSizeDisplay');
            if (fileNameDisplay && fileSizeDisplay) {
                // Update the text content
                fileNameDisplay.textContent = file.name;
                fileSizeDisplay.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
                
                // Simple approach - directly set styles for better reliability
                previewDetails.style.display = 'flex';
                previewDetails.style.justifyContent = 'space-between';
                previewDetails.style.alignItems = 'center';
                previewDetails.style.margin = '10px auto';
                previewDetails.style.background = 'rgba(0, 0, 0, 0.7)';
                previewDetails.style.color = 'white';
                previewDetails.style.padding = '8px 12px';
                previewDetails.style.borderRadius = '6px';
                previewDetails.style.zIndex = '10';
                
                // Also add the class for any CSS transitions
                previewDetails.classList.add('visible');
                
                console.log('[Upload] Details section shown with direct styles');
                
                // Position the details section to match the image width
                const updateDetailsWidth = () => {
                    // Get the image width
                    const imgWidth = previewImage.offsetWidth;
                    console.log('[Upload] Image width for details:', imgWidth);
                    
                    if (imgWidth > 0) {
                        // Set the width to match the image
                        previewDetails.style.width = imgWidth + 'px';
                        previewDetails.style.maxWidth = '100%';
                    }
                };
                
                // Initial positioning with a small delay to ensure image is rendered
                setTimeout(updateDetailsWidth, 100);
                
                // Also update on window resize to maintain correct positioning
                window.addEventListener('resize', updateDetailsWidth);
                
                // Store the function reference to remove it when a new image is selected
                previewImage.dataset.resizeHandler = true;
            }
            
            // Add debug logging
            console.log('[Upload] Preview loaded');
            console.log('[Upload] Image dimensions:', img.width, 'x', img.height);
            console.log('[Upload] File:', {
                name: file.name,
                type: file.type,
                size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
            });
        };
        
        // Set image sources
        img.src = e.target.result;
        previewImage.src = e.target.result;
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
    console.log('[Upload] Returning selected file:', imageUpload.files[0].name);
    return imageUpload.files[0];
}

// Expose functions to the window object
window.upload = {
    getSelectedFile,
    handleFileSelect,
    updateUploadUI,
    initializeImageUpload
};

// Initialize the upload module
initializeImageUpload();
