<?php

declare(strict_types=1);

namespace App;

final class Response
{
    public static function json(array $payload, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');

        $json = json_encode($payload, JSON_PRETTY_PRINT);

        if ($json === false) {
            http_response_code(500);
            echo '{"status":"error","message":"Failed to encode JSON response."}';
            return;
        }

        echo $json;
    }
}
