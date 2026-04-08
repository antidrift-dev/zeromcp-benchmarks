// ZeroMCP over Actix-web
//
// Build: cargo build --release --bin server-actix

use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::{json, Value};
use std::sync::Arc;
use zeromcp::{Ctx, Input, Permissions, Prompt, PromptArgument, PromptContent, PromptMessage, Resource, Server, Tool};

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

    // ---- Resources ----

    server.resource(Resource {
        uri: "resource:///data.json".to_string(),
        name: "data".to_string(),
        description: "Static JSON data".to_string(),
        mime_type: "application/json".to_string(),
        read: Box::new(|| {
            Box::pin(async { Ok(r#"{"key":"value","count":42}"#.to_string()) })
        }),
    });

    server.resource(Resource {
        uri: "resource:///dynamic".to_string(),
        name: "dynamic".to_string(),
        description: "Dynamic resource".to_string(),
        mime_type: "application/json".to_string(),
        read: Box::new(|| {
            Box::pin(async { Ok(r#"{"dynamic":true}"#.to_string()) })
        }),
    });

    // ---- Prompts ----

    server.prompt(Prompt {
        name: "greet".to_string(),
        description: Some("Generate a greeting message".to_string()),
        arguments: Some(vec![
            PromptArgument {
                name: "name".to_string(),
                description: Some("Name of the person to greet".to_string()),
                required: Some(true),
            },
            PromptArgument {
                name: "tone".to_string(),
                description: Some("Tone of the greeting".to_string()),
                required: Some(false),
            },
        ]),
        render: Box::new(|args: Value| {
            Box::pin(async move {
                let name = args["name"].as_str().unwrap_or("world");
                let tone = args["tone"].as_str().unwrap_or("friendly");
                Ok(vec![PromptMessage {
                    role: "user".to_string(),
                    content: PromptContent::Text {
                        text: format!("Please greet {name} in a {tone} tone."),
                    },
                }])
            })
        }),
    });

    server
}

async fn health(data: web::Data<Arc<Server>>) -> HttpResponse {
    let _ = data;
    HttpResponse::Ok().json(json!({"status": "ok", "tools": 3, "resources": 2, "prompts": 1}))
}

async fn mcp(
    data: web::Data<Arc<Server>>,
    body: web::Json<Value>,
) -> HttpResponse {
    let request = body.into_inner();
    match data.handle_request(&request).await {
        Some(response) => HttpResponse::Ok().json(response),
        None => HttpResponse::Ok().json(json!({})),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let server = Arc::new(create_server());
    eprintln!("[actix-web] listening on :{port}");

    HttpServer::new(move || {
        let server = server.clone();
        App::new()
            .app_data(web::Data::new(server))
            .route("/health", web::get().to(health))
            .route("/mcp", web::post().to(mcp))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
