package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

var (
	leaks   [][]byte
	leaksMu sync.Mutex
)

type HelloArgs struct {
	Name string `json:"name"`
}

type EmptyArgs struct{}

func main() {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "official-chaos",
		Version: "1.0.0",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "hello",
		Description: "Say hello",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args HelloArgs) (*mcp.CallToolResult, any, error) {
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("Hello, %s!", args.Name)}},
		}, nil, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "throw_error",
		Description: "Tool that throws",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args EmptyArgs) (*mcp.CallToolResult, any, error) {
		return nil, nil, fmt.Errorf("Intentional chaos: unhandled exception")
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "hang",
		Description: "Tool that hangs forever",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args EmptyArgs) (*mcp.CallToolResult, any, error) {
		time.Sleep(86400 * time.Second)
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "unreachable"}}}, nil, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "slow",
		Description: "Tool that takes 3 seconds",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args EmptyArgs) (*mcp.CallToolResult, any, error) {
		time.Sleep(3 * time.Second)
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: `{"status":"ok","delay_ms":3000}`}}}, nil, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "leak_memory",
		Description: "Tool that leaks memory",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args EmptyArgs) (*mcp.CallToolResult, any, error) {
		leaksMu.Lock()
		leaks = append(leaks, make([]byte, 1024*1024))
		count := len(leaks)
		leaksMu.Unlock()
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf(`{"leaked_buffers":%d,"total_mb":%d}`, count, count)}}}, nil, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "stdout_corrupt",
		Description: "Tool that writes to stdout",
	}, func(ctx context.Context, req *mcp.CallToolRequest, args EmptyArgs) (*mcp.CallToolResult, any, error) {
		fmt.Println("CORRUPTED OUTPUT")
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: `{"status":"ok"}`}}}, nil, nil
	})

	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Fatal(err)
	}
}
