import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './config/db.js';
import createTables from './config/schema.js';
import { authenticateToken, optionalAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database tables
createTables();

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to الوفاء API',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Products Routes
app.get('/api/products', async (req, res) => {
  try {
    const { category, featured, latest } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = true';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category_id = $${params.length}`;
    }
    if (featured === 'true') {
      query += ' AND is_featured = true';
    }
    if (latest === 'true') {
      query += ' ORDER BY created_at DESC LIMIT 20';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = $1 AND p.is_active = true',
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, image, category_id, is_featured } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9أ-ي]/g, '-').replace(/-+/g, '-');
    
    const result = await pool.query(
      `INSERT INTO products (name, slug, description, price, image, category_id, is_featured) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, slug, description, price, image, category_id, is_featured || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categories Routes
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cart Routes
app.get('/api/cart', async (req, res) => {
  try {
    const { session_id } = req.query;
    const result = await pool.query(
      `SELECT ci.*, p.name, p.price, p.image, p.slug 
       FROM cart_items ci 
       JOIN products p ON ci.product_id = p.id 
       WHERE ci.session_id = $1`,
      [session_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cart', async (req, res) => {
  try {
    const { session_id, product_id, quantity } = req.body;
    
    // Check if item exists
    const existing = await pool.query(
      'SELECT * FROM cart_items WHERE session_id = $1 AND product_id = $2',
      [session_id, product_id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2',
        [quantity || 1, existing.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (session_id, product_id, quantity) VALUES ($1, $2, $3)',
        [session_id, product_id, quantity || 1]
      );
    }
    res.json({ message: 'Added to cart' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cart/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders Routes
app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, customer_name, customer_phone, customer_email, items, notes } = req.body;
    
    // Calculate total
    let total = 0;
    for (const item of items) {
      const product = await pool.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      total += product.rows[0].price * item.quantity;
    }

    // Create order
    const order = await pool.query(
      `INSERT INTO orders (user_id, customer_name, customer_phone, customer_email, total, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, customer_name, customer_phone, customer_email, total, notes]
    );

    // Add order items
    for (const item of items) {
      const product = await pool.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.rows[0].id, item.product_id, item.quantity, product.rows[0].price]
      );
    }

    // Clear cart
    await pool.query('DELETE FROM cart_items WHERE session_id = $1', [req.body.session_id]);

    res.status(201).json(order.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT o.*, json_agg(json_build_object(\'id\', oi.id, \'product_id\', oi.product_id, \'quantity\', oi.quantity, \'price\', oi.price, \'name\', p.name)) as items FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order details
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price, 'name', p.name, 'image', p.image)) as items 
       FROM orders o 
       LEFT JOIN order_items oi ON o.id = oi.order_id 
       LEFT JOIN products p ON oi.product_id = p.id 
       WHERE o.id = $1 AND o.user_id = $2 
       GROUP BY o.id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reviews Routes
app.get('/api/reviews', async (req, res) => {
  try {
    const { product_id } = req.query;
    let query = 'SELECT r.*, u.name as user_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id';
    const params = [];
    
    if (product_id) {
      params.push(product_id);
      query += ` WHERE r.product_id = $${params.length}`;
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { product_id, user_id, rating, comment } = req.body;
    const result = await pool.query(
      'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
      [product_id, user_id, rating, comment]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pages Routes (Static Pages)
app.get('/api/pages', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, slug, content FROM pages');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pages/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pages WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Routes
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
    res.json({ message: 'Setting updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role',
      [name, email, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = generateToken(user);
    
    res.status(201).json({ 
      message: 'Registration successful',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await pool.query(
      'SELECT id, name, email, password, role FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = generateToken(user);
    
    res.json({ 
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, role',
      [name, email, req.user.id]
    );
    
    res.json({ user: result.rows[0], message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    
    const validPassword = await bcrypt.compare(currentPassword, user.rows[0].password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});