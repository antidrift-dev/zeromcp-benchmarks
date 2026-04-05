<?php
/**
 * Official MCP PHP SDK server — hello + add tools over stdio.
 */

require __DIR__ . '/vendor/autoload.php';

use Mcp\Server\Server;
use Mcp\Types\Tool;
use Mcp\Types\CallToolResult;
use Mcp\Types\TextContent;

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
        Tool::create('add', 'Add two numbers')
            ->setInputSchema([
                'type' => 'object',
                'properties' => [
                    'a' => ['type' => 'number'],
                    'b' => ['type' => 'number'],
                ],
                'required' => ['a', 'b'],
            ]),
        function (object $params) {
            $a = $params->a ?? 0;
            $b = $params->b ?? 0;
            $content = new TextContent(strval($a + $b));
            $result = new CallToolResult();
            $result->content = [$content];
            return $result;
        }
    )
    ->build();

$server->connect('stdio');
