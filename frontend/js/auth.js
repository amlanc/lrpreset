/**
 * Authentication Module
 * Handles user authentication, profile management and session state
 */

let googleUser = null;

/**
 * Updates the UI based on authentication state
 * @param {boolean} isSignedIn - Whether the user is signed in
 * @param {Object} profile - User profile information
 */
function updateUI(isSignedIn, profile) {
    const authSection = document.getElementById('auth-section');
    if (!authSection) {
        return;
    }
    
    console.log('Updating UI based on auth state:', isSignedIn);
    
    // Clear the auth section
    authSection.innerHTML = '';
    
    if (isSignedIn && profile) {
        // Create user profile container
        const userProfile = document.createElement('div');
        userProfile.className = 'user-profile';
        
        // Add user avatar
        const profileImage = document.createElement('img');
        profileImage.className = 'profile-image';
        
        if (profile.picture) {
            
            // Check if we have a cached version of the image
            const cachedImage = localStorage.getItem('cachedProfileImage');
            const cachedImageUserId = localStorage.getItem('cachedProfileImageUserId');
            
            // Only use cached image if it belongs to the current user
            if (cachedImage && cachedImage.startsWith('data:image') && cachedImageUserId === profile.sub) {
                console.log('Using cached profile image');
                // Use cached image if available
                profileImage.src = cachedImage;
                profileImage.alt = profile.name || 'User';
                userProfile.appendChild(profileImage);
            } else {
                console.log('Loading profile image from Google');
                // Create initials as immediate fallback
                const initialsElement = document.createElement('div');
                initialsElement.className = 'profile-image';
                initialsElement.id = 'profile-initials';
                initialsElement.textContent = (profile.name || 'U')[0].toUpperCase();
                initialsElement.style.backgroundColor = '#4285F4';
                initialsElement.style.color = 'white';
                initialsElement.style.display = 'flex';
                initialsElement.style.alignItems = 'center';
                initialsElement.style.justifyContent = 'center';
                userProfile.appendChild(initialsElement);
                
                // Try to load the actual image in the background
                const avatar = new Image();
                avatar.crossOrigin = 'anonymous';
                
                // Add error handling for image
                avatar.onerror = function() {
                    console.log('Failed to load profile image, using initials');
                    // Keep the initials as fallback - no need to modify since they're already displayed
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
                        
                        // Remove the initials element
                        const initialsElement = document.getElementById('profile-initials');
                        if (initialsElement) {
                            initialsElement.remove();
                        }
                        
                        // Create and add the profile image
                        profileImage.src = dataUrl;
                        profileImage.alt = profile.name || 'User';
                        userProfile.appendChild(profileImage);
                        
                        console.log('Profile image cached and displayed successfully');
                    } catch (e) {
                        console.error("Failed to cache profile image:", e);
                        // Keep the initials as fallback - no need to modify
                    }
                };
                
                // Use our proxy to avoid rate limiting
                const originalImageUrl = profile.picture;
                const proxyImageUrl = `proxy/profile-image?url=${encodeURIComponent(originalImageUrl)}`;
                console.log('Using proxy for profile image:', proxyImageUrl);
                
                // Set the source last to trigger loading
                avatar.src = proxyImageUrl;
            }
            
        } else {
            // Use initials if no picture available
            profileImage.style.backgroundColor = '#4285F4';
            profileImage.style.color = 'white';
            profileImage.style.display = 'flex';
            profileImage.style.alignItems = 'center';
            profileImage.style.justifyContent = 'center';
            profileImage.textContent = (profile.name || 'U')[0].toUpperCase();
        }
        
        userProfile.appendChild(profileImage);
        
        // Create dropdown menu
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';
        
        // Add dropdown items
        const dashboardItem = document.createElement('a');
        dashboardItem.href = 'dashboard.html';
        dashboardItem.className = 'dropdown-item';
        dashboardItem.innerHTML = '<i class="fas fa-th-large"></i>Dashboard';
        dropdownMenu.appendChild(dashboardItem);
        
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        dropdownMenu.appendChild(divider);
        
        const signOutItem = document.createElement('a');
        signOutItem.href = '#';
        signOutItem.className = 'dropdown-item';
        signOutItem.innerHTML = '<i class="fas fa-sign-out-alt"></i>Sign Out';
        
        // Add click handler to sign out item
        signOutItem.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
        dropdownMenu.appendChild(signOutItem);
        
        // Add click handler to user profile
        userProfile.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            dropdownMenu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userProfile.contains(e.target)) {
                userProfile.classList.remove('active');
                dropdownMenu.classList.remove('show');
            }
        });
        
        // Add user name
        const userName = document.createElement('span');
        userName.className = 'user-name';
        userName.textContent = profile.name || profile.email || 'User';
        userProfile.appendChild(userName);
        
        // Add components to auth section
        authSection.appendChild(userProfile);
        authSection.appendChild(dropdownMenu);
    } else {
        createSignInButton();
    }
    
    // Update upload UI if the function exists
    if (typeof window.upload !== 'undefined' && typeof window.upload.updateUploadUI === 'function') {
        window.upload.updateUploadUI();
    }
    
    // Initialize create preset button if the function exists
    if (typeof window.preset !== 'undefined' && typeof window.preset.initializeCreatePresetButton === 'function') {
        window.preset.initializeCreatePresetButton();
    }
}

/**
 * Creates the Google Sign-In button
 */
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
    
    // Create the Google Sign-In button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'g-signin-button';
    
    // Create the button with official Google styling
    const signInButton = document.createElement('button');
    signInButton.className = 'gsi-material-button';
    
    // Create the button content wrapper
    const buttonContent = document.createElement('div');
    buttonContent.className = 'gsi-material-button-content-wrapper';
    
    // Add Google's official logo
    const googleLogo = document.createElement('div');
    googleLogo.className = 'gsi-material-button-icon';
    googleLogo.innerHTML = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: block;"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>';
    
    // Add the button text
    const buttonText = document.createElement('span');
    buttonText.className = 'gsi-material-button-text';
    buttonText.textContent = 'Sign in with Google';
    
    // Assemble the button content
    buttonContent.appendChild(googleLogo);
    buttonContent.appendChild(buttonText);
    
    // Add the content to the button
    signInButton.appendChild(buttonContent);
    signInButton.addEventListener('click', initiateGoogleSignIn);
    
    // Add the button to the container and then to the auth section
    buttonContainer.appendChild(signInButton);
    authSection.appendChild(buttonContainer);
}

/**
 * Gets configuration from the server
 * @returns {Promise<Object>} Configuration object
 */
function getConfig() {
    return fetch(getApiUrl('/config'))
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to get config');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error getting config:', error);
            return {
                googleClientId: '123456789-example.apps.googleusercontent.com' // Fallback
            };
        });
}

/**
 * Initiates Google Sign-In process
 */
function initiateGoogleSignIn() {
    getConfig().then(config => {
        const clientId = config.googleClientId;
        
        // Create the OAuth 2.0 URL
        const redirectUri = window.location.origin + '/google-callback';
        const scope = 'profile email';
        const responseType = 'token id_token';
        const prompt = 'select_account';
        
        // Generate a random nonce
        const nonce = generateNonce();
        
        // Store the nonce in localStorage to verify later
        localStorage.setItem('auth_nonce', nonce);
        
        // Build the URL
        let url = 'https://accounts.google.com/o/oauth2/v2/auth';
        url += `?client_id=${encodeURIComponent(clientId)}`;
        url += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
        url += `&response_type=${encodeURIComponent(responseType)}`;
        url += `&scope=${encodeURIComponent(scope)}`;
        url += `&prompt=${encodeURIComponent(prompt)}`;
        url += `&state=${encodeURIComponent(window.location.pathname)}`;
        url += `&nonce=${encodeURIComponent(nonce)}`;
        
        // Redirect to Google's OAuth page
        window.location.href = url;
    });
}

/**
 * Generates a random nonce for OAuth security
 * @returns {string} A random string to use as nonce
 */
function generateNonce() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Handles Google Sign-In response
 * @param {Object} response - Google Sign-In response
 */
function handleGoogleSignIn(response) {
    // Parse the ID token
    const idToken = response.credential;
    
    // Decode the token to get user info
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    
    // Store the token
    localStorage.setItem('authToken', idToken);
    
    // Update the UI
    googleUser = payload;
    updateUI(true, payload);
}

/**
 * Signs out the current user
 */
function signOut() {
    // Clear auth token
    localStorage.removeItem('authToken');
    
    // Clear cached profile image
    localStorage.removeItem('cachedProfileImage');
    localStorage.removeItem('cachedProfileImageUserId');
    
    // Reset user
    googleUser = null;
    
    // Update UI
    updateUI(false, null);
    
    // Reload the page to reset any state
    window.location.reload();
}

/**
 * Initializes Google Sign-In
 */
function startGoogleAuth() {
    console.log('Starting Google Auth initialization...');
    
    // Check if we have a stored token
    const token = localStorage.getItem('authToken');
    
    if (token) {
        try {
            // Decode the token
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // Check if token is expired
            const expiryTime = payload.exp * 1000; // Convert to milliseconds
            if (Date.now() >= expiryTime) {
                console.log('Token expired, signing out');
                signOut();
                return;
            }
            
            // Token is valid, update UI
            googleUser = payload;
            console.log('Valid token found, user is authenticated:', payload.name || payload.email);
            updateUI(true, payload);
        } catch (e) {
            console.error('Error parsing token:', e);
            signOut();
        }
    } else {
        // No token, show sign-in button
        console.log('No auth token found, user is not authenticated');
        updateUI(false, null);
    }
}

/**
 * Checks URL for authentication response
 */
function checkUrlForAuthResponse() {
    // Check if we have a hash in the URL (from OAuth redirect)
    if (window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        
        // Check for id_token
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');
        const state = params.get('state');
        
        if (idToken && accessToken) {
            // Decode the token
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            
            // Verify the nonce if present
            const storedNonce = localStorage.getItem('auth_nonce');
            if (storedNonce && payload.nonce !== storedNonce) {
                console.error('Nonce mismatch in checkUrlForAuthResponse');
                // Continue anyway for now, but log the error
            }
            
            // Clean up the nonce
            localStorage.removeItem('auth_nonce');
            
            // Store the tokens
            localStorage.setItem('authToken', idToken);
            localStorage.setItem('accessToken', accessToken);
            
            // Update the UI
            googleUser = payload;
            updateUI(true, payload);
            
            // Clean up the URL
            if (history.replaceState) {
                // If state exists, redirect to that path
                if (state) {
                    history.replaceState(null, null, state);
                } else {
                    history.replaceState(null, null, window.location.pathname);
                }
            }
            
            return true;
        }
    }
    
    // Check for error in query parameters (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
        console.error('Authentication error:', error);
        alert('Authentication failed: ' + error);
        
        // Clean up the URL
        if (history.replaceState) {
            history.replaceState(null, null, window.location.pathname);
        }
        
        return true;
    }
    
    return false;
}

/**
 * Checks if user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
function isAuthenticated() {
    const token = localStorage.getItem('authToken');
    const isAuth = !!token;
    console.log('Authentication check:', isAuth, token ? 'Token exists' : 'No token');
    return isAuth;
}

/**
 * Gets the authentication token for API requests
 * @returns {string} The authentication token or empty string if not authenticated
 */
function getAuthToken() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log("No authentication token found");
        return '';
    }
    
    try {
        // Decode the token
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Check if token is expired
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        if (Date.now() >= expiryTime) {
            console.log('Token expired, removing');
            localStorage.removeItem('authToken');
            return '';
        }
        
        // Token is valid
        return token;
    } catch (e) {
        console.error('Error parsing token:', e);
        return '';
    }
}

/**
 * Gets the user ID from the authentication token
 * @returns {string} The user ID or 'anonymous' if not authenticated
 */
function getUserId() {
    try {
        const token = getAuthToken();
        if (!token) return 'anonymous';
        
        // Decode the JWT token (without verification)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        return payload.sub || 'anonymous';
    } catch (error) {
        console.error('Error getting user ID:', error);
        return 'anonymous';
    }
}

// Export functions for use in other modules
window.auth = {
    updateUI,
    createSignInButton,
    getConfig,
    initiateGoogleSignIn,
    handleGoogleSignIn,
    signOut,
    startGoogleAuth,
    checkUrlForAuthResponse,
    isAuthenticated,
    getAuthToken,
    getUserId
};
