// Official MCP Go SDK server with chaos tools for resilience testing.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/modelcontextprotocol/go-sdk/server"
)

var leaks [][]byte

func main() {
	s := server.NewServer(
		mcp.Implementation{Name: "official-chaos", Version: "1.0.0"},
		nil,
	)

	s.AddTool(mcp.Tool{
		Name:        "hello",
		Description: "Say hello",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]map[string]any{
				"name": {"type": "string"},
			},
			Required: []string{"name"},
		},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		name, _ := req.Arguments["name"].(string)
		return &mcp.CallToolResult{
			Content: []mcp.Content{mcp.TextContent{Type: "text", Text: fmt.Sprintf("Hello, %s!", name)}},
		}, nil
	})

	s.AddTool(mcp.Tool{
		Name:        "throw_error",
		Description: "Tool that throws",
		InputSchema: mcp.ToolInputSchema{Type: "object"},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		return nil, fmt.Errorf("Intentional chaos: unhandled exception")
	})

	s.AddTool(mcp.Tool{
		Name:        "hang",
		Description: "Tool that hangs forever",
		InputSchema: mcp.ToolInputSchema{Type: "object"},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		time.Sleep(86400 * time.Second)
		return &mcp.CallToolResult{
			Content: []mcp.Content{mcp.TextContent{Type: "text", Text: "unreachable"}},
		}, nil
	})

	s.AddTool(mcp.Tool{
		Name:        "slow",
		Description: "Tool that takes 3 seconds",
		InputSchema: mcp.ToolInputSchema{Type: "object"},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		time.Sleep(3 * time.Second)
		return &mcp.CallToolResult{
			Content: []mcp.Content{mcp.TextContent{Type: "text", Text: `{"status":"ok","delay_ms":3000}`}},
		}, nil
	})

	s.AddTool(mcp.Tool{
		Name:        "leak_memory",
		Description: "Tool that leaks memory",
		InputSchema: mcp.ToolInputSchema{Type: "object"},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		leaks = append(leaks, make([]byte, 1024*1024))
		return &mcp.CallToolResult{
			Content: []mcp.Content{mcp.TextContent{Type: "text", Text: fmt.Sprintf(`{"leaked_buffers":%d,"total_mb":%d}`, len(leaks), len(leaks))}},
		}, nil
	})

	s.AddTool(mcp.Tool{
		Name:        "stdout_corrupt",
		Description: "Tool that writes to stdout",
		InputSchema: mcp.ToolInputSchema{Type: "object"},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		os.Stdout.WriteString("CORRUPTED OUTPUT\n")
		return &mcp.CallToolResult{
			Content: []mcp.Content{mcp.TextContent{Type: "text", Text: `{"status":"ok"}`}},
		}, nil
	})

	if err := server.RunStdio(context.Background(), s); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
