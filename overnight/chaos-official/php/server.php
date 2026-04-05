<?php
require __DIR__ . '/vendor/autoload.php';

use Mcp\Server;
use Mcp\Server\Transport\StdioTransport;
use Mcp\Capability\Registry;
use Mcp\Schema\Tool;

$leaks = [];

$registry = new Registry();

$registry->registerTool(
    new Tool(name: 'hello', inputSchema: ['type' => 'object', 'properties' => ['name' => ['type' => 'string']]], description: 'Say hello', annotations: null),
    function (string $name = 'world'): string { return "Hello, {$name}!"; }
);

$registry->registerTool(
    new Tool(name: 'throw_error', inputSchema: ['type' => 'object', 'properties' => []], description: 'Tool that throws', annotations: null),
    function (): string { throw new \RuntimeException('Intentional chaos'); }
);

$registry->registerTool(
    new Tool(name: 'hang', inputSchema: ['type' => 'object', 'properties' => []], description: 'Tool that hangs forever', annotations: null),
    function (): string { sleep(86400); return 'unreachable'; }
);

$registry->registerTool(
    new Tool(name: 'slow', inputSchema: ['type' => 'object', 'properties' => []], description: 'Tool that takes 3 seconds', annotations: null),
    function (): string { sleep(3); return json_encode(['status' => 'ok', 'delay_ms' => 3000]); }
);

$registry->registerTool(
    new Tool(name: 'leak_memory', inputSchema: ['type' => 'object', 'properties' => []], description: 'Tool that leaks memory', annotations: null),
    function (): string {
        global $leaks;
        $leaks[] = str_repeat("\x00", 1024 * 1024);
        return json_encode(['leaked_buffers' => count($leaks), 'total_mb' => count($leaks)]);
    }
);

$registry->registerTool(
    new Tool(name: 'stdout_corrupt', inputSchema: ['type' => 'object', 'properties' => []], description: 'Tool that writes to stdout', annotations: null),
    function (): string {
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
