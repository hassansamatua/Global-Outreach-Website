import User from '../models/User.js';
import { validationResult } from 'express-validator';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const register = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, firstName, lastName } = req.body;

  try {
    // Check if user already exists
    let user = await User.findByEmail(email);
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if username is taken
    user = await User.findByUsername(username);
    if (user) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Create new user (default role is 'viewer')
    user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: 'viewer' // Default role
    });

    // Generate JWT token
    const token = User.generateJwt(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
export const login = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Authenticate user
    const { user, token } = await User.login(email, password);
    
    res.json({
      user,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ message: error.message || 'Invalid credentials' });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
export const updateProfile = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, email, avatar } = req.body;

  try {
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }

    // Update user profile
    const updatedUser = await User.updateProfile(req.user.id, {
      firstName,
      lastName,
      email,
      avatar
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
export const changePassword = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    await User.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ message: error.message || 'Error changing password' });
  }
};

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
export const getUsers = async (req, res) => {
  try {
    const users = await User.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   PUT /api/auth/users/:id/role
 * @desc    Update user role (admin only)
 * @access  Private/Admin
 */
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    // Prevent changing own role
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const updatedUser = await User.updateUserRole(id, role);
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   PUT /api/auth/users/:id/toggle-active
 * @desc    Toggle user active status (admin only)
 * @access  Private/Admin
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deactivating own account
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    const updatedUser = await User.toggleUserStatus(id);
    res.json(updatedUser);
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
