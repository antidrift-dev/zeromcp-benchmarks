package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type HelloArgs struct {
	Name string `json:"name"`
}

type AddArgs struct {
	A float64 `json:"a"`
	B float64 `json:"b"`
}

func main() {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "bench-official",
		Version: "1.0.0",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "hello",
		Description: "Say hello to someone",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args HelloArgs) (*mcp.CallToolResult, any, error) {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: fmt.Sprintf("Hello, %s!", args.Name)},
			},
		}, nil, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "add",
		Description: "Add two numbers together",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args AddArgs) (*mcp.CallToolResult, any, error) {
		result, _ := json.Marshal(map[string]float64{"sum": args.A + args.B})
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: string(result)},
			},
		}, nil, nil
	})

	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Fatal(err)
	}
}
