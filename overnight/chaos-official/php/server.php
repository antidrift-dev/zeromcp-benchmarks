<?php
require __DIR__ . '/vendor/autoload.php';

use Mcp\Server;
use Mcp\Server\Transport\StdioTransport;
use Mcp\Capability\Registry;
use Mcp\Schema\Tool;

$leaks = [];

$registry = new Registry();

$registry->registerTool(
    new Tool(name: 'hello', description: 'Say hello', inputSchema: ['type' => 'object', 'properties' => ['name' => ['type' => 'string']]], annotations: null),
    function (object $params): string { return "Hello, " . ($params->name ?? 'world') . "!"; }
);

$registry->registerTool(
    new Tool(name: 'throw_error', description: 'Tool that throws', inputSchema: ['type' => 'object', 'properties' => []], annotations: null),
    function (object $params): string { throw new \RuntimeException('Intentional chaos'); }
);

$registry->registerTool(
    new Tool(name: 'hang', description: 'Tool that hangs forever', inputSchema: ['type' => 'object', 'properties' => []], annotations: null),
    function (object $params): string { sleep(86400); return 'unreachable'; }
);

$registry->registerTool(
    new Tool(name: 'slow', description: 'Tool that takes 3 seconds', inputSchema: ['type' => 'object', 'properties' => []], annotations: null),
    function (object $params): string { sleep(3); return json_encode(['status' => 'ok', 'delay_ms' => 3000]); }
);

$registry->registerTool(
    new Tool(name: 'leak_memory', description: 'Tool that leaks memory', inputSchema: ['type' => 'object', 'properties' => []], annotations: null),
    function (object $params): string {
        global $leaks;
        $leaks[] = str_repeat("\x00", 1024 * 1024);
        return json_encode(['leaked_buffers' => count($leaks), 'total_mb' => count($leaks)]);
    }
);

$registry->registerTool(
    new Tool(name: 'stdout_corrupt', description: 'Tool that writes to stdout', inputSchema: ['type' => 'object', 'properties' => []], annotations: null),
    function (object $params): string {
        fwrite(STDOUT, "CORRUPTED OUTPUT\n");
        fflush(STDOUT);
        return json_encode(['status' => 'ok']);
    }
);

$server = Server::builder()
    ->setServerInfo('official-chaos', '1.0.0')
    ->setRegistry($registry)
    ->build();

$transport = new StdioTransport();
$server->run($transport);
