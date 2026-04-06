use rmcp::handler::server::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::schemars;
use rmcp::{ServerHandler, ServiceExt, model::*, tool, tool_router, tool_handler};
use serde::Deserialize;
use tokio::io::stdin;
use tokio::io::stdout;

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct HelloArgs {
    name: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct AddArgs {
    a: f64,
    b: f64,
}

#[derive(Debug, Clone)]
struct BenchServer {
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl BenchServer {
    #[tool(description = "Say hello")]
    async fn hello(&self, Parameters(args): Parameters<HelloArgs>) -> Result<CallToolResult, rmcp::ErrorData> {
        Ok(CallToolResult::success(vec![Content::text(format!(
            "Hello, {}!",
            args.name
        ))]))
    }

    #[tool(description = "Add two numbers")]
    async fn add(&self, Parameters(args): Parameters<AddArgs>) -> Result<CallToolResult, rmcp::ErrorData> {
        Ok(CallToolResult::success(vec![Content::text(format!(
            "{}",
            args.a + args.b
        ))]))
    }
}

#[tool_handler]
impl ServerHandler for BenchServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder().enable_tools().build(),
        )
        .with_server_info(Implementation::new("official-rust", "1.0.0"))
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let service = BenchServer {
        tool_router: BenchServer::tool_router(),
    }
    .serve((stdin(), stdout()))
    .await
    .expect("Failed to start server");

    service.waiting().await?;
    Ok(())
}
