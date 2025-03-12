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
    
    // Check for admin status and update the navigation bar
    if (isSignedIn) {
        updateAdminNavLink(profile);
    } else {
        // Remove admin link if it exists
        const adminLink = document.querySelector('.nav-links a[href="admin.html"]');
        if (adminLink) {
            adminLink.remove();
        }
    }
    
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
        
        // Add credits item
        const creditsItem = document.createElement('a');
        creditsItem.href = 'credits.html';
        creditsItem.className = 'dropdown-item';
        creditsItem.innerHTML = '<i class="fas fa-coins"></i>Credits';
        dropdownMenu.appendChild(creditsItem);
        
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
 * @param {string} containerId - Optional ID of the container to place the button in
 */
function createSignInButton(containerId) {
    // Get the container - either auth-section or the specified container
    const container = containerId ? document.getElementById(containerId) : document.getElementById('auth-section');
    if (!container) {
        console.error('Container not found for sign-in button:', containerId || 'auth-section');
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
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.margin = '20px 0';
    
    // Create the standard Google sign-in button
    const signInButton = document.createElement('button');
    signInButton.className = 'gsi-material-button';
    signInButton.addEventListener('click', initiateGoogleSignIn);
    
    // Create the button content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'gsi-material-button-content-wrapper';
    
    // Add Google's official logo
    const googleIcon = document.createElement('div');
    googleIcon.className = 'gsi-material-button-icon';
    googleIcon.innerHTML = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>';
    
    // Add the button text
    const buttonText = document.createElement('span');
    buttonText.className = 'gsi-material-button-text';
    buttonText.textContent = 'Sign in with Google';
    
    // Assemble the button
    contentWrapper.appendChild(googleIcon);
    contentWrapper.appendChild(buttonText);
    signInButton.appendChild(contentWrapper);
    
    // Add the button to the container
    buttonContainer.appendChild(signInButton);
    container.appendChild(buttonContainer);
}

/**
 * Gets configuration from the server
 * @returns {Promise<Object>} Configuration object
 */
function getConfig() {
    // Check if getApiUrl is defined, otherwise define it locally
    if (typeof getApiUrl !== 'function') {
        // Define getApiUrl function locally if it's not available
        window.getApiUrl = function(endpoint) {
            // Make sure endpoint starts with a slash
            if (!endpoint.startsWith('/')) {
                endpoint = '/' + endpoint;
            }
            
            // Get the base URL for API calls
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const baseUrl = isLocalhost ? 'http://localhost:8000' : 'https://pic2preset.com';
            return baseUrl + endpoint;
        };
    }
    
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
    
    // Store the token and user ID
    localStorage.setItem('authToken', idToken);
    localStorage.setItem('userId', payload.sub);
    
    // Update the UI
    googleUser = payload;
    updateUI(true, payload);
}

/**
 * Signs out the current user
 */
function signOut() {
    // Clear auth token and user ID
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    
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
        // Redirect to login if no token
        window.location.href = '/index.html';
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
            // Redirect to login if token expired
            window.location.href = '/index.html';
            return '';
        }
        
        // Token is valid
        return token;
    } catch (e) {
        console.error('Error parsing token:', e);
        // Redirect to login if token is invalid
        window.location.href = '/index.html';
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

/**
 * Checks if the current user has admin privileges
 * @returns {Promise<boolean>} Promise resolving to true if user is admin, false otherwise
 */
function isAdmin() {
    return new Promise((resolve) => {
        if (!isAuthenticated()) {
            console.log('User not authenticated, cannot be admin');
            resolve(false);
            return;
        }
        
        // Get the user's email from the token
        try {
            const token = getAuthToken();
            if (!token) {
                console.log('No auth token found, cannot be admin');
                resolve(false);
                return;
            }
            
            const payload = JSON.parse(atob(token.split('.')[1]));
            const email = payload.email;
            console.log('Checking admin status for email:', email);
            
            // For testing purposes - hardcode the admin email
            if (email && email.toLowerCase() === 'amlanc@gmail.com') {
                console.log('Admin email match found, user is admin');
                resolve(true);
                return;
            }
            
            // Check with the server if this user is an admin
            const apiUrl = getApiUrl('/api/user/is_admin');
            console.log('Checking admin status at URL:', apiUrl);
            
            fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(response => {
                    console.log('Admin check response status:', response.status);
                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Admin status check response:', data);
                    resolve(data.is_admin === true);
                })
                .catch(error => {
                    console.error('Error checking admin status:', error);
                    resolve(false);
                });
        } catch (error) {
            console.error('Error parsing token for admin check:', error);
            resolve(false);
        }
    });
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
    // Backward compatibility for older code still using getToken
    getToken: getAuthToken,
    getUserId,
    isAdmin
};

/**
 * Updates the navigation bar to show/hide the admin link based on user's admin status
 * @param {Object} profile - User profile information
 */
function updateAdminNavLink(profile) {
    if (!profile) {
        console.log('No profile provided to updateAdminNavLink');
        return;
    }
    
    console.log('Updating admin nav link for user:', profile.name);
    
    // Check if the user is an admin
    isAdmin().then(isAdmin => {
        console.log('Is admin check result:', isAdmin);
        
        // Find the navigation links container - handle both nav structures
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) {
            console.log('Nav links element not found');
            return;
        }
        
        console.log('Found nav-links element:', navLinks);
        
        // Remove existing admin link if it exists
        const existingAdminLink = document.querySelector('.nav-links a[href="admin.html"]');
        if (existingAdminLink) {
            console.log('Removing existing admin link');
            existingAdminLink.remove();
        }
        
        // Add admin link if user is an admin
        if (isAdmin) {
            console.log('User is admin, adding admin link');
            const dashboardLink = document.querySelector('.nav-links a[href="dashboard.html"]');
            console.log('Dashboard link found:', !!dashboardLink);
            
            // Create admin link
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.innerHTML = '<i class="fas fa-cog"></i> Admin';
            
            // Add active class if on admin page
            if (window.location.pathname.endsWith('admin.html')) {
                adminLink.classList.add('active');
                // Remove active class from dashboard link if it exists
                if (dashboardLink) {
                    dashboardLink.classList.remove('active');
                }
            }
            
            // Insert admin link after dashboard link
            if (dashboardLink && dashboardLink.nextSibling) {
                console.log('Inserting admin link after dashboard link');
                navLinks.insertBefore(adminLink, dashboardLink.nextSibling);
            } else {
                console.log('Appending admin link to nav links');
                navLinks.appendChild(adminLink);
            }
            console.log('Admin link added successfully');
        } else {
            console.log('User is not an admin, no admin link added');
        }
    }).catch(error => {
        console.error('Error checking admin status:', error);
    });
}

// Initialize auth module
startGoogleAuth();
checkUrlForAuthResponse();

// Initialize auth when the script loads
document.addEventListener('DOMContentLoaded', () => {
    startGoogleAuth();
    checkUrlForAuthResponse();
});
