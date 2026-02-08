use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::helpers::math::{hash, verify_password};
use crate::errors::UserError;

const SUPABASE_URL: &str = "https://ohtddidtxggzuutvcxtu.supabase.co/rest/v1";
const API_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGRkaWR0eGdnenV1dHZjeHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5MDk5OSwiZXhwIjoyMDg2MDY2OTk5fQ.A3cb55Wv5Kj16g1xDkDuAlLzZimQgOLfUF-0H2w5ET0"; // Use Service Role Key for backend access

#[derive(Serialize, Deserialize)]
struct UserRow {
    id: i32,
    username: String,
}

#[derive(Serialize, Deserialize)]
struct AuthRow {
    password_hash: String,
}
pub async fn verify_password_from_database(user_id: i32, password: &str) -> bool {
    // We call our HTTP-based get_user_password
    match get_user_password(user_id).await {
        Ok(Some(hashed_password)) => {
            // verify_password comes from your math.rs helper
            verify_password(password, &hashed_password)
        },
        _ => false,
    }
}

pub async fn reset_database() -> Result<bool, UserError> {
    let client = get_client();

    // 1. Delete all authentication records
    // In PostgREST, a DELETE with no filters (or a 'not.is.null' filter) clears the table
    client.delete(format!("{}/authentication?user_id=gt.0", SUPABASE_URL))
        .send()
        .await
        .map_err(|_| UserError::DatabaseLookupError)?;

    // 2. Delete all users
    client.delete(format!("{}/users?id=gt.0", SUPABASE_URL))
        .send()
        .await
        .map_err(|_| UserError::DatabaseLookupError)?;

    // 3. Re-seed test data
    // Note: Since we are using standard HTTP, we just call our own create function
    create_new_user("Alice", "1234").await?;
    create_new_user("Bob", "12345").await?;
    create_new_user("Eve", "123456").await?;

    println!("Database reset and seeded via HTTPS");
    Ok(true)
}
// Helper to create the HTTP client with headers
fn get_client() -> Client {
    Client::builder()
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("apikey", API_KEY.parse().unwrap());
            headers.insert("Authorization", format!("Bearer {}", API_KEY).parse().unwrap());
            headers.insert("Content-Type", "application/json".parse().unwrap());
            headers.insert("Prefer", "return=representation".parse().unwrap());
            headers
        })
        .build()
        .unwrap()
}

pub async fn get_user_id_from_username(username: &str) -> Result<Option<i32>, UserError> {
    let client = get_client();
    let url = format!("{}/users?username=eq.{}", SUPABASE_URL, username);

    let response = client.get(url).send().await.map_err(|_| UserError::DatabaseLookupError)?;
    let users: Vec<UserRow> = response.json().await.map_err(|_| UserError::DatabaseLookupError)?;

    Ok(users.first().map(|u| u.id))
}

pub async fn get_user_password(user_id: i32) -> Result<Option<String>, UserError> {
    let client = get_client();
    let url = format!("{}/authentication?user_id=eq.{}", SUPABASE_URL, user_id);

    let response = client.get(url).send().await.map_err(|_| UserError::DatabaseLookupError)?;
    let auths: Vec<AuthRow> = response.json().await.map_err(|_| UserError::DatabaseLookupError)?;

    Ok(auths.first().map(|a| a.password_hash.clone()))
}

pub async fn create_new_user(username: &str, password: &str) -> Result<i32, UserError> {
    let client = get_client();
    
    // 1. Create the user
    let user_payload = serde_json::json!({ "username": username });
    let user_resp = client.post(format!("{}/users", SUPABASE_URL))
        .json(&user_payload)
        .send().await.map_err(|_| UserError::DatabaseLookupError)?;

    let user: Vec<UserRow> = user_resp.json().await.map_err(|_| UserError::DatabaseLookupError)?;
    let new_id = user[0].id;

    // 2. Create the auth entry
    let auth_payload = serde_json::json!({
        "user_id": new_id,
        "password_hash": hash(password)
    });

    client.post(format!("{}/authentication", SUPABASE_URL))
        .json(&auth_payload)
        .send().await.map_err(|_| UserError::DatabaseLookupError)?;

    Ok(new_id)
}