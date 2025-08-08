// diranalyze/backend/src/version_control.rs

use rusqlite::{Connection, Result, params};
use chrono::{DateTime, Utc};

// Define a simple struct to represent file info coming from the frontend/scanner
#[derive(Debug, serde::Deserialize)] // Deserialize if it comes from an API request
pub struct ScannedFileInfo {
    pub path: String,        // Relative path from project root
    pub hash: String,        // SHA-256 content hash
    pub size: i64,           // File size in bytes
}

/// Creates the initial version (Version 0) of the project in the database.
/// This function assumes it's called after the initial scan of a project.
///
/// # Arguments
/// * `conn` - A mutable reference to the SQLite connection.
/// * `project_root_name` - The name of the root directory of the project.
/// * `files` - A slice of `ScannedFileInfo` structs representing all files in the project.
///
/// # Returns
/// The `version_id` of the newly created project version, or an error.
pub fn create_initial_project_snapshot(
    conn: &mut Connection,
    project_root_name: &str, // Or some unique project identifier if you manage multiple
    files: &[ScannedFileInfo],
) -> Result<i64> {
    let tx = conn.transaction()?;

    let current_timestamp = Utc::now().to_rfc3339();
    let description = format!("Initial snapshot of project: {}", project_root_name);

    // 1. Insert into ProjectVersions
    tx.execute(
        "INSERT INTO ProjectVersions (parent_version_id, timestamp, description) VALUES (NULL, ?1, ?2)",
        params![current_timestamp, description],
    )?;
    let version_id = tx.last_insert_rowid();

    // 2. Insert all files into VersionFiles for this version_id
    let mut stmt_vf = tx.prepare(
        "INSERT INTO VersionFiles (project_version_id, file_path, content_hash, file_size) VALUES (?1, ?2, ?3, ?4)"
    )?;
    for file_info in files {
        stmt_vf.execute(params![
            version_id,
            file_info.path,     // Ensure this path is relative to the project root
            file_info.hash,
            file_info.size
        ])?;
    }
    drop(stmt_vf); // Explicitly drop statement before commit if preferred, or it drops on scope end

    // 3. (Optional) Log this high-level operation in OperationLog
    let op_details = serde_json::json!({
        "project_name": project_root_name,
        "files_count": files.len(),
        "total_size": files.iter().map(|f| f.size).sum::<i64>()
    });
    tx.execute(
        "INSERT INTO OperationLog (linked_project_version_id, timestamp, operation_type, target_entity, details_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            version_id,
            current_timestamp,
            "PROJECT_SNAPSHOT_INITIAL",
            project_root_name,
            op_details.to_string()
        ],
    )?;

    tx.commit()?;
    Ok(version_id)
}

// --- Example Usage (for testing this module, not for direct API use yet) ---
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db_manage; // To use the open_db_connection and initialize_database

    fn setup_test_db() -> Connection {
        // Use an in-memory database for testing
        let mut conn = Connection::open_in_memory().expect("Failed to open in-memory DB");
        db_manage::initialize_database(&conn).expect("Failed to initialize test DB schema");
        conn
    }

    #[test]
    fn test_create_initial_snapshot() {
        let mut conn = setup_test_db();

        let project_name = "MyTestProject";
        let files_data = vec![
            ScannedFileInfo {
                path: "MyTestProject/README.md".to_string(),
                hash: "abc123readmehash".to_string(),
                size: 1024,
            },
            ScannedFileInfo {
                path: "MyTestProject/src/main.js".to_string(),
                hash: "def456mainjshash".to_string(),
                size: 2048,
            },
        ];

        let result = create_initial_project_snapshot(&mut conn, project_name, &files_data);
        assert!(result.is_ok());
        let version_id = result.unwrap();
        assert_eq!(version_id, 1); // First version

        // Verify ProjectVersions table
        let mut stmt_pv = conn.prepare("SELECT description, parent_version_id FROM ProjectVersions WHERE version_id = ?1").unwrap();
        let pv_row = stmt_pv.query_row(params![version_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?))
        }).unwrap();
        assert_eq!(pv_row.0, "Initial snapshot of project: MyTestProject");
        assert_eq!(pv_row.1, None);

        // Verify VersionFiles table
        let mut stmt_vf_count = conn.prepare("SELECT COUNT(*) FROM VersionFiles WHERE project_version_id = ?1").unwrap();
        let vf_count: i64 = stmt_vf_count.query_row(params![version_id], |row| row.get(0)).unwrap();
        assert_eq!(vf_count, 2);

        let mut stmt_vf_readme = conn.prepare("SELECT content_hash, file_size FROM VersionFiles WHERE project_version_id = ?1 AND file_path = ?2").unwrap();
        let vf_readme_row = stmt_vf_readme.query_row(params![version_id, "MyTestProject/README.md"], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        }).unwrap();
        assert_eq!(vf_readme_row.0, "abc123readmehash");
        assert_eq!(vf_readme_row.1, 1024);

        // Verify OperationLog
         let mut stmt_ol_count = conn.prepare("SELECT COUNT(*) FROM OperationLog WHERE linked_project_version_id = ?1").unwrap();
        let ol_count: i64 = stmt_ol_count.query_row(params![version_id], |row| row.get(0)).unwrap();
        assert_eq!(ol_count, 1);
    }
}