import pool from './db.js';

const createTables = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        image VARCHAR(500),
        parent_id INTEGER REFERENCES categories(id),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Categories table created');

    // Products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image VARCHAR(500),
        category_id INTEGER REFERENCES categories(id),
        is_featured BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Products table created');

    // Orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        total DECIMAL(10,2) NOT NULL,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_email VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Orders table created');

    // Order items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Order items table created');

    // Cart items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255),
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Cart items table created');

    // Reviews table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Reviews table created');

    // Pages table (static pages)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Pages table created');

    // Settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Settings table created');

    // Insert default settings
    await pool.query(`
      INSERT INTO settings (key, value) VALUES 
        ('store_name', 'الوفاء'),
        ('primary_color', '#c36ba0'),
        ('whatsapp', '+966500000000'),
        ('logo', ''),
        ('description', 'متجر إلكتروني للخدمات والمنتجات الرقمية')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('✅ Default settings inserted');

    // Insert default pages
    await pool.query(`
      INSERT INTO pages (title, slug, content) VALUES 
        ('سياسة الاسترجاع', 'refund-policy', 'سياسة الاسترجاع: لا يحق للمستهلك استرجاع المنتج بعد الدفع.'),
        ('سياسة الخصوصية', 'privacy-policy', 'سياسة الخصوصية: نحن نهتم بخصوصيتك ونحمي بياناتك.'),
        ('الشروط والأحكام', 'terms', 'الشروط والأحكام: باستخدام الموقع فأنت توافق على الشروط.')
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('✅ Default pages inserted');

    console.log('🎉 All tables created successfully!');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
};

export default createTables;