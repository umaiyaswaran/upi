// ===== GLOBAL STATE =====
let isLoggedIn = false;
let currentUser = null;
let authToken = null;
const API_URL = 'http://localhost:3000/api';

// Exchange rates (static mock data)
const exchangeRates = {
    'INR_to_USD': 0.012,
    'INR_to_EUR': 0.011,
    'USD_to_INR': 83.50,
    'USD_to_EUR': 0.92,
    'EUR_to_INR': 91.05,
    'EUR_to_USD': 1.09
};

// ===== API HELPER FUNCTIONS =====
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok && result.message === 'Invalid token') {
            logout();
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error' };
    }
}

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
    if (pageId !== 'login' && !isLoggedIn) {
        alert('Please login first!');
        showPage('login');
        return;
    }

    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add('active');
        
        // Initialize page-specific content
        if (pageId === 'transactions') {
            populateTransactions();
        } else if (pageId === 'dashboard') {
            updateDashboard();
        }
    }
}

// ===== LOGIN / SIGNUP FUNCTIONS =====
function switchAuthTab(tabId) {
    // Hide all forms
    const forms = document.querySelectorAll('.auth-form');
    forms.forEach(form => form.classList.remove('active'));

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Show selected form and mark tab as active
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    const result = await apiCall('/auth/login', 'POST', { email, password });

    if (result.success) {
        authToken = result.token;
        isLoggedIn = true;
        currentUser = result.user;

        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));

        updateUserInfo();
        showPage('dashboard');
        
        // Reset form
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } else {
        alert(result.message || 'Login failed');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const bankName = document.getElementById('signup-bank-name').value;
    const accountNumber = document.getElementById('signup-account-number').value;
    const password = document.getElementById('signup-password').value;

    if (!name || !email || !phone || !bankName || !accountNumber || !password) {
        alert('Please fill in all fields');
        return;
    }

    const result = await apiCall('/auth/signup', 'POST', { name, email, phone, bankName, accountNumber, password });

    if (result.success) {
        authToken = result.token;
        isLoggedIn = true;
        currentUser = result.user;

        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));

        updateUserInfo();
        showPage('dashboard');

        // Reset form
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-phone').value = '';
        document.getElementById('signup-bank-name').value = '';
        document.getElementById('signup-account-number').value = '';
        document.getElementById('signup-password').value = '';
    } else {
        alert(result.message || 'Signup failed');
    }
}

function logout() {
    isLoggedIn = false;
    currentUser = null;
    authToken = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    showPage('login');
    alert('Logged out successfully!');
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-email').textContent = `Email: ${currentUser.email}`;
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function updateDashboard() {
    updateUserInfo();
    
    // Fetch balances from API
    const result = await apiCall('/dashboard/balance', 'GET');
    
    if (result.success && result.balances) {
        document.getElementById('balance-inr').textContent = result.balances.balance_inr.toFixed(2);
        document.getElementById('balance-usd').textContent = result.balances.balance_usd.toFixed(2);
        document.getElementById('balance-eur').textContent = result.balances.balance_eur.toFixed(2);
    }
}

// ===== SEND MONEY FUNCTIONS =====
function updateConversion() {
    const amount = parseFloat(document.getElementById('send-amount').value);
    const currency = document.getElementById('send-currency').value;
    
    if (!amount || amount <= 0) {
        document.getElementById('conversion-display').style.display = 'none';
        return;
    }

    document.getElementById('conversion-display').style.display = 'block';
    
    // For simplicity, let's convert all to USD
    let targetCurrency, convertedAmount, rate;
    
    if (currency === 'INR') {
        targetCurrency = 'USD';
        rate = exchangeRates['INR_to_USD'];
        convertedAmount = (amount * rate).toFixed(2);
    } else if (currency === 'USD') {
        targetCurrency = 'EUR';
        rate = exchangeRates['USD_to_EUR'];
        convertedAmount = (amount * rate).toFixed(2);
    } else { // EUR
        targetCurrency = 'INR';
        rate = exchangeRates['EUR_to_INR'];
        convertedAmount = (amount * rate).toFixed(2);
    }

    const currencySymbols = { 'INR': '₹', 'USD': '$', 'EUR': '€' };
    
    document.getElementById('conversion-from-amount').textContent = amount.toFixed(2);
    document.getElementById('conversion-from-currency').textContent = currency;
    document.getElementById('conversion-to-amount').textContent = convertedAmount;
    document.getElementById('conversion-to-currency').textContent = targetCurrency;
    
    const rateText = `1 ${currency} = ${rate} ${targetCurrency}`;
    document.getElementById('exchange-rate').textContent = rateText;
}

async function handleSendMoney(event) {
    event.preventDefault();
    
    const recipientName = document.getElementById('recipient-name').value;
    const recipientEmail = document.getElementById('recipient-email').value;
    const recipientBankName = document.getElementById('recipient-bank-name').value;
    const recipientAccountNumber = document.getElementById('recipient-account-number').value;
    const amount = parseFloat(document.getElementById('send-amount').value);
    const currency = document.getElementById('send-currency').value;
    const message = document.getElementById('send-message').value;

    if (!recipientName || !recipientEmail || !recipientBankName || !recipientAccountNumber || !amount || amount <= 0) {
        alert('Please fill in all required fields');
        return;
    }

    const result = await apiCall('/send-money', 'POST', {
        recipientName,
        recipientEmail,
        recipientBankName,
        recipientAccountNumber,
        amount,
        currency,
        message
    });

    if (result.success) {
        alert(`✅ Success! ${amount} ${currency} has been sent to ${recipientName}\n\nRecipient Bank: ${recipientBankName}\nAccount: ${recipientAccountNumber}\nTransaction ID: ${result.transactionId}`);
        
        // Reset form
        document.getElementById('recipient-name').value = '';
        document.getElementById('recipient-email').value = '';
        document.getElementById('recipient-bank-name').value = '';
        document.getElementById('recipient-account-number').value = '';
        document.getElementById('send-amount').value = '';
        document.getElementById('send-message').value = '';
        document.getElementById('conversion-display').style.display = 'none';
        
        // Update dashboard
        updateDashboard();
    } else {
        alert('❌ ' + (result.message || 'Failed to send money'));
    }
}

// ===== CURRENCY CONVERTER FUNCTIONS =====
async function convertCurrency() {
    const fromAmount = parseFloat(document.getElementById('converter-from-amount').value);
    const fromCurrency = document.getElementById('converter-from-currency').value;
    const toCurrency = document.getElementById('converter-to-currency').value;

    if (!fromAmount || fromAmount <= 0) {
        document.getElementById('converter-to-amount').value = '';
        return;
    }

    const result = await apiCall('/converter', 'POST', {
        fromAmount,
        fromCurrency,
        toCurrency
    });

    if (result.success) {
        document.getElementById('converter-to-amount').value = result.toAmount;
    } else {
        alert(result.message || 'Conversion failed');
    }
}

function swapCurrencies() {
    const fromCurrency = document.getElementById('converter-from-currency').value;
    const toCurrency = document.getElementById('converter-to-currency').value;
    
    document.getElementById('converter-from-currency').value = toCurrency;
    document.getElementById('converter-to-currency').value = fromCurrency;
    
    // Swap amounts
    const fromAmount = document.getElementById('converter-from-amount').value;
    const toAmount = document.getElementById('converter-to-amount').value;
    
    document.getElementById('converter-from-amount').value = toAmount;
    document.getElementById('converter-to-amount').value = '';
    
    convertCurrency();
}

// ===== INVESTMENTS FUNCTIONS =====
async function populateInvestments() {
    const result = await apiCall('/investments', 'GET');
    
    if (result.success && result.investments && result.investments.length > 0) {
        // If user has investments, display them
        console.log('Investments:', result.investments);
    } else {
        // Show mock investments if no database investments
        console.log('Using mock investments');
    }
}

// ===== TRANSACTIONS FUNCTIONS =====
async function populateTransactions() {
    const filter = document.getElementById('transaction-filter').value;
    const endpoint = filter && filter !== 'all' ? `/transactions?type=${filter}` : '/transactions';
    
    const result = await apiCall(endpoint, 'GET');
    const tbody = document.getElementById('transactions-list');
    tbody.innerHTML = '';

    if (result.success && result.transactions && result.transactions.length > 0) {
        result.transactions.forEach(transaction => {
            const row = document.createElement('tr');
            
            const date = new Date(transaction.created_at).toLocaleString();
            const typeLabel = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
            
            row.innerHTML = `
                <td>${date}</td>
                <td>${typeLabel}</td>
                <td>${transaction.description}</td>
                <td>${transaction.amount} ${transaction.currency}</td>
                <td><span class="positive">${transaction.status.toUpperCase()}</span></td>
            `;
            
            tbody.appendChild(row);
        });
    } else {
        // Show mock transactions if no database data
        const mockTransactions = [
            {
                date: '2025-12-10 14:30',
                type: 'sent',
                description: 'Payment to Raj Kumar',
                amount: '5000.00',
                currency: 'INR',
                status: 'completed'
            },
            {
                date: '2025-12-09 11:15',
                type: 'received',
                description: 'Received from Priya Sharma',
                amount: '2500.00',
                currency: 'INR',
                status: 'completed'
            },
            {
                date: '2025-12-09 09:45',
                type: 'conversion',
                description: 'Currency Conversion: INR to USD',
                amount: '150.00',
                currency: 'USD',
                status: 'completed'
            }
        ];

        mockTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            const typeLabel = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
            
            row.innerHTML = `
                <td>${transaction.date}</td>
                <td>${typeLabel}</td>
                <td>${transaction.description}</td>
                <td>${transaction.amount} ${transaction.currency}</td>
                <td><span class="positive">${transaction.status.toUpperCase()}</span></td>
            `;
            
            tbody.appendChild(row);
        });
    }
}

function filterTransactions() {
    const filter = document.getElementById('transaction-filter').value;
    const tbody = document.getElementById('transactions-list');
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        const typeCell = row.cells[1].textContent.toLowerCase();
        
        if (filter === 'all') {
            row.style.display = '';
        } else if (filter === 'sent' && typeCell.includes('sent')) {
            row.style.display = '';
        } else if (filter === 'received' && typeCell.includes('received')) {
            row.style.display = '';
        } else if (filter === 'conversion' && typeCell.includes('conversion')) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        isLoggedIn = true;
        updateUserInfo();
        showPage('dashboard');
    } else {
        showPage('login');
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Could add additional escape key functionality here
    }
});
