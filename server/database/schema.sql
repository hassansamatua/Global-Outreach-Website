-- Content Types
CREATE TABLE IF NOT EXISTS content_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Content
CREATE TABLE IF NOT EXISTS content (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_type_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  body LONGTEXT,
  excerpt TEXT,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  meta_title VARCHAR(255),
  meta_description TEXT,
  featured_image VARCHAR(255),
  created_by INT NOT NULL,
  updated_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  FOREIGN KEY (content_type_id) REFERENCES content_types(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE,
  FULLTEXT (title, body, excerpt)
);

-- Media
CREATE TABLE IF NOT EXISTS media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  size INT NOT NULL,
  url VARCHAR(255) NOT NULL,
  alt_text TEXT,
  caption TEXT,
  content_type VARCHAR(100),
  content_id INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default content types if they don't exist
INSERT IGNORE INTO content_types (name, slug, description) VALUES
('Page', 'page', 'A standard page'),
('Post', 'post', 'A blog post'),
('Event', 'event', 'An event');