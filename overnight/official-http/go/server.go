// Official MCP Go SDK server — hello + add tools over stdio.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	s := mcp.NewServer(&mcp.Implementation{Name: "official-go", Version: "1.0.0"}, nil)

	s.AddTool(&mcp.Tool{
		Name:        "hello",
		Description: "Say hello",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}`),
	}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		var args struct{ Name string }
		if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
			return nil, err
		}
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("Hello, %s!", args.Name)}},
		}, nil
	})

	s.AddTool(&mcp.Tool{
		Name:        "add",
		Description: "Add two numbers",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"a":{"type":"number"},"b":{"type":"number"}},"required":["a","b"]}`),
	}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		var args struct {
			A float64
			B float64
		}
		if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
			return nil, err
		}
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("%g", args.A+args.B)}},
		}, nil
	})

	if err := s.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
