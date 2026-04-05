use rmcp::handler::server::tool::Parameters;
use rmcp::schemars;
use rmcp::{ServerHandler, ServiceExt, model::*, tool};
use serde::Deserialize;
use std::sync::Mutex;
use tokio::io::stdin;
use tokio::io::stdout;

static LEAKS: Mutex<Vec<Vec<u8>>> = Mutex::new(Vec::new());

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct HelloArgs {
    name: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct EmptyArgs {}

#[derive(Debug, Clone)]
struct ChaosServer;

#[tool(tool_box)]
impl ChaosServer {
    #[tool(description = "Say hello")]
    async fn hello(&self, Parameters(args): Parameters<HelloArgs>) -> Result<CallToolResult, rmcp::Error> {
        Ok(CallToolResult::success(vec![Content::text(format!(
            "Hello, {}!",
            args.name
        ))]))
    }

    #[tool(description = "Tool that throws")]
    async fn throw_error(&self, Parameters(_args): Parameters<EmptyArgs>) -> Result<CallToolResult, rmcp::Error> {
        Err(rmcp::Error::invalid_params(
            "Intentional chaos: unhandled exception",
            None,
        ))
    }

    #[tool(description = "Tool that hangs forever")]
    async fn hang(&self, Parameters(_args): Parameters<EmptyArgs>) -> Result<CallToolResult, rmcp::Error> {
        tokio::time::sleep(std::time::Duration::from_secs(86400)).await;
        Ok(CallToolResult::success(vec![Content::text("unreachable")]))
    }

    #[tool(description = "Tool that takes 3 seconds")]
    async fn slow(&self, Parameters(_args): Parameters<EmptyArgs>) -> Result<CallToolResult, rmcp::Error> {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        Ok(CallToolResult::success(vec![Content::text(
            r#"{"status":"ok","delay_ms":3000}"#,
        )]))
    }

    #[tool(description = "Tool that leaks memory")]
    async fn leak_memory(&self, Parameters(_args): Parameters<EmptyArgs>) -> Result<CallToolResult, rmcp::Error> {
        let count = {
            let mut leaks = LEAKS.lock().unwrap();
            leaks.push(vec![0u8; 1024 * 1024]);
            leaks.len()
        };
        Ok(CallToolResult::success(vec![Content::text(format!(
            r#"{{"leaked_buffers":{},"total_mb":{}}}"#,
            count, count
        ))]))
    }

    #[tool(description = "Tool that writes to stdout")]
    async fn stdout_corrupt(&self, Parameters(_args): Parameters<EmptyArgs>) -> Result<CallToolResult, rmcp::Error> {
        println!("CORRUPTED OUTPUT");
        Ok(CallToolResult::success(vec![Content::text(
            r#"{"status":"ok"}"#,
        )]))
    }
}

impl ServerHandler for ChaosServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities {
                tools: Some(ToolsCapability::default()),
                ..Default::default()
            },
            server_info: Implementation {
                name: "chaos-rust".into(),
                version: "0.1.0".into(),
            },
            instructions: None,
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let service = ChaosServer
        .serve((stdin(), stdout()))
        .await
        .expect("Failed to start server");

    service.waiting().await?;
    Ok(())
}
