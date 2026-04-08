<?php

require __DIR__ . '/vendor/autoload.php';

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use ZeroMcp\Config;
use ZeroMcp\Server as ZeroMcpServer;
use ZeroMcp\Tool;

/**
 * ZeroMCP over Slim -- HTTP benchmark server.
 *
 * Designed to run behind PHP's built-in server:
 *   php -S 0.0.0.0:3000 server-slim.php
 */

// Let PHP's built-in server handle static files
if (PHP_SAPI === 'cli-server') {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
        return false;
    }
}

$config = new Config([
    'tools' => [],
    'resources' => [__DIR__ . '/resources'],
    'prompts' => [__DIR__ . '/prompts'],
]);

$server = new ZeroMcpServer($config);
$server->loadTools();

// Register tools inline
$helloTool = new Tool(
    name: 'hello',
    description: 'Say hello',
    input: ['name' => ['type' => 'string', 'description' => 'Name to greet']],
    execute: function (array $args, $ctx): string {
        return 'Hello, ' . ($args['name'] ?? 'world') . '!';
    }
);

$addTool = new Tool(
    name: 'add',
    description: 'Add two numbers',
    input: [
        'a' => ['type' => 'number', 'description' => 'First number'],
        'b' => ['type' => 'number', 'description' => 'Second number'],
    ],
    execute: function (array $args, $ctx): float {
        return (float) ($args['a'] ?? 0) + (float) ($args['b'] ?? 0);
    }
);

// Inject tools (appending to any file-scanned tools)
$ref = new ReflectionProperty($server, 'tools');
$ref->setAccessible(true);
$existing = $ref->getValue($server);
$ref->setValue($server, array_merge($existing, ['hello' => $helloTool, 'add' => $addTool]));

$app = AppFactory::create();

$app->get('/health', function (Request $request, Response $response) {
    $response->getBody()->write(json_encode(['status' => 'ok']));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/mcp', function (Request $request, Response $response) use ($server) {
    $body = json_decode((string) $request->getBody(), true);
    $result = $server->handleRequest($body);
    if ($result !== null) {
        $response->getBody()->write(json_encode($result, JSON_UNESCAPED_SLASHES));
        return $response->withHeader('Content-Type', 'application/json');
    }
    return $response->withStatus(204);
});

$app->run();
