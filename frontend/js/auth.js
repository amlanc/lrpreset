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
