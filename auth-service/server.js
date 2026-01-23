/**
 * Simple Mock Supabase Auth Service for Local Development
 * This provides basic JWT authentication without full GoTrue
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 63000;

// Use the JWT secret as a base64 decoded buffer (matching PostgREST expectations)
const JWT_SECRET_B64 = '6TXrpcgE1JyJdkyKWhImwrEbSndjT8eGkCZVi3n1oxc=';
const JWT_SECRET = Buffer.from(JWT_SECRET_B64, 'base64');

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
}));
app.use(bodyParser.json());

// In-memory user store (reset on restart)
const users = new Map();

// Helper to generate JWT token compatible with PostgREST
const generateToken = (userId, email, role = 'authenticated') => {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour expiry
  
  const payload = {
    iss: 'supabase',
    sub: userId,
    aud: 'authenticated',
    role: role,
    email: email,
    iat: iat,
    exp: exp,
  };
  
  // Sign with the same algorithm and secret PostgREST expects
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Sign up endpoint
app.post('/auth/v1/signup', (req, res) => {
  try {
    const { email, password, user_metadata = {} } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'missing_fields',
        error_description: 'Email and password required'
      });
    }
    
    if (users.has(email)) {
      return res.status(400).json({
        error: 'user_already_exists',
        error_description: 'User with this email already exists'
      });
    }
    
    // Create user
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email,
      password, // In production, this would be hashed
      user_metadata,
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(), // Auto-confirm locally
    };
    
    users.set(email, user);
    
    // Generate tokens
    const access_token = generateToken(userId, email, 'authenticated');
    const refresh_token = generateToken(userId, email, 'authenticated');
    
    res.json({
      user: {
        id: userId,
        email,
        user_metadata,
        aud: 'authenticated',
        confirmation_sent_at: null,
        confirmed_at: user.confirmed_at,
        created_at: user.created_at,
      },
      session: {
        access_token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token,
        user: {
          id: userId,
          email,
          user_metadata,
        },
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// Sign in endpoint
app.post('/auth/v1/token', (req, res) => {
  try {
    const { email, password, grant_type } = req.body;
    
    if (grant_type === 'refresh_token') {
      // Handle refresh token
      const refresh_token = req.body.refresh_token;
      if (!refresh_token) {
        return res.status(400).json({ error: 'missing_refresh_token' });
      }
      
      try {
        const decoded = jwt.verify(refresh_token, JWT_SECRET);
        const new_access_token = generateToken(decoded.sub, decoded.email, 'authenticated');
        return res.json({
          access_token: new_access_token,
          token_type: 'bearer',
          expires_in: 3600,
        });
      } catch {
        return res.status(401).json({ error: 'invalid_grant' });
      }
    }
    
    // Regular email/password login
    if (!email || !password) {
      return res.status(400).json({
        error: 'missing_fields',
        error_description: 'Email and password required'
      });
    }
    
    const user = users.get(email);
    if (!user || user.password !== password) {
      return res.status(401).json({
        error: 'invalid_credentials',
        error_description: 'Invalid email or password'
      });
    }
    
    // Generate tokens
    const access_token = generateToken(user.id, email, 'authenticated');
    const refresh_token = generateToken(user.id, email, 'authenticated');
    
    res.json({
      access_token,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token,
      user: {
        id: user.id,
        email,
        user_metadata: user.user_metadata,
        aud: 'authenticated',
        confirmed_at: user.confirmed_at,
      },
    });
  } catch (error) {
    console.error('Token error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get current user
app.get('/auth/v1/user', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'missing_token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = users.get(decoded.email);
    if (!user) {
      return res.status(401).json({ error: 'user_not_found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      aud: 'authenticated',
      confirmed_at: user.confirmed_at,
    });
  } catch (error) {
    res.status(401).json({ error: 'invalid_token' });
  }
});

// Sign out
app.post('/auth/v1/logout', (req, res) => {
  res.json({ success: true });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
  console.log(`✅ Mock Auth Service running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /auth/v1/signup - Create new user');
  console.log('  POST /auth/v1/token - Login with email/password');
  console.log('  GET  /auth/v1/user - Get current user (requires Bearer token)');
  console.log('  POST /auth/v1/logout - Sign out');
  console.log('  GET  /health - Health check');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Sign up endpoint
app.post('/auth/v1/signup', (req, res) => {
  try {
    const { email, password, user_metadata = {} } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'missing_fields',
        error_description: 'Email and password required'
      });
    }
    
    if (users.has(email)) {
      return res.status(400).json({
        error: 'user_already_exists',
        error_description: 'User with this email already exists'
      });
    }
    
    // Create user
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email,
      password, // In production, this would be hashed
      user_metadata,
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(), // Auto-confirm locally
    };
    
    users.set(email, user);
    
    // Generate tokens
    const access_token = generateToken(userId, email, 'authenticated');
    const refresh_token = generateToken(userId, email, 'authenticated');
    
    res.json({
      user: {
        id: userId,
        email,
        user_metadata,
        aud: 'authenticated',
        confirmation_sent_at: null,
        confirmed_at: user.confirmed_at,
        created_at: user.created_at,
      },
      session: {
        access_token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token,
        user: {
          id: userId,
          email,
          user_metadata,
        },
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// Sign in endpoint
app.post('/auth/v1/token', (req, res) => {
  try {
    const { email, password, grant_type } = req.body;
    
    if (grant_type === 'refresh_token') {
      // Handle refresh token
      const refresh_token = req.body.refresh_token;
      if (!refresh_token) {
        return res.status(400).json({ error: 'missing_refresh_token' });
      }
      
      try {
        const decoded = jwt.verify(refresh_token, JWT_SECRET);
        const new_access_token = generateToken(decoded.sub, decoded.email, 'authenticated');
        return res.json({
          access_token: new_access_token,
          token_type: 'bearer',
          expires_in: 3600,
        });
      } catch {
        return res.status(401).json({ error: 'invalid_grant' });
      }
    }
    
    // Regular email/password login
    if (!email || !password) {
      return res.status(400).json({
        error: 'missing_fields',
        error_description: 'Email and password required'
      });
    }
    
    const user = users.get(email);
    if (!user || user.password !== password) {
      return res.status(401).json({
        error: 'invalid_credentials',
        error_description: 'Invalid email or password'
      });
    }
    
    // Generate tokens
    const access_token = generateToken(user.id, email, 'authenticated');
    const refresh_token = generateToken(user.id, email, 'authenticated');
    
    res.json({
      access_token,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token,
      user: {
        id: user.id,
        email,
        user_metadata: user.user_metadata,
        aud: 'authenticated',
        confirmed_at: user.confirmed_at,
      },
    });
  } catch (error) {
    console.error('Token error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get current user
app.get('/auth/v1/user', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'missing_token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = users.get(decoded.email);
    if (!user) {
      return res.status(401).json({ error: 'user_not_found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      aud: 'authenticated',
      confirmed_at: user.confirmed_at,
    });
  } catch (error) {
    res.status(401).json({ error: 'invalid_token' });
  }
});

// Sign out
app.post('/auth/v1/logout', (req, res) => {
  res.json({ success: true });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
  console.log(`✅ Mock Auth Service running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /auth/v1/signup - Create new user');
  console.log('  POST /auth/v1/token - Login with email/password');
  console.log('  GET  /auth/v1/user - Get current user (requires Bearer token)');
  console.log('  POST /auth/v1/logout - Sign out');
  console.log('  GET  /health - Health check');
});
