import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from the token
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ message: 'User account is deactivated' });
    }

    // Attach user to request object
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to check if user has required role(s)
 */
export const authorize = (roles = []) => {
  // Convert single role to array if needed
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Check if user has required role
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is the owner of the resource or admin
 */
export const isOwnerOrAdmin = (model, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      // Allow admins to do anything
      if (req.user.role === 'admin') {
        return next();
      }

      // Get the resource
      const resource = await model.findById(req.params[idParam]);
      
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      // Check if the user is the owner
      const ownerId = resource.author_id || resource.user_id || resource.created_by;
      
      if (ownerId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ 
          message: 'You are not authorized to perform this action' 
        });
      }

      // Attach resource to request for use in the route handler
      req.resource = resource;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};
