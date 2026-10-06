const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    console.log('Connected to MySQL server');

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    console.log(`Database '${process.env.DB_NAME}' created or already exists`);

    await connection.query(`USE ${process.env.DB_NAME}`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        owner_id INT NOT NULL,
        code TEXT,
        language VARCHAR(20) DEFAULT 'javascript',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_owner (owner_id),
        INDEX idx_active (is_active)
      )
    `);
    console.log('Workspaces table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_workspaces (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        workspace_id VARCHAR(36) NOT NULL,
        role ENUM('owner', 'collaborator', 'viewer') DEFAULT 'collaborator',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_workspace (user_id, workspace_id),
        INDEX idx_user (user_id),
        INDEX idx_workspace (workspace_id)
      )
    `);
    console.log('User workspaces table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        token TEXT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_expires (expires_at)
      )
    `);
    console.log('Sessions table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS workspace_files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        workspace_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type ENUM('file', 'folder') NOT NULL,
        content LONGTEXT,
        language VARCHAR(50),
        parent_id INT NULL,
        path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES workspace_files(id) ON DELETE CASCADE,
        INDEX idx_workspace (workspace_id),
        INDEX idx_parent (parent_id),
        INDEX idx_type (type),
        UNIQUE KEY unique_workspace_path (workspace_id, path(400))
      )
    `);
    console.log('Workspace files table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_save_events (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        workspace_id VARCHAR(36) NOT NULL,
        file_id INT NOT NULL,
        user_id INT NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_save_user_date (user_id, saved_at),
        INDEX idx_save_workspace_date (workspace_id, saved_at)
      )
    `);
    console.log('File save events table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_versions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        file_id INT NOT NULL,
        workspace_id VARCHAR(36) NOT NULL,
        content LONGTEXT,
        language VARCHAR(50),
        version_number INT NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES workspace_files(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_file_versions (file_id, version_number),
        INDEX idx_workspace_versions (workspace_id)
      )
    `);
    console.log('File versions table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS version_labels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        version_id BIGINT NOT NULL,
        label VARCHAR(100) NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (version_id) REFERENCES file_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_version_label (version_id, label)
      )
    `);
    console.log('Version labels table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        workspace_id VARCHAR(36) NOT NULL,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        response TEXT,
        role ENUM('user', 'assistant') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_workspace (workspace_id),
        INDEX idx_created (created_at)
      )
    `);
    console.log('Chat messages table created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        workspace_id VARCHAR(36) NOT NULL,
        user_id INT NOT NULL,
        username VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_workspace (workspace_id),
        INDEX idx_timestamp (timestamp)
      )
    `);
    console.log('User chat messages table created successfully');

    console.log('\nDatabase setup completed successfully!');
    console.log('You can now start the server with: npm start or node index.js');

  } catch (error) {
    console.error('Error setting up database:', error.message);
    console.error('\nPlease check your MySQL credentials in the .env file:');
    console.error('- DB_HOST');
    console.error('- DB_USER');
    console.error('- DB_PASSWORD');
    console.error('- DB_PORT');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
