import { pool } from '../config/db.js';

class Post {
  // Create a new blog post
  static async create({ 
    title, 
    slug, 
    content, 
    excerpt, 
    featuredImage, 
    metaTitle, 
    metaDescription, 
    metaKeywords, 
    isPublished, 
    authorId,
    categoryIds = []
  }) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Insert the post
      const [result] = await connection.execute(
        `INSERT INTO posts 
         (title, slug, content, excerpt, featured_image, meta_title, meta_description, meta_keywords, is_published, author_id, published_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, 
          slug, 
          content, 
          excerpt, 
          featuredImage, 
          metaTitle, 
          metaDescription, 
          metaKeywords, 
          isPublished, 
          authorId,
          isPublished ? new Date() : null
        ]
      );
      
      const postId = result.insertId;
      
      // Add categories if provided
      if (categoryIds && categoryIds.length > 0) {
        const categoryValues = categoryIds.map(categoryId => [postId, categoryId]);
        await connection.query(
          'INSERT INTO post_categories (post_id, category_id) VALUES ?',
          [categoryValues]
        );
      }
      
      await connection.commit();
      return this.findById(postId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Find post by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u.username as author_username,
              u.avatar as author_avatar,
              GROUP_CONCAT(DISTINCT c.id) as category_ids,
              GROUP_CONCAT(DISTINCT c.name) as category_names
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN post_categories pc ON p.id = pc.post_id
       LEFT JOIN categories c ON pc.category_id = c.id
       WHERE p.id = ?
       GROUP BY p.id`,
      [id]
    );
    
    if (rows.length === 0) return null;
    
    const post = rows[0];
    
    // Format categories
    if (post.category_ids) {
      const categoryIds = post.category_ids.split(',').map(Number);
      const categoryNames = post.category_names.split(',');
      post.categories = categoryIds.map((id, index) => ({
        id,
        name: categoryNames[index]
      }));
    } else {
      post.categories = [];
    }
    
    delete post.category_ids;
    delete post.category_names;
    
    return post;
  }

  // Find post by slug
  static async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u.username as author_username,
              u.avatar as author_avatar,
              GROUP_CONCAT(DISTINCT c.id) as category_ids,
              GROUP_CONCAT(DISTINCT c.name) as category_names
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN post_categories pc ON p.id = pc.post_id
       LEFT JOIN categories c ON pc.category_id = c.id
       WHERE p.slug = ? AND p.is_published = TRUE
       GROUP BY p.id`,
      [slug]
    );
    
    if (rows.length === 0) return null;
    
    const post = rows[0];
    
    // Format categories
    if (post.category_ids) {
      const categoryIds = post.category_ids.split(',').map(Number);
      const categoryNames = post.category_names.split(',');
      post.categories = categoryIds.map((id, index) => ({
        id,
        name: categoryNames[index]
      }));
    } else {
      post.categories = [];
    }
    
    delete post.category_ids;
    delete post.category_names;
    
    return post;
  }

  // Get all posts with pagination and filtering
  static async findAll({ 
    search = '', 
    status = 'published', 
    category = null, 
    page = 1, 
    limit = 10,
    featured = null
  } = {}) {
    const offset = (page - 1) * limit;
    let query = `FROM posts p 
                LEFT JOIN users u ON p.author_id = u.id
                LEFT JOIN post_categories pc ON p.id = pc.post_id
                LEFT JOIN categories c ON pc.category_id = c.id
                WHERE 1=1`;
    
    const params = [];
    
    // Apply search filter
    if (search) {
      query += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Apply status filter
    if (status === 'published') {
      query += ' AND p.is_published = TRUE';
    } else if (status === 'draft') {
      query += ' AND p.is_published = FALSE';
    }
    
    // Apply category filter
    if (category) {
      query += ' AND c.slug = ?';
      params.push(category);
    }
    
    // Apply featured filter
    if (featured !== null) {
      query += ' AND p.is_featured = ?';
      params.push(featured);
    }
    
    // Get total count for pagination
    const [countRows] = await pool.execute(
      `SELECT COUNT(DISTINCT p.id) as total ${query}`,
      params
    );
    
    const total = countRows[0].total;
    
    // Add grouping, sorting and pagination
    query += ` GROUP BY p.id 
              ORDER BY p.published_at DESC 
              LIMIT ? OFFSET ?`;
    
    params.push(limit, offset);
    
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u.username as author_username,
              u.avatar as author_avatar,
              GROUP_CONCAT(DISTINCT c.id) as category_ids,
              GROUP_CONCAT(DISTINCT c.name) as category_names
       ${query}`,
      params
    );
    
    // Format the results
    const formattedRows = rows.map(row => {
      const post = { ...row };
      
      if (post.category_ids) {
        const categoryIds = post.category_ids.split(',').map(Number);
        const categoryNames = post.category_names.split(',');
        post.categories = categoryIds.map((id, index) => ({
          id,
          name: categoryNames[index]
        }));
      } else {
        post.categories = [];
      }
      
      delete post.category_ids;
      delete post.category_names;
      
      return post;
    });
    
    return {
      data: formattedRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Update a post
  static async update(id, {
    title, 
    slug, 
    content, 
    excerpt, 
    featuredImage, 
    metaTitle, 
    metaDescription, 
    metaKeywords, 
    isPublished,
    categoryIds = []
  }) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Update the post
      const [result] = await connection.execute(
        `UPDATE posts 
         SET title = ?, slug = ?, content = ?, excerpt = ?, 
             featured_image = ?, meta_title = ?, meta_description = ?, 
             meta_keywords = ?, is_published = ?,
             published_at = CASE WHEN ? = TRUE AND published_at IS NULL THEN NOW()
                               WHEN ? = FALSE THEN NULL
                               ELSE published_at END
         WHERE id = ?`,
        [
          title, 
          slug, 
          content, 
          excerpt, 
          featuredImage, 
          metaTitle, 
          metaDescription, 
          metaKeywords, 
          isPublished,
          isPublished,
          isPublished,
          id
        ]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Post not found');
      }
      
      // Update categories
      await connection.execute('DELETE FROM post_categories WHERE post_id = ?', [id]);
      
      if (categoryIds && categoryIds.length > 0) {
        const categoryValues = categoryIds.map(categoryId => [id, categoryId]);
        await connection.query(
          'INSERT INTO post_categories (post_id, category_id) VALUES ?',
          [categoryValues]
        );
      }
      
      await connection.commit();
      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Delete a post
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM posts WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Check if slug exists (for validation)
  static async slugExists(slug, excludeId = null) {
    let query = 'SELECT id FROM posts WHERE slug = ?';
    const params = [slug];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
  }

  // Increment view count
  static async incrementViewCount(id) {
    await pool.execute(
      'UPDATE posts SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?',
      [id]
    );
  }

  // Get related posts
  static async getRelatedPosts(postId, limit = 3) {
    const [rows] = await pool.execute(
      `SELECT p.*, u.username as author_username
       FROM posts p
       JOIN post_categories pc1 ON p.id = pc1.post_id
       JOIN post_categories pc2 ON pc1.category_id = pc2.category_id AND pc2.post_id = ?
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.id != ? AND p.is_published = TRUE
       GROUP BY p.id
       ORDER BY COUNT(*) DESC, p.published_at DESC
       LIMIT ?`,
      [postId, postId, limit]
    );
    
    return rows;
  }

  // Get posts by author
  static async findByAuthor(authorId, { page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM posts WHERE author_id = ? AND is_published = TRUE',
      [authorId]
    );
    
    const total = countRows[0].total;
    
    // Get paginated results
    const [rows] = await pool.execute(
      `SELECT p.*, u.username as author_username
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.author_id = ? AND p.is_published = TRUE
       ORDER BY p.published_at DESC
       LIMIT ? OFFSET ?`,
      [authorId, limit, offset]
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
}

export default Post;
