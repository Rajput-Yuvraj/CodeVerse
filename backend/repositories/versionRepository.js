const { pool } = require('../config/db');

const MAX_VERSIONS_PER_FILE = 50;

class VersionRepository {
  /**
   * Create a new version snapshot for a file.
   * Auto-computes version_number and prunes old versions beyond the limit.
   */
  async createVersion(fileId, workspaceId, content, language, userId) {
    try {
      const versionNumber = (await this.getLatestVersionNumber(fileId)) + 1;

      const [result] = await pool.query(
        `INSERT INTO file_versions (file_id, workspace_id, content, language, version_number, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fileId, workspaceId, content, language || null, versionNumber, userId]
      );

      // Prune old versions (non-blocking)
      this.pruneOldVersions(fileId).catch(err =>
        console.error('Error pruning old versions:', err)
      );

      return {
        id: result.insertId,
        file_id: fileId,
        workspace_id: workspaceId,
        version_number: versionNumber,
        created_by: userId,
      };
    } catch (error) {
      console.error('Error creating version:', error);
      throw error;
    }
  }

  /**
   * Get all versions for a file, newest first, with labels and author username.
   */
  async getVersionsByFile(fileId, workspaceId) {
    try {
      const [versions] = await pool.query(
        `SELECT
           fv.id,
           fv.version_number,
           fv.language,
           fv.created_by,
           fv.created_at,
           u.username AS author,
           (SELECT GROUP_CONCAT(
              CONCAT(vl.id, ':', vl.label) SEPARATOR '||'
            )
            FROM version_labels vl WHERE vl.version_id = fv.id
           ) AS labels_raw
         FROM file_versions fv
         INNER JOIN users u ON u.id = fv.created_by
         WHERE fv.file_id = ? AND fv.workspace_id = ?
         ORDER BY fv.version_number DESC`,
        [fileId, workspaceId]
      );

      // Parse labels
      return versions.map(v => ({
        ...v,
        labels: v.labels_raw
          ? v.labels_raw.split('||').map(l => {
              const [id, label] = l.split(':');
              return { id: Number(id), label };
            })
          : [],
        labels_raw: undefined,
      }));
    } catch (error) {
      console.error('Error getting versions:', error);
      throw error;
    }
  }

  /**
   * Get a single version's full content by its ID.
   */
  async getVersionById(versionId) {
    try {
      const [rows] = await pool.query(
        `SELECT fv.*, u.username AS author
         FROM file_versions fv
         INNER JOIN users u ON u.id = fv.created_by
         WHERE fv.id = ?`,
        [versionId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting version by ID:', error);
      throw error;
    }
  }

  /**
   * Get the latest version number for a file (0 if none exist).
   */
  async getLatestVersionNumber(fileId) {
    try {
      const [rows] = await pool.query(
        'SELECT MAX(version_number) AS max_num FROM file_versions WHERE file_id = ?',
        [fileId]
      );
      return rows[0].max_num || 0;
    } catch (error) {
      console.error('Error getting latest version number:', error);
      throw error;
    }
  }

  /**
   * Add a named label to a version.
   */
  async addLabel(versionId, label, userId) {
    try {
      const [result] = await pool.query(
        'INSERT INTO version_labels (version_id, label, created_by) VALUES (?, ?, ?)',
        [versionId, label, userId]
      );
      return { id: result.insertId, version_id: versionId, label };
    } catch (error) {
      console.error('Error adding label:', error);
      throw error;
    }
  }

  /**
   * Remove a label by its ID.
   */
  async removeLabel(labelId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM version_labels WHERE id = ?',
        [labelId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error removing label:', error);
      throw error;
    }
  }

  /**
   * Delete the oldest versions beyond the keep limit for a file.
   */
  async pruneOldVersions(fileId, keepCount = MAX_VERSIONS_PER_FILE) {
    try {
      const [rows] = await pool.query(
        `SELECT id FROM file_versions
         WHERE file_id = ?
         ORDER BY version_number DESC
         LIMIT 18446744073709551615 OFFSET ?`,
        [fileId, keepCount]
      );

      if (rows.length > 0) {
        const idsToDelete = rows.map(r => r.id);
        await pool.query(
          'DELETE FROM file_versions WHERE id IN (?)',
          [idsToDelete]
        );
      }
    } catch (error) {
      console.error('Error pruning old versions:', error);
      throw error;
    }
  }

  /**
   * Get the total version count for a file.
   */
  async getVersionCount(fileId) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS count FROM file_versions WHERE file_id = ?',
        [fileId]
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error getting version count:', error);
      throw error;
    }
  }
}

module.exports = new VersionRepository();
