use bcrypt;
use dotenv;
use crate::{errors::JWTError, models::JWTModel};
use std::env;
use base64::{engine::general_purpose::URL_SAFE, Engine as _};
use sha2::Sha256;
use hmac::{Hmac, Mac};
use std::time::{SystemTime, UNIX_EPOCH};
/// Hashes the password using bcrypt
pub fn hash(password: &str) -> String {
    //Hashes the password
    let the_hash = bcrypt::hash(password, 12);
    match the_hash {
        Ok(t) => t,
        Err(_e) => "error".to_string(),
    }
}
/// Verifies the password
pub fn verify_password(password: &str, hashed_password: &str) -> bool {
    let verified = bcrypt::verify(password, hashed_password);
    match verified {
        Ok(x) => {
            return x;
        },
        Err(_) => {
            return false;
        }
    }
}
/// Creates a JWT Token with a given header and body
fn create_jwt(header: &str, body: &str) -> Result<String, JWTError> {
    dotenv::dotenv().ok();
    let jwt_secret = env::var("JWT_SECRET");
    let secret = match jwt_secret {
        Ok(val) => val,
        Err(_) => "Error".to_string(),
    };
    // Cleans the inputs by removing newlines and spaces
    let header_token: String = URL_SAFE.encode(header.replace(" ", "").replace("\n", ""));
    let body_token: String = URL_SAFE.encode(body.replace(" ", "").replace("\n", ""));
    let combined = format!("{}.{}", header_token, body_token);
    type HmacSha256 = Hmac<Sha256>;
    let mut hashed_body = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(success) => success,
        Err(_) => return Err(JWTError::HashingError),
    };
    hashed_body.update(combined.as_bytes());
    let result = hashed_body.finalize().into_bytes();
    let final_token = format!("{}.{}", combined, URL_SAFE.encode(result));
    return Ok(final_token);
}
/// Returns an invalid signature error if the signature is invalid, and returns 0 if the signature is expired, and returns the user id if otherwise
pub fn verify_jwt_signature(token: &str) -> Result<i32, JWTError> {
    dotenv::dotenv().ok();
    let jwt_secret = env::var("JWT_SECRET");
    let secret = match jwt_secret {
        Ok(val) => val,
        Err(_) => "Error".to_string(),
    };
    let mut split_token = token.split(".");
    let head = match split_token.next() {
        Some(success) => success,
        None => return Err(JWTError::JWTFormattingError),
    };
    let body = match split_token.next() {
        Some(success) => success,
        None => return Err(JWTError::JWTFormattingError),
    };
    
    let head_body = format!("{}.{}", head, body);
    type HmacSha256 = Hmac<Sha256>;
    let mut hashed_body = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(success) => success,
        Err(_) => return Err(JWTError::HashingError),
    };
    hashed_body.update(head_body.as_bytes());
    let result = hashed_body.finalize().into_bytes();
    let final_token = format!("{}.{}", head_body, URL_SAFE.encode(result));
    if token != final_token {
        return Err(JWTError::InvalidSignatureError);
    }
    let decoded_body = match URL_SAFE.decode(body) {
        Ok(success) => match String::from_utf8(success) {
            Ok(decoded) => decoded,
            Err(_) => return Err(JWTError::JWTFormattingError),
        },
        Err(_) => return Err(JWTError::HashingError),
    };
    let result: Result<JWTModel, serde_json::Error> = serde_json::from_str(&decoded_body);
    let request: JWTModel = match result {
        Ok(req) => {
            req
        }
        Err(_) => {
            return Err(JWTError::HashingError);
        }
            
    };
    let current_time = SystemTime::now();
    let ms_since_epoch = current_time.duration_since(UNIX_EPOCH).expect("Time should go forward!").as_millis();
    if request.exp < ms_since_epoch {
        return Ok(0);
    }
    return Ok(request.user);
}
/// Parses the JWT to see the current login state. Returns 0 if the user is not logged in, 1 if the JWT shows that the password is valid
pub fn parse_jwt_signature(token: &str) -> Result<u8, JWTError> { 
    let mut split_token = token.split(".");
    let _head = match split_token.next() {
        Some(success) => success,
        None => return Err(JWTError::JWTFormattingError),
    };
    let body = match split_token.next() {
        Some(success) => success,
        None => return Err(JWTError::JWTFormattingError),
    };
    let decoded_body = match URL_SAFE.decode(body) {
        Ok(success) => match String::from_utf8(success) {
            Ok(decoded) => decoded,
            Err(_) => return Err(JWTError::JWTFormattingError),
        },
        Err(_) => return Err(JWTError::HashingError),
    };
    let result: Result<JWTModel, serde_json::Error> = serde_json::from_str(&decoded_body);
    let request: JWTModel = match result {
        Ok(req) => {
            req
        }
        Err(_) => {
            return Err(JWTError::HashingError);
        }
            
    };
    if request.pass {
        return Ok(1);
    }
    return Ok(0);
    
}
pub fn generate_jwt_based_on_state(user_id: i32, is_password_correct: bool) -> Result<String, JWTError> {
    // let secret =  "a-string-secret-at-least-256-bits-long";
    let header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    let current_time = SystemTime::now();
    let ms_since_epoch = current_time.duration_since(UNIX_EPOCH).expect("Time should go forward!").as_millis() + 1800000;
    let body = format!("{{\"exp\":{},\"user\":{},\"pass\":{}}}", ms_since_epoch, user_id, is_password_correct);
    return create_jwt(&header, &body);
}