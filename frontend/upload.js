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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', handleFileSelect);
    }
});
