import { pool } from '../config/db.js';

class Page {
  // Create a new page
  static async create({ title, slug, content, excerpt, featuredImage, metaTitle, metaDescription, metaKeywords, isPublished, createdBy }) {
    const [result] = await pool.execute(
      `INSERT INTO pages 
       (title, slug, content, excerpt, featured_image, meta_title, meta_description, meta_keywords, is_published, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, content, excerpt, featuredImage, metaTitle, metaDescription, metaKeywords, isPublished, createdBy, createdBy]
    );
    return this.findById(result.insertId);
  }

  // Find page by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u1.username as created_by_username, 
              u2.username as updated_by_username 
       FROM pages p
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.updated_by = u2.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // Find page by slug
  static async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u1.username as created_by_username, 
              u2.username as updated_by_username 
       FROM pages p
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.updated_by = u2.id
       WHERE p.slug = ?`,
      [slug]
    );
    return rows[0] || null;
  }

  // Get all pages (with optional filters)
  static async findAll({ search = '', status = 'all', page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    let query = `FROM pages p 
                LEFT JOIN users u1 ON p.created_by = u1.id 
                LEFT JOIN users u2 ON p.updated_by = u2.id 
                WHERE 1=1`;
    
    const params = [];
    
    if (search) {
      query += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    if (status === 'published') {
      query += ' AND p.is_published = TRUE';
    } else if (status === 'draft') {
      query += ' AND p.is_published = FALSE';
    }
    
    // Get total count for pagination
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total ${query}`, params);
    const total = countRows[0].total;
    
    // Add sorting and pagination
    query += ' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u1.username as created_by_username, 
              u2.username as updated_by_username 
       ${query}`,
      params
    );
    
    return {
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Update a page
  static async update(id, { title, slug, content, excerpt, featuredImage, metaTitle, metaDescription, metaKeywords, isPublished, updatedBy }) {
    const [result] = await pool.execute(
      `UPDATE pages 
       SET title = ?, slug = ?, content = ?, excerpt = ?, 
           featured_image = ?, meta_title = ?, meta_description = ?, 
           meta_keywords = ?, is_published = ?, updated_by = ? 
       WHERE id = ?`,
      [title, slug, content, excerpt, featuredImage, metaTitle, 
       metaDescription, metaKeywords, isPublished, updatedBy, id]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('Page not found');
    }
    
    return this.findById(id);
  }

  // Delete a page
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM pages WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Check if slug exists (for validation)
  static async slugExists(slug, excludeId = null) {
    let query = 'SELECT id FROM pages WHERE slug = ?';
    const params = [slug];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
  }
}

export default Page;
