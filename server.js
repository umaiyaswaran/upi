const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_secret_key_globalupi_2025';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// Database initialization
const dbPath = path.join(__dirname, 'globalupi.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                bank_name TEXT,
                account_number TEXT,
                password TEXT NOT NULL,
                balance_inr REAL DEFAULT 25500.00,
                balance_usd REAL DEFAULT 500.00,
                balance_eur REAL DEFAULT 300.00,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Transactions table
        db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                recipient_name TEXT,
                recipient_email TEXT,
                recipient_bank_name TEXT,
                recipient_account_number TEXT,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'completed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Currency conversions table
        db.run(`
            CREATE TABLE IF NOT EXISTS conversions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                from_currency TEXT NOT NULL,
                to_currency TEXT NOT NULL,
                from_amount REAL NOT NULL,
                to_amount REAL NOT NULL,
                rate REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Investments table
        db.run(`
            CREATE TABLE IF NOT EXISTS investments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                quantity REAL NOT NULL,
                current_price REAL NOT NULL,
                performance REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log('Database tables initialized');
    });
}

// ===== AUTHENTICATION ROUTES =====

// User Registration
app.post('/api/auth/signup', (req, res) => {
    const { name, email, phone, bankName, accountNumber, password } = req.body;

    if (!name || !email || !phone || !bankName || !accountNumber || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error hashing password' });
        }

        db.run(
            `INSERT INTO users (name, email, phone, bank_name, account_number, password) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, phone, bankName, accountNumber, hashedPassword],
            function(err) {
                if (err) {
                    return res.status(400).json({ success: false, message: 'Email already exists' });
                }

                const token = jwt.sign({ id: this.lastID, email }, SECRET_KEY, { expiresIn: '7d' });
                res.json({
                    success: true,
                    message: 'Account created successfully',
                    token,
                    user: { id: this.lastID, name, email, phone, bankName, accountNumber }
                });
            }
        );
    });
});

// User Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }

            const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: { id: user.id, name: user.name, email: user.email }
            });
        });
    });
});

// ===== MIDDLEWARE =====
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        req.userId = decoded.id;
        next();
    });
}

// ===== DASHBOARD ROUTES =====

// Get user balance
app.get('/api/dashboard/balance', verifyToken, (req, res) => {
    db.get(`SELECT balance_inr, balance_usd, balance_eur FROM users WHERE id = ?`, [req.userId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, balances: row });
    });
});

// Get user info
app.get('/api/dashboard/user', verifyToken, (req, res) => {
    db.get(`SELECT id, name, email, phone FROM users WHERE id = ?`, [req.userId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user: row });
    });
});

// ===== SEND MONEY ROUTES =====

// Send money
app.post('/api/send-money', verifyToken, (req, res) => {
    const { recipientName, recipientEmail, recipientBankName, recipientAccountNumber, amount, currency, message } = req.body;

    if (!recipientName || !recipientEmail || !recipientBankName || !recipientAccountNumber || !amount || !currency) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const balanceField = `balance_${currency.toLowerCase()}`;
    
    db.get(`SELECT ${balanceField} FROM users WHERE id = ?`, [req.userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user[balanceField] < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        const newBalance = user[balanceField] - amount;
        
        db.run(
            `UPDATE users SET ${balanceField} = ? WHERE id = ?`,
            [newBalance, req.userId],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error updating balance' });
                }

                db.run(
                    `INSERT INTO transactions (user_id, type, recipient_name, recipient_email, recipient_bank_name, recipient_account_number, amount, currency, description, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [req.userId, 'sent', recipientName, recipientEmail, recipientBankName, recipientAccountNumber, amount, currency, message || 'Payment sent', 'completed'],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ success: false, message: 'Error recording transaction' });
                        }

                        res.json({
                            success: true,
                            message: 'Money sent successfully',
                            transactionId: `TXN${this.lastID}`,
                            newBalance
                        });
                    }
                );
            }
        );
    });
});

// ===== CURRENCY CONVERTER ROUTES =====

// Convert currency
app.post('/api/converter', verifyToken, (req, res) => {
    const { fromAmount, fromCurrency, toCurrency } = req.body;

    if (!fromAmount || !fromCurrency || !toCurrency) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const exchangeRates = {
        'INR_to_USD': 0.012,
        'INR_to_EUR': 0.011,
        'USD_to_INR': 83.50,
        'USD_to_EUR': 0.92,
        'EUR_to_INR': 91.05,
        'EUR_to_USD': 1.09
    };

    let toAmount = fromAmount;
    const rateKey = `${fromCurrency}_to_${toCurrency}`;
    const rate = exchangeRates[rateKey];

    if (!rate) {
        return res.status(400).json({ success: false, message: 'Invalid currency pair' });
    }

    toAmount = (fromAmount * rate).toFixed(2);

    db.run(
        `INSERT INTO conversions (user_id, from_currency, to_currency, from_amount, to_amount, rate) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.userId, fromCurrency, toCurrency, fromAmount, toAmount, rate],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error recording conversion' });
            }

            res.json({
                success: true,
                message: 'Conversion successful',
                fromAmount,
                fromCurrency,
                toAmount,
                toCurrency,
                rate
            });
        }
    );
});

// ===== INVESTMENTS ROUTES =====

// Get user investments
app.get('/api/investments', verifyToken, (req, res) => {
    db.all(`SELECT * FROM investments WHERE user_id = ?`, [req.userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching investments' });
        }

        res.json({ success: true, investments: rows || [] });
    });
});

// Add investment (admin only for demo)
app.post('/api/investments', verifyToken, (req, res) => {
    const { symbol, name, type, quantity, currentPrice, performance } = req.body;

    db.run(
        `INSERT INTO investments (user_id, symbol, name, type, quantity, current_price, performance) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, symbol, name, type, quantity, currentPrice, performance],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error adding investment' });
            }

            res.json({
                success: true,
                message: 'Investment added successfully',
                investmentId: this.lastID
            });
        }
    );
});

// ===== TRANSACTION HISTORY ROUTES =====

// Get transactions
app.get('/api/transactions', verifyToken, (req, res) => {
    const type = req.query.type;
    let query = `SELECT * FROM transactions WHERE user_id = ?`;
    const params = [req.userId];

    if (type && type !== 'all') {
        query += ` AND type = ?`;
        params.push(type);
    }

    query += ` ORDER BY created_at DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching transactions' });
        }

        res.json({ success: true, transactions: rows || [] });
    });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`GLOBALUPI Backend running at http://localhost:${PORT}`);
    console.log('Database: SQLite (globalupi.db)');
});
