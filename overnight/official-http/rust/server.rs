use rmcp::handler::server::tool::Parameters;
use rmcp::schemars;
use rmcp::{ServerHandler, ServiceExt, model::*, tool};
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
struct BenchServer;

#[tool(tool_box)]
impl BenchServer {
    #[tool(description = "Say hello")]
    async fn hello(&self, Parameters(args): Parameters<HelloArgs>) -> Result<CallToolResult, rmcp::Error> {
        Ok(CallToolResult::success(vec![Content::text(format!(
            "Hello, {}!",
            args.name
        ))]))
    }

    #[tool(description = "Add two numbers")]
    async fn add(&self, Parameters(args): Parameters<AddArgs>) -> Result<CallToolResult, rmcp::Error> {
        Ok(CallToolResult::success(vec![Content::text(format!(
            "{}",
            args.a + args.b
        ))]))
    }
}

impl ServerHandler for BenchServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities {
                tools: Some(ToolsCapability::default()),
                ..Default::default()
            },
            server_info: Implementation {
                name: "official-rust".into(),
                version: "1.0.0".into(),
            },
            instructions: None,
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let service = BenchServer
        .serve((stdin(), stdout()))
        .await
        .expect("Failed to start server");

    service.waiting().await?;
    Ok(())
}
