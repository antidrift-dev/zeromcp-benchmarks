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
