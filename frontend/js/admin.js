/**
 * Admin Dashboard JavaScript
 * Handles user management, transaction history, and analytics
 */

document.addEventListener('DOMContentLoaded', () => {
    // Make sure auth module is initialized first
    if (typeof auth === 'undefined') {
        console.error('Auth module not loaded. Make sure auth.js is included before admin.js');
        return;
    }
    
    // Check if user is admin before loading admin content
    checkAdminAccess();

    // Tab navigation
    setupTabNavigation();

    // Setup modals
    setupModals();
    
    // Create toast container
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
});

/**
 * Check if the current user has admin access
 */
function checkAdminAccess() {
    // Check if user is authenticated
    if (!auth.isAuthenticated()) {
        // Redirect to login page with admin.html as the redirect target
        window.location.href = 'login.html?redirect=admin.html';
        return;
    }
    
    // Use the isAdmin function from auth.js
    auth.isAdmin().then(isAdmin => {
        if (isAdmin) {
            // User is admin, load admin content
            loadAdminContent();
        } else {
            // User is not an admin, redirect to dashboard
            alert('You do not have admin privileges to access this page.');
            window.location.href = 'dashboard.html';
        }
    }).catch(error => {
        console.error('Error checking admin access:', error);
        showToast('Error checking admin access. Please try again later.', 'error');
        window.location.href = 'dashboard.html';
    });
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, info)
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <span class="close-toast">&times;</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Close button functionality
    toast.querySelector('.close-toast').addEventListener('click', () => {
        toastContainer.removeChild(toast);
    });
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode === toastContainer) {
            toastContainer.removeChild(toast);
        }
    }, duration);
}

/**
 * Load all admin content
 */
function loadAdminContent() {
    // Load users
    loadUsers();

    // Load transactions
    loadTransactions();

    // Load analytics
    loadAnalytics();

    // Setup event listeners
    setupEventListeners();
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

/**
 * Load users data
 */
function loadUsers() {
    const token = auth.getAuthToken();
    const tableBody = document.getElementById('users-table-body');
    
    tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading users...</td></tr>';
    
    // Fetch users from API
    fetch('/api/admin/users?include_credits=true', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        // Clear the table
        tableBody.innerHTML = '';
        
        // Always show the current admin user first
        const adminEmail = getCurrentUserEmail() || 'amlanc@gmail.com';
        displayCurrentAdminUser(tableBody, adminEmail);
        
        // Display other users
        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                // Skip the current admin user as it's already displayed
                if (user.email === adminEmail) return;
                
                displayUserRow(tableBody, user);
            });
        }
    })
    .catch(error => {
        console.error('Error loading users:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Error loading users. Please try again.</td></tr>';
        
        // Still show admin user even if other users fail to load
        const adminEmail = getCurrentUserEmail() || 'amlanc@gmail.com';
        displayCurrentAdminUser(tableBody, adminEmail);
    });
}

/**
 * Get the current user's email from the auth token
 */
function getCurrentUserEmail() {
    try {
        const token = auth.getAuthToken();
        if (!token) return null;
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email;
    } catch (error) {
        console.error('Error getting user email:', error);
        return null;
    }
}

/**
 * Display the current admin user in the table
 */
function displayCurrentAdminUser(tableBody, email) {
    tableBody.innerHTML = '';
    const row = document.createElement('tr');
    
    // Format date with time: YYYY-MM-DD HH:MM
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 10) + ' ' + 
                         now.toTimeString().slice(0, 5);
    
    // Get the current user ID from the auth token
    let userId = 'current-admin';
    try {
        const token = auth.getAuthToken();
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.sub || userId;
        }
    } catch (error) {
        console.error('Error getting user ID:', error);
    }
    
    row.innerHTML = `
        <td>${email}</td>
        <td>${formattedDate}</td>
        <td>Unlimited</td>
        <td><span class="user-badge badge-admin">Admin</span></td>
        <td class="user-actions">
            <button class="action-button add-credits-btn" data-user-id="${userId}">Add Credits</button>
        </td>
    `;
    
    tableBody.appendChild(row);
    
    // Setup event listeners for the new buttons
    setupUserActionButtons();
}

/**
 * Display a user row in the table
 * @param {HTMLElement} tableBody - The table body element
 * @param {Object} user - User data object
 */
function displayUserRow(tableBody, user) {
    if (!user || !user.email) return;
    
    const row = document.createElement('tr');
    
    // Format date with time: YYYY-MM-DD HH:MM
    let formattedDate = 'Unknown';
    if (user.created_at) {
        const date = new Date(user.created_at);
        formattedDate = date.toISOString().slice(0, 10) + ' ' + 
                        date.toTimeString().slice(0, 5);
    }
    
    // Determine user type
    let userType = 'Regular';
    let userBadgeClass = 'badge-regular';
    
    if (user.is_admin) {
        userType = 'Admin';
        userBadgeClass = 'badge-admin';
    } else if (user.is_test) {
        userType = 'Test';
        userBadgeClass = 'badge-test';
    }
    
    // Create action buttons based on user type
    let actionButtons = `
        <button class="action-button add-credits-btn" data-user-id="${user.id}">Add Credits</button>
    `;
    
    if (!user.is_admin) {
        actionButtons += `
            <button class="action-button make-admin-btn" data-email="${user.email}">Make Admin</button>
        `;
    } else {
        actionButtons += `
            <button class="action-button danger remove-admin-btn" data-email="${user.email}">Remove Admin</button>
        `;
    }
    
    if (!user.is_test) {
        actionButtons += `
            <button class="action-button secondary add-test-btn" data-email="${user.email}">Make Test</button>
        `;
    } else {
        actionButtons += `
            <button class="action-button secondary danger remove-test-btn" data-email="${user.email}">Remove Test</button>
        `;
    }
    
    row.innerHTML = `
        <td>${user.email}</td>
        <td>${formattedDate}</td>
        <td>${user.credits || 0}</td>
        <td><span class="user-badge ${userBadgeClass}">${userType}</span></td>
        <td class="user-actions">${actionButtons}</td>
    `;
    
    tableBody.appendChild(row);
}

/**
 * Load transaction history
 */
function loadTransactions() {
    const token = auth.getAuthToken();
    const tableBody = document.getElementById('transactions-table-body');
    const daysFilter = document.getElementById('transaction-days-filter')?.value || '30';
    const typeFilter = document.getElementById('transaction-type-filter')?.value || '';
    
    if (!tableBody) {
        console.error('Transactions table body not found');
        return;
    }
    
    tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading transactions...</td></tr>';
    
    let url = `/api/admin/transactions?days=${daysFilter}`;
    if (typeFilter) {
        url += `&type=${typeFilter}`;
    }
    
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.transactions && data.transactions.length > 0) {
            tableBody.innerHTML = '';
            
            data.transactions.forEach(transaction => {
                const row = document.createElement('tr');
                
                // Format date
                const transactionDate = new Date(transaction.created_at).toLocaleString();
                
                // Format transaction type
                let transactionType = transaction.transaction_type;
                if (transactionType === 'purchase') {
                    transactionType = 'Credit Purchase';
                } else if (transactionType === 'preset_creation') {
                    transactionType = 'Preset Creation';
                } else if (transactionType === 'preset_download') {
                    transactionType = 'Preset Download';
                } else if (transactionType === 'admin_grant') {
                    transactionType = 'Admin Credit Grant';
                }
                
                // Format credits (positive or negative)
                const creditsClass = transaction.credits_amount >= 0 ? 'positive-credits' : 'negative-credits';
                const creditsSign = transaction.credits_amount >= 0 ? '+' : '';
                
                row.innerHTML = `
                    <td>${transactionDate}</td>
                    <td>${transaction.user_email || 'Unknown'}</td>
                    <td>${transactionType}</td>
                    <td class="${creditsClass}">${creditsSign}${transaction.credits_amount}</td>
                    <td>${transaction.reference_id || '-'}</td>
                `;
                
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">No transactions found</td></tr>';
        }
    })
    .catch(error => {
        console.error('Error loading transactions:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Error loading transactions. Please try again.</td></tr>';
        showToast('Error loading transactions. Please try again.', 'error');
    });
}

/**
 * Load analytics data
 */
function loadAnalytics() {
    const token = auth.getAuthToken();
    const days = document.getElementById('analytics-period')?.value || '30';
    
    // Check if analytics elements exist
    const totalUsersElement = document.getElementById('total-users');
    const activeUsersElement = document.getElementById('active-users');
    const creditsSoldElement = document.getElementById('credits-sold');
    const presetsCreatedElement = document.getElementById('presets-created');
    
    if (!totalUsersElement || !activeUsersElement || !creditsSoldElement || !presetsCreatedElement) {
        console.error('Analytics elements not found');
        return;
    }
    
    // Set loading state
    totalUsersElement.textContent = 'Loading...';
    activeUsersElement.textContent = 'Loading...';
    creditsSoldElement.textContent = 'Loading...';
    presetsCreatedElement.textContent = 'Loading...';
    
    // Load summary data
    fetch(`/api/admin/users?include_credits=false`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.users) {
            totalUsersElement.textContent = data.users.length;
        } else {
            totalUsersElement.textContent = '0';
        }
    })
    .catch(error => {
        console.error('Error loading user analytics:', error);
        totalUsersElement.textContent = 'Error';
        showToast('Error loading user analytics. Please try again.', 'error');
    });
    
    // Load transaction data for analytics
    fetch(`/api/admin/transactions?days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.transactions && data.transactions.length > 0) {
            // Calculate active users (users with any transaction in the period)
            const activeUsers = new Set();
            let creditsSold = 0;
            let presetsCreated = 0;
            
            // Process transactions for analytics
            data.transactions.forEach(transaction => {
                if (transaction.user_id) {
                    activeUsers.add(transaction.user_id);
                }
                
                if (transaction.transaction_type === 'purchase') {
                    creditsSold += transaction.credits_amount || 0;
                } else if (transaction.transaction_type === 'preset_creation') {
                    presetsCreated++;
                }
            });
            
            // Update analytics cards
            activeUsersElement.textContent = activeUsers.size;
            creditsSoldElement.textContent = creditsSold;
            presetsCreatedElement.textContent = presetsCreated;
            
            // Create activity chart
            createActivityChart(data.transactions, days);
        } else {
            // No transactions found
            activeUsersElement.textContent = '0';
            creditsSoldElement.textContent = '0';
            presetsCreatedElement.textContent = '0';
        }
    })
    .catch(error => {
        console.error('Error loading transaction analytics:', error);
        activeUsersElement.textContent = 'Error';
        creditsSoldElement.textContent = 'Error';
        presetsCreatedElement.textContent = 'Error';
        showToast('Error loading transaction analytics. Please try again.', 'error');
    });
}

/**
 * Create activity chart
 */
function createActivityChart(transactions, days) {
    // Check if chart element exists
    const chartElement = document.getElementById('activity-chart');
    if (!chartElement) {
        console.error('Activity chart element not found');
        return;
    }
    
    try {
        // Group transactions by date
        const dateGroups = {};
        const transactionTypes = ['purchase', 'preset_creation', 'preset_download', 'admin_grant'];
        
        // Create date range for the chart
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days || 30));
        
        // Initialize all dates in the range
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dateGroups[dateStr] = {
                purchase: 0,
                preset_creation: 0,
                preset_download: 0,
                admin_grant: 0
            };
        }
        
        // Group transactions by date and type
        transactions.forEach(transaction => {
            if (!transaction.created_at) return;
            
            try {
                const date = new Date(transaction.created_at).toISOString().split('T')[0];
                if (dateGroups[date]) {
                    if (transaction.transaction_type === 'purchase') {
                        dateGroups[date].purchase++;
                    } else if (transaction.transaction_type === 'preset_creation') {
                        dateGroups[date].preset_creation++;
                    } else if (transaction.transaction_type === 'preset_download') {
                        dateGroups[date].preset_download++;
                    } else if (transaction.transaction_type === 'admin_grant') {
                        dateGroups[date].admin_grant++;
                    }
                }
            } catch (e) {
                console.error('Error processing transaction date:', e);
            }
        });
        
        // Prepare data for Chart.js
        const labels = Object.keys(dateGroups).sort();
        const purchaseData = labels.map(date => dateGroups[date].purchase);
        const creationData = labels.map(date => dateGroups[date].preset_creation);
        const downloadData = labels.map(date => dateGroups[date].preset_download);
        const adminGrantData = labels.map(date => dateGroups[date].admin_grant);
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }
        
        // Create chart
        const ctx = chartElement.getContext('2d');
        
        // Destroy existing chart if it exists
        if (window.activityChart) {
            window.activityChart.destroy();
        }
        
        window.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Credit Purchases',
                        data: purchaseData,
                        borderColor: '#4a90e2',
                        backgroundColor: 'rgba(74, 144, 226, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Preset Creations',
                        data: creationData,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Preset Downloads',
                        data: downloadData,
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243, 156, 18, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Admin Credit Grants',
                        data: adminGrantData,
                        borderColor: '#9b59b6',
                        backgroundColor: 'rgba(155, 89, 182, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating activity chart:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // User search
    const userSearch = document.getElementById('user-search');
    userSearch.addEventListener('input', () => {
        const searchTerm = userSearch.value.toLowerCase();
        const rows = document.querySelectorAll('#users-table-body tr');
        
        rows.forEach(row => {
            const email = row.querySelector('td:first-child')?.textContent.toLowerCase() || '';
            if (email.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
    
    // Transaction filters
    document.getElementById('transaction-type-filter').addEventListener('change', loadTransactions);
    document.getElementById('transaction-days-filter').addEventListener('change', loadTransactions);
    
    // Analytics period
    document.getElementById('analytics-period').addEventListener('change', loadAnalytics);
    
    // Download transactions as CSV
    document.getElementById('download-transactions').addEventListener('click', downloadTransactionsCSV);
    
    // Add admin button
    document.querySelector('.admin-header').insertAdjacentHTML('beforeend', `
        <div class="admin-actions">
            <button id="add-admin-button" class="action-button">Add Admin User</button>
            <button id="add-test-account-button" class="action-button secondary">Add Test Account</button>
        </div>
    `);
    
    document.getElementById('add-admin-button').addEventListener('click', () => {
        document.getElementById('add-admin-modal').style.display = 'flex';
    });
    
    document.getElementById('add-test-account-button').addEventListener('click', () => {
        document.getElementById('add-test-account-modal').style.display = 'flex';
    });
}

/**
 * Setup user action buttons
 */
function setupUserActionButtons() {
    // Add credits buttons
    document.querySelectorAll('.add-credits-btn').forEach(button => {
        button.addEventListener('click', () => {
            const userId = button.getAttribute('data-user-id');
            const userRow = button.closest('tr');
            const userEmail = userRow.cells[0].textContent.trim();
            
            document.getElementById('user-id-for-credits').value = userId;
            document.getElementById('user-email-for-credits').value = userEmail;
            document.getElementById('credits-user-email').querySelector('span').textContent = userEmail;
            document.getElementById('add-credits-modal').style.display = 'flex';
        });
    });
    
    // Make admin buttons
    document.querySelectorAll('.make-admin-btn').forEach(button => {
        button.addEventListener('click', () => {
            const email = button.getAttribute('data-email');
            addAdminUser(email);
        });
    });
    
    // Remove admin buttons
    document.querySelectorAll('.remove-admin-btn').forEach(button => {
        button.addEventListener('click', () => {
            const email = button.getAttribute('data-email');
            removeAdminUser(email);
        });
    });
    
    // Make test buttons
    document.querySelectorAll('.make-test-btn').forEach(button => {
        button.addEventListener('click', () => {
            const email = button.getAttribute('data-email');
            addTestAccount(email);
        });
    });
    
    // Remove test buttons
    document.querySelectorAll('.remove-test-btn').forEach(button => {
        button.addEventListener('click', () => {
            const email = button.getAttribute('data-email');
            removeTestAccount(email);
        });
    });
}

/**
 * Setup modals
 */
function setupModals() {
    // Close modals
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Add credits form
    document.getElementById('add-credits-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const userId = document.getElementById('user-id-for-credits').value;
        const creditsAmount = document.getElementById('credits-amount').value;
        addCreditsToUser(userId, creditsAmount);
    });
    
    // Add admin form
    document.getElementById('add-admin-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('admin-email').value;
        addAdminUser(email);
    });
    
    // Add test account form
    document.getElementById('add-test-account-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('test-account-email').value;
        addTestAccount(email);
    });
}

/**
 * Add credits to a user
 */
function addCreditsToUser(userId, creditsAmount) {
    const token = auth.getAuthToken();
    const userEmail = document.getElementById('user-email-for-credits').value;
    
    fetch(`/api/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credits_amount: creditsAmount })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || `${creditsAmount} credits added successfully to ${userEmail}`, 'success');
            document.getElementById('add-credits-modal').style.display = 'none';
            loadUsers();
            loadTransactions();
        } else {
            showToast(data.error || 'Failed to add credits', 'error');
        }
    })
    .catch(error => {
        console.error('Error adding credits:', error);
        showToast('Error adding credits. Please try again.', 'error');
    });
}

/**
 * Add admin user
 */
function addAdminUser(email) {
    const token = auth.getAuthToken();
    
    fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || `Admin user ${email} added successfully`, 'success');
            document.getElementById('add-admin-modal').style.display = 'none';
            document.getElementById('admin-email').value = '';
            loadUsers();
        } else {
            showToast(data.error || 'Failed to add admin user', 'error');
        }
    })
    .catch(error => {
        console.error('Error adding admin user:', error);
        showToast('Error adding admin user. Please try again.', 'error');
    });
}

/**
 * Remove admin user
 */
function removeAdminUser(email) {
    if (!confirm(`Are you sure you want to remove admin privileges from ${email}?`)) {
        return;
    }
    
    const token = auth.getAuthToken();
    
    fetch(`/api/admin/admins/${email}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || `Admin privileges removed from ${email}`, 'success');
            loadUsers();
        } else {
            showToast(data.error || 'Failed to remove admin user', 'error');
        }
    })
    .catch(error => {
        console.error('Error removing admin user:', error);
        showToast('Error removing admin user. Please try again.', 'error');
    });
}

/**
 * Add test account
 */
function addTestAccount(email) {
    const token = auth.getAuthToken();
    
    fetch('/api/admin/test-accounts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || `Test account ${email} added successfully`, 'success');
            document.getElementById('add-test-account-modal').style.display = 'none';
            document.getElementById('test-account-email').value = '';
            loadUsers();
        } else {
            showToast(data.error || 'Failed to add test account', 'error');
        }
    })
    .catch(error => {
        console.error('Error adding test account:', error);
        showToast('Error adding test account. Please try again.', 'error');
    });
}

/**
 * Remove test account
 */
function removeTestAccount(email) {
    if (!confirm(`Are you sure you want to remove test status from ${email}?`)) {
        return;
    }
    
    const token = auth.getAuthToken();
    
    fetch(`/api/admin/test-accounts/${email}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || 'Test account removed successfully', 'success');
            loadUsers();
        } else {
            showToast(data.error || 'Failed to remove test account', 'error');
        }
    })
    .catch(error => {
        console.error('Error removing test account:', error);
        showToast('Error removing test account. Please try again.', 'error');
    });
}

/**
 * Download transactions as CSV
 */
function downloadTransactionsCSV() {
    const token = auth.getAuthToken();
    const daysFilter = document.getElementById('transaction-days-filter').value;
    const typeFilter = document.getElementById('transaction-type-filter').value;
    
    let url = `/api/admin/transactions?days=${daysFilter}`;
    if (typeFilter) {
        url += `&type=${typeFilter}`;
    }
    
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.transactions && data.transactions.length > 0) {
            // Create CSV content
            const headers = ['Date', 'User Email', 'Transaction Type', 'Credits Amount', 'Reference ID'];
            let csvContent = headers.join(',') + '\n';
            
            data.transactions.forEach(transaction => {
                const date = new Date(transaction.created_at).toLocaleString();
                const type = transaction.transaction_type;
                const row = [
                    `"${date}"`,
                    `"${transaction.user_email}"`,
                    `"${type}"`,
                    transaction.credits_amount,
                    `"${transaction.reference_id || ''}"`
                ];
                
                csvContent += row.join(',') + '\n';
            });
            
            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            showToast('No transactions to download', 'info');
        }
    })
    .catch(error => {
        console.error('Error downloading transactions:', error);
        showToast('Error downloading transactions. Please try again.', 'error');
    });
}
