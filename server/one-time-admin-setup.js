import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'global_outreach'
};

// Admin credentials
const ADMIN_EMAIL = 'admin@globaloutreach.org';
const ADMIN_PASSWORD = 'Admin@123';

async function setupAdmin() {
  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    
    // Check if admin exists
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?', 
      [ADMIN_EMAIL]
    );

    if (users.length > 0) {
      console.log('Admin user already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await connection.execute(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, ADMIN_EMAIL]
      );
    } else {
      console.log('Creating new admin user...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await connection.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Admin User', ADMIN_EMAIL, hashedPassword, 'admin']
      );
    }

    console.log('\n========================================');
    console.log('ADMIN CREDENTIALS:');
    console.log('========================================');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('========================================\n');
    
    console.log('Admin setup completed successfully!');
    
    // Self-destruct
    console.log('\nThis script will self-destruct in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Delete this file
    const fs = await import('fs');
    const path = await import('path');
    const __filename = new URL(import.meta.url).pathname;
    fs.unlinkSync(__filename);
    console.log('Script has been deleted.');
    
  } catch (error) {
    console.error('Error setting up admin:', error);
  } finally {
    if (connection) await connection.end();
    process.exit();
  }
}

// Start the setup
setupAdmin();
