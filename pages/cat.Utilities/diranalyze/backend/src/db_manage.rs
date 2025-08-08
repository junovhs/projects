// diranalyze/backend/src/db_manage.rs
use rusqlite::{Connection, Result as RusqliteResult};
use std::path::PathBuf; // PathBuf is still useful for canonicalize

pub fn open_db_connection_with_path(db_path_str: &str) -> RusqliteResult<Connection> {
    let conn = Connection::open(db_path_str)?;
    Ok(conn)
}

pub fn open_db_connection() -> RusqliteResult<Connection> {
    open_db_connection_with_path(".diranalyze_db.sqlite3")
}

pub fn initialize_database(conn: &Connection) -> RusqliteResult<()> {
    // conn.path() returns Option<&str>
    let db_path_str_opt: Option<&str> = conn.path();

    let canonical_path_display: String = match db_path_str_opt {
        Some(path_str) => { // path_str is &str
            // Convert &str to PathBuf to use canonicalize
            match PathBuf::from(path_str).canonicalize() {
                Ok(canon_path) => canon_path.display().to_string(),
                Err(e) => {
                    println!("[DB_SCHEMA] Warning: Could not canonicalize DB path '{}': {:?}", path_str, e);
                    path_str.to_string() // Use the original string path if canonicalize fails
                }
            }
        }
        None => {
            ".diranalyze_db.sqlite3 (Path not directly available from connection object)".to_string()
        }
    };

    println!("[DB_SCHEMA] Initializing schema for database resolved to: '{}'", canonical_path_display);

    conn.execute_batch(
        "BEGIN;
        CREATE TABLE IF NOT EXISTS ProjectVersions (
            version_id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_version_id INTEGER,
            timestamp TEXT NOT NULL,
            description TEXT,
            CONSTRAINT fk_parent_version
                FOREIGN KEY (parent_version_id)
                REFERENCES ProjectVersions (version_id)
                ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS VersionFiles (
            version_file_id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_version_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            CONSTRAINT fk_project_version
                FOREIGN KEY (project_version_id)
                REFERENCES ProjectVersions (version_id)
                ON DELETE CASCADE,
            UNIQUE (project_version_id, file_path)
        );
        CREATE TABLE IF NOT EXISTS OperationLog (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            linked_project_version_id INTEGER,
            timestamp TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            target_entity TEXT,
            content_hash_before TEXT,
            content_hash_after TEXT,
            details_json TEXT
        );
        COMMIT;"
    )?;
    println!("[DB_SCHEMA] Schema initialization SQL batch executed for '{}'.", canonical_path_display);
    Ok(())
}