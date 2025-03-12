/**
 * Credits management system for LR Preset
 * Handles displaying credit balance, purchasing credits, and credit-related UI
 */

// Credit system configuration
const CREDITS_PER_PACK = 10;
const PRICE_PER_PACK = 9.99;

// Store the user's credit information
let userCredits = {
    balance: 0,
    isTestAccount: false,
    totalEarned: 0,
    lastUpdate: ''
};

/**
 * Initialize the credit system UI
 * This should be called after user authentication
 */
function initCreditSystem() {
    // Add credit display to the navbar if it doesn't exist
    if (!document.getElementById('credit-display')) {
        const navbarRight = document.querySelector('.navbar-right');
        if (navbarRight) {
            const creditDisplay = document.createElement('div');
            creditDisplay.id = 'credit-display';
            creditDisplay.className = 'credit-display';
            creditDisplay.innerHTML = `
                <span class="credit-icon">💎</span>
                <span class="credit-balance">Loading...</span>
            `;
            navbarRight.prepend(creditDisplay);
            
            // Add click event to navigate to purchase page
            creditDisplay.addEventListener('click', () => {
                window.location.href = '/credits.html';
            });
        }
    }
    
    // Fetch the user's credit balance
    fetchCreditBalance();
}

/**
 * Fetch the user's credit balance from the server
 */
function fetchCreditBalance() {
    const userId = localStorage.getItem('user_id');
    const userEmail = localStorage.getItem('user_email');
    
    if (!userId) {
        console.error('User ID not found in localStorage');
        return;
    }
    
    fetch(`/api/credits?user_id=${userId}&email=${userEmail || ''}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch credit balance');
            }
            return response.json();
        })
        .then(data => {
            // Update the stored credit information
            userCredits = {
                balance: data.credits.balance,
                isTestAccount: data.credits.is_test_account,
                totalEarned: data.credits.total_earned,
                lastUpdate: data.credits.last_update
            };
            
            // Update the credit display in the navbar
            updateCreditDisplay();
        })
        .catch(error => {
            console.error('Error fetching credit balance:', error);
            // Set a default value on error
            updateCreditDisplay('Error');
        });
}

/**
 * Update the credit display in the navbar
 * @param {string} [customText] - Optional custom text to display instead of the balance
 */
function updateCreditDisplay(customText) {
    const creditBalance = document.querySelector('.credit-balance');
    if (creditBalance) {
        if (customText) {
            creditBalance.textContent = customText;
        } else if (userCredits.isTestAccount) {
            creditBalance.textContent = 'Unlimited';
        } else {
            creditBalance.textContent = userCredits.balance;
        }
    }
}

/**
 * Check if the user has enough credits for an operation
 * @param {number} requiredCredits - Number of credits required
 * @returns {boolean} - Whether the user has enough credits
 */
function hasEnoughCredits(requiredCredits = 1) {
    // Test accounts always have enough credits
    if (userCredits.isTestAccount) {
        return true;
    }
    
    // Check if the user has enough credits
    return userCredits.balance >= requiredCredits;
}

/**
 * Show a modal to inform the user they need more credits
 * @param {function} [onPurchase] - Callback to execute if the user chooses to purchase credits
 */
function showNeedMoreCreditsModal(onPurchase) {
    // Create modal overlay if it doesn't exist
    let modalOverlay = document.getElementById('credit-modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'credit-modal-overlay';
        modalOverlay.className = 'modal-overlay';
        document.body.appendChild(modalOverlay);
    }
    
    // Create modal content
    modalOverlay.innerHTML = `
        <div class="modal-content credit-modal">
            <div class="modal-header">
                <h2>Insufficient Credits</h2>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <div class="credit-icon-large">💎</div>
                <p>You need at least 1 credit to create a preset.</p>
                <p>Purchase more credits to continue creating amazing presets!</p>
                <div class="credit-actions">
                    <button id="go-to-credits" class="primary-button">Purchase Credits</button>
                    <button id="cancel-credits" class="secondary-button">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Show the modal
    modalOverlay.style.display = 'flex';
    
    // Add event listeners
    const closeButton = modalOverlay.querySelector('.close-button');
    const cancelButton = document.getElementById('cancel-credits');
    const purchaseButton = document.getElementById('go-to-credits');
    
    // Close modal function
    const closeModal = () => {
        modalOverlay.style.display = 'none';
    };
    
    // Add event listeners
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    
    // Purchase button redirects to credits page
    purchaseButton.addEventListener('click', () => {
        window.location.href = 'credits.html';
        if (typeof onPurchase === 'function') {
            onPurchase();
        }
    });
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'need-credits-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>More Credits Needed</h2>
                <p>You need at least 1 credit to create a preset.</p>
                <p>Would you like to purchase more credits?</p>
                <div class="modal-buttons">
                    <button id="purchase-credits-btn" class="btn btn-primary">Purchase Credits</button>
                    <button id="cancel-purchase-btn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.querySelector('#cancel-purchase-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.querySelector('#purchase-credits-btn').addEventListener('click', () => {
            modal.style.display = 'none';
            if (onPurchase) {
                onPurchase();
            } else {
                window.location.href = '/credits.html';
            }
        });
    }
    
    // Show the modal
    modal.style.display = 'block';
}

/**
 * Initialize the credits purchase page
 * This should be called on the credits.html page
 */
function initCreditsPurchasePage() {
    // Fetch the user's credit balance
    fetchCreditBalance();
    
    // Set up the purchase form
    const purchaseForm = document.getElementById('purchase-form');
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', handleCreditPurchase);
    }
    
    // Update the price display when the quantity changes
    const quantityInput = document.getElementById('credit-packs');
    const totalPriceDisplay = document.getElementById('total-price');
    
    if (quantityInput && totalPriceDisplay) {
        quantityInput.addEventListener('change', () => {
            const quantity = parseInt(quantityInput.value, 10);
            const totalPrice = (quantity * PRICE_PER_PACK).toFixed(2);
            totalPriceDisplay.textContent = `$${totalPrice}`;
        });
        
        // Trigger the change event to set the initial price
        quantityInput.dispatchEvent(new Event('change'));
    }
    
    // Display the user's current credit balance
    const currentBalanceDisplay = document.getElementById('current-balance');
    if (currentBalanceDisplay) {
        // Update the balance display when credits are fetched
        const updateBalanceInterval = setInterval(() => {
            if (userCredits.isTestAccount) {
                currentBalanceDisplay.textContent = 'Unlimited';
                clearInterval(updateBalanceInterval);
            } else if (userCredits.balance !== 0 || userCredits.balance === 0) {
                currentBalanceDisplay.textContent = userCredits.balance;
                clearInterval(updateBalanceInterval);
            }
        }, 100);
    }
    
    // Hide purchase form for test accounts
    if (userCredits.isTestAccount) {
        const purchaseContainer = document.querySelector('.purchase-container');
        if (purchaseContainer) {
            purchaseContainer.innerHTML = `
                <div class="test-account-message">
                    <h2>Test Account</h2>
                    <p>You are using a test account with unlimited credits.</p>
                    <p>No purchase is necessary.</p>
                </div>
            `;
        }
    }
}

/**
 * Handle the credit purchase form submission
 * @param {Event} event - The form submission event
 */
function handleCreditPurchase(event) {
    event.preventDefault();
    
    const userId = localStorage.getItem('user_id');
    if (!userId) {
        showError('User ID not found. Please log in again.');
        return;
    }
    
    // Get the number of credit packs to purchase
    const creditPacks = parseInt(document.getElementById('credit-packs').value, 10);
    
    // Check if EULA is accepted
    const eulaAccepted = document.getElementById('eula-checkbox').checked;
    if (!eulaAccepted) {
        showError('You must accept the End User License Agreement to proceed.');
        return;
    }
    
    // Show loading state
    const submitButton = document.querySelector('#purchase-form button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;
    
    // Create the checkout session
    fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            credit_packs: creditPacks,
            success_url: `${window.location.origin}/purchase-success.html`,
            cancel_url: `${window.location.origin}/credits.html`
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create checkout session');
        }
        return response.json();
    })
    .then(data => {
        // Redirect to the checkout page
        window.location.href = data.url;
    })
    .catch(error => {
        console.error('Error creating checkout session:', error);
        showError('Failed to create checkout session. Please try again.');
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
    });
}

/**
 * Show an error message on the purchase page
 * @param {string} message - The error message to display
 */
function showError(message) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        // Hide the error after 5 seconds
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

/**
 * Verify a credit purchase on the success page
 * This should be called on the purchase-success.html page
 */
function verifyPurchase() {
    // Get the session ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (!sessionId) {
        showPurchaseResult(false, 'No session ID found in URL');
        return;
    }
    
    // Verify the purchase
    fetch(`/api/credits/verify?session_id=${sessionId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Payment verification failed');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showPurchaseResult(true);
                
                // Update the credit balance
                fetchCreditBalance();
            } else {
                showPurchaseResult(false, 'Payment verification failed');
            }
        })
        .catch(error => {
            console.error('Error verifying purchase:', error);
            showPurchaseResult(false, 'Error verifying purchase');
        });
}

/**
 * Show the purchase result on the success page
 * @param {boolean} success - Whether the purchase was successful
 * @param {string} [errorMessage] - Error message to display if the purchase failed
 */
function showPurchaseResult(success, errorMessage) {
    const resultContainer = document.getElementById('purchase-result');
    if (resultContainer) {
        if (success) {
            resultContainer.innerHTML = `
                <div class="success-message">
                    <h2>Purchase Successful!</h2>
                    <p>Your credits have been added to your account.</p>
                    <p><a href="/dashboard.html">Return to Dashboard</a></p>
                </div>
            `;
        } else {
            resultContainer.innerHTML = `
                <div class="error-message">
                    <h2>Purchase Failed</h2>
                    <p>${errorMessage || 'An error occurred during the purchase process.'}</p>
                    <p><a href="/credits.html">Try Again</a> or <a href="/dashboard.html">Return to Dashboard</a></p>
                </div>
            `;
        }
    }
}

// Export functions for use in other files
window.creditSystem = {
    initCreditSystem,
    fetchCreditBalance,
    hasEnoughCredits,
    showNeedMoreCreditsModal,
    initCreditsPurchasePage,
    verifyPurchase
};
