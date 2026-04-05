use rmcp::{
    ServerHandler, ServiceExt,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router,
    transport::stdio,
};
use std::sync::Mutex;

static LEAKS: Mutex<Vec<Vec<u8>>> = Mutex::new(Vec::new());

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct HelloArgs { name: String }

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct EmptyArgs {}

#[derive(Debug, Clone)]
struct ChaosServer { tool_router: ToolRouter<Self> }

#[tool_router]
impl ChaosServer {
    fn new() -> Self { Self { tool_router: Self::tool_router() } }

    #[tool(description = "Say hello")]
    fn hello(&self, Parameters(HelloArgs { name }): Parameters<HelloArgs>) -> String {
        format!("Hello, {name}!")
    }

    #[tool(description = "Tool that throws")]
    fn throw_error(&self, Parameters(_): Parameters<EmptyArgs>) -> Result<String, String> {
        Err("Intentional chaos: unhandled exception".into())
    }

    #[tool(description = "Tool that hangs forever")]
    async fn hang(&self, Parameters(_): Parameters<EmptyArgs>) -> String {
        tokio::time::sleep(std::time::Duration::from_secs(86400)).await;
        "unreachable".into()
    }

    #[tool(description = "Tool that takes 3 seconds")]
    async fn slow(&self, Parameters(_): Parameters<EmptyArgs>) -> String {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        r#"{"status":"ok","delay_ms":3000}"#.into()
    }

    #[tool(description = "Tool that leaks memory")]
    fn leak_memory(&self, Parameters(_): Parameters<EmptyArgs>) -> String {
        let count = {
            let mut leaks = LEAKS.lock().unwrap();
            leaks.push(vec![0u8; 1024 * 1024]);
            leaks.len()
        };
        format!(r#"{{"leaked_buffers":{count},"total_mb":{count}}}"#)
    }

    #[tool(description = "Tool that writes to stdout")]
    fn stdout_corrupt(&self, Parameters(_): Parameters<EmptyArgs>) -> String {
        println!("CORRUPTED OUTPUT");
        r#"{"status":"ok"}"#.into()
    }
}

#[tool_handler]
impl ServerHandler for ChaosServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let server = ChaosServer::new().serve(stdio()).await?;
    server.waiting().await?;
    Ok(())
}
