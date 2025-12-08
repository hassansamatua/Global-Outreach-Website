import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'global_outreach',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function checkDatabase() {
  let connection;
  try {
    // Test connection
    connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL database');

    // Check if users table exists
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'users'"
    );

    if (tables.length === 0) {
      console.log('❌ Users table does not exist. Creating it now...');
      
      // Read and execute the schema file
      const schemaPath = path.join(__dirname, '..', 'src', 'config', 'database.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split into individual statements and execute them
      const statements = schema
        .split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (err) {
          console.error(`Error executing statement: ${statement}\n`, err);
          throw err;
        }
      }
      
      console.log('✅ Successfully created users table');
    } else {
      console.log('✅ Users table exists');
    }

    // Check table structure
    const [columns] = await connection.query('DESCRIBE users');
    console.log('\nUsers table columns:');
    console.table(columns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default,
      Extra: col.Extra
    })));

    // Check if there are any users
    const [users] = await connection.query('SELECT id, email, role FROM users');
    console.log(`\nFound ${users.length} users in the database`);
    if (users.length > 0) {
      console.table(users);
    }

  } catch (error) {
    console.error('❌ Database error:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.release();
    await pool.end();
  }
}

checkDatabase().catch(console.error);
