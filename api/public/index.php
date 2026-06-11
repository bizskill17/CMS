<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Database;
use App\MasterRegistry;
use App\Response;
use PDO;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($path === '/api/health' && $method === 'GET') {
        $pdo = Database::connection();
        $dbName = (string) $pdo->query('select database()')->fetchColumn();

        Response::json([
            'status' => 'ok',
            'app' => 'Policy Management System API',
            'version' => '0.1.0',
            'database' => $dbName
        ]);
        exit;
    }

    if ($path === '/api/customers' && $method === 'GET') {
        $pdo = Database::connection();
        $limit = isset($_GET['limit']) ? max(1, min(100, (int) $_GET['limit'])) : 25;

        $statement = $pdo->prepare(
            'SELECT id, customer_code, full_name, mobile, email, city, state, is_active, created_at
             FROM customers
             ORDER BY id DESC
             LIMIT :limit'
        );
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll(),
            'meta' => [
                'limit' => $limit
            ]
        ]);
        exit;
    }

    if ($path === '/api/masters' && $method === 'GET') {
        Response::json([
            'status' => 'ok',
            'data' => array_keys(MasterRegistry::all())
        ]);
        exit;
    }

    if ($path === '/api/policies' && $method === 'GET') {
        $pdo = Database::connection();
        $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;

        $statement = $pdo->prepare(
            'SELECT
                p.id,
                p.policy_number,
                p.policy_type,
                p.business_type,
                p.gross_premium,
                p.net_premium,
                p.issue_date,
                p.risk_start_date,
                p.risk_end_date,
                p.paid_by_type,
                p.payment_mode,
                p.policy_status,
                c.full_name AS customer_name,
                cg.group_name AS customer_group_name,
                ic.company_name,
                ip.product_name
             FROM policies p
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             LEFT JOIN insurance_products ip ON ip.id = p.product_id
             ORDER BY p.id DESC
             LIMIT :limit'
        );
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll(),
            'meta' => ['limit' => $limit]
        ]);
        exit;
    }

    if ($path === '/api/policies/issue-form' && $method === 'GET') {
        $pdo = Database::connection();

        $customerGroups = $pdo->query(
            'SELECT id, group_name
             FROM customer_groups
             WHERE isnull(id) = 0
             ORDER BY group_name ASC'
        )->fetchAll();

        $customers = $pdo->query(
            'SELECT c.id, c.group_id, c.customer_code, c.full_name, c.mobile, cg.group_name
             FROM customers c
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             WHERE c.is_active = 1
             ORDER BY c.full_name ASC'
        )->fetchAll();

        $policyTypes = $pdo->query(
            'SELECT id, category_name, parent_category_id
             FROM product_categories
             WHERE is_active = 1 AND parent_category_id IS NOT NULL
             ORDER BY category_name ASC'
        )->fetchAll();

        $insuranceCompanies = $pdo->query(
            'SELECT id, company_name
             FROM insurance_companies
             WHERE is_active = 1
             ORDER BY company_name ASC'
        )->fetchAll();

        $products = $pdo->query(
            'SELECT ip.id, ip.company_id, ip.category_id, ip.product_name, ic.company_name
             FROM insurance_products ip
             LEFT JOIN insurance_companies ic ON ic.id = ip.company_id
             WHERE ip.is_active = 1
             ORDER BY ip.product_name ASC'
        )->fetchAll();

        Response::json([
            'status' => 'ok',
            'data' => [
                'customerGroups' => $customerGroups,
                'customers' => $customers,
                'policyTypes' => $policyTypes,
                'insuranceCompanies' => $insuranceCompanies,
                'products' => $products,
            ],
        ]);
        exit;
    }

    if ($path === '/api/policies/issue' && $method === 'POST') {
        $pdo = Database::connection();
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        foreach (['customer_id', 'policy_number', 'company_id'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $customerId = (int) $payload['customer_id'];
        $companyId = (int) $payload['company_id'];
        $productId = isset($payload['product_id']) && $payload['product_id'] !== '' ? (int) $payload['product_id'] : null;
        $policyTypeId = isset($payload['policy_type']) && $payload['policy_type'] !== '' ? (int) $payload['policy_type'] : null;
        $policyTypeName = null;

        if ($productId !== null && $policyTypeId !== null) {
            $categoryCheck = $pdo->prepare('SELECT category_id FROM insurance_products WHERE id = :id');
            $categoryCheck->bindValue(':id', $productId, PDO::PARAM_INT);
            $categoryCheck->execute();
            $productCategoryId = $categoryCheck->fetchColumn();

            if ($productCategoryId !== false && (int) $productCategoryId !== $policyTypeId) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Selected Product Name does not belong to the chosen Policy Type.'
                ], 422);
                exit;
            }
        }

        if ($policyTypeId !== null) {
            $policyTypeStatement = $pdo->prepare('SELECT category_name FROM product_categories WHERE id = :id');
            $policyTypeStatement->bindValue(':id', $policyTypeId, PDO::PARAM_INT);
            $policyTypeStatement->execute();
            $policyTypeName = $policyTypeStatement->fetchColumn() ?: null;
        }

        $pdo->beginTransaction();

        try {
            $familyCode = 'PF' . date('YmdHis') . random_int(100, 999);
            $policyCode = 'PL' . date('YmdHis') . random_int(100, 999);

            $familyStatement = $pdo->prepare(
                'INSERT INTO policy_families (policy_family_code, customer_id, family_label)
                 VALUES (:policy_family_code, :customer_id, :family_label)'
            );
            $familyStatement->bindValue(':policy_family_code', $familyCode);
            $familyStatement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
            $familyStatement->bindValue(':family_label', $payload['policy_number']);
            $familyStatement->execute();

            $policyFamilyId = (int) $pdo->lastInsertId();

            $statement = $pdo->prepare(
                'INSERT INTO policies (
                    policy_code,
                    policy_family_id,
                    customer_id,
                    company_id,
                    product_id,
                    policy_number,
                    business_type,
                    policy_type,
                    sum_insured,
                    gross_premium,
                    net_premium,
                    issue_date,
                    risk_start_date,
                    risk_end_date,
                    vehicle_make,
                    vehicle_model,
                    year_of_manufacture,
                    registration_no,
                    paid_by_type,
                    payment_mode,
                    payment_status,
                    client_payment_status,
                    payment_received_amount,
                    payment_pending_amount,
                    policy_status,
                    last_status,
                    fiscal_year_ending
                 ) VALUES (
                    :policy_code,
                    :policy_family_id,
                    :customer_id,
                    :company_id,
                    :product_id,
                    :policy_number,
                    :business_type,
                    :policy_type,
                    :sum_insured,
                    :gross_premium,
                    :net_premium,
                    :issue_date,
                    :risk_start_date,
                    :risk_end_date,
                    :vehicle_make,
                    :vehicle_model,
                    :year_of_manufacture,
                    :registration_no,
                    :paid_by_type,
                    :payment_mode,
                    :payment_status,
                    :client_payment_status,
                    :payment_received_amount,
                    :payment_pending_amount,
                    :policy_status,
                    :last_status,
                    :fiscal_year_ending
                 )'
            );

            $grossPremium = $payload['gross_premium'] !== '' ? (float) $payload['gross_premium'] : null;
            $netPremium = $payload['net_premium'] !== '' ? (float) $payload['net_premium'] : null;

            $statement->bindValue(':policy_code', $policyCode);
            $statement->bindValue(':policy_family_id', $policyFamilyId, PDO::PARAM_INT);
            $statement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
            $statement->bindValue(':company_id', $companyId, PDO::PARAM_INT);
            $statement->bindValue(':product_id', $productId, $productId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $statement->bindValue(':policy_number', $payload['policy_number']);
            $statement->bindValue(':business_type', $payload['business_type'] !== '' ? $payload['business_type'] : null);
            $statement->bindValue(':policy_type', $policyTypeName);
            $statement->bindValue(':sum_insured', $payload['sum_insured'] !== '' ? $payload['sum_insured'] : null);
            $statement->bindValue(':gross_premium', $grossPremium);
            $statement->bindValue(':net_premium', $netPremium);
            $statement->bindValue(':issue_date', $payload['issue_date'] !== '' ? $payload['issue_date'] : null);
            $statement->bindValue(':risk_start_date', $payload['risk_start_date'] !== '' ? $payload['risk_start_date'] : null);
            $statement->bindValue(':risk_end_date', $payload['risk_end_date'] !== '' ? $payload['risk_end_date'] : null);
            $statement->bindValue(':vehicle_make', $payload['vehicle_make'] !== '' ? $payload['vehicle_make'] : null);
            $statement->bindValue(':vehicle_model', $payload['vehicle_model'] !== '' ? $payload['vehicle_model'] : null);
            $statement->bindValue(':year_of_manufacture', $payload['year_of_manufacture'] !== '' ? (int) $payload['year_of_manufacture'] : null, $payload['year_of_manufacture'] !== '' ? PDO::PARAM_INT : PDO::PARAM_NULL);
            $statement->bindValue(':registration_no', $payload['registration_no'] !== '' ? $payload['registration_no'] : null);
            $statement->bindValue(':paid_by_type', $payload['paid_by_type'] !== '' ? $payload['paid_by_type'] : null);
            $statement->bindValue(':payment_mode', $payload['payment_mode'] !== '' ? $payload['payment_mode'] : null);
            $statement->bindValue(':payment_status', 'Pending');
            $statement->bindValue(':client_payment_status', 'Pending');
            $statement->bindValue(':payment_received_amount', 0);
            $statement->bindValue(':payment_pending_amount', $netPremium ?? 0);
            $statement->bindValue(':policy_status', 'Active');
            $statement->bindValue(':last_status', 'Issued');
            $statement->bindValue(':fiscal_year_ending', (int) date('Y'));
            $statement->execute();

            $policyId = (int) $pdo->lastInsertId();
            $pdo->commit();

            Response::json([
                'status' => 'ok',
                'message' => 'Policy issued successfully.',
                'data' => [
                    'policy_id' => $policyId,
                    'policy_code' => $policyCode,
                    'policy_family_code' => $familyCode,
                ],
            ], 201);
            exit;
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }
    }

    if (str_starts_with($path, '/api/masters/')) {
        $registry = MasterRegistry::all();
        $segments = array_values(array_filter(explode('/', trim($path, '/'))));
        $resource = $segments[2] ?? null;
        $id = isset($segments[3]) ? (int) $segments[3] : null;

        if (!$resource || !isset($registry[$resource])) {
            Response::json([
                'status' => 'error',
                'message' => 'Master resource not found'
            ], 404);
            exit;
        }

        $config = $registry[$resource];
        $pdo = Database::connection();

        if ($method === 'GET' && $id === null) {
            $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;
            $sql = sprintf(
                'SELECT %s FROM %s ORDER BY %s LIMIT :limit',
                $config['select'],
                $config['from'],
                $config['order_by']
            );
            $statement = $pdo->prepare($sql);
            $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
            $statement->execute();

            Response::json([
                'status' => 'ok',
                'data' => $statement->fetchAll(),
                'meta' => ['limit' => $limit]
            ]);
            exit;
        }

        if (($method === 'POST' && $id === null) || ($method === 'PUT' && $id !== null)) {
            $rawBody = file_get_contents('php://input');
            $payload = json_decode($rawBody ?: '[]', true);

            if (!is_array($payload)) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid JSON payload'
                ], 422);
                exit;
            }

            foreach ($config['required'] as $requiredField) {
                if (!array_key_exists($requiredField, $payload) || $payload[$requiredField] === '') {
                    Response::json([
                        'status' => 'error',
                        'message' => sprintf('Field "%s" is required.', $requiredField)
                    ], 422);
                    exit;
                }
            }

            $normalized = [];
            foreach ($config['write_columns'] as $column) {
                if (!array_key_exists($column, $payload)) {
                    continue;
                }

                $value = $payload[$column];

                if (in_array($column, $config['boolean'] ?? [], true)) {
                    $normalized[$column] = $value ? 1 : 0;
                    continue;
                }

                if (in_array($column, $config['nullable'] ?? [], true) && ($value === '' || $value === null)) {
                    $normalized[$column] = null;
                    continue;
                }

                $normalized[$column] = $value;
            }

            if ($method === 'POST') {
                $columns = array_keys($normalized);
                $placeholders = array_map(static fn (string $column): string => ':' . $column, $columns);

                $sql = sprintf(
                    'INSERT INTO %s (%s) VALUES (%s)',
                    $config['table'],
                    implode(', ', $columns),
                    implode(', ', $placeholders)
                );

                $statement = $pdo->prepare($sql);
                foreach ($normalized as $column => $value) {
                    $statement->bindValue(':' . $column, $value);
                }
                $statement->execute();

                Response::json([
                    'status' => 'ok',
                    'message' => 'Record created successfully.',
                    'id' => (int) $pdo->lastInsertId()
                ], 201);
                exit;
            }

            if (empty($normalized)) {
                Response::json([
                    'status' => 'error',
                    'message' => 'No updatable fields provided.'
                ], 422);
                exit;
            }

            $assignments = [];
            foreach (array_keys($normalized) as $column) {
                $assignments[] = sprintf('%s = :%s', $column, $column);
            }

            $sql = sprintf(
                'UPDATE %s SET %s WHERE id = :id',
                $config['table'],
                implode(', ', $assignments)
            );

            $statement = $pdo->prepare($sql);
            foreach ($normalized as $column => $value) {
                $statement->bindValue(':' . $column, $value);
            }
            $statement->bindValue(':id', $id, PDO::PARAM_INT);
            $statement->execute();

            Response::json([
                'status' => 'ok',
                'message' => 'Record updated successfully.'
            ]);
            exit;
        }
    }

    Response::json([
        'status' => 'error',
        'message' => 'Route not found'
    ], 404);
} catch (Throwable $throwable) {
    Response::json([
        'status' => 'error',
        'message' => $throwable->getMessage()
    ], 500);
}
