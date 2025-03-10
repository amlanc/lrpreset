let googleUser = null;

function updateUI(isSignedIn, profile) {
    const authSection = document.getElementById('auth-section');
    if (!authSection) {
        return;
    }
    
    // Clear the auth section
    authSection.innerHTML = '';
    
    if (isSignedIn && profile) {
        // Create user info container
        const userInfo = document.createElement('div');
        userInfo.id = 'user-info';
        userInfo.className = 'user-info';
        
        // Add user avatar if available
        if (profile.picture) {
            // Create avatar container
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'user-avatar';
            
            // Check if we have a cached version of the image
            const cachedImage = localStorage.getItem('cachedProfileImage');
            const cachedImageUserId = localStorage.getItem('cachedProfileImageUserId');
            
            // Only use cached image if it belongs to the current user
            if (cachedImage && cachedImage.startsWith('data:image') && cachedImageUserId === profile.sub) {
                console.log('Using cached profile image');
                // Use cached image if available
                const avatar = document.createElement('img');
                avatar.src = cachedImage;
                avatar.alt = profile.name || 'User';
                avatarContainer.appendChild(avatar);
            } else {
                console.log('Loading profile image from Google');
                // Create avatar with initials first (as immediate fallback)
                avatarContainer.textContent = (profile.name || 'U')[0].toUpperCase();
                avatarContainer.style.backgroundColor = '#4285F4'; // Google blue
                avatarContainer.style.color = 'white';
                avatarContainer.style.fontWeight = 'bold';
                avatarContainer.style.fontSize = '16px';
                
                // Try to load the actual image in the background
                const avatar = new Image();
                avatar.crossOrigin = 'anonymous';
                
                // Add error handling for image
                avatar.onerror = function() {
                    console.log('Failed to load profile image, using initials');
                    // Keep the initials that we already set up
                };
                
                // Add load handler to cache the image
                avatar.onload = function() {
                    try {
                        // Create a canvas to convert the image to a data URL
                        const canvas = document.createElement('canvas');
                        canvas.width = avatar.width;
                        canvas.height = avatar.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(avatar, 0, 0);
                        
                        // Cache the image as a data URL
                        const dataUrl = canvas.toDataURL('image/png');
                        localStorage.setItem('cachedProfileImage', dataUrl);
                        localStorage.setItem('cachedProfileImageUserId', profile.sub);
                        
                        // Replace the initials with the actual image
                        avatarContainer.textContent = '';
                        const displayAvatar = document.createElement('img');
                        displayAvatar.src = dataUrl;
                        displayAvatar.alt = profile.name || 'User';
                        avatarContainer.appendChild(displayAvatar);
                        
                        console.log('Profile image cached successfully');
                    } catch (e) {
                        console.error("Failed to cache profile image:", e);
                    }
                };
                
                // Use our proxy to avoid rate limiting
                const originalImageUrl = profile.picture;
                const proxyImageUrl = `/proxy/profile-image?url=${encodeURIComponent(originalImageUrl)}`;
                console.log('Using proxy for profile image:', proxyImageUrl);
                
                // Set the source last to trigger loading
                avatar.src = proxyImageUrl;
            }
            
            // Add container to user info
            userInfo.appendChild(avatarContainer);
        } else {
            // Create avatar container with initials if no picture
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'user-avatar';
            avatarContainer.textContent = (profile.name || 'U')[0].toUpperCase();
            avatarContainer.style.backgroundColor = '#4285F4'; // Google blue
            avatarContainer.style.color = 'white';
            avatarContainer.style.fontWeight = 'bold';
            avatarContainer.style.fontSize = '16px';
            userInfo.appendChild(avatarContainer);
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
        createSignInButton();
    }
}

function createSignInButton() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) {
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
    googleLogo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMTcuNiA5LjJsLS4xLTEuOEg5djMuNGg0LjhDMTMuNiAxMiAxMyAxMyAxMiAxMy42djIuMmgzYTguOCA4LjggMCAwIDAgMi42LTYuNnoiIGZpbGw9IiM0Mjg1RjQiIGZpbGwtcnVsZT0ibm9uemVybyIvPjxwYXRoIGQ9Ik05IDE4YzIuNCAwIDQuNS0uOCA2LTIuMmwtMy0yLjJhNS40IDUuNCAwIDAgMS04LTIuOUgxVjEzYTkgOSAwIDAgMCA4IDV6IiBmaWxsPSIjMzRBODUzIiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNNCAxMC43YTUuNCA1LjQgMCAwIDEgMC0zLjRWNUgxYTkgOSAwIDAgMCAwIDhsMy0yLjN6IiBmaWxsPSIjRkJCQzA1IiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNNCAzLjZjMS4zIDAgMi41LjQgMy40IDEuM0wxNSAyLjNBOSA5IDAgMCAwIDEgNWwzIDIuNGE1LjQgNS40IDAgMCAxIDUtMy43eiIgZmlsbD0iI0VBNDMzNSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTAgMGgxOHYxOEgweiIvPjwvZz48L3N2Zz4=';
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
        // Use relative path for config fetch
        console.log('Fetching config from: /config');
        const response = await fetch('/config');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const config = await response.json();
        console.log('Config loaded successfully:', config);
        return config;
    } catch (error) {
        console.error('Error fetching config:', error);
        return null;
    }
}

// Update initiateGoogleSignIn to use the config
async function initiateGoogleSignIn() {
    const config = await getConfig();
    if (!config || !config.googleClientId) {
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
    const redirectUri = encodeURIComponent(window.location.origin + '/');
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
    } else {
        updateUI(false);
    }
}

// Update sign out to use Google's sign-out
function signOut() {
    google.accounts.id.disableAutoSelect();
    
    // Clear tokens from localStorage
    localStorage.removeItem('googleToken');
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('cachedProfileImage'); // Clear cached profile image
    localStorage.removeItem('cachedProfileImageUserId'); // Clear cached profile image user ID
    
    // Update UI
    updateUI(false);
    
    // Redirect to home page if not already there
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.location.href = '/';
    }
}

// Initialize Google Sign-In on page load
function startGoogleAuth() {
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
                updateUI(true, decodedToken);
                return;
            } else {
                localStorage.removeItem('googleToken');
            }
        } catch (error) {
            localStorage.removeItem('googleToken');
        }
    }
    
    // If we get here, user is not authenticated, show sign-in button
    createSignInButton();
}

// Function to check URL for authentication response
function checkUrlForAuthResponse() {
    // Check if we have a hash fragment in the URL (from Google redirect)
    if (window.location.hash) {
        // Parse the hash fragment
        const params = new URLSearchParams(window.location.hash.substring(1));
        
        // Check if we have an ID token
        if (params.has('id_token')) {
            const idToken = params.get('id_token');
            const accessToken = params.get('access_token');
            
            // Verify the token
            try {
                const decodedToken = jwt_decode(idToken);
                
                // Store the tokens
                localStorage.setItem('googleToken', idToken);
                localStorage.setItem('googleAccessToken', accessToken);
                
                // Update the UI with user profile including picture
                updateUI(true, {
                    name: decodedToken.name,
                    email: decodedToken.email,
                    picture: decodedToken.picture,  // Make sure to include the picture
                    sub: decodedToken.sub
                });
                
                // Clean up the URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (error) {
                console.error("Error decoding token:", error);
            }
        }
    } else {
        // Check if we have a stored token
        const storedToken = localStorage.getItem('googleToken');
        if (storedToken) {
            try {
                const decodedToken = jwt_decode(storedToken);
                // Update UI with stored token data
                updateUI(true, {
                    name: decodedToken.name,
                    email: decodedToken.email,
                    picture: decodedToken.picture,  // Make sure to include the picture
                    sub: decodedToken.sub
                });
            } catch (error) {
                console.error("Error decoding stored token:", error);
                // Clear invalid token
                localStorage.removeItem('googleToken');
                localStorage.removeItem('googleAccessToken');
                updateUI(false);
            }
        }
    }
}

// Function to initialize image upload functionality
function initializeImageUpload() {
    // Set up file input change event
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', function(event) {
            handleFileSelect(event);
        });
    } else {
        console.warn("[Upload] Image upload input not found");
    }
    
    // Set up create preset button click event
    const createPresetBtn = document.getElementById('createPresetBtn');
    if (createPresetBtn) {
        createPresetBtn.addEventListener('click', handleCreatePresetClick);
    } else {
        console.warn("[Upload] Create preset button not found");
    }
}

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
    const maxSize = 164 * 1024 * 1024; // 164MB in bytes
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

// Function to handle the Create Preset button click
function handleCreatePresetClick() {
    console.log("[Upload] Create Preset button clicked");
    
    // Check if an image is selected
    const previewImage = document.getElementById('previewImage');
    if (!previewImage || !previewImage.src || previewImage.src === '') {
        alert('Please upload an image first');
        return;
    }
    
    // Get the image file
    const imageUpload = document.getElementById('imageUpload');
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) {
        alert('Please upload an image first');
        return;
    }
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('image', imageUpload.files[0]);
    
    // Add user ID to the form data
    try {
        // Get the token from localStorage
        const token = localStorage.getItem('googleToken');
        
        if (!token) {
            console.log("No authentication token found, using anonymous user");
            formData.append('user_id', 'anonymous');
        } else {
            const decodedToken = jwt_decode(token);
            formData.append('user_id', decodedToken.sub);
        }
    } catch (error) {
        console.error("Error decoding token:", error);
        // Continue with anonymous user
        formData.append('user_id', 'anonymous');
    }
    
    // Show progress container
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'flex';
    }
    
    // Update progress
    updateUploadProgress(20, 'Uploading image...');
    
    // Send to backend
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            // Start by parsing the response to get the error message
            return response.json().then(errorData => {
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }).catch(jsonError => {
                // If we can't parse JSON, use the status text
                throw new Error(`Upload failed: ${response.statusText || `HTTP error! status: ${response.status}`}`);
            });
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
        updateUploadProgress(95, 'AI processing complete, finalizing preset...');
        
        // Check if we have a preset ID
        if (data && data.preset_id) {
            // Wait a bit to show progress, then redirect to preset page
            setTimeout(() => {
                updateUploadProgress(100, 'Preset created successfully!');
                
                // Redirect to preset page
                setTimeout(() => {
                    window.location.href = `${window.location.origin}/preset-detail.html?id=${data.preset_id}`;
                }, 500);
            }, 1000);
        } else {
            console.log("[Upload] No image selected, showing alert");
            alert("Please select an image first.");
        }
    })
    .catch(error => {
        console.error("[Upload] Error uploading image:", error);
        
        // Stop the AI animation if it was started
        stopAIProgressAnimation();
        
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

// Function to upload image
function uploadImage() {
    return new Promise((resolve, reject) => {
        if (!isAuthenticated()) {
            reject(new Error('Authentication required'));
            return;
        }
        
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        
        if (!file) {
            reject(new Error('No file selected'));
            return;
        }
        
        // Create form data
        const formData = new FormData();
        formData.append('image', file);
        
        // Get the ID token
        const idToken = googleUser.credential;
        
        // Create headers with authentication
        const headers = new Headers({
            'Authorization': `Bearer ${idToken}`
        });
        
        // Upload the image
        fetch('/upload', {
            method: 'POST',
            headers: headers,
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required');
                }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            resolve(data);
        })
        .catch(error => {
            console.error('Error:', error);
            if (error.message === 'Authentication required') {
                // Redirect to sign in
                initiateGoogleSignIn();
            }
            reject(error);
        });
    });
}

// Function to update upload progress
function updateUploadProgress(percentage, message) {
    const uploadProgress = document.getElementById('uploadProgress');
    const statusText = document.getElementById('statusText');
    
    if (uploadProgress) {
        uploadProgress.style.width = `${percentage}%`;
        
        // Add pulse animation when AI is processing (between 20% and 90%)
        if (percentage > 20 && percentage < 90) {
            uploadProgress.classList.add('pulse');
        } else {
            uploadProgress.classList.remove('pulse');
        }
    }
    
    if (statusText && message) {
        statusText.textContent = message;
        
        // Add typing animation when AI is processing
        if (percentage > 20 && percentage < 90) {
            statusText.classList.add('typing-animation');
        } else {
            statusText.classList.remove('typing-animation');
        }
    }
    
    // Show AI processing steps when we reach the AI processing stage
    const aiProcessingContainer = document.getElementById('aiProcessingContainer');
    if (aiProcessingContainer) {
        if (percentage >= 20) {
            aiProcessingContainer.style.display = 'block';
        } else {
            aiProcessingContainer.style.display = 'none';
        }
    }
    
    // Update the active AI step based on the progress percentage
    updateAIProcessingStep(percentage);
}

// Function to simulate AI progress animation
function startAIProgressAnimation() {
    console.log("Starting AI progress animation");
    const uploadProgress = document.getElementById('uploadProgress');
    const statusText = document.getElementById('statusText');
    const aiProcessingContainer = document.getElementById('aiProcessingContainer');
    
    if (!uploadProgress) {
        console.error("Upload progress element not found");
        return;
    }
    
    // Show AI processing container
    if (aiProcessingContainer) {
        aiProcessingContainer.style.display = 'block';
    } else {
        console.error("AI processing container not found");
    }
    
    // Start from 40% (after upload complete)
    let progress = 40;
    
    // Add pulse animation to progress bar
    uploadProgress.classList.add('pulse');
    
    // AI processing messages to cycle through
    const aiMessages = [
        "AI is analyzing lighting conditions...",
        "AI is evaluating color balance...",
        "AI is examining composition...",
        "AI is determining optimal adjustments...",
        "AI is extracting adjustments...",
        "AI is finalizing your custom preset..."
    ];
    
    let messageIndex = 0;
    
    // Initial message
    if (statusText) {
        statusText.textContent = aiMessages[0];
        statusText.classList.add('typing-animation');
    }
    
    // Update message every 2 seconds
    const messageInterval = setInterval(() => {
        if (statusText) {
            messageIndex = (messageIndex + 1) % aiMessages.length;
            statusText.textContent = aiMessages[messageIndex];
            
            // Ensure the typing animation is applied
            statusText.classList.remove('typing-animation');
            // Force a reflow to restart the animation
            void statusText.offsetWidth;
            statusText.classList.add('typing-animation');
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
            
            if (statusText) {
                statusText.textContent = "Almost done! Finalizing your preset...";
            }
        }
        
        if (uploadProgress) {
            uploadProgress.style.width = `${progress}%`;
            console.log("Setting progress width to:", `${progress}%`);
            
            // Update the AI processing steps
            updateAIProcessingStep(progress);
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
    console.log("Stopping AI progress animation");
    
    if (window.aiProgressIntervals) {
        clearInterval(window.aiProgressIntervals.message);
        clearInterval(window.aiProgressIntervals.progress);
    }
    
    // Remove pulse animation
    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) {
        uploadProgress.classList.remove('pulse');
    }
    
    // Remove typing animation
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.classList.remove('typing-animation');
    }
    
    // Complete all steps when done
    const steps = document.querySelectorAll('.ai-step');
    steps.forEach(step => {
        step.classList.remove('active');
        step.classList.add('completed');
    });
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
        // Add error handling for image loading
        previewImage.onerror = function() {
            console.error("Failed to load image from URL:", imageUrl);
        };
        
        // Set crossOrigin for external images
        previewImage.crossOrigin = "anonymous";
        
        // Set the image source
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
            fetch(`/preset/${presetId}/preview`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
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
        // Format numbers with up to 2 decimal places, removing % signs
        return value.toFixed(2).replace(/\.00$/, '').replace(/%/g, '');
    }
    return value.toString().replace(/%/g, '');
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
        
        const response = await fetch(`/preset/${presetId}/checkout`, {
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
function downloadPreset(presetId, sessionId) {
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
    
    console.log("[Upload] Sending request to backend:", {
        presetId: presetId,
        userId: userId
    });
    
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
    fetch(`/preset/${presetId}/download${queryParams}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            updateProgressBar(progressBar, 30, 'Download URL received');
            return response.json();
        })
        .then(data => {
            console.log("Download response:", data);
            
            if (data.xmp_url) {
                updateProgressBar(progressBar, 50, 'Downloading XMP file...');
                
                // Clean up the URL if it has a trailing question mark
                let xmpUrl = data.xmp_url;
                if (xmpUrl.endsWith('?')) {
                    xmpUrl = xmpUrl.slice(0, -1);
                }
                
                console.log("Fetching XMP from URL:", xmpUrl);
                
                // Instead of using a link, fetch the XMP content directly
                fetch(xmpUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
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
        bar.style.width = `${percentage}%`;
        
        // Add pulse animation when AI is processing (between 20% and 90%)
        if (isError) {
            bar.style.backgroundColor = '#ff4d4d';
        } else {
            bar.style.backgroundColor = percentage === 100 ? '#4CAF50' : '#2196F3';
        }
    }
    
    if (text) {
        text.textContent = message || `${percentage}%`;
        
        // Add typing animation when AI is processing
        if (isError) {
            text.style.color = '#ff4d4d';
        } else {
            text.style.color = '';
        }
    }
    
    // Show AI processing steps when we reach the AI processing stage
    const aiProcessingContainer = document.getElementById('aiProcessingContainer');
    if (aiProcessingContainer) {
        if (percentage >= 20) {
            aiProcessingContainer.style.display = 'block';
        }
    }
    
    // Update the active AI step based on the progress percentage
    updateAIProcessingStep(percentage);
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
    fetch(`/user/${userId}/presets`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('User not found');
                } else {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
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
                let errorMessage = 'Error loading your presets. Please try again later.';
                let errorIcon = 'fa-exclamation-circle';
                
                if (error.message === 'User not found') {
                    errorMessage = 'Your user profile could not be found. Please try logging in again.';
                    errorIcon = 'fa-user-slash';
                }
                
                dashboardContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas ${errorIcon}"></i>
                        <p>${errorMessage}</p>
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
        // Use our proxy endpoint for Supabase images to avoid CORS issues
        img.src = `/proxy/supabase-image?url=${encodeURIComponent(preset.image_url)}`;
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
        nameLink.textContent = preset.name || `Preset ${preset.id.substring(0, 8)}`;
        nameCell.appendChild(nameLink);
        
        // Date cell
        const dateCell = document.createElement('td');
        if (preset.created_at) {
            try {
                const date = new Date(preset.created_at);
                dateCell.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            } catch (e) {
                console.error("Error formatting date:", e);
                dateCell.textContent = preset.created_at;
            }
        } else {
            dateCell.textContent = 'Unknown';
        }
        
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
            deletePreset(preset.id);
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
    fetch(`/preset/${presetId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(() => {
        // Clear any cached data for this preset
        localStorage.removeItem(`preset_${presetId}`);
        localStorage.removeItem(`preset_image_${presetId}`);
        localStorage.removeItem(`preset_metadata_${presetId}`);
        
        // Reload the presets table
        loadUserPresets();
    })
    .catch(error => {
        console.error('Error deleting preset:', error);
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
    fetch(`/preset/${presetId}`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Preset not found');
                } else {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
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
                if (error.message === 'Preset not found') {
                    presetContent.innerHTML = `
                        <div class="error-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>The preset you're looking for could not be found. It may have been deleted or never existed.</p>
                            <a href="dashboard.html" class="back-link">Back to Dashboard</a>
                        </div>
                    `;
                } else {
                    presetContent.innerHTML = `
                        <div class="error-message">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Error loading preset details. Please try again later.</p>
                            <a href="dashboard.html" class="back-link">Back to Dashboard</a>
                        </div>
                    `;
                }
            }
        });
}

// Function to display preset details
function displayPresetDetails(preset, presetId) {
    const presetContent = document.getElementById('preset-content');
    if (!presetContent) return;
    
    console.log("Displaying preset details:", preset);
    
    // Parse metadata if it's a string
    let metadata = preset.metadata;
    if (typeof metadata === 'string') {
        try {
            metadata = JSON.parse(metadata);
            console.log("Parsed metadata:", metadata);
        } catch (e) {
            console.error("Error parsing metadata:", e);
            metadata = {};
        }
    }
    
    // Use our proxy endpoint for Supabase images to avoid CORS issues
    const proxyImageUrl = `/proxy/supabase-image?url=${encodeURIComponent(preset.image_url)}`;
    console.log("Using proxy image URL:", proxyImageUrl);
    
    // Format the creation date if available
    let creationDate = '';
    if (preset.created_at) {
        try {
            const date = new Date(preset.created_at);
            creationDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
            console.error("Error formatting date:", e);
            creationDate = preset.created_at;
        }
    }
    
    // Create the content structure
    presetContent.innerHTML = `
        <div class="preset-detail-container">
            <div class="preset-header">
                <h2>${preset.name || 'Your AI-Generated Preset'}</h2>
                <div class="preset-metadata">
                    <span class="preset-date">${creationDate ? 'Created on: ' + creationDate : ''}</span>
                    ${preset.original_filename ? `<span class="preset-filename">Original file: ${preset.original_filename}</span>` : ''}
                </div>
            </div>
            
            <div class="preset-content-grid">
                <div class="preset-image-section">
                    <div class="preset-image-container">
                        <img src="${proxyImageUrl}" alt="Preset preview" class="preset-image">
                    </div>
                    <div class="preset-actions">
                        <button onclick="downloadPreset('${presetId}')" class="primary-button">
                            <i class="fas fa-download"></i> Download Preset
                        </button>
                    </div>
                </div>
                
                <div class="preset-info-container">
                    <div class="adjustments-container">
                        <h3>Preset Adjustments</h3>
                        <div id="adjustments-table"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create and populate the adjustments table
    const adjustmentsTable = document.getElementById('adjustments-table');
    if (adjustmentsTable && metadata) {
        // Define the categories we want to display as columns
        const categories = [
            { key: 'basic', label: 'Basic Adjustments' },
            { key: 'color', label: 'Color' },
            { key: 'detail', label: 'Detail' },
            { key: 'effects', label: 'Effects' }
        ];
        
        // Create table structure
        let tableHTML = `
            <table class="adjustments-table">
                <thead>
                    <tr>
                        ${categories.map(cat => `<th>${cat.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Find the maximum number of adjustments in any category
        let maxRows = 0;
        categories.forEach(category => {
            const categoryData = metadata[category.key] || {};
            maxRows = Math.max(maxRows, Object.keys(categoryData).length);
        });
        
        // Create rows
        for (let i = 0; i < maxRows; i++) {
            tableHTML += '<tr>';
            
            // Add cells for each category
            categories.forEach(category => {
                const categoryData = metadata[category.key] || {};
                const keys = Object.keys(categoryData);
                
                tableHTML += '<td>';
                if (i < keys.length) {
                    const key = keys[i];
                    const value = categoryData[key];
                    tableHTML += `
                        <div class="adjustment-item">
                            <span class="label">${formatLabel(key)}</span>
                            <span class="value">${formatValue(value)}</span>
                        </div>
                    `;
                }
                tableHTML += '</td>';
            });
            
            tableHTML += '</tr>';
        }
        
        tableHTML += '</tbody></table>';
        adjustmentsTable.innerHTML = tableHTML;
    }
}

// Add these functions to handle local storage of the last uploaded image and preset
function saveLastUploadedImage(imageUrl, presetId, presetData) {
    // Validate the image URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
        console.error("Invalid image URL:", imageUrl);
        return;
    }
    
    const lastUpload = {
        imageUrl: imageUrl,
        presetId: presetId,
        previewData: presetData,
        timestamp: new Date().getTime()
    };
    localStorage.setItem('lastUploadedImage', JSON.stringify(lastUpload));
}

function getLastUploadedImage() {
    const lastUploadJson = localStorage.getItem('lastUploadedImage');
    if (lastUploadJson) {
        try {
            const data = JSON.parse(lastUploadJson);
            
            // Validate the data
            if (!data.imageUrl || !data.presetId) {
                console.error("Invalid cached image data:", data);
                return null;
            }
            
            // Check if the image URL points to mock storage
            if (data.imageUrl.includes('/mock-storage/')) {
                console.log("Clearing cached image that points to mock storage");
                localStorage.removeItem('lastUploadedImage');
                return null;
            }
            
            return data;
        } catch (e) {
            console.error("Error parsing cached image data:", e);
            return null;
        }
    }
    return null;
}

// Add a function to check for last uploaded image on page load
function checkForLastUpload() {
    // First, clear any old mock storage URLs
    const lastUploadJson = localStorage.getItem('lastUploadedImage');
    if (lastUploadJson) {
        try {
            const data = JSON.parse(lastUploadJson);
            if (data.imageUrl && data.imageUrl.includes('/mock-storage/')) {
                console.log("Removing cached mock storage URL:", data.imageUrl);
                localStorage.removeItem('lastUploadedImage');
            }
        } catch (e) {
            console.error("Error checking cached image data:", e);
        }
    }
    
    // Now get the last uploaded image (if it's valid)
    const lastUpload = getLastUploadedImage();
    if (lastUpload && lastUpload.imageUrl && lastUpload.presetId) {
        console.log("[Upload] Found last uploaded image:", lastUpload);
        
        // Show the preset preview with the last uploaded image
        showPresetPreview(lastUpload.presetId, lastUpload.imageUrl, lastUpload.previewData);
    }
}

// Helper function to get the API URL
function getApiUrl(endpoint) {
    // Always use relative paths since frontend and backend are served from the same origin
    return endpoint;
}

// Initialize the application
async function initializeApp() {
    // Get configuration first
    await getConfig();
    
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
    
    // Check for authentication response in URL
    checkUrlForAuthResponse();
    
    // Check for last uploaded image
    checkForLastUpload();
}

// Document ready function to initialize all event handlers
document.addEventListener('DOMContentLoaded', function() {
    // Clear any mock storage data
    clearMockStorageData();
    
    // Initialize the app
    initializeApp();
});

// Add a function to clear all mock storage data
function clearMockStorageData() {
    console.log("Checking for and clearing any mock storage data");
    
    // Check for lastUploadedImage
    const lastUploadJson = localStorage.getItem('lastUploadedImage');
    if (lastUploadJson) {
        try {
            const data = JSON.parse(lastUploadJson);
            if (data.imageUrl && data.imageUrl.includes('/mock-storage/')) {
                console.log("Removing cached mock storage URL:", data.imageUrl);
                localStorage.removeItem('lastUploadedImage');
            }
        } catch (e) {
            console.error("Error checking cached image data:", e);
        }
    }
    
    // Check for any other items that might contain mock storage URLs
    // This is a more aggressive approach to ensure all mock storage references are removed
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        
        if (value && value.includes && value.includes('/mock-storage/')) {
            console.log(`Removing localStorage item with mock storage reference: ${key}`);
            localStorage.removeItem(key);
        }
    }
}

// Function to update the active AI processing step
function updateAIProcessingStep(percentage) {
    console.log("Updating AI processing step for percentage:", percentage);
    
    // Get all steps
    const steps = document.querySelectorAll('.ai-step');
    if (!steps || steps.length === 0) {
        console.warn("No AI steps found in the DOM");
        return;
    }
    
    // Define percentage thresholds for each step
    const thresholds = [
        { step: 'upload', min: 0, max: 20 },
        { step: 'analyze', min: 20, max: 40 },
        { step: 'lighting', min: 40, max: 60 },
        { step: 'color', min: 60, max: 75 },
        { step: 'generate', min: 75, max: 90 },
        { step: 'finalize', min: 90, max: 100 }
    ];
    
    // Find the current active step based on percentage
    let activeStep = null;
    for (const threshold of thresholds) {
        if (percentage >= threshold.min && percentage < threshold.max) {
            activeStep = threshold.step;
            break;
        }
    }
    
    console.log("Active step determined to be:", activeStep);
    
    // Update step classes
    steps.forEach(step => {
        const stepName = step.getAttribute('data-step');
        
        // Remove all active classes first
        step.classList.remove('active');
        
        // Find the index of this step and the active step
        const stepIndex = thresholds.findIndex(t => t.step === stepName);
        const activeIndex = thresholds.findIndex(t => t.step === activeStep);
        
        if (stepIndex === -1 || activeIndex === -1) {
            console.warn(`Could not find index for step: ${stepName} or active step: ${activeStep}`);
            return;
        }
        
        // Mark steps as completed if they come before the active step
        if (stepIndex < activeIndex) {
            step.classList.remove('active');
            step.classList.add('completed');
        } 
        // Mark the active step
        else if (stepName === activeStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } 
        // Reset steps that come after the active step
        else {
            step.classList.remove('active', 'completed');
        }
    });
    
    // Show the AI processing container when we're in the AI processing phase
    const aiProcessingContainer = document.getElementById('aiProcessingContainer');
    if (aiProcessingContainer) {
        if (percentage >= 20) {
            aiProcessingContainer.style.display = 'block';
        }
    }
}

// Function to check if user is authenticated
function isAuthenticated() {
    return googleUser !== null;
}

// Function to initialize image upload functionality
function initializeImageUpload() {
    const uploadSection = document.getElementById('upload-section');
    if (!uploadSection) return;
    
    // Hide upload section if not authenticated
    if (!isAuthenticated()) {
        uploadSection.innerHTML = `
            <div class="auth-required">
                <i class="fas fa-lock"></i>
                <h2>Sign in Required</h2>
                <p>Please sign in with Google to create presets.</p>
                <button onclick="initiateGoogleSignIn()" class="signin-button">
                    <i class="fab fa-google"></i> Sign in with Google
                </button>
            </div>
        `;
        return;
    }
    
    // Show upload interface if authenticated
    uploadSection.innerHTML = `
        <div class="upload-container">
            <div class="upload-box" id="upload-box">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Drag & drop your photo here or click to select</p>
                <input type="file" id="file-input" accept="image/*" style="display: none;">
            </div>
            <button id="create-preset" class="create-button" style="display: none;">
                <i class="fas fa-magic"></i> Create Preset
            </button>
        </div>
        <div id="progress-container" class="progress-container" style="display: none;">
            <!-- Progress bar will be added here -->
        </div>
    `;
    
    setupUploadHandlers();
}

// Function to setup upload handlers
function setupUploadHandlers() {
    const uploadBox = document.getElementById('upload-box');
    const fileInput = document.getElementById('file-input');
    const createButton = document.getElementById('create-preset');
    
    if (!uploadBox || !fileInput || !createButton) return;
    
    uploadBox.addEventListener('click', () => fileInput.click());
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        handleFileSelect(e);
    });
    
    fileInput.addEventListener('change', handleFileSelect);
    createButton.addEventListener('click', function(e) {
        if (!isAuthenticated()) {
            e.preventDefault();
            alert('Please sign in to upload images');
            return;
        }
        handleCreatePresetClick();
    });
}

function displayPresetDetails(preset) {
    const adjustmentsContainer = document.querySelector('.adjustments-container');
    
    // Organize adjustments into categories
    const categories = {
        basic: {},
        tone: {},
        color: {},
        effects: {}
    };
    
    // Sort adjustments into categories
    if (preset && preset.adjustments) {
        Object.entries(preset.adjustments).forEach(([key, value]) => {
            if (key.includes('exposure') || key.includes('contrast') || key.includes('highlights') || key.includes('shadows')) {
                categories.basic[key] = value;
            } else if (key.includes('tone') || key.includes('white') || key.includes('black')) {
                categories.tone[key] = value;
            } else if (key.includes('color') || key.includes('tint') || key.includes('vibrance') || key.includes('saturation')) {
                categories.color[key] = value;
            } else {
                categories.effects[key] = value;
            }
        });
    }
    
    // Create tabs container
    const tabsHtml = `
        <div class="tabs-container">
            <div class="tabs-nav">
                <button class="tab-button active" data-tab="basic">Basic</button>
                <button class="tab-button" data-tab="tone">Tone</button>
                <button class="tab-button" data-tab="color">Color</button>
                <button class="tab-button" data-tab="effects">Effects</button>
            </div>
            <div id="basic" class="tab-content active">
                <table class="tab-table">
                    ${generateTabContent(categories.basic)}
                </table>
            </div>
            <div id="tone" class="tab-content">
                <table class="tab-table">
                    ${generateTabContent(categories.tone)}
                </table>
            </div>
            <div id="color" class="tab-content">
                <table class="tab-table">
                    ${generateTabContent(categories.color)}
                </table>
            </div>
            <div id="effects" class="tab-content">
                <table class="tab-table">
                    ${generateTabContent(categories.effects)}
                </table>
            </div>
        </div>
    `;
    
    adjustmentsContainer.innerHTML = tabsHtml;
    
    // Add tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show the corresponding tab content
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

function generateTabContent(adjustments) {
    if (!adjustments || Object.keys(adjustments).length === 0) {
        return '<tr><td colspan="2" style="text-align: center; color: #666;">No adjustments in this category</td></tr>';
    }
    
    return Object.entries(adjustments)
        .map(([key, value]) => `
            <tr>
                <td>${formatAdjustmentName(key)}</td>
                <td>${formatAdjustmentValue(value)}</td>
            </tr>
        `).join('');
}

// Add a favicon link to prevent 404
document.head.innerHTML += '<link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A">';
