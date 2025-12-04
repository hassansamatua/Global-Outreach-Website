import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class User {
  // Create a new user
  static async create({ username, email, password, role = 'viewer', firstName, lastName }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role, firstName, lastName]
    );
    return this.findById(result.insertId);
  }

  // Find user by ID
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  // Find user by email
  static async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  // Find user by username
  static async findByUsername(username) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  // Update user profile
  static async updateProfile(id, { firstName, lastName, email, avatar }) {
    const [result] = await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, avatar = ? WHERE id = ?',
      [firstName, lastName, email, avatar, id]
    );
    return this.findById(id);
  }

  // Change user password
  static async changePassword(id, currentPassword, newPassword) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
    return true;
  }

  // Generate JWT token
  static generateJwt(user) {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  static verifyJwt(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Login user
  static async login(email, password) {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Update last login
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Generate JWT token
    const token = this.generateJwt(user);
    
    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;
    
    return { user: userWithoutPassword, token };
  }

  // Get all users (admin only)
  static async getAllUsers() {
    const [rows] = await pool.execute(
      'SELECT id, username, email, role, first_name, last_name, is_active, last_login, created_at FROM users'
    );
    return rows;
  }

  // Update user role (admin only)
  static async updateUserRole(id, role) {
    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    return this.findById(id);
  }

  // Toggle user active status (admin only)
  static async toggleUserStatus(id) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    const newStatus = !user.is_active;
    await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);
    return { ...user, is_active: newStatus };
  }
}

export default User;
