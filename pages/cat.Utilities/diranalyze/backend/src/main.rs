// diranalyze/backend/src/main.rs

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State as AxumState,
    },
    response::IntoResponse,
    routing::{get, get_service, post},
    Json, Router,
};
use reqwest::Client;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf; // For path manipulation
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::services::ServeDir;
use rusqlite::{params, Connection as RusqliteConnection, Result as RusqliteResult};

// --- Modules for database and version control ---
mod db_manage;
mod version_control;

// --- Structs for API requests ---
#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct ScannedFileInfo {
    pub path: String,
    pub hash: String,
    pub size: i64,
}

#[derive(Debug, serde::Deserialize)]
pub struct InitialSnapshotRequest {
    pub project_root_name: String,
    pub files: Vec<ScannedFileInfo>,
}

// --- Application State for Axum ---
#[derive(Clone)]
struct AppState {
    http_client: Client,
    db_pool: Arc<Mutex<RusqliteConnection>>,
}

// --- Main Application ---
#[tokio::main]
async fn main() {
    dotenvy::dotenv().expect(".env file not found");

    let db_file_path_str = ".diranalyze_db.sqlite3"; // Defined once for consistency

    // --- Step 1: Initialize and verify DB schema BEFORE server operations ---
    println!("\n--- DATABASE INITIALIZATION & VERIFICATION PHASE ---");
    let absolute_db_path_for_log = PathBuf::from(db_file_path_str)
        .canonicalize()
        .map_or_else(|_| db_file_path_str.to_string(), |p| p.display().to_string());
    {
        // Scope for the initial, dedicated schema check connection
        println!("[DB_INIT] Attempting to open database for schema check at: '{}'", absolute_db_path_for_log);
        let conn_for_schema_check = db_manage::open_db_connection_with_path(db_file_path_str)
            .expect("Failed to open DB for schema check");
        println!("[DB_INIT] Database opened for schema check.");

        println!("[DB_INIT] Attempting to initialize database schema...");
        db_manage::initialize_database(&conn_for_schema_check)
            .expect("Failed to initialize database schema during check");
        // initialize_database now logs its own success

        println!("[DB_INIT] Verifying 'ProjectVersions' table creation immediately...");
        let mut stmt_check_pv = conn_for_schema_check
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ProjectVersions';")
            .expect("Failed to prepare 'ProjectVersions' table check statement");
        let project_versions_exists = stmt_check_pv.exists([])
            .expect("Failed to execute 'ProjectVersions' table check");
        drop(stmt_check_pv);

        if project_versions_exists {
            println!("[DB_INIT] >>> SUCCESS: 'ProjectVersions' table was found immediately after init call.");
        } else {
            println!("[DB_INIT] >>> CRITICAL FAILURE: 'ProjectVersions' table was NOT found immediately after init call.");
        }
        
        println!("[DB_INIT] Verifying 'VersionFiles' table creation immediately...");
        let mut stmt_check_vf = conn_for_schema_check
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='VersionFiles';")
            .expect("Failed to prepare 'VersionFiles' table check statement");
        let version_files_exists = stmt_check_vf.exists([])
            .expect("Failed to execute 'VersionFiles' table check");
        drop(stmt_check_vf);

        if version_files_exists {
            println!("[DB_INIT] >>> SUCCESS: 'VersionFiles' table was found immediately after init call.");
        } else {
            println!("[DB_INIT] >>> CRITICAL FAILURE: 'VersionFiles' table was NOT found immediately after init call.");
        }

        println!("[DB_INIT] Verifying 'OperationLog' table creation immediately...");
        let mut stmt_check_ol = conn_for_schema_check
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='OperationLog';")
            .expect("Failed to prepare 'OperationLog' table check statement");
        let operation_log_exists = stmt_check_ol.exists([])
            .expect("Failed to execute 'OperationLog' table check");
        drop(stmt_check_ol);
        
        if operation_log_exists {
            println!("[DB_INIT] >>> SUCCESS: 'OperationLog' table was found immediately after init call.");
        } else {
            println!("[DB_INIT] >>> CRITICAL FAILURE: 'OperationLog' table was NOT found immediately after init call.");
        }
        println!("[DB_INIT] Schema check connection scope ending, changes should be flushed as connection is dropped.");
    } // conn_for_schema_check is dropped here
    println!("--- DATABASE INITIALIZATION & VERIFICATION PHASE COMPLETE ---\n");

    // --- Step 2: Setup for the actual server (re-open connection) ---
    println!("[SERVER_SETUP] Opening new database connection for server operations at: '{}'", absolute_db_path_for_log);
    let db_conn_for_server = db_manage::open_db_connection_with_path(db_file_path_str)
        .expect("Failed to re-open DB connection for server");
    db_manage::initialize_database(&db_conn_for_server) // Call again to be sure server's connection sees it
        .expect("Failed to re-initialize database for server use (this should be fine if first init worked)");
    println!("[SERVER_SETUP] Database connection for server ready.");
    let db_pool = Arc::new(Mutex::new(db_conn_for_server));

    let http_client = Client::new();
    let app_state = AppState { http_client, db_pool };
    let assets_dir = std::path::PathBuf::from("..");

    let app = Router::new()
        .route("/api/llm_proxy", post(llm_proxy_handler))
        .route("/ws", get(websocket_handler))
        .route("/api/snapshot/initial", post(handle_create_initial_snapshot))
        .fallback_service(get_service(ServeDir::new(assets_dir)))
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("--> DirAnalyze backend serving on http://{}", addr);
    println!("--> WebSocket endpoint available at ws://{}/ws", addr);
    println!("--> Database should be fully initialized and accessible for server operations.");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// --- API Handlers ---
async fn llm_proxy_handler( /* ... same as before ... */ AxumState(state): AxumState<AppState>, Json(payload): Json<Value>) -> Result<Json<Value>, axum::http::StatusCode> {
    let api_key = match std::env::var("OPENAI_API_KEY") { Ok(key) => key, Err(_) => { eprintln!("--> ERROR: OPENAI_API_KEY not found in .env file."); return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR); } };
    let api_url = "https://api.openai.com/v1/chat/completions";
    println!("--> LLM_PROXY: Forwarding request to LLM API...");
    let response = state.http_client.post(api_url).bearer_auth(api_key).json(&payload).send().await;
    match response {
        Ok(res) => {
            if res.status().is_success() { println!("--> LLM_PROXY: Success from LLM API"); let body: Value = res.json().await.unwrap_or_else(|_| json!({"error": "Failed to parse LLM response"})); Ok(Json(body)) }
            else { let status = res.status(); let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string()); eprintln!("--> LLM_PROXY: Error from LLM API ({}): {}", status, error_text); Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR) }
        }
        Err(e) => { eprintln!("--> LLM_PROXY: Failed to send request to LLM API: {}", e); Err(axum::http::StatusCode::BAD_GATEWAY) }
    }
}

async fn handle_create_initial_snapshot(
    AxumState(state): AxumState<AppState>,
    Json(payload): Json<InitialSnapshotRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    println!("--> API_SNAPSHOT: Received request for project: {}", payload.project_root_name);
    println!("--> API_SNAPSHOT: Files to snapshot: {} files", payload.files.len());

    let files_to_snapshot_for_vc_mod: Vec<version_control::ScannedFileInfo> = payload.files.into_iter().map(|f| {
        version_control::ScannedFileInfo { path: f.path, hash: f.hash, size: f.size }
    }).collect();

    let mut conn_guard = state.db_pool.lock().await;
    println!("--> API_SNAPSHOT: Acquired DB lock.");

    let version_id_result = version_control::create_initial_project_snapshot(
        &mut conn_guard,
        &payload.project_root_name,
        &files_to_snapshot_for_vc_mod,
    );

    match version_id_result {
        Ok(version_id) => {
            println!("--> API_SNAPSHOT: Successfully created initial snapshot. Version ID: {}", version_id);
            
            // Attempt PRAGMAs after successful operation, before lock is released.
            // These might help ensure data is visible externally, though their effect can vary.
            // WAL mode needs to be enabled for PRAGMA wal_checkpoint to be most effective.
            // For default rollback journal, these are less critical but won't hurt.
            match conn_guard.execute("PRAGMA wal_checkpoint(TRUNCATE);", []) { // TRUNCATE is more aggressive
                Ok(updated_rows) => println!("--> API_SNAPSHOT: Attempted PRAGMA wal_checkpoint(TRUNCATE); Rows updated (usually 0 unless in WAL and checkpointing): {}", updated_rows),
                Err(e) => println!("--> API_SNAPSHOT: Error/Info attempting PRAGMA wal_checkpoint(TRUNCATE) (may be harmless if not in WAL mode): {:?}", e),
            }
            match conn_guard.execute("PRAGMA optimize;", []) {
                 Ok(updated_rows) => println!("--> API_SNAPSHOT: Attempted PRAGMA optimize; Rows updated (usually 0): {}", updated_rows),
                Err(e) => println!("--> API_SNAPSHOT: Error attempting PRAGMA optimize: {:?}", e),
            }
            println!("--> API_SNAPSHOT: Releasing DB lock.");
            // conn_guard is dropped here, releasing the lock.
            
            Ok(Json(json!({ "message": "Initial snapshot created successfully", "version_id": version_id })))
        }
        Err(e) => {
            eprintln!("--> API_SNAPSHOT: Error creating initial snapshot: {:?}", e);
            // Lock is also dropped here if we return early.
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn websocket_handler( /* ... same as before ... */ ws: WebSocketUpgrade, AxumState(_state): AxumState<AppState>) -> impl IntoResponse {
    println!("--> WS: Upgrade request received.");
    ws.on_upgrade(handle_socket)
}
async fn handle_socket(mut socket: WebSocket) { /* ... same as before ... */ 
    println!("--> WS: Client connected");
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(t)) => { println!("--> WS: Received text message: {}", t); if socket.send(Message::Text(format!("Echo from backend: {}", t))).await.is_err() { println!("--> WS: Client disconnected (send error)."); break; } }
            Ok(Message::Binary(b)) => { println!("--> WS: Received binary message: {} bytes", b.len()); if socket.send(Message::Binary(b)).await.is_err() { println!("--> WS: Client disconnected (send error)."); break; } }
            Ok(Message::Close(_)) => { println!("--> WS: Client sent close message."); break; }
            Err(e) => { println!("--> WS: Error: {}", e); break; }
            _ => { println!("--> WS: Received other message type."); }
        }
    }
    println!("--> WS: Connection closed.");
}