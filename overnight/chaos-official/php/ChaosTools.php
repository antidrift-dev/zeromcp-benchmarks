<?php

use Mcp\Capability\Attribute\McpTool;

class ChaosTools
{
    private static array $leaks = [];

    #[McpTool(name: 'hello', description: 'Say hello')]
    public function hello(string $name = 'world'): string
    {
        return "Hello, {$name}!";
    }

    #[McpTool(name: 'throw_error', description: 'Tool that throws')]
    public function throwError(): string
    {
        throw new \RuntimeException('Intentional chaos: unhandled exception');
    }

    #[McpTool(name: 'hang', description: 'Tool that hangs forever')]
    public function hang(): string
    {
        sleep(86400);
        return 'unreachable';
    }

    #[McpTool(name: 'slow', description: 'Tool that takes 3 seconds')]
    public function slow(): string
    {
        sleep(3);
        return json_encode(['status' => 'ok', 'delay_ms' => 3000]);
    }

    #[McpTool(name: 'leak_memory', description: 'Tool that leaks memory')]
    public function leakMemory(): string
    {
        self::$leaks[] = str_repeat("\x00", 1024 * 1024);
        $count = count(self::$leaks);
        return json_encode(['leaked_buffers' => $count, 'total_mb' => $count]);
    }

    #[McpTool(name: 'stdout_corrupt', description: 'Tool that writes to stdout')]
    public function stdoutCorrupt(): string
    {
        fwrite(STDOUT, "CORRUPTED OUTPUT\n");
        fflush(STDOUT);
        return json_encode(['status' => 'ok']);
    }
}
