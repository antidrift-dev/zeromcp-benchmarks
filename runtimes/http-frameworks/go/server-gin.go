//go:build ignore

// ZeroMCP over Gin
package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/antidrift-dev/zeromcp/pkg/zeromcp"
	"github.com/gin-gonic/gin"
)

func main() {
	server := zeromcp.NewServer()
	registerTools(server)
	registerResources(server)
	registerPrompts(server)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	toolCount := 3

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "tools": toolCount})
	})

	r.POST("/mcp", func(c *gin.Context) {
		var req map[string]any
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"jsonrpc": "2.0",
				"error":   gin.H{"code": -32700, "message": "Parse error"},
			})
			return
		}

		resp := server.HandleRequest(req)
		if resp == nil {
			c.JSON(http.StatusOK, gin.H{})
		} else {
			c.JSON(http.StatusOK, resp)
		}
	})

	fmt.Fprintf(os.Stderr, "[gin] listening on :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func registerTools(s *zeromcp.Server) {
	s.Tool("hello", zeromcp.Tool{
		Description: "Say hello to someone",
		Input:       zeromcp.Input{"name": "string"},
		Execute: func(args map[string]any, ctx *zeromcp.Ctx) (any, error) {
			name, _ := args["name"].(string)
			if name == "" {
				name = "world"
			}
			return fmt.Sprintf("Hello, %s!", name), nil
		},
	})

	s.Tool("add", zeromcp.Tool{
		Description: "Add two numbers together",
		Input: zeromcp.Input{
			"a": zeromcp.InputField{Type: "number", Description: "First number"},
			"b": zeromcp.InputField{Type: "number", Description: "Second number"},
		},
		Execute: func(args map[string]any, ctx *zeromcp.Ctx) (any, error) {
			a, _ := args["a"].(float64)
			b, _ := args["b"].(float64)
			return map[string]any{"sum": a + b}, nil
		},
	})

	s.Tool("create_invoice", zeromcp.Tool{
		Description: "Create an invoice",
		Input: zeromcp.Input{
			"customer": "string",
			"amount":   "number",
		},
		Execute: func(args map[string]any, ctx *zeromcp.Ctx) (any, error) {
			customer, _ := args["customer"].(string)
			amount, _ := args["amount"].(float64)
			return map[string]any{
				"id":       "INV-001",
				"customer": customer,
				"amount":   amount,
				"status":   "created",
			}, nil
		},
	})
}

func registerResources(s *zeromcp.Server) {
	s.Resource("data", zeromcp.ResourceDef{
		URI:         "resource:///data.json",
		Description: "Static JSON data",
		MimeType:    "application/json",
		Read: func() (string, error) {
			return `{"key":"value","count":42}`, nil
		},
	})

	s.Resource("dynamic", zeromcp.ResourceDef{
		URI:         "resource:///dynamic",
		Description: "Dynamic resource",
		MimeType:    "application/json",
		Read: func() (string, error) {
			return `{"dynamic":true}`, nil
		},
	})
}

func registerPrompts(s *zeromcp.Server) {
	s.Prompt("greet", zeromcp.PromptDef{
		Description: "Generate a greeting message",
		Arguments: []zeromcp.PromptArgument{
			{Name: "name", Description: "Name to greet", Required: true},
			{Name: "tone", Description: "Tone of greeting (e.g. formal, casual)"},
		},
		Render: func(args map[string]any) ([]zeromcp.PromptMessage, error) {
			name, _ := args["name"].(string)
			tone, _ := args["tone"].(string)
			greeting := fmt.Sprintf("Hello, %s!", name)
			if tone != "" {
				greeting = fmt.Sprintf("Hello, %s! (tone: %s)", name, tone)
			}
			return []zeromcp.PromptMessage{
				{Role: "user", Content: map[string]any{"type": "text", "text": greeting}},
			}, nil
		},
	})
}
