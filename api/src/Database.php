<?php

declare(strict_types=1);

namespace App;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $configPath = dirname(__DIR__) . '/config/database.php';
        /** @var array<string, mixed> $config */
        $config = file_exists($configPath) ? require $configPath : [];

        $host = self::env(['HOSTINGER_DB_HOST', 'DB_HOST'], (string) ($config['host'] ?? 'localhost'));
        $port = (int) self::env(['HOSTINGER_DB_PORT', 'DB_PORT'], (string) ($config['port'] ?? 3306));
        $database = self::env(['HOSTINGER_DB_NAME', 'HOSTINGER_DB_DATABASE', 'DB_NAME', 'DB_DATABASE'], (string) ($config['database'] ?? ''));
        $username = self::env(['HOSTINGER_DB_USER', 'HOSTINGER_DB_USERNAME', 'DB_USER', 'DB_USERNAME'], (string) ($config['username'] ?? ''));
        $password = self::env(['HOSTINGER_DB_PASSWORD', 'DB_PASSWORD'], (string) ($config['password'] ?? ''));
        $charset = self::env(['HOSTINGER_DB_CHARSET', 'DB_CHARSET'], (string) ($config['charset'] ?? 'utf8mb4'));

        if ($database === '' || $username === '') {
            throw new RuntimeException('Database settings are incomplete. Set api/config/database.php or Hostinger DB environment variables.');
        }

        $hostsToTry = array_values(array_unique(array_filter([
            $host,
            $host !== 'localhost' ? 'localhost' : null,
            $host !== '127.0.0.1' ? '127.0.0.1' : null,
        ])));

        $connectionOptions = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ];

        $lastException = null;

        foreach ($hostsToTry as $candidateHost) {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $candidateHost,
                $port,
                $database,
                $charset
            );

            try {
                self::$connection = new PDO($dsn, (string) $username, (string) $password, $connectionOptions);
                return self::$connection;
            } catch (PDOException $exception) {
                $lastException = $exception;
            }
        }

        throw new RuntimeException(
            'Database connection failed: ' . ($lastException ? $lastException->getMessage() : 'Unknown database error.'),
            0,
            $lastException
        );
    }

    /**
     * @param list<string> $keys
     */
    private static function env(array $keys, string $default = ''): string
    {
        foreach ($keys as $key) {
            $value = getenv($key);

            if ($value !== false && trim($value) !== '') {
                return $value;
            }
        }

        return $default;
    }
}
