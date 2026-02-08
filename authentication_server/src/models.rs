use serde_derive::Deserialize;

#[derive(Deserialize)]
pub struct User {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct UserWithKey { //not in use
    pub username: String,
    pub secret_key: String,
}
#[derive(Deserialize)]
pub struct UserRequest { //not in use
    pub username: String,
    pub password: String,
    pub jwt: String,
}
#[derive(Deserialize)]
pub struct MFARequest {
    pub jwt: String,
    pub password: u32,
}
#[derive(Deserialize)]
pub struct JWTModel {
    pub exp: u128,
    pub user: i32,
    pub pass: bool,
}
