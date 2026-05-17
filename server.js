require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { constants } = require('http2');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Import integration services
const db = require('./config/db');
const unsplashService = require('./services/unsplash');
const pixabayService = require('./services/pixabay');
const storyblocksService = require('./services/storyblocks');


// In-memory database (resets on server restart)
const users = [];
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_static_secret_key';


// ==========================================
// AUTH MIDDLEWARE
// ==========================================
const authMiddleware = (req, res, next) => {
  // Extract token from the HTTP Authorization header
  const authHeader = req.headers['authorization'];
  
  // Expected format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(constants.HTTP_STATUS_UNAUTHORIZED).json({ error: 'Access denied: Please log in and provide a valid token.' });
  }

  try {
    // Verify cryptographic integrity of the token
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified; // Attach decrypted user context payload to the request object
    next(); // Pass control to the next route handler
  } catch (error) {
    res.status(constants.HTTP_STATUS_FORBIDDEN).json({ error: 'Invalid or expired tokens' });
  }
};


// ==========================================
// 📝 AUTHENTICATION ROUTES
// ==========================================

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: 'Please fill in the complete username and password.' });
  }

  try {
    // Check if user already exists using SQL query
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: 'This username has already been registered.' });
    }

    // Securely hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new record into MySQL database
    await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    
    res.status(constants.HTTP_STATUS_CREATED).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Database Registration Error:', error);
    res.status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: 'A database error occurred during the registration process.' });
  }
});

// 2. User Login (Token Issuance)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Retrieve user payload from database by unique username
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0]; // Fetch the first matched record
    
    if (!user) {
      return res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: 'Username or password incorrect' });
    }

    // Authenticate encrypted password string matches plain-text
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: 'Username or password incorrect' });
    }

    // Generate JWT token
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });
    
    res.json({ message: 'Login successful', token: `Bearer ${token}` });
  } catch (error) {
    console.error('Database Login Error:', error);
    res.status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: 'A database error occurred during the login process.' });
  }
});


app.get('/api/search', authMiddleware, async (req, res) => {
  const { keyword } = req.query;

  // Validation: keyword query parameter is mandatory
  if (!keyword) {
    return res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: 'Please enter keyword' });
  }

  try {
    // Execute all third-party API requests concurrently in a pool
    const results = await Promise.allSettled([
      unsplashService.search(keyword),
      pixabayService.search(keyword),
      storyblocksService.search(keyword)
    ]);

    let compiledImages = [];

    // Aggregate fulfilled result arrays into a single unified dataset
    results.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        compiledImages = compiledImages.concat(result.value);
      }
    });

    // Return the aggregated array to the client
    res.json({
      total: compiledImages.length, // Included for client-side pagination or count verification
      data: compiledImages
    });

  } catch (error) {
    // Top-level fallback error handler to prevent application crash
    console.error('Main server error:', error);
    res.status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`The server has been successfully started at http://localhost:${PORT}`);
});