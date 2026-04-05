// Official MCP Go SDK server — hello + add tools over stdio.
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/modelcontextprotocol/go-sdk/server"
)

func main() {
	s := server.NewServer(
		mcp.Implementation{Name: "official-go", Version: "1.0.0"},
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
		Name:        "add",
		Description: "Add two numbers",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]map[string]any{
				"a": {"type": "number"},
				"b": {"type": "number"},
			},
			Required: []string{"a", "b"},
		},
	}, func(ctx context.Context, req mcp.CallToolParams) (*mcp.CallToolResult, error) {
		a, _ := req.Arguments["a"].(float64)
		b, _ := req.Arguments["b"].(float64)
		return &mcp.CallToolResult{
			Content: []mcp.Content{mcp.TextContent{Type: "text", Text: fmt.Sprintf("%g", a+b)}},
		}, nil
	})

	if err := server.RunStdio(context.Background(), s); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
