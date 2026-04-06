<?php
/**
 * Official MCP PHP SDK server — hello + add tools over stdio.
 */

require __DIR__ . '/vendor/autoload.php';

use Mcp\Server;

$server = Server::builder()
    ->setServerInfo('official-php', '1.0.0')
    ->addTool(
        handler: function (string $name): string {
            return "Hello, {$name}!";
        },
        name: 'hello',
        description: 'Say hello',
        inputSchema: [
            'type' => 'object',
            'properties' => ['name' => ['type' => 'string']],
            'required' => ['name'],
        ]
    )
    ->addTool(
        handler: function (float $a, float $b): string {
            return strval($a + $b);
        },
        name: 'add',
        description: 'Add two numbers',
        inputSchema: [
            'type' => 'object',
            'properties' => [
                'a' => ['type' => 'number'],
                'b' => ['type' => 'number'],
            ],
            'required' => ['a', 'b'],
        ]
    )
    ->build();

$transport = new \Mcp\Server\Transport\StdioTransport();
$server->run($transport);
