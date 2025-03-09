/**
 * Payments Module
 * Handles preset checkout and downloads
 */

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
    
    // Construct URL with session ID if provided
    let url = window.utils.getApiUrl(`/preset/${presetId}/download`);
    if (sessionId) {
        url += `?session_id=${sessionId}`;
    }
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Start the download
    fetch(url, {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
    })
    .then(blob => {
        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);
        
        // Set up the download
        link.href = url;
        link.download = `preset_${presetId}.xmp`;
        
        // Trigger the download
        link.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    })
    .catch(error => {
        console.error('Error downloading preset:', error);
        alert('Error downloading preset: ' + error.message);
    });
}

// Export functions to the global namespace
window.payments = {
    initiateCheckout,
    downloadPreset
};
