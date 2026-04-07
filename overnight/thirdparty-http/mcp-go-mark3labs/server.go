package main

import (
	"context"
	"fmt"
	"os"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func main() {
	s := server.NewMCPServer(
		"mcp-go-mark3labs-bench",
		"1.0.0",
		server.WithToolCapabilities(false),
	)

	// hello tool: {name: string} -> "Hello, {name}!"
	helloTool := mcp.NewTool("hello",
		mcp.WithDescription("Say hello"),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Name to greet"),
		),
	)
	s.AddTool(helloTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		name, err := request.RequireString("name")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcp.NewToolResultText(fmt.Sprintf("Hello, %s!", name)), nil
	})

	// add tool: {a: number, b: number} -> sum as string
	addTool := mcp.NewTool("add",
		mcp.WithDescription("Add two numbers"),
		mcp.WithNumber("a",
			mcp.Required(),
			mcp.Description("First number"),
		),
		mcp.WithNumber("b",
			mcp.Required(),
			mcp.Description("Second number"),
		),
	)
	s.AddTool(addTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		a, err := request.RequireFloat("a")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		b, err := request.RequireFloat("b")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		sum := a + b
		return mcp.NewToolResultText(fmt.Sprintf("%g", sum)), nil
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	httpServer := server.NewStreamableHTTPServer(s)
	fmt.Printf("mcp-go-mark3labs listening on :%s\n", port)
	if err := httpServer.Start(":" + port); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
