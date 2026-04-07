// ZeroMCP over Axum
//
// Build: cargo build --release --bin server-axum

use axum::{extract::State, routing::{get, post}, Json, Router};
use serde_json::{json, Value};
use std::sync::Arc;
use zeromcp::{Ctx, Input, Permissions, Server, Tool};

fn create_server() -> Server {
    let mut server = Server::new();

    server.tool(
        "hello",
        Tool {
            description: "Say hello to someone".to_string(),
            input: Input::new().required_desc("name", "string", "Who to greet"),
            permissions: Permissions::default(), cached_schema: Default::default(),
            execute: Box::new(|args: Value, _ctx: Ctx| {
                Box::pin(async move {
                    let name = args["name"].as_str().unwrap_or("world");
                    Ok(Value::String(format!("Hello, {name}!")))
                })
            }),
        },
    );

    server.tool(
        "add",
        Tool {
            description: "Add two numbers together".to_string(),
            input: Input::new()
                .required_desc("a", "number", "First number")
                .required_desc("b", "number", "Second number"),
            permissions: Permissions::default(), cached_schema: Default::default(),
            execute: Box::new(|args: Value, _ctx: Ctx| {
                Box::pin(async move {
                    let a = args["a"].as_f64().unwrap_or(0.0);
                    let b = args["b"].as_f64().unwrap_or(0.0);
                    Ok(json!({"sum": a + b}))
                })
            }),
        },
    );

    server.tool(
        "create_invoice",
        Tool {
            description: "Create an invoice".to_string(),
            input: Input::new()
                .required_desc("customer", "string", "Customer name")
                .required_desc("amount", "number", "Invoice amount"),
            permissions: Permissions::default(), cached_schema: Default::default(),
            execute: Box::new(|args: Value, _ctx: Ctx| {
                Box::pin(async move {
                    let customer = args["customer"].as_str().unwrap_or("unknown");
                    let amount = args["amount"].as_f64().unwrap_or(0.0);
                    Ok(json!({
                        "id": "INV-001",
                        "customer": customer,
                        "amount": amount,
                        "status": "created"
                    }))
                })
            }),
        },
    );

    server
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok", "tools": 3}))
}

async fn mcp(State(server): State<Arc<Server>>, Json(request): Json<Value>) -> Json<Value> {
    match server.handle_request(&request).await {
        Some(response) => Json(response),
        None => Json(json!({})),
    }
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let server = Arc::new(create_server());

    let app = Router::new()
        .route("/health", get(health))
        .route("/mcp", post(mcp))
        .with_state(server);

    let addr = format!("0.0.0.0:{port}");
    eprintln!("[axum] listening on :{port}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
