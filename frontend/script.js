let googleUser = null;

function updateUI(isSignedIn, profile) {
    console.log("[UI] Updating UI state:", { isSignedIn, profile: profile || 'none' });
    
    const authSection = document.getElementById('auth-section');
    if (!authSection) {
        console.error("[UI] Auth section not found in DOM");
        return;
    }
    
    // Clear the auth section
    authSection.innerHTML = '';
    
    if (isSignedIn && profile) {
        console.log("[UI] User is signed in, updating UI with profile");
        
        // Create user info container
        const userInfo = document.createElement('div');
        userInfo.id = 'user-info';
        userInfo.className = 'user-info';
        
        // Add user avatar if available
        if (profile.picture) {
            const avatar = document.createElement('img');
            avatar.src = profile.picture;
            avatar.alt = profile.name || 'User';
            avatar.className = 'user-avatar';
            userInfo.appendChild(avatar);
        }
        
        // Add user name
        const userName = document.createElement('span');
        userName.textContent = profile.name || profile.email || 'User';
        userName.className = 'user-name';
        userInfo.appendChild(userName);
        
        // Add dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        
        const dropdownButton = document.createElement('button');
        dropdownButton.className = 'dropdown-button';
        dropdownButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
        
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'dropdown-content';
        
        // Add dropdown items
        const profileLink = document.createElement('a');
        profileLink.href = '#';
        profileLink.textContent = 'Profile';
        dropdownContent.appendChild(profileLink);
        
        const dashboardLink = document.createElement('a');
        dashboardLink.href = 'dashboard.html';
        dashboardLink.textContent = 'Dashboard';
        dropdownContent.appendChild(dashboardLink);
        
        const signOutLink = document.createElement('a');
        signOutLink.href = '#';
        signOutLink.textContent = 'Sign Out';
        signOutLink.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
        dropdownContent.appendChild(signOutLink);
        
        dropdown.appendChild(dropdownButton);
        dropdown.appendChild(dropdownContent);
        userInfo.appendChild(dropdown);
        
        // Add user info to auth section
        authSection.appendChild(userInfo);
        
        // Set up dropdown toggle
        dropdownButton.addEventListener('click', function() {
            dropdownContent.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        window.addEventListener('click', function(event) {
            if (!event.target.matches('.dropdown-button') && !event.target.matches('.dropdown-button *')) {
                if (dropdownContent.classList.contains('show')) {
                    dropdownContent.classList.remove('show');
                }
            }
        });
    } else {
        console.log("[UI] User is not signed in, showing sign-in button");
        createSignInButton();
    }
}

function createSignInButton() {
    console.log("[Auth] Creating sign-in button");
    
    const authSection = document.getElementById('auth-section');
    if (!authSection) {
        console.error("[Auth] Auth section not found in DOM");
        return;
    }
    
    // Clear any existing buttons first
    const existingButton = document.getElementById('g-signin-button');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Create a custom Google Sign-In button
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'g-signin-button';
    
    const customButton = document.createElement('button');
    customButton.className = 'google-signin-button';
    
    // Create Google logo
    const googleLogo = document.createElement('img');
    googleLogo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMTcuNiA5LjJsLS4xLTEuOEg5djMuNGg0LjhDMTMuNiAxMiAxMyAxMyAxMiAxMy42djIuMmgzYTguOCA4LjggMCAwIDAgMi42LTYuNnoiIGZpbGw9IiM0Mjg1RjQiIGZpbGwtcnVsZT0ibm9uemVybyIvPjxwYXRoIGQ9Ik05IDE4YzIuNCAwIDQuNS0uOCA2LTIuMmwtMy0yLjJhNS40IDUuNCAwIDAgMS04LTIuOUgxVjEzYTkgOSAwIDAgMCA4IDV6IiBmaWxsPSIjMzRBODUzIiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNNCAxMC43YTUuNCA1LjQgMCAwIDEgMC0zLjRWNUgxYTkgOSAwIDAgMCAwIDhsMy0yLjN6IiBmaWxsPSIjRkJCQzA1IiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNOSAzLjZjMS4zIDAgMi41LjQgMy40IDEuM0wxNSAyLjNBOSA5IDAgMCAwIDEgNWwzIDIuNGE1LjQgNS40IDAgMCAxIDUtMy43eiIgZmlsbD0iI0VBNDMzNSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTAgMGgxOHYxOEgweiIvPjwvZz48L3N2Zz4=';
    googleLogo.alt = 'Google logo';
    googleLogo.className = 'google-logo';
    
    // Create text span
    const buttonText = document.createElement('span');
    buttonText.textContent = 'Sign in with Google';
    
    customButton.appendChild(googleLogo);
    customButton.appendChild(buttonText);
    customButton.addEventListener('click', initiateGoogleSignIn);
    
    buttonContainer.appendChild(customButton);
    authSection.appendChild(buttonContainer);
}

// Add this function to get configuration
async function getConfig() {
    try {
        const response = await fetch('http://localhost:8000/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('[Config] Error fetching config:', error);
        return null;
    }
}

// Update initiateGoogleSignIn to use the config
async function initiateGoogleSignIn() {
    console.log("[Auth] Initiating Google Sign-In flow");
    
    const config = await getConfig();
    if (!config || !config.googleClientId) {
        console.error("[Auth] Missing Google Client ID");
        return;
    }
    
    // Show loading state
    const customButton = document.querySelector('.google-signin-button');
    if (customButton) {
        customButton.textContent = 'Signing in...';
        customButton.disabled = true;
        customButton.style.opacity = '0.7';
    }
    
    const clientId = config.googleClientId;
    const redirectUri = encodeURIComponent('http://localhost:8001/');
    // Update scope to match exactly what Google expects
    const scope = encodeURIComponent('https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid');
    const responseType = 'token id_token';
    const state = encodeURIComponent(Math.random().toString(36).substring(2));
    const nonce = encodeURIComponent(Math.random().toString(36).substring(2));
    
    localStorage.setItem('oauthState', state);
    localStorage.setItem('oauthNonce', nonce);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}&state=${state}&nonce=${nonce}`;
    
    window.location.href = authUrl;
}

// Callback function for Google Sign-In
function handleGoogleSignIn(response) {
    console.log("[Auth] Handling Google Sign-In response");
    
    if (response.credential) {
        // Decode the credential
        const decodedToken = jwt_decode(response.credential);
        
        // Store the token
        localStorage.setItem('googleToken', response.credential);
        
        // Update UI with user info
        updateUI(true, {
            name: decodedToken.name,
            email: decodedToken.email,
            picture: decodedToken.picture,
            sub: decodedToken.sub
        });
        
        console.log("[Auth] Sign-in successful");
    } else {
        console.error("[Auth] No credential received");
        updateUI(false);
    }
}

// Update sign out to use Google's sign-out
function signOut() {
    console.log("[Auth] User signing out");
    
    google.accounts.id.disableAutoSelect();
    
    // Clear tokens from localStorage
    localStorage.removeItem('googleToken');
    
    // Update UI
    updateUI(false);
    
    // Redirect to home page if not already there
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.location.href = '/';
    }
}

// Initialize Google Sign-In on page load
function startGoogleAuth() {
    console.log("[Auth] Starting Google Auth");
    
    // Initialize Google Identity Services
    google.accounts.id.initialize({
        client_id: '705829908462-kem339aaui68vt1t4jo2ee10ph13lai3.apps.googleusercontent.com',
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    
    // Check if user is already authenticated
    const storedToken = localStorage.getItem('googleToken');
    if (storedToken) {
        try {
            const decodedToken = jwt_decode(storedToken);
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (decodedToken.exp && decodedToken.exp > currentTime) {
                console.log("[Auth] User already authenticated with valid token");
                updateUI(true, decodedToken);
                return;
            } else {
                console.log("[Auth] Token expired, removing from storage");
                localStorage.removeItem('googleToken');
            }
        } catch (error) {
            console.error("[Auth] Error with stored token:", error);
            localStorage.removeItem('googleToken');
        }
    }
    
    // If we get here, user is not authenticated, show sign-in button
    createSignInButton();
}

// Document ready function to initialize all event handlers
document.addEventListener('DOMContentLoaded', function() {
    console.log("[App] Document loaded, initializing app...");
    
    // Initialize image upload functionality
    initializeImageUpload();
    
    // Initialize Google Auth
    startGoogleAuth();
    
    // Check if we're on the dashboard page
    if (document.getElementById('presets-table-body')) {
        loadUserPresets();
    }
    
    // Check if we're on the preset detail page
    if (document.getElementById('preset-content')) {
        loadPresetDetails();
    }
    
    // Debug elements
    debugElements();
    
    // Check for authentication from URL parameters (after Google redirect)
    checkUrlForAuthResponse();
});

// Function to check URL for authentication response
function checkUrlForAuthResponse() {
    console.log("[Auth] Checking URL for auth response");
    
    // Check if we have a hash fragment in the URL (from Google redirect)
    if (window.location.hash) {
        console.log("[Auth] Found hash fragment in URL");
        
        // Parse the hash fragment
        const params = new URLSearchParams(window.location.hash.substring(1));
        
        // Check if we have an ID token
        if (params.has('id_token')) {
            console.log("[Auth] Found ID token in URL");
            
            const idToken = params.get('id_token');
            const accessToken = params.get('access_token');
            
            // Verify the token
            try {
                const decodedToken = jwt_decode(idToken);
                console.log("[Auth] Decoded token:", decodedToken);
                
                // Store the tokens
                localStorage.setItem('googleToken', idToken);
                localStorage.setItem('googleAccessToken', accessToken);
                
                // Update the UI
                updateUI(true, decodedToken);
                
                // Clean up the URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (error) {
                console.error("[Auth] Error decoding token:", error);
            }
        }
    }
}

// Function to initialize image upload functionality
function initializeImageUpload() {
    console.log("[Upload] Initializing image upload...");
    
    // Set up file input change event
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        console.log("[Upload] Found image upload input, setting up event listener");
        
        imageUpload.addEventListener('change', function(event) {
            console.log("[Upload] File input change detected");
            handleFileSelect(event);
        });
    } else {
        console.warn("[Upload] Image upload input not found");
    }
    
    // Set up create preset button click event
    const createPresetBtn = document.getElementById('createPresetBtn');
    if (createPresetBtn) {
        console.log("[Upload] Found create preset button, setting up event listener");
        
        createPresetBtn.addEventListener('click', handleCreatePresetClick);
    } else {
        console.warn("[Upload] Create preset button not found");
    }
}

// Function to handle file selection
function handleFileSelect(event) {
    console.log("[Upload] File input change detected");
    
    const file = event.target.files[0];
    if (!file) {
        console.warn("[Upload] No file selected");
        return;
    }
    
    console.log("[Upload] Processing file:", {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`
    });
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, or WebP).');
        return;
    }
    
    // Check file size (max 164MB)
    const maxSize = 164 * 1024 * 1024; // 164MB in bytes
    if (file.size > maxSize) {
        alert('File size exceeds 164MB. Please select a smaller image.');
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log("[Upload] File read complete, showing preview");
        
        // Get elements
        const previewImage = document.getElementById('previewImage');
        const previewContainer = document.querySelector('.preview-image-container');
        const previewPlaceholder = document.querySelector('.preview-placeholder');
        
        // Check if elements exist
        if (!previewImage || !previewContainer || !previewPlaceholder) {
            console.error("[Upload] Preview elements not found");
            return;
        }
        
        // Set image source
        previewImage.src = e.target.result;
        
        // Show image container and hide placeholder
        previewContainer.style.display = 'block';
        previewPlaceholder.style.display = 'none';
        
        // We're not showing the details anymore
    };
    
    reader.readAsDataURL(file);
}

// Function to handle the Create Preset button click
function handleCreatePresetClick() {
    console.log("[Upload] Create Preset button clicked");
    
    // Check if an image is selected
    const previewImage = document.getElementById('previewImage');
    const previewContainer = document.querySelector('.preview-image-container');
    
    // Check if the image is displayed (meaning an image is selected)
    if (previewImage && previewImage.src && previewContainer.style.display !== 'none') {
        console.log("[Upload] Image is selected, proceeding with preset creation");
        uploadImage(); // Call the existing uploadImage function with no parameters
    } else {
        console.log("[Upload] No image selected, showing alert");
        alert("Please select an image first.");
    }
}

// Function to upload image
function uploadImage() {
    console.log("[Upload] Starting image upload process");
    
    const fileInput = document.getElementById('imageUpload');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        console.error("[Upload] No file selected for upload");
        alert('Please select an image first.');
        return;
    }
    
    const file = fileInput.files[0];
    console.log("[Upload] Sending request to backend:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        userId: userId
    });
    
    // Show upload status
    const uploadStatus = document.getElementById('upload-status');
    const uploadProgress = document.getElementById('uploadProgress');
    const statusText = document.getElementById('statusText');
    
    if (uploadStatus) {
        uploadStatus.style.display = 'block';
    }
    
    if (uploadProgress) {
        uploadProgress.style.width = '0%';
    }
    
    if (statusText) {
        statusText.textContent = 'Uploading your image...';
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('image', file);
    
    // Get user ID (use anonymous if not logged in)
    const token = localStorage.getItem('googleToken');
    let userId = 'anonymous';
    
    if (token) {
        try {
            const decoded = jwt_decode(token);
            userId = decoded.sub;
            formData.append('user_id', userId);
        } catch (e) {
            console.error("[Auth] Error decoding token:", e);
        }
    }
    
    // Update progress to show upload started
    updateUploadProgress(20, 'Uploading image...');
    
    // Send to backend
    fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update progress to show upload complete and AI processing started
        updateUploadProgress(40, 'Image uploaded! AI is analyzing your photo...');
        
        // Start progress animation for AI processing
        startAIProgressAnimation();
        
        return response.json();
    })
    .then(data => {
        console.log("Upload successful:", data);
        
        // Update progress to show AI processing complete
        updateUploadProgress(100, 'AI preset generated successfully!');
        
        // Hide the upload status after a short delay
        setTimeout(() => {
            if (uploadStatus) {
                uploadStatus.style.display = 'none';
            }
            
            // Show the preset preview
            showPresetPreview(data.preset_id, data.image_url, data.preset_data);
            
            // Save the last uploaded image
            saveLastUploadedImage(data.image_url, data.preset_id, data.preset_data);
        }, 1000);
    })
    .catch(error => {
        console.error("[Upload] Error uploading image:", error);
        
        if (statusText) {
            statusText.textContent = `Error: ${error.message}`;
            statusText.style.color = 'red';
        }
        
        if (uploadProgress) {
            uploadProgress.style.width = '0%';
            uploadProgress.style.backgroundColor = 'red';
        }
        
        // Hide the upload status after a delay
        setTimeout(() => {
            if (uploadStatus) {
                uploadStatus.style.display = 'none';
            }
        }, 3000);
    });
}

// Function to update upload progress
function updateUploadProgress(percentage, message) {
    const uploadProgress = document.getElementById('uploadProgress');
    const statusText = document.getElementById('statusText');
    
    if (uploadProgress) {
        uploadProgress.style.width = `${percentage}%`;
    }
    
    if (statusText && message) {
        statusText.textContent = message;
    }
}

// Function to simulate AI progress animation
function startAIProgressAnimation() {
    const uploadProgress = document.getElementById('uploadProgress');
    const statusText = document.getElementById('statusText');
    
    if (!uploadProgress) return;
    
    // Start from 40% (after upload complete)
    let progress = 40;
    
    // AI processing messages to cycle through
    const aiMessages = [
        "AI is analyzing lighting conditions...",
        "AI is evaluating color balance...",
        "AI is examining composition...",
        "AI is determining optimal adjustments...",
        "AI is generating preset parameters...",
        "AI is finalizing your custom preset..."
    ];
    
    let messageIndex = 0;
    
    // Update message every 2 seconds
    const messageInterval = setInterval(() => {
        if (statusText) {
            statusText.textContent = aiMessages[messageIndex];
            messageIndex = (messageIndex + 1) % aiMessages.length;
        }
    }, 2000);
    
    // Gradually increase progress from 40% to 90% (the last 10% will be when we get the response)
    const progressInterval = setInterval(() => {
        // Increase progress by a random amount between 1-3%
        progress += Math.random() * 2 + 1;
        
        // Cap at 90% until we get the actual response
        if (progress >= 90) {
            progress = 90;
            clearInterval(progressInterval);
            clearInterval(messageInterval);
            
            if (statusText) {
                statusText.textContent = "Almost done! Finalizing your preset...";
            }
        }
        
        if (uploadProgress) {
            uploadProgress.style.width = `${progress}%`;
        }
    }, 500);
    
    // Store the intervals in global variables so we can clear them if needed
    window.aiProgressIntervals = {
        message: messageInterval,
        progress: progressInterval
    };
}

// Function to stop AI progress animation (call this if there's an error or when complete)
function stopAIProgressAnimation() {
    if (window.aiProgressIntervals) {
        clearInterval(window.aiProgressIntervals.message);
        clearInterval(window.aiProgressIntervals.progress);
    }
}

// Function to show preset preview
function showPresetPreview(presetId, imageUrl, presetData) {
    console.log("Showing preset preview for preset ID:", presetId);
    console.log("Image URL:", imageUrl);
    console.log("Preset data:", presetData);
    
    // Get the preset preview section
    const presetPreview = document.getElementById('preset-preview');
    if (!presetPreview) {
        console.error("Preset preview section not found");
        return;
    }
    
    // Show the preset preview section
    presetPreview.style.display = 'block';
    
    // Scroll to the preset preview section
    presetPreview.scrollIntoView({ behavior: 'smooth' });
    
    // Set the preview image
    const previewImage = document.getElementById('preset-preview-image');
    if (previewImage) {
        previewImage.src = imageUrl;
        console.log("Set preview image src to:", imageUrl);
    } else {
        console.error("Preview image element not found");
    }
    
    // Check if presetData is valid
    if (!presetData) {
        console.log("No preset data provided, using 'preview' field instead");
        // Try to get preset data from the 'preview' field (which is what the backend returns)
        const uploadResponse = document.getElementById('upload-response');
        if (uploadResponse && uploadResponse.dataset.response) {
            try {
                const responseData = JSON.parse(uploadResponse.dataset.response);
                if (responseData.preview) {
                    presetData = responseData.preview;
                    console.log("Found preset data in 'preview' field:", presetData);
                }
            } catch (e) {
                console.error("Error parsing response data:", e);
            }
        }
        
        // If still no preset data, fetch it from the server
        if (!presetData) {
            console.log("Fetching preset data from server");
            fetch(`http://localhost:8000/preset/${presetId}/preview`)
                .then(response => response.json())
                .then(data => {
                    console.log("Fetched preset data:", data);
                    populateAdjustmentTabs(data, presetId);
                })
                .catch(error => {
                    console.error("Error fetching preset data:", error);
                });
            return;
        }
    }
    
    // Log the structure of presetData
    console.log("Preset data structure:", Object.keys(presetData));
    
    // Populate the adjustment tabs
    populateAdjustmentTabs(presetData, presetId);
}

// Function to populate all adjustment tabs
function populateAdjustmentTabs(presetData, presetId) {
    // Check if we have the expected structure or need to adapt
    let formattedData = presetData;
    
    // If the data is in the 'preview' format
    if (presetData.basic && !presetData.color && !presetData.detail && !presetData.effects) {
        formattedData = {
            basic: presetData.basic || {},
            color: presetData.color || {},
            detail: presetData.detail || {},
            effects: presetData.effects || {}
        };
    }
    
    // Populate each tab
    populateAdjustmentTab('basic-adjustments', formattedData.basic || {});
    populateAdjustmentTab('color-adjustments', formattedData.color || {});
    populateAdjustmentTab('detail-adjustments', formattedData.detail || {});
    populateAdjustmentTab('effects-adjustments', formattedData.effects || {});
    
    // Set up tab switching
    setupTabSwitching();
    
    // Set up download button with the correct presetId
    const downloadButton = document.getElementById('download-button');
    if (downloadButton && presetId) {
        // Store the presetId as a data attribute on the button
        downloadButton.setAttribute('data-preset-id', presetId);
        
        // Set up the click handler
        downloadButton.onclick = function() {
            // Get the presetId from the data attribute
            const id = this.getAttribute('data-preset-id');
            if (id) {
                downloadPreset(id);
            } else {
                console.error("No preset ID found for download");
                alert("Error: No preset ID found for download");
            }
        };
    } else if (downloadButton) {
        console.warn("No preset ID provided for download button");
        downloadButton.onclick = function() {
            alert("Error: No preset ID available for download");
        };
    }
}

// Function to set up tab switching
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.preset-tab');
    const tabContents = document.querySelectorAll('.preset-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Show the corresponding tab content
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Function to populate an adjustment tab
function populateAdjustmentTab(tabId, adjustments) {
    const container = document.getElementById(tabId);
    if (!container) {
        console.error(`Adjustment container ${tabId} not found`);
        return;
    }
    
    console.log(`Populating ${tabId} with:`, adjustments);
    
    // Clear existing content
    container.innerHTML = '';
    
    // Check if there are any adjustments
    if (Object.keys(adjustments).length === 0) {
        container.innerHTML = '<tr><td><div class="adjustment-item"><span class="label">No adjustments</span></div></td></tr>';
        return;
    }
    
    // Add each adjustment
    Object.entries(adjustments).forEach(([key, value]) => {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        
        const item = document.createElement('div');
        item.className = 'adjustment-item';
        
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = formatLabel(key);
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'value';
        valueSpan.textContent = formatValue(value);
        
        item.appendChild(label);
        item.appendChild(valueSpan);
        cell.appendChild(item);
        row.appendChild(cell);
        
        container.appendChild(row);
    });
}

// Helper function to format adjustment labels
function formatLabel(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
}

// Helper function to format adjustment values
function formatValue(value) {
    if (typeof value === 'number') {
        // Format numbers with up to 2 decimal places
        return value.toFixed(2).replace(/\.00$/, '');
    }
    return value.toString();
}

async function initiateCheckout(presetId) {
    // Check if user is logged in
    const token = localStorage.getItem('googleToken');
    if (!token) {
        alert("Please sign in to purchase this preset.");
        return;
    }
    
    try {
        const decodedToken = jwt_decode(token);
        const userId = decodedToken.sub;
        
        const response = await fetch(`http://localhost:8000/preset/${presetId}/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Checkout session created:", data);
        
        // Redirect to Stripe Checkout
        window.location.href = data.url;
        
    } catch (error) {
        console.error("Error creating checkout session:", error);
        alert("Error creating checkout session. Please try again.");
    }
}

// Function to handle successful payment return
function handlePaymentSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const presetId = urlParams.get('preset_id');
    
    if (sessionId && presetId) {
        // Download the preset
        downloadPreset(presetId, sessionId);
        
        // Show success message
        document.getElementById('payment-success').style.display = 'block';
        
        // Clear URL parameters
        history.replaceState(null, null, window.location.pathname);
    }
}

// Function to download a preset
function downloadPreset(presetId) {
    console.log("Downloading preset:", presetId);
    
    // Show loading state
    const downloadButton = document.getElementById('download-button');
    if (downloadButton) {
        downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
        downloadButton.disabled = true;
    }
    
    // Get user ID from token if available
    let userId = 'anonymous';
    const token = localStorage.getItem('googleToken');
    if (token) {
        try {
            const decoded = jwt_decode(token);
            userId = decoded.sub;
        } catch (e) {
            console.error("Error decoding token:", e);
        }
    }
    
    // Set FLASK_ENV to development in the query string to bypass payment in development
    const devMode = true; // Set to false in production
    const queryParams = devMode ? '?FLASK_ENV=development&user_id=' + userId : '?user_id=' + userId;
    
    // Create a progress bar if it doesn't exist
    let progressBar = document.getElementById('download-progress');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'download-progress';
        progressBar.className = 'download-progress';
        progressBar.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="progress-text">0%</div>
        `;
        
        // Insert the progress bar after the download button
        if (downloadButton && downloadButton.parentNode) {
            downloadButton.parentNode.insertBefore(progressBar, downloadButton.nextSibling);
        }
    }
    
    // Show the progress bar
    progressBar.style.display = 'block';
    
    // Update progress bar (initial state)
    updateProgressBar(progressBar, 10, 'Requesting download...');
    
    // Fetch the download URL from the server
    fetch(`http://localhost:8000/preset/${presetId}/download${queryParams}`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 402) {
                    throw new Error('Payment required to download this preset');
                } else {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
            }
            updateProgressBar(progressBar, 30, 'Download URL received');
            return response.json();
        })
        .then(data => {
            console.log("Download response:", data);
            
            if (data.xmp_url) {
                updateProgressBar(progressBar, 50, 'Downloading XMP file...');
                
                // Instead of using a link, fetch the XMP content directly
                fetch(data.xmp_url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        updateProgressBar(progressBar, 75, 'Processing XMP file...');
                        return response.text(); // Get the XMP content as text
                    })
                    .then(xmpContent => {
                        // Create a Blob from the XMP content
                        const blob = new Blob([xmpContent], { type: 'application/xml' });
                        const url = URL.createObjectURL(blob);
                        
                        // Create a download link
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `preset_${presetId}.xmp`; // Force download with filename
                        link.style.display = 'none';
                        
                        // Add to document, click it, and remove it
                        document.body.appendChild(link);
                        link.click();
                        
                        // Clean up
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            document.body.removeChild(link);
                            
                            // Update progress and reset button
                            updateProgressBar(progressBar, 100, 'Download complete!');
                            
                            // Hide progress bar after completion
                            setTimeout(() => {
                                progressBar.style.display = 'none';
                                
                                // Reset button state
                                if (downloadButton) {
                                    downloadButton.innerHTML = '<i class="fas fa-check"></i> Downloaded';
                                    setTimeout(() => {
                                        downloadButton.innerHTML = '<i class="fas fa-download"></i> Download Preset';
                                        downloadButton.disabled = false;
                                    }, 2000);
                                }
                            }, 1500);
                        }, 100);
                    })
                    .catch(error => {
                        console.error("Error downloading XMP file:", error);
                        updateProgressBar(progressBar, 0, 'Download failed: ' + error.message, true);
                        
                        // Reset button state with error
                        if (downloadButton) {
                            downloadButton.innerHTML = '<i class="fas fa-exclamation-circle"></i> Download Failed';
                            downloadButton.style.backgroundColor = '#ff4d4d';
                            
                            setTimeout(() => {
                                downloadButton.innerHTML = '<i class="fas fa-download"></i> Try Again';
                                downloadButton.style.backgroundColor = '';
                                downloadButton.disabled = false;
                            }, 3000);
                        }
                    });
            } else {
                throw new Error('No download URL provided');
            }
        })
        .catch(error => {
            console.error("Error downloading preset:", error);
            
            // Update progress bar to show error
            updateProgressBar(progressBar, 0, 'Download failed: ' + error.message, true);
            
            // Hide progress bar after a delay
            setTimeout(() => {
                progressBar.style.display = 'none';
            }, 3000);
            
            // Reset button state with error
            if (downloadButton) {
                downloadButton.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + error.message;
                downloadButton.style.backgroundColor = '#ff4d4d';
                
                setTimeout(() => {
                    downloadButton.innerHTML = '<i class="fas fa-download"></i> Try Again';
                    downloadButton.style.backgroundColor = '';
                    downloadButton.disabled = false;
                }, 3000);
            }
        });
}

// Helper function to update the progress bar
function updateProgressBar(progressBar, percentage, message, isError = false) {
    if (!progressBar) return;
    
    const bar = progressBar.querySelector('.progress-bar');
    const text = progressBar.querySelector('.progress-text');
    
    if (bar) {
        bar.style.width = percentage + '%';
        if (isError) {
            bar.style.backgroundColor = '#ff4d4d';
        } else {
            bar.style.backgroundColor = percentage === 100 ? '#4CAF50' : '#2196F3';
        }
    }
    
    if (text) {
        text.textContent = message || `${percentage}%`;
        if (isError) {
            text.style.color = '#ff4d4d';
        } else {
            text.style.color = '';
        }
    }
}

// Function to load user presets for the dashboard
function loadUserPresets() {
    console.log("Loading user presets for dashboard");
    
    // Get user ID (use anonymous if not logged in)
    const token = localStorage.getItem('googleToken');
    let userId = 'anonymous';
    
    if (token) {
        try {
            const decoded = jwt_decode(token);
            userId = decoded.sub;
        } catch (e) {
            console.error("Error decoding token:", e);
        }
    }
    
    // Show loading indicator
    const loadingElement = document.getElementById('loading-presets');
    const noPresetsElement = document.getElementById('no-presets');
    const tableContainer = document.querySelector('.presets-table-container');
    
    if (loadingElement) loadingElement.style.display = 'block';
    if (noPresetsElement) noPresetsElement.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'none';
    
    // Fetch user presets from the backend
    fetch(`http://localhost:8000/user/${userId}/presets`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(presets => {
            // Hide loading indicator
            if (loadingElement) loadingElement.style.display = 'none';
            
            if (!presets || presets.length === 0) {
                // Show no presets message
                if (noPresetsElement) noPresetsElement.style.display = 'block';
                return;
            }
            
            // Show table and populate with presets
            if (tableContainer) tableContainer.style.display = 'block';
            displayPresetsTable(presets);
        })
        .catch(error => {
            console.error("Error loading user presets:", error);
            
            // Hide loading indicator
            if (loadingElement) loadingElement.style.display = 'none';
            
            // Show error message
            const dashboardContent = document.querySelector('.dashboard-content');
            if (dashboardContent) {
                dashboardContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error loading your presets. Please try again later.</p>
                        <button onclick="loadUserPresets()" class="retry-button">Retry</button>
                    </div>
                `;
            }
        });
}

// Function to display presets in a table
function displayPresetsTable(presets) {
    const tableBody = document.getElementById('presets-table-body');
    if (!tableBody) return;
    
    // Clear previous content
    tableBody.innerHTML = '';
    
    // Add each preset to the table
    presets.forEach(preset => {
        const row = document.createElement('tr');
        
        // Image cell
        const imageCell = document.createElement('td');
        const img = document.createElement('img');
        img.src = preset.image_url;
        img.alt = 'Preset Thumbnail';
        img.className = 'preset-thumbnail';
        img.onerror = function() {
            this.src = 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="60" height="60" fill="%23f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="8" text-anchor="middle" fill="%23999">No image</text></svg>';
        };
        imageCell.appendChild(img);
        
        // Name cell
        const nameCell = document.createElement('td');
        const nameLink = document.createElement('a');
        nameLink.href = `preset-detail.html?id=${preset.id}`;
        nameLink.className = 'preset-name';
        nameLink.textContent = `Preset ${preset.id.substring(0, 8)}`;
        nameCell.appendChild(nameLink);
        
        // Date cell
        const dateCell = document.createElement('td');
        const date = new Date(preset.created_at);
        dateCell.textContent = date.toLocaleDateString();
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'preset-actions';
        
        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.className = 'action-button download-button';
        downloadButton.innerHTML = '<i class="fas fa-download"></i> Download';
        downloadButton.onclick = function() {
            downloadPreset(preset.id);
        };
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button delete-button';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteButton.onclick = function() {
            if (confirm('Are you sure you want to delete this preset?')) {
                deletePreset(preset.id);
            }
        };
        
        actionsCell.appendChild(downloadButton);
        actionsCell.appendChild(deleteButton);
        
        // Add cells to row
        row.appendChild(imageCell);
        row.appendChild(nameCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);
        
        // Add row to table
        tableBody.appendChild(row);
    });
}

// Function to delete a preset
function deletePreset(presetId) {
    fetch(`http://localhost:8000/preset/${presetId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Reload the presets table
            loadUserPresets();
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'delete-success';
            successMessage.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>Preset deleted successfully!</span>
            `;
            
            document.body.appendChild(successMessage);
            
            setTimeout(() => {
                successMessage.classList.add('fade-out');
                setTimeout(() => {
                    document.body.removeChild(successMessage);
                }, 500);
            }, 3000);
        })
        .catch(error => {
            console.error('Error deleting preset:', error);
            alert('Error deleting preset. Please try again.');
        });
}

// Function to load preset details for the detail page
function loadPresetDetails() {
    // Get preset ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const presetId = urlParams.get('id');
    
    if (!presetId) {
        // Redirect to dashboard if no preset ID
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Show loading indicator
    const presetContent = document.getElementById('preset-content');
    if (presetContent) {
        presetContent.innerHTML = `
            <div class="loading-preset">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading preset details...</p>
            </div>
        `;
    }
    
    // Fetch preset details
    fetch(`http://localhost:8000/preset/${presetId}/preview`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(preset => {
            // Display preset details
            displayPresetDetails(preset, presetId);
        })
        .catch(error => {
            console.error('Error loading preset details:', error);
            
            if (presetContent) {
                presetContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error loading preset details. Please try again later.</p>
                        <a href="dashboard.html" class="back-link">Back to Dashboard</a>
                    </div>
                `;
            }
        });
}

// Function to display preset details
function displayPresetDetails(preset, presetId) {
    const presetContent = document.getElementById('preset-content');
    if (!presetContent) return;
    
    // Create the content structure similar to the screenshot
    presetContent.innerHTML = `
        <h2>Your AI-Generated Preset</h2>
        <div class="preview-container">
            <div class="preview-image-container">
                <img id="preview-image" src="${preset.image_url}" alt="Preview">
            </div>
            <div class="preview-details">
                <div id="preview-adjustments" class="adjustments-list">
                    <!-- Adjustments will be loaded here -->
                </div>
                <div class="purchase-container">
                    <button id="download-button" class="download-button">
                        <i class="fas fa-download"></i> Download Preset
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Set up image error handling
    const previewImage = document.getElementById('preview-image');
    if (previewImage) {
        previewImage.onerror = function() {
            this.src = 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="%23999">Image not available</text></svg>';
        };
    }
    
    // Display the adjustments in a table format
    const adjustmentsList = document.getElementById('preview-adjustments');
    if (adjustmentsList && preset) {
        // Create the table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'adjustments-table-container';
        
        // Create the table
        const table = document.createElement('table');
        table.className = 'adjustments-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Define the adjustment categories we want to display
        const categories = [
            { key: 'basic', label: 'Basic Adjustments' },
            { key: 'color', label: 'Color Balance' },
            { key: 'detail', label: 'Detail' },
            { key: 'effects', label: 'Effects' }
        ];
        
        // Add header cells for each category
        categories.forEach(category => {
            const th = document.createElement('th');
            th.textContent = category.label;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Find the maximum number of adjustments in any category
        let maxRows = 0;
        categories.forEach(category => {
            const categoryData = preset[category.key] || {};
            maxRows = Math.max(maxRows, Object.keys(categoryData).length);
        });
        
        // Create rows for each adjustment
        for (let i = 0; i < maxRows; i++) {
            const row = document.createElement('tr');
            
            // Add cells for each category
            categories.forEach(category => {
                const td = document.createElement('td');
                const categoryData = preset[category.key] || {};
                const keys = Object.keys(categoryData);
                
                if (i < keys.length) {
                    const key = keys[i];
                    const value = categoryData[key];
                    
                    // Create adjustment item
                    const item = document.createElement('div');
                    item.className = 'adjustment-item';
                    
                    const label = document.createElement('span');
                    label.className = 'label';
                    label.textContent = formatLabel(key);
                    
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'value';
                    valueSpan.textContent = formatValue(value);
                    
                    item.appendChild(label);
                    item.appendChild(valueSpan);
                    td.appendChild(item);
                }
                
                row.appendChild(td);
            });
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        adjustmentsList.appendChild(tableContainer);
    }
    
    // Set up download button
    const downloadButton = document.getElementById('download-button');
    if (downloadButton) {
        downloadButton.onclick = function() {
            downloadPreset(presetId);
        };
    }
}

// Add these functions to handle local storage of the last uploaded image and preset
function saveLastUploadedImage(imageUrl, presetId, previewData) {
    const lastUpload = {
        imageUrl: imageUrl,
        presetId: presetId,
        previewData: previewData,
        timestamp: new Date().getTime()
    };
    localStorage.setItem('lastUploadedImage', JSON.stringify(lastUpload));
}

function getLastUploadedImage() {
    const lastUploadJson = localStorage.getItem('lastUploadedImage');
    if (lastUploadJson) {
        try {
            return JSON.parse(lastUploadJson);
        } catch (e) {
            console.error("[Storage] Error parsing last upload data:", e);
            return null;
        }
    }
    return null;
}

// Add a function to check for last uploaded image on page load
function checkForLastUpload() {
    const lastUpload = getLastUploadedImage();
    if (lastUpload && lastUpload.imageUrl && lastUpload.presetId) {
        console.log("[Upload] Found last uploaded image:", lastUpload);
        
        // Show the preset preview with the last uploaded image
        showPresetPreview(lastUpload.presetId, lastUpload.imageUrl, lastUpload.previewData);
    }
}

// Add this function to help debug the DOM elements
function debugElements() {
    console.log("[Debug] Checking DOM elements:");
    
    const elements = {
        'imageUpload': document.getElementById('imageUpload'),
        'createPresetBtn': document.getElementById('createPresetBtn'),
        'previewImage': document.getElementById('previewImage'),
        'previewContainer': document.querySelector('.preview-image-container'),
        'previewPlaceholder': document.querySelector('.preview-placeholder'),
        'fileNameDisplay': document.getElementById('fileNameDisplay'),
        'fileSizeDisplay': document.getElementById('fileSizeDisplay')
    };
    
    for (const [name, element] of Object.entries(elements)) {
        console.log(`[Debug] ${name}: ${element ? 'Found' : 'Not found'}`);
    }
    
    return elements;
} 
