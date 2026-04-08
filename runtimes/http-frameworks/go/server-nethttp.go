//go:build ignore

// ZeroMCP over net/http (stdlib)
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/antidrift-dev/zeromcp/pkg/zeromcp"
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

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "tools": toolCount})
	})

	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(405)
			json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
			return
		}

		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0",
				"error":   map[string]any{"code": -32700, "message": "Parse error"},
			})
			return
		}

		resp := server.HandleRequest(req)
		w.Header().Set("Content-Type", "application/json")
		if resp == nil {
			json.NewEncoder(w).Encode(map[string]any{})
		} else {
			json.NewEncoder(w).Encode(resp)
		}
	})

	fmt.Fprintf(os.Stderr, "[net/http] listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
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
