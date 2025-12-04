import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection with XAMPP defaults
const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  multipleStatements: true
});

async function initializeDatabase() {
  let connection;
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Get a connection from the pool
    connection = await pool.getConnection();
    
    console.log('Creating database and tables...');
    
    // Execute the schema SQL
    await connection.query(schema);
    
    console.log('Database and tables created successfully!');
    console.log('Admin user created:');
    console.log('Email: admin@globaloutreach.org');
    console.log('Password: Admin@123');
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (connection) await connection.release();
    await pool.end();
    process.exit();
  }
}

initializeDatabase();
