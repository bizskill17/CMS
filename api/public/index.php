<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Database;
use App\MasterRegistry;
use App\Response;
use PDO;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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

    if ($path === '/api/menu/counts' && $method === 'GET') {
        $pdo = Database::connection();
        $counts = [];

        // Masters counts
        $registry = MasterRegistry::all();
        foreach ($registry as $key => $config) {
            $table = $config['table'];
            $counts[$key] = (int) $pdo->query("SELECT count(*) FROM $table")->fetchColumn();
        }

        // Policies counts
        $counts['all-policies'] = (int) $pdo->query('SELECT count(*) FROM policies')->fetchColumn();
        $counts['renew-policy'] = (int) $pdo->query(
            'SELECT count(*) FROM policies 
             WHERE risk_end_date IS NOT NULL 
               AND risk_end_date >= curdate() 
               AND coalesce(renewal_status, "") <> "Renewed"'
        )->fetchColumn();
        
        $counts['attach-documents'] = (int) $pdo->query(
            'SELECT count(*) FROM (
                SELECT p.id FROM policies p
                LEFT JOIN documents d ON d.policy_id = p.id AND d.deleted_at IS NULL AND d.is_active = 1
                GROUP BY p.id HAVING count(d.id) = 0
             ) pending_docs'
        )->fetchColumn();

        // Payments counts
        $counts['pending-payments'] = (int) $pdo->query(
            'SELECT count(*) FROM policies WHERE paid_by_type = "Agent" AND coalesce(payment_pending_amount, 0) > 0'
        )->fetchColumn();

        Response::json([
            'status' => 'ok',
            'data' => $counts
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

    if (preg_match('#^/api/customers/(\d+)/policies$#', $path, $matches) === 1 && $method === 'GET') {
        $pdo = Database::connection();
        $customerId = (int) $matches[1];

        $customerStatement = $pdo->prepare(
            'SELECT id, customer_code, full_name
             FROM customers
             WHERE id = :id
             LIMIT 1'
        );
        $customerStatement->bindValue(':id', $customerId, PDO::PARAM_INT);
        $customerStatement->execute();
        $customer = $customerStatement->fetch();

        if (!$customer) {
            Response::json([
                'status' => 'error',
                'message' => 'Customer not found.'
            ], 404);
            exit;
        }

        $policyStatement = $pdo->prepare(
            'SELECT
                p.id,
                p.policy_number,
                p.business_type,
                p.policy_type,
                p.issue_date,
                p.risk_start_date,
                p.risk_end_date,
                p.renewal_status,
                p.policy_status,
                p.registration_no,
                ic.company_name,
                ip.product_name
             FROM policies p
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             LEFT JOIN insurance_products ip ON ip.id = p.product_id
             WHERE p.customer_id = :customer_id
             ORDER BY p.risk_end_date DESC, p.issue_date DESC, p.id DESC'
        );
        $policyStatement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
        $policyStatement->execute();

        Response::json([
            'status' => 'ok',
            'data' => [
                'customer' => $customer,
                'policies' => $policyStatement->fetchAll()
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

    if ($path === '/api/dashboard/policy-summary' && $method === 'GET') {
        $pdo = Database::connection();

        $renewalsNext7Days = (int) $pdo->query(
            'SELECT count(*)
             FROM policies p
             WHERE p.risk_end_date IS NOT NULL
               AND p.risk_end_date >= curdate()
               AND p.risk_end_date <= date_add(curdate(), interval 7 day)
               AND coalesce(p.renewal_status, "") <> "Renewed"'
        )->fetchColumn();

        $pendingDocumentUploads = (int) $pdo->query(
            'SELECT count(*)
             FROM (
                SELECT p.id
                FROM policies p
                LEFT JOIN documents d
                  ON d.policy_id = p.id
                 AND d.deleted_at IS NULL
                 AND d.is_active = 1
                GROUP BY p.id
                HAVING count(d.id) = 0
             ) pending_documents'
        )->fetchColumn();

        $renewalsOverdue = (int) $pdo->query(
            'SELECT count(*)
             FROM policies p
             WHERE p.risk_end_date IS NOT NULL
               AND p.risk_end_date < curdate()
               AND coalesce(p.renewal_status, "") <> "Renewed"'
        )->fetchColumn();

        $pendingClientCollections = (int) $pdo->query(
            'SELECT count(*)
             FROM policies p
             WHERE p.paid_by_type = "Agent"
               AND coalesce(p.payment_pending_amount, 0) > 0'
        )->fetchColumn();

        Response::json([
            'status' => 'ok',
            'data' => [
                'renewals_next_7_days' => $renewalsNext7Days,
                'pending_document_uploads' => $pendingDocumentUploads,
                'renewals_overdue' => $renewalsOverdue,
                'pending_client_collections' => $pendingClientCollections,
            ]
        ]);
        exit;
    }

    if ($path === '/api/policies/pending-documents' && $method === 'GET') {
        $pdo = Database::connection();
        $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;

        $statement = $pdo->prepare(
            'SELECT
                p.id,
                p.policy_number,
                p.policy_type,
                p.issue_date,
                p.risk_end_date,
                c.full_name AS customer_name,
                cg.group_name AS customer_group_name,
                ic.company_name,
                ip.product_name
             FROM policies p
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             LEFT JOIN insurance_products ip ON ip.id = p.product_id
             LEFT JOIN documents d
               ON d.policy_id = p.id
              AND d.deleted_at IS NULL
              AND d.is_active = 1
             GROUP BY
                p.id,
                p.policy_number,
                p.policy_type,
                p.issue_date,
                p.risk_end_date,
                c.full_name,
                cg.group_name,
                ic.company_name,
                ip.product_name
             HAVING count(d.id) = 0
             ORDER BY p.updated_at DESC, p.id DESC
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

    if ($path === '/api/policies/upload-document' && $method === 'POST') {
        $pdo = Database::connection();

        $policyId = isset($_POST['policy_id']) ? (int) $_POST['policy_id'] : 0;
        $documentTypeId = isset($_POST['document_type_id']) ? (int) $_POST['document_type_id'] : 0;

        if ($policyId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Policy is required.'
            ], 422);
            exit;
        }

        if ($documentTypeId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Document type is required.'
            ], 422);
            exit;
        }

        if (!isset($_FILES['file']) || !is_array($_FILES['file']) || (int) $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::json([
                'status' => 'error',
                'message' => 'A file upload is required.'
            ], 422);
            exit;
        }

        $policyStatement = $pdo->prepare('SELECT id, customer_id FROM policies WHERE id = :id');
        $policyStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
        $policyStatement->execute();
        $policy = $policyStatement->fetch();

        if (!$policy) {
            Response::json([
                'status' => 'error',
                'message' => 'Policy not found.'
            ], 404);
            exit;
        }

        $documentTypeStatement = $pdo->prepare('SELECT id FROM document_types WHERE id = :id');
        $documentTypeStatement->bindValue(':id', $documentTypeId, PDO::PARAM_INT);
        $documentTypeStatement->execute();

        if (!$documentTypeStatement->fetchColumn()) {
            Response::json([
                'status' => 'error',
                'message' => 'Document type not found.'
            ], 404);
            exit;
        }

        $uploadDir = dirname(__DIR__) . '/uploads';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            Response::json([
                'status' => 'error',
                'message' => 'Unable to prepare upload directory.'
            ], 500);
            exit;
        }

        $originalName = (string) $_FILES['file']['name'];
        $tmpName = (string) $_FILES['file']['tmp_name'];
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $storedName = uniqid('doc_', true) . ($extension !== '' ? '.' . $extension : '');
        $targetPath = $uploadDir . '/' . $storedName;

        if (!move_uploaded_file($tmpName, $targetPath)) {
            Response::json([
                'status' => 'error',
                'message' => 'Failed to save uploaded file.'
            ], 500);
            exit;
        }

        $mimeType = mime_content_type($targetPath) ?: null;
        $fileSize = filesize($targetPath) ?: null;
        $documentNumber = trim((string) ($_POST['document_number'] ?? ''));
        $documentDate = trim((string) ($_POST['document_date'] ?? ''));
        $expiryDate = trim((string) ($_POST['expiry_date'] ?? ''));
        $remarks = trim((string) ($_POST['remarks'] ?? ''));

        $statement = $pdo->prepare(
            'INSERT INTO documents (
                document_type_id,
                customer_id,
                policy_id,
                file_name,
                stored_file_name,
                file_url,
                file_extension,
                mime_type,
                file_size_bytes,
                document_number,
                document_date,
                expiry_date,
                remarks,
                uploaded_at,
                is_active
             ) VALUES (
                :document_type_id,
                :customer_id,
                :policy_id,
                :file_name,
                :stored_file_name,
                :file_url,
                :file_extension,
                :mime_type,
                :file_size_bytes,
                :document_number,
                :document_date,
                :expiry_date,
                :remarks,
                now(),
                1
             )'
        );
        $statement->bindValue(':document_type_id', $documentTypeId, PDO::PARAM_INT);
        $statement->bindValue(':customer_id', (int) $policy['customer_id'], PDO::PARAM_INT);
        $statement->bindValue(':policy_id', $policyId, PDO::PARAM_INT);
        $statement->bindValue(':file_name', $originalName);
        $statement->bindValue(':stored_file_name', $storedName);
        $statement->bindValue(':file_url', 'uploads/' . $storedName);
        $statement->bindValue(':file_extension', $extension !== '' ? $extension : null);
        $statement->bindValue(':mime_type', $mimeType);
        $statement->bindValue(':file_size_bytes', $fileSize, $fileSize !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
        $statement->bindValue(':document_number', $documentNumber !== '' ? $documentNumber : null);
        $statement->bindValue(':document_date', $documentDate !== '' ? $documentDate : null);
        $statement->bindValue(':expiry_date', $expiryDate !== '' ? $expiryDate : null);
        $statement->bindValue(':remarks', $remarks !== '' ? $remarks : null);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'message' => 'Document uploaded successfully.'
        ], 201);
        exit;
    }

    if ($path === '/api/payments/pending-client' && $method === 'GET') {
        $pdo = Database::connection();
        $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;

        $statement = $pdo->prepare(
            'SELECT
                p.id,
                p.policy_number,
                p.policy_type,
                p.issue_date,
                p.paid_by_type,
                p.net_premium,
                p.payment_received_amount,
                p.payment_pending_amount,
                p.client_payment_status,
                c.full_name AS customer_name,
                ic.company_name
             FROM policies p
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             WHERE p.paid_by_type = "Agent"
               AND coalesce(p.payment_pending_amount, 0) > 0
             ORDER BY p.updated_at DESC, p.id DESC
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

    if ($path === '/api/payments/client-payment' && $method === 'POST') {
        $pdo = Database::connection();
        $payload = json_decode(file_get_contents('php://input') ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        foreach (['policy_id', 'payment_date', 'amount', 'payment_mode'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $policyId = (int) $payload['policy_id'];
        $amount = (float) $payload['amount'];

        if ($amount <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Amount must be greater than zero.'
            ], 422);
            exit;
        }

        $policyStatement = $pdo->prepare(
            'SELECT id, net_premium, payment_received_amount, payment_pending_amount
             FROM policies
             WHERE id = :id'
        );
        $policyStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
        $policyStatement->execute();
        $policy = $policyStatement->fetch();

        if (!$policy) {
            Response::json([
                'status' => 'error',
                'message' => 'Policy not found.'
            ], 404);
            exit;
        }

        $currentReceived = (float) ($policy['payment_received_amount'] ?? 0);
        $netPremium = (float) ($policy['net_premium'] ?? 0);
        $newReceived = $currentReceived + $amount;
        $newPending = max($netPremium - $newReceived, 0);
        $clientPaymentStatus = $newPending <= 0 ? 'Received' : ($newReceived > 0 ? 'Partial' : 'Pending');

        $pdo->beginTransaction();

        try {
            $insertStatement = $pdo->prepare(
                'INSERT INTO client_payments (
                    policy_id,
                    payment_date,
                    amount,
                    payment_mode,
                    payment_status,
                    cheque_number,
                    cheque_date,
                    clearing_date,
                    reference_number,
                    remarks
                 ) VALUES (
                    :policy_id,
                    :payment_date,
                    :amount,
                    :payment_mode,
                    :payment_status,
                    :cheque_number,
                    :cheque_date,
                    :clearing_date,
                    :reference_number,
                    :remarks
                 )'
            );
            $insertStatement->bindValue(':policy_id', $policyId, PDO::PARAM_INT);
            $insertStatement->bindValue(':payment_date', $payload['payment_date']);
            $insertStatement->bindValue(':amount', $amount);
            $insertStatement->bindValue(':payment_mode', $payload['payment_mode']);
            $insertStatement->bindValue(':payment_status', $payload['payment_status'] !== '' ? $payload['payment_status'] : 'Received');
            $insertStatement->bindValue(':cheque_number', trim((string) ($payload['cheque_number'] ?? '')) !== '' ? $payload['cheque_number'] : null);
            $insertStatement->bindValue(':cheque_date', trim((string) ($payload['cheque_date'] ?? '')) !== '' ? $payload['cheque_date'] : null);
            $insertStatement->bindValue(':clearing_date', trim((string) ($payload['clearing_date'] ?? '')) !== '' ? $payload['clearing_date'] : null);
            $insertStatement->bindValue(':reference_number', trim((string) ($payload['reference_number'] ?? '')) !== '' ? $payload['reference_number'] : null);
            $insertStatement->bindValue(':remarks', trim((string) ($payload['remarks'] ?? '')) !== '' ? $payload['remarks'] : null);
            $insertStatement->execute();

            $updateStatement = $pdo->prepare(
                'UPDATE policies
                 SET payment_received_amount = :payment_received_amount,
                     payment_pending_amount = :payment_pending_amount,
                     client_payment_status = :client_payment_status
                 WHERE id = :id'
            );
            $updateStatement->bindValue(':payment_received_amount', $newReceived);
            $updateStatement->bindValue(':payment_pending_amount', $newPending);
            $updateStatement->bindValue(':client_payment_status', $clientPaymentStatus);
            $updateStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
            $updateStatement->execute();

            $pdo->commit();

            Response::json([
                'status' => 'ok',
                'message' => 'Client payment updated successfully.',
                'data' => [
                    'payment_received_amount' => $newReceived,
                    'payment_pending_amount' => $newPending,
                    'client_payment_status' => $clientPaymentStatus,
                ],
            ]);
            exit;
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }
    }

    if ($path === '/api/policies/renew-form' && $method === 'GET') {
        $pdo = Database::connection();

        $policies = $pdo->query(
            'SELECT
                p.id,
                p.policy_family_id,
                p.customer_id,
                c.group_id AS customer_group_id,
                cg.group_name AS customer_group_name,
                c.full_name AS customer_name,
                c.mobile AS customer_mobile,
                p.policy_number,
                p.policy_type,
                p.company_id,
                ic.company_name,
                p.product_id,
                ip.product_name,
                p.sum_insured,
                p.vehicle_make,
                p.vehicle_model,
                p.year_of_manufacture,
                p.registration_no,
                p.risk_end_date,
                p.renewal_status
             FROM policies p
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             LEFT JOIN insurance_products ip ON ip.id = p.product_id
             WHERE p.risk_end_date IS NOT NULL
               AND p.risk_end_date >= curdate()
               AND coalesce(p.renewal_status, "") <> "Renewed"
             ORDER BY p.risk_end_date ASC, p.policy_number ASC'
        )->fetchAll();

        Response::json([
            'status' => 'ok',
            'data' => [
                'policies' => $policies,
            ],
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

        $agentAccounts = $pdo->query(
            'SELECT
                apa.id,
                apa.agent_id,
                a.full_name AS agent_name,
                apa.account_label,
                apa.account_type,
                apa.bank_name,
                apa.is_default
             FROM agent_payment_accounts apa
             LEFT JOIN agents a ON a.id = apa.agent_id
             WHERE apa.is_active = 1
             ORDER BY a.full_name ASC, apa.is_default DESC, apa.account_label ASC'
        )->fetchAll();

        Response::json([
            'status' => 'ok',
            'data' => [
                'customerGroups' => $customerGroups,
                'customers' => $customers,
                'policyTypes' => $policyTypes,
                'insuranceCompanies' => $insuranceCompanies,
                'products' => $products,
                'agentAccounts' => $agentAccounts,
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

        $requiresChequeDetails =
            (($payload['paid_by_type'] ?? '') === 'Agent')
            && (($payload['payment_mode'] ?? '') === 'Cheque');

        if ($requiresChequeDetails) {
            foreach (['cheque_number', 'cheque_date', 'cheque_amount'] as $requiredField) {
                if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                    Response::json([
                        'status' => 'error',
                        'message' => sprintf('Field "%s" is required when Payment By is Agent and Payment Mode is Cheque.', $requiredField)
                    ], 422);
                    exit;
                }
            }
        }

        if ((($payload['paid_by_type'] ?? '') === 'Agent')
            && (!array_key_exists('agent_payment_account_id', $payload) || trim((string) $payload['agent_payment_account_id']) === '')
        ) {
            Response::json([
                'status' => 'error',
                'message' => 'Field "agent_payment_account_id" is required when Payment By is Agent.'
            ], 422);
            exit;
        }

        $customerId = (int) $payload['customer_id'];
        $companyId = (int) $payload['company_id'];
        $productId = isset($payload['product_id']) && $payload['product_id'] !== '' ? (int) $payload['product_id'] : null;
        $policyTypeId = isset($payload['policy_type']) && $payload['policy_type'] !== '' ? (int) $payload['policy_type'] : null;
        $agentPaymentAccountId = isset($payload['agent_payment_account_id']) && $payload['agent_payment_account_id'] !== ''
            ? (int) $payload['agent_payment_account_id']
            : null;
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
                    agent_payment_account_id,
                    payment_status,
                    client_payment_status,
                    payment_received_amount,
                    payment_pending_amount,
                    client_cheque_number,
                    client_cheque_date,
                    payment_remarks,
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
                    :agent_payment_account_id,
                    :payment_status,
                    :client_payment_status,
                    :payment_received_amount,
                    :payment_pending_amount,
                    :client_cheque_number,
                    :client_cheque_date,
                    :payment_remarks,
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
            $statement->bindValue(':agent_payment_account_id', $agentPaymentAccountId, $agentPaymentAccountId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $statement->bindValue(':payment_status', 'Pending');
            $statement->bindValue(':client_payment_status', 'Pending');
            $statement->bindValue(':payment_received_amount', 0);
            $statement->bindValue(':payment_pending_amount', $netPremium ?? 0);
            $statement->bindValue(':client_cheque_number', $requiresChequeDetails ? $payload['cheque_number'] : null);
            $statement->bindValue(':client_cheque_date', $requiresChequeDetails ? $payload['cheque_date'] : null);
            $statement->bindValue(
                ':payment_remarks',
                $requiresChequeDetails ? sprintf('Initial agent cheque amount: %s', $payload['cheque_amount']) : null
            );
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

    if ($path === '/api/policies/renew' && $method === 'POST') {
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

        foreach (['previous_policy_id', 'new_policy_number'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $previousPolicyId = (int) $payload['previous_policy_id'];
        $previousPolicyStatement = $pdo->prepare(
            'SELECT *
             FROM policies
             WHERE id = :id'
        );
        $previousPolicyStatement->bindValue(':id', $previousPolicyId, PDO::PARAM_INT);
        $previousPolicyStatement->execute();
        $previousPolicy = $previousPolicyStatement->fetch();

        if (!$previousPolicy) {
            Response::json([
                'status' => 'error',
                'message' => 'Selected old policy was not found.'
            ], 404);
            exit;
        }

        $pdo->beginTransaction();

        try {
            $policyCode = 'PL' . date('YmdHis') . random_int(100, 999);
            $grossPremium = $payload['gross_premium'] !== '' ? (float) $payload['gross_premium'] : null;
            $netPremium = $payload['net_premium'] !== '' ? (float) $payload['net_premium'] : null;

            $statement = $pdo->prepare(
                'INSERT INTO policies (
                    policy_code,
                    policy_family_id,
                    previous_policy_id,
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
                    renewal_status,
                    policy_status,
                    inactive_reason,
                    is_latest_in_family,
                    last_status,
                    fiscal_year_ending
                 ) VALUES (
                    :policy_code,
                    :policy_family_id,
                    :previous_policy_id,
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
                    :renewal_status,
                    :policy_status,
                    :inactive_reason,
                    :is_latest_in_family,
                    :last_status,
                    :fiscal_year_ending
                 )'
            );

            $statement->bindValue(':policy_code', $policyCode);
            $statement->bindValue(':policy_family_id', (int) $previousPolicy['policy_family_id'], PDO::PARAM_INT);
            $statement->bindValue(':previous_policy_id', $previousPolicyId, PDO::PARAM_INT);
            $statement->bindValue(':customer_id', (int) $previousPolicy['customer_id'], PDO::PARAM_INT);
            $statement->bindValue(':company_id', (int) $previousPolicy['company_id'], PDO::PARAM_INT);
            $statement->bindValue(':product_id', $previousPolicy['product_id'] !== null ? (int) $previousPolicy['product_id'] : null, $previousPolicy['product_id'] !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
            $statement->bindValue(':policy_number', $payload['new_policy_number']);
            $statement->bindValue(':business_type', 'Renewal');
            $statement->bindValue(':policy_type', $payload['policy_type'] !== '' ? $payload['policy_type'] : $previousPolicy['policy_type']);
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
            $statement->bindValue(':renewal_status', 'Renewed');
            $statement->bindValue(':policy_status', 'Active');
            $statement->bindValue(':inactive_reason', null, PDO::PARAM_NULL);
            $statement->bindValue(':is_latest_in_family', 1, PDO::PARAM_INT);
            $statement->bindValue(':last_status', 'Renewed');
            $statement->bindValue(':fiscal_year_ending', (int) date('Y'));
            $statement->execute();

            $updatePrevious = $pdo->prepare(
                'UPDATE policies
                 SET is_latest_in_family = 0, renewal_status = :renewal_status, last_status = :last_status
                 WHERE id = :id'
            );
            $updatePrevious->bindValue(':renewal_status', 'Renewed');
            $updatePrevious->bindValue(':last_status', 'Superseded');
            $updatePrevious->bindValue(':id', $previousPolicyId, PDO::PARAM_INT);
            $updatePrevious->execute();

            $policyId = (int) $pdo->lastInsertId();
            $pdo->commit();

            Response::json([
                'status' => 'ok',
                'message' => 'Policy renewed successfully.',
                'data' => [
                    'policy_id' => $policyId,
                    'policy_code' => $policyCode,
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

        if ($method === 'DELETE' && $id !== null) {
            $statement = $pdo->prepare(sprintf('DELETE FROM %s WHERE id = :id', $config['table']));
            $statement->bindValue(':id', $id, PDO::PARAM_INT);
            $statement->execute();

            if ($statement->rowCount() === 0) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Record not found.'
                ], 404);
                exit;
            }

            Response::json([
                'status' => 'ok',
                'message' => 'Record deleted successfully.'
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
