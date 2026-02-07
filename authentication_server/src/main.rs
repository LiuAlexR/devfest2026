use dotenv::dotenv;
use std::env;
fn main() {
    println!("Hello, world!");
    dotenv().ok();
    let JWT_SECRET = env::var("JWT_SECRET");
    match JWT_SECRET {
        Ok(val) => println!("{}", val),
        Err(e) => println!("Error API_KEY: {}", e),
    }
}
