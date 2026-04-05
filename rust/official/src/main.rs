use rmcp::{
    ServerHandler,
    ServiceExt,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router,
    transport::stdio,
};

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct HelloRequest {
    pub name: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct AddRequest {
    pub a: f64,
    pub b: f64,
}

#[derive(Debug, Clone)]
pub struct BenchServer {
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl BenchServer {
    pub fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "Say hello to someone")]
    fn hello(&self, Parameters(HelloRequest { name }): Parameters<HelloRequest>) -> String {
        format!("Hello, {name}!")
    }

    #[tool(description = "Add two numbers together")]
    fn add(&self, Parameters(AddRequest { a, b }): Parameters<AddRequest>) -> String {
        serde_json::json!({"sum": a + b}).to_string()
    }
}

#[tool_handler]
impl ServerHandler for BenchServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let service = BenchServer::new().serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}
