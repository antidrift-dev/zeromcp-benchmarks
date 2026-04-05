<?php

require_once __DIR__ . '/vendor/autoload.php';

use Mcp\Server;
use Mcp\Server\Transport\StdioTransport;

$server = Server::builder()
    ->setServerInfo('bench-official', '1.0.0')
    ->addTool(
        handler: function (string $name): string {
            return "Hello, {$name}!";
        },
        name: 'hello',
        description: 'Say hello to someone'
    )
    ->addTool(
        handler: function (float $a, float $b): string {
            return json_encode(['sum' => $a + $b]);
        },
        name: 'add',
        description: 'Add two numbers together'
    )
    ->build();

$transport = new StdioTransport();
$server->run($transport);
