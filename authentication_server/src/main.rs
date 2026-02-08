use actix_web::{App, HttpResponse, HttpServer, Responder, post, get, web::Json, HttpRequest};
use actix_cors::Cors;

// Using 'crate' is the safest way to refer to your own modules
use lib::helpers::database_interface::{
    get_user_id_from_username, reset_database, verify_password_from_database, create_new_user
};
use lib::helpers::math::{generate_jwt_based_on_state, verify_jwt_signature};
use lib::models::*;

/// Helper: Extracts user_id from JWT in the Authorization header
fn get_user_id_from_header(req: &HttpRequest) -> Result<i32, String> {
    let header = req.headers().get("Authorization")
        .ok_or("No Authorization header")?
        .to_str()
        .map_err(|_| "Invalid header format")?;

    // Remove "Bearer " prefix
    let token = header.strip_prefix("Bearer ").unwrap_or(header);

    match verify_jwt_signature(token) {
        Ok(user_id) if user_id > 0 => Ok(user_id),
        Ok(_) => Err("Token expired".to_string()),
        Err(_) => Err("Invalid token".to_string()),
    }
}

#[post("/register_user")]
async fn register_user(user_data: Json<User>) -> impl Responder {
    match create_new_user(&user_data.username, &user_data.password).await {
        Ok(id) => HttpResponse::Ok().json(id),
        Err(_) => HttpResponse::InternalServerError().json("Registration failed"),
    }
}

#[post("/verify_login")]
async fn verify_login(user_data: Json<User>) -> impl Responder {
    let user_id = match get_user_id_from_username(&user_data.username).await {
        Ok(Some(id)) => id,
        Ok(None) => return HttpResponse::NotFound().json("User does not exist"),
        Err(_) => return HttpResponse::InternalServerError().json("Database error"),
    };

    if verify_password_from_database(user_id, &user_data.password).await {
        // user_id, is_password_correct
        match generate_jwt_based_on_state(user_id, true) {
            Ok(jwt) => HttpResponse::Ok().json(jwt),
            Err(_) => HttpResponse::InternalServerError().json("JWT failed"),
        }
    } else {
        HttpResponse::Unauthorized().json("Wrong Password")
    }
}

/// New Route: Validates a JWT sent from the frontend
#[post("/validate_session")]
async fn validate_session(req: HttpRequest) -> impl Responder {
    match get_user_id_from_header(&req) {
        Ok(user_id) => HttpResponse::Ok().json(serde_json::json!({ "status": "valid", "user_id": user_id })),
        Err(e) => HttpResponse::Unauthorized().json(e),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Server starting on 127.0.0.1:8081");
    
    HttpServer::new(|| {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .wrap(cors)
            .service(register_user)
            .service(verify_login)
            .service(validate_session)
    })
    .bind(("127.0.0.1", 8081))?
    .run()
    .await
}