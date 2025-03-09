/**
 * Utilities Module
 * Contains helper functions used across the application
 */

/**
 * Gets the API URL for a given endpoint
 * @param {string} endpoint - API endpoint
 * @returns {string} Full API URL
 */
function getApiUrl(endpoint) {
    // Make sure endpoint starts with a slash
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }
    
    // Get the base URL for API calls
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? 'http://localhost:8000' : 'https://pic2preset.com';
    return baseUrl + endpoint;
}

/**
 * Starts the AI progress animation
 */
function startAIProgressAnimation() {
    const aiProcessingContainer = document.getElementById('aiProcessingContainer');
    if (aiProcessingContainer) {
        aiProcessingContainer.style.display = 'flex';
        
        // Get all steps
        const steps = document.querySelectorAll('.ai-step');
        const totalSteps = steps.length;
        let currentStep = 0;
        
        // Clear any existing animation
        steps.forEach(step => {
            step.classList.remove('active');
        });
        
        // Function to animate a single step
        function animateStep() {
            // Reset previous step if we're looping back to the beginning
            if (currentStep === 0) {
                steps.forEach(step => {
                    step.classList.remove('active');
                });
            }
            
            // Activate current step
            steps[currentStep].classList.add('active');
            
            // Move to next step
            currentStep = (currentStep + 1) % totalSteps;
            
            // If we've reached the end of the sequence, wait a bit longer before restarting
            const delay = currentStep === 0 ? 2000 : 1000;
            
            // Continue the animation loop
            setTimeout(animateStep, delay);
        }
        
        // Start the animation
        animateStep();
    } else {
        console.error('AI processing container not found');
    }
}

/**
 * Stops the AI progress animation
 */
function stopAIProgressAnimation() {
    const aiProcessingContainer = document.getElementById('aiProcessingContainer');
    if (aiProcessingContainer) {
        // Make all steps active to show completion
        const steps = document.querySelectorAll('.ai-step');
        steps.forEach(step => {
            step.classList.add('active');
        });
        
        // Hide container after a short delay
        setTimeout(() => {
            aiProcessingContainer.style.display = 'none';
            
            // Reset for next time
            steps.forEach(step => {
                step.classList.remove('active');
            });
        }, 1000);
    } else {
        console.error('AI processing container not found');
    }
}

/**
 * Formats a date string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Formats a price
 * @param {number} price - Price in cents
 * @returns {string} Formatted price
 */
function formatPrice(price) {
    return (price / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
    });
}

/**
 * Gets a URL parameter
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Debounces a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Creates a notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
function createNotification(message, type = 'info', duration = 3000) {
    // Get or create notifications container
    let notificationsContainer = document.getElementById('notifications-container');
    if (!notificationsContainer) {
        notificationsContainer = document.createElement('div');
        notificationsContainer.id = 'notifications-container';
        document.body.appendChild(notificationsContainer);
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
        notification.classList.add('hiding');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    notification.appendChild(closeButton);
    
    // Add to container
    notificationsContainer.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.add('hiding');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }
    
    return notification;
}

/**
 * Truncates text to a specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

/**
 * Validates an email address
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Copies text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
}

/**
 * Generates a random ID
 * @param {number} length - ID length
 * @returns {string} Random ID
 */
function generateRandomId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/**
 * Formats a parameter label
 * @param {string} key - Parameter key
 * @returns {string} Formatted label
 */
function formatLabel(key) {
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Formats a parameter value
 * @param {any} value - Parameter value
 * @returns {string} Formatted value
 */
function formatValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    
    // Handle numbers with decimal precision
    if (typeof value === 'number') {
        // If it's a whole number or close to it
        if (Math.abs(value - Math.round(value)) < 0.001) {
            return Math.round(value).toString();
        }
        // Otherwise format with up to 2 decimal places
        return value.toFixed(2);
    }
    
    // Handle booleans
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    
    // Handle objects (shouldn't happen, but just in case)
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return '[Object]';
        }
    }
    
    // Default: convert to string
    return value.toString();
}

/**
 * Converts a Lightroom temperature slider value to Kelvin
 * @param {number} lrValue - Lightroom temperature slider value (-100 to +100)
 * @returns {number} - Temperature in Kelvin
 */
function convertLightroomTemperatureToKelvin(lrValue) {
    // Base temperature (5500K)
    const baseTemp = 5500;
    
    // Convert the slider value to a multiplier
    // -100 -> 0.5x (cooler)
    // 0 -> 1x (neutral)
    // +100 -> 2x (warmer)
    const multiplier = lrValue >= 0 
        ? 1 + (lrValue / 100) // For positive values: 1.0 to 2.0
        : 1 + (lrValue / 200); // For negative values: 0.5 to 1.0
    
    // Apply the multiplier to the base temperature
    return Math.round(baseTemp * multiplier);
}

// Export functions for use in other modules
window.utils = {
    getApiUrl,
    startAIProgressAnimation,
    stopAIProgressAnimation,
    formatDate,
    formatPrice,
    getUrlParameter,
    debounce,
    createNotification,
    truncateText,
    validateEmail,
    copyToClipboard,
    generateRandomId,
    formatLabel,
    formatValue,
    convertLightroomTemperatureToKelvin
};
