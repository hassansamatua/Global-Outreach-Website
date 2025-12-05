import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ES module alternative for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  },
});

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'global_outreach',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to MySQL database:', err);
    process.exit(1);
  });

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper function to handle database errors
const handleDbError = (res, error) => {
  console.error('Database error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'A database error occurred',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Content Management Middleware
const checkContentPermission = (requiredRole = 'editor') => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === requiredRole) {
      return next();
    }
    return res.status(403).json({ message: 'Insufficient permissions' });
  };
};

// Content Type Routes
app.get('/api/content/types', authenticateToken, async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM content_types');
    res.json(results);
  } catch (error) {
    console.error('Error fetching content types:', error);
    res.status(500).json({ message: 'Error fetching content types' });
  }
});

// Content Routes
app.get('/api/content', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', type = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        c.*, 
        ct.name as content_type_name,
        u.name as author_name
      FROM content c
      LEFT JOIN content_types ct ON c.content_type_id = ct.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (search) {
      query += ` AND (c.title LIKE ? OR c.body LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (type) {
      query += ` AND ct.slug = ?`;
      params.push(type);
    }
    
    // Count total records
    const [countResult] = await pool.query(
      query.replace(/SELECT[\s\S]+FROM/, 'SELECT COUNT(*) as total FROM'),
      params
    );
    
    // Add pagination and sorting
    query += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [results] = await pool.query(query, params);
    
    res.json({
      data: results,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult[0].total / limit)
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ message: 'Error fetching content' });
  }
});

app.get('/api/content/:id', authenticateToken, async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT 
        c.*, 
        ct.name as content_type_name,
        u.name as author_name
       FROM content c
       LEFT JOIN content_types ct ON c.content_type_id = ct.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    
    res.json(results[0]);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ message: 'Error fetching content' });
  }
});

app.post('/api/content', authenticateToken, async (req, res) => {
  try {
    const { 
      content_type_id, 
      title, 
      slug, 
      body, 
      excerpt, 
      status, 
      meta_title, 
      meta_description,
      featured_image 
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO content 
       (content_type_id, title, slug, body, excerpt, status, 
        meta_title, meta_description, featured_image, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        content_type_id,
        title,
        slug,
        body || '',
        excerpt || '',
        status || 'draft',
        meta_title || '',
        meta_description || '',
        featured_image || null,
        req.user.id,
        req.user.id
      ]
    );

    const [newContent] = await pool.query(
      'SELECT * FROM content WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newContent[0]);
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ message: 'Error creating content' });
  }
});

app.put('/api/content/:id', authenticateToken, async (req, res) => {
  try {
    const { 
      content_type_id, 
      title, 
      slug, 
      body, 
      excerpt, 
      status, 
      meta_title, 
      meta_description,
      featured_image 
    } = req.body;

    await pool.query(
      `UPDATE content 
       SET content_type_id = ?,
           title = ?,
           slug = ?,
           body = ?,
           excerpt = ?,
           status = ?,
           meta_title = ?,
           meta_description = ?,
           featured_image = ?,
           updated_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        content_type_id,
        title,
        slug,
        body || '',
        excerpt || '',
        status || 'draft',
        meta_title || '',
        meta_description || '',
        featured_image || null,
        req.user.id,
        req.params.id
      ]
    );

    const [updatedContent] = await pool.query(
      'SELECT * FROM content WHERE id = ?',
      [req.params.id]
    );

    res.json(updatedContent[0]);
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ message: 'Error updating content' });
  }
});

app.delete('/api/content/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM content WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ message: 'Error deleting content' });
  }
});

// Content Stats
app.get('/api/content/stats', authenticateToken, async (req, res) => {
  try {
    // Get total content count
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM content');
    
    // Get count by content type
    const [byType] = await pool.query(`
      SELECT ct.name as type, COUNT(c.id) as count 
      FROM content c
      JOIN content_types ct ON c.content_type_id = ct.id
      GROUP BY ct.name
    `);
    
    // Get monthly content creation stats
    const [monthly] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM content
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month
    `);
    
    // Get recent content
    const [recent] = await pool.query(`
      SELECT c.id, c.title, c.status, c.updated_at, ct.name as type
      FROM content c
      JOIN content_types ct ON c.content_type_id = ct.id
      ORDER BY c.updated_at DESC 
      LIMIT 5
    `);
    
    res.json({
      total: parseInt(total),
      byType,
      monthly,
      recent
    });
  } catch (error) {
    console.error('Error getting content stats:', error);
    res.status(500).json({ message: 'Error fetching content statistics' });
  }
});

// Media Upload Endpoint
app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file;
    const { originalname, mimetype, filename, size } = file;
    const fileUrl = `/uploads/${filename}`;

    const [result] = await pool.query(
      `INSERT INTO media 
       (original_name, mime_type, file_name, size, url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [originalname, mimetype, filename, size, fileUrl, req.user.id]
    );

    const [newMedia] = await pool.query(
      'SELECT * FROM media WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newMedia[0]);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Media Management Endpoints
app.get('/api/media', authenticateToken, async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM media ORDER BY created_at DESC');
    res.json(results);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ message: 'Error fetching media' });
  }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try {
    // First get the file info
    const [media] = await pool.query('SELECT * FROM media WHERE id = ?', [req.params.id]);
    
    if (media.length === 0) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Delete the file from the filesystem
    const filePath = path.join(uploadDir, media[0].file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await pool.query('DELETE FROM media WHERE id = ?', [req.params.id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ message: 'Error deleting media' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// Error handling middleware for file uploads
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size is too large. Maximum size is 10MB.' });
  }
  if (err.message === 'Invalid file type. Only images and PDFs are allowed.') {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// Load environment variables
dotenv.config();

// Initialize express
const app = express();
const PORT = process.env.PORT || 5000;

// Create MySQL connection pool with XAMPP default settings
const pool = mysql.createPool({
  host: '127.0.0.1',  // Use 127.0.0.1 instead of localhost to avoid socket issues
  port: 3306,         // Default MySQL port
  user: 'root',       // Default XAMPP MySQL username
  password: '',       // Default XAMPP MySQL password (empty)
  database: 'global_outreach',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true  // Allow multiple SQL statements
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  });

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper function to handle database errors
const handleDbError = (res, error) => {
  console.error('Database error:', error);
  return res.status(500).json({ 
    success: false, 
    message: 'Database error',
    error: error.message 
  });
};

// Content Management Middleware
const checkContentPermission = (requiredRole = 'editor') => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === requiredRole) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
  };
};

// Content Routes
app.get('/api/content', authenticateToken, async (req, res) => {
  try {
    const [content] = await pool.query(`
      SELECT c.*, ct.name as type_name, u.name as author_name 
      FROM content c
      LEFT JOIN content_types ct ON c.content_type_id = ct.id
      LEFT JOIN users u ON c.author_id = u.id
      ORDER BY c.created_at DESC
    `);
    res.json(content);
  } catch (error) {
    handleDbError(res, error);
  }
});

app.get('/api/content/:id', authenticateToken, async (req, res) => {
  try {
    const [content] = await pool.query(
      'SELECT * FROM content WHERE id = ?', 
      [req.params.id]
    );
    
    if (content.length === 0) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }
    
    res.json({ success: true, data: content[0] });
  } catch (error) {
    handleDbError(res, error);
  }
});

app.post('/api/content', authenticateToken, checkContentPermission(), async (req, res) => {
  const { content_type_id, title, slug, body, excerpt, status, featured_image, meta_title, meta_description } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO content 
       (content_type_id, title, slug, body, excerpt, status, featured_image, meta_title, meta_description, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [content_type_id, title, slug, body, excerpt, status, featured_image, meta_title, meta_description, req.user.id, req.user.id]
    );
    
    const [newContent] = await pool.query('SELECT * FROM content WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newContent[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Content with this slug already exists' });
    }
    handleDbError(res, error);
  }
});

app.put('/api/content/:id', authenticateToken, checkContentPermission(), async (req, res) => {
  const { title, slug, body, excerpt, status, featured_image, meta_title, meta_description } = req.body;
  
  try {
    await pool.query(
      `UPDATE content SET 
        title = ?, slug = ?, body = ?, excerpt = ?, status = ?, 
        featured_image = ?, meta_title = ?, meta_description = ?, 
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, slug, body, excerpt, status, featured_image, meta_title, meta_description, req.user.id, req.params.id]
    );
    
    const [updatedContent] = await pool.query('SELECT * FROM content WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedContent[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Content with this slug already exists' });
    }
    handleDbError(res, error);
  }
});

app.delete('/api/content/:id', authenticateToken, checkContentPermission('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM content WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    handleDbError(res, error);
  }
});

// Media Routes
app.post('/api/media/upload', authenticateToken, checkContentPermission(), async (req, res) => {
  // This is a simplified version. In a real app, you'd use multer or similar for file uploads
  const { filename, originalName, mimeType, size, path, altText, caption } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO media 
       (filename, original_name, mime_type, size, path, alt_text, caption, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [filename, originalName, mimeType, size, path, altText, caption, req.user.id]
    );
    
    const [newMedia] = await pool.query('SELECT * FROM media WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newMedia[0] });
  } catch (error) {
    handleDbError(res, error);
  }
});

// Settings Routes
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT * FROM settings');
    res.json({ success: true, data: settings });
  } catch (error) {
    handleDbError(res, error);
  }
});

app.put('/api/settings', authenticateToken, checkContentPermission('admin'), async (req, res) => {
  const { settings } = req.body;
  
  try {
    await pool.query('START TRANSACTION');
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, value, value]
      );
    }
    
    await pool.query('COMMIT');
    
    const [updatedSettings] = await pool.query('SELECT * FROM settings');
    res.json({ success: true, data: updatedSettings });
  } catch (error) {
    await pool.query('ROLLBACK');
    handleDbError(res, error);
  }
});

// Public Routes
getPublicContent
app.get('/api/public/content/:slug', async (req, res) => {
  try {
    const [content] = await pool.query(
      `SELECT c.*, ct.name as content_type, u1.name as author 
       FROM content c
       JOIN content_types ct ON c.content_type_id = ct.id
       JOIN users u1 ON c.created_by = u1.id
       WHERE c.slug = ? AND c.status = 'published'`,
      [req.params.slug]
    );
    
    if (content.length === 0) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }
    
    res.json({ success: true, data: content[0] });
  } catch (error) {
    handleDbError(res, error);
  }
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  console.log('Login request received:', { 
    body: req.body,
    headers: req.headers 
  });
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    console.log('Missing credentials:', { email: !!email, password: !!password });
    return res.status(400).json({ 
      message: 'Email and password are required',
      received: { email: !!email, password: !!password }
    });
  }

  try {
    console.log('Looking up user with email:', email);
    // Find user by email
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    console.log('Users found:', users.length);
    if (users.length === 0) {
      console.log('No user found with email:', email);
      return res.status(400).json({ 
        message: 'Invalid credentials',
        details: 'No user found with this email'
      });
    }

    const user = users[0];
    console.log('User found, checking password...');
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match result:', isMatch);
    
    if (!isMatch) {
      console.log('Password does not match for user:', email);
      return res.status(400).json({ 
        message: 'Invalid credentials',
        details: 'Incorrect password'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );

    // Remove password from response
    const { password: _, ...userData } = user;
    
    res.json({ token, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Global Outreach API is running!' });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../client/dist', 'index.html'));
  });
}
// Admin Registration Route (Temporary)
app.post('/api/auth/register-admin', async (req, res) => {
  console.log('Admin registration attempt:', req.body);
  
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'All fields are required' 
    });
  }

  try {
    // Check if admin already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin']
    );

    // Create token
    const token = jwt.sign(
      { id: result.insertId, email, role: 'admin' },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering admin',
      error: error.message

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});