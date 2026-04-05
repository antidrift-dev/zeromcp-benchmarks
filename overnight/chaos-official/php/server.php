<?php
/**
 * Official MCP PHP SDK server with chaos tools for resilience testing.
 */

require __DIR__ . '/vendor/autoload.php';

use Mcp\Server\Server;
use Mcp\Types\Tool;
use Mcp\Types\CallToolResult;
use Mcp\Types\TextContent;

$leaks = [];

$server = Server::builder()
    ->addTool(
        Tool::create('hello', 'Say hello')
            ->setInputSchema([
                'type' => 'object',
                'properties' => ['name' => ['type' => 'string']],
                'required' => ['name'],
            ]),
        function (object $params) {
            $name = $params->name ?? 'world';
            $content = new TextContent("Hello, {$name}!");
            $result = new CallToolResult();
            $result->content = [$content];
            return $result;
        }
    )
    ->addTool(
        Tool::create('throw_error', 'Tool that throws')
            ->setInputSchema(['type' => 'object', 'properties' => new \stdClass()]),
        function (object $params) {
            throw new \RuntimeException('Intentional chaos: unhandled exception');
        }
    )
    ->addTool(
        Tool::create('hang', 'Tool that hangs forever')
            ->setInputSchema(['type' => 'object', 'properties' => new \stdClass()]),
        function (object $params) {
            sleep(86400);
            $content = new TextContent('unreachable');
            $result = new CallToolResult();
            $result->content = [$content];
            return $result;
        }
    )
    ->addTool(
        Tool::create('slow', 'Tool that takes 3 seconds')
            ->setInputSchema(['type' => 'object', 'properties' => new \stdClass()]),
        function (object $params) {
            sleep(3);
            $content = new TextContent('{"status":"ok","delay_ms":3000}');
            $result = new CallToolResult();
            $result->content = [$content];
            return $result;
        }
    )
    ->addTool(
        Tool::create('leak_memory', 'Tool that leaks memory')
            ->setInputSchema(['type' => 'object', 'properties' => new \stdClass()]),
        function (object $params) {
            global $leaks;
            $leaks[] = str_repeat("\x00", 1024 * 1024);
            $count = count($leaks);
            $content = new TextContent("{\"leaked_buffers\":{$count},\"total_mb\":{$count}}");
            $result = new CallToolResult();
            $result->content = [$content];
            return $result;
        }
    )
    ->addTool(
        Tool::create('stdout_corrupt', 'Tool that writes to stdout')
            ->setInputSchema(['type' => 'object', 'properties' => new \stdClass()]),
        function (object $params) {
            fwrite(STDOUT, "CORRUPTED OUTPUT\n");
            fflush(STDOUT);
            $content = new TextContent('{"status":"ok"}');
            $result = new CallToolResult();
            $result->content = [$content];
            return $result;
        }
    )
    ->build();

$server->connect('stdio');
