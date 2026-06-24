<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Database;
use App\MasterRegistry;
use App\Response;
use PDO;
use PDOException;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Organization-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function singularizeMasterLabel(string $resource): string
{
    $label = str_replace('-', ' ', $resource);

    return match ($resource) {
        'customer-groups' => 'customer group',
        'customers' => 'customer',
        'insurance-companies' => 'insurance company',
        'states' => 'state',
        'cities' => 'city',
        'product-categories' => 'product category',
        'insurance-products' => 'insurance product',
        'document-types' => 'document type',
        'users' => 'user',
        'agents' => 'agent',
        'agent-accounts' => 'agent account',
        'settings' => 'settings record',
        default => rtrim($label, 's'),
    };
}

function linkedDeleteMessage(string $resource): string
{
    $label = singularizeMasterLabel($resource);

    return sprintf(
        'Cannot delete this %s because linked records exist. Remove the related records first and try again.',
        $label
    );
}

function buildFullAccessViews(): string
{
    return json_encode([
        '/dashboard',
        '/masters/organizations',
        '/masters/customers',
        '/masters/customer-groups',
        '/masters/insurance-companies',
        '/masters/states',
        '/masters/cities',
        '/masters/product-categories',
        '/masters/insurance-products',
        '/masters/document-types',
        '/masters/users',
        '/masters/agents',
        '/masters/agent-accounts',
        '/masters/settings',
        '/leads/all',
        '/leads/add',
        '/leads/pending-assigning',
        '/leads/pending-first-follow-up',
        '/leads/pending-repeat-follow-up',
        '/leads/converted',
        '/leads/lost',
        '/leads/canceled',
        '/leads/activity-log',
        '/tasks/all',
        '/tasks/add',
        '/tasks/pending',
        '/tasks/completed',
        '/tasks/canceled',
        '/tasks/action-log',
        '/policies/all',
        '/policies/issue',
        '/policies/renew',
        '/policies/attach-documents',
        '/payments/pending',
        '/payments/received',
        '/reports/policies-added',
        '/reports/policies-this-week',
        '/reports/policies-this-month',
        '/reports/pending-payments',
        '/reports/pending-document-uploads',
        '/reports/expiry-reports/section/monthly',
        '/reports/expiry-reports/section/daily',
        '/reports/expiry-reports/section/weekly',
        '/reports/expiry-reports/section/yearly',
    ]);
}

function requestOrganizationId(): ?int
{
    $rawOrganizationId = $_SERVER['HTTP_X_ORGANIZATION_ID']
        ?? $_SERVER['REDIRECT_HTTP_X_ORGANIZATION_ID']
        ?? ($_GET['organization_id'] ?? null);

    if ($rawOrganizationId === null || trim((string) $rawOrganizationId) === '') {
        return null;
    }

    $organizationId = (int) $rawOrganizationId;

    return $organizationId > 0 ? $organizationId : null;
}

function requireOrganizationId(): int
{
    $organizationId = requestOrganizationId();

    if ($organizationId === null) {
        Response::json([
            'status' => 'error',
            'message' => 'Login organization is required.'
        ], 400);
        exit;
    }

    return $organizationId;
}

function bindOrganizationId($statement, int $organizationId): void
{
    $statement->bindValue(':organization_id', $organizationId, PDO::PARAM_INT);
}

function isMissingOrganizationColumn(PDOException $exception): bool
{
    return $exception->getCode() === '42S22'
        && str_contains($exception->getMessage(), 'organization_id');
}

function scopedCountOrZero(PDO $pdo, string $sql, int $organizationId): int
{
    try {
        $statement = $pdo->prepare($sql);
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        return (int) $statement->fetchColumn();
    } catch (PDOException $exception) {
        if (isMissingOrganizationColumn($exception)) {
            return 0;
        }

        throw $exception;
    }
}

function scopedRowsOrEmpty(PDO $pdo, string $sql, int $organizationId, array $bindings = []): array
{
    try {
        $statement = $pdo->prepare($sql);
        bindOrganizationId($statement, $organizationId);
        foreach ($bindings as $name => [$value, $type]) {
            $statement->bindValue($name, $value, $type);
        }
        $statement->execute();

        return $statement->fetchAll();
    } catch (PDOException $exception) {
        if (isMissingOrganizationColumn($exception)) {
            return [];
        }

        throw $exception;
    }
}
function isFinalLeadStatus(string $status): bool
{
    return in_array($status, ['Converted', 'Lost', 'Canceled'], true);
}

function normalizeLeadUpdateStatus(string $status): string
{
    $normalized = strtolower(trim($status));

    return match ($normalized) {
        'success' => 'Success',
        'follow up again' => 'Follow Up Again',
        'lost' => 'Lost',
        'cancel' => 'Cancel',
        default => '',
    };
}

function deriveLeadStatusFromAssignment(?int $assignedToUserId, bool $hasUpdates, ?string $currentStatus = null): string
{
    if ($currentStatus !== null && isFinalLeadStatus($currentStatus)) {
        return $currentStatus;
    }

    if ($assignedToUserId === null) {
        return 'Pending Assigning';
    }

    return $hasUpdates ? 'Pending Repeat Follow Up' : 'Pending First Follow Up';
}

function deriveLeadStatusFromUpdate(string $updateStatus, ?string $nextFollowUpDate): string
{
    return match ($updateStatus) {
        'Success' => $nextFollowUpDate ? 'Pending Repeat Follow Up' : 'Converted',
        'Follow Up Again' => 'Pending Repeat Follow Up',
        'Lost' => 'Lost',
        'Cancel' => 'Canceled',
        default => 'Pending Repeat Follow Up',
    };
}

function isFinalTaskStatus(string $status): bool
{
    return in_array($status, ['Completed', 'Canceled'], true);
}

function normalizeTaskUpdateStatus(string $status): string
{
    $normalized = strtolower(trim($status));

    return match ($normalized) {
        'success' => 'Success',
        'follow up again' => 'Follow Up Again',
        'cancel' => 'Cancel',
        default => '',
    };
}

function deriveTaskStatusFromAssignment(?int $assignedToUserId, bool $hasUpdates, ?string $currentStatus = null): string
{
    if ($currentStatus !== null && isFinalTaskStatus($currentStatus)) {
        return $currentStatus;
    }

    return 'Pending';
}

function deriveTaskStatusFromUpdate(string $updateStatus, ?string $nextFollowUpDate): string
{
    return match ($updateStatus) {
        'Success' => $nextFollowUpDate ? 'Pending' : 'Completed',
        'Follow Up Again' => 'Pending',
        'Cancel' => 'Canceled',
        default => 'Pending',
    };
}

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
        $organizationId = requireOrganizationId();
        $counts = [];

        $scopedCount = static function (string $sql) use ($pdo, $organizationId): int {
            return scopedCountOrZero($pdo, $sql, $organizationId);
        };

        $registry = MasterRegistry::all();
        foreach ($registry as $key => $config) {
            $table = $config['table'];
            if (($config['organization_owned'] ?? true) === true) {
                $counts[$key] = $scopedCount(sprintf('SELECT count(*) FROM %s WHERE %s = :organization_id', $config['from'] ?? $table, $config['organization_scope_column'] ?? 'organization_id'));
            } elseif ($key === 'organizations') {
                $counts[$key] = $scopedCount('SELECT count(*) FROM organizations WHERE id = :organization_id');
            } else {
                $counts[$key] = (int) $pdo->query("SELECT count(*) FROM $table")->fetchColumn();
            }
        }

        $counts['leads-all'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id');
        $counts['leads-pending-assigning'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Pending Assigning"');
        $counts['leads-pending-first-follow-up'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Pending First Follow Up"');
        $counts['leads-pending-repeat-follow-up'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Pending Repeat Follow Up"');
        $counts['leads-converted'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Converted"');
        $counts['leads-converted-today'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Converted" AND latest_update_date = curdate()');
        $counts['leads-lost'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Lost"');
        $counts['leads-lost-today'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Lost" AND latest_update_date = curdate()');
        $counts['leads-canceled'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Canceled"');
        $counts['leads-canceled-today'] = $scopedCount('SELECT count(*) FROM leads WHERE organization_id = :organization_id AND lead_status = "Canceled" AND latest_update_date = curdate()');
        $counts['leads-activity-log'] = $scopedCount('SELECT count(*) FROM lead_updates WHERE organization_id = :organization_id');

        $counts['tasks-all'] = $scopedCount('SELECT count(*) FROM tasks WHERE organization_id = :organization_id');
        $counts['tasks-pending'] = $scopedCount('SELECT count(*) FROM tasks WHERE organization_id = :organization_id AND task_status = "Pending"');
        $counts['tasks-completed'] = $scopedCount('SELECT count(*) FROM tasks WHERE organization_id = :organization_id AND task_status = "Completed"');
        $counts['tasks-completed-today'] = $scopedCount('SELECT count(*) FROM tasks WHERE organization_id = :organization_id AND task_status = "Completed" AND latest_update_date = curdate()');
        $counts['tasks-canceled'] = $scopedCount('SELECT count(*) FROM tasks WHERE organization_id = :organization_id AND task_status = "Canceled"');
        $counts['tasks-canceled-today'] = $scopedCount('SELECT count(*) FROM tasks WHERE organization_id = :organization_id AND task_status = "Canceled" AND latest_update_date = curdate()');
        $counts['tasks-activity-log'] = $scopedCount('SELECT count(*) FROM task_updates WHERE organization_id = :organization_id');

        $counts['all-policies'] = $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id');
        $counts['renew-policy'] = $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND risk_end_date >= curdate() AND coalesce(renewal_status, "") <> "Renewed"');
        $counts['renew-policy-today'] = $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date = curdate() AND coalesce(renewal_status, "") <> "Renewed"');
        $counts['attach-documents'] = $scopedCount('SELECT count(*) FROM (SELECT p.id FROM policies p LEFT JOIN documents d ON d.policy_id = p.id AND d.deleted_at IS NULL AND d.is_active = 1 WHERE p.organization_id = :organization_id GROUP BY p.id HAVING count(d.id) = 0) pending_docs');
        $counts['pending-payments'] = $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND paid_by_type = "Agent" AND coalesce(payment_pending_amount, 0) > 0');
        $counts['policies-added'] = $scopedCount('SELECT count(*) FROM policies p WHERE p.organization_id = :organization_id AND date(p.created_at) = curdate()');
        $counts['policies-this-week'] = $scopedCount('SELECT count(*) FROM policies p WHERE p.organization_id = :organization_id AND yearweek(p.created_at, 1) = yearweek(curdate(), 1)');
        $counts['policies-this-month'] = $scopedCount('SELECT count(*) FROM policies p WHERE p.organization_id = :organization_id AND year(p.created_at) = year(curdate()) AND month(p.created_at) = month(curdate())');
        $counts['expiry-reports'] = $scopedCount('SELECT count(*) FROM policies p WHERE p.organization_id = :organization_id AND p.risk_end_date IS NOT NULL');

        Response::json([
            'status' => 'ok',
            'data' => $counts
        ]);
        exit;
    }

    if ($path === '/api/customers' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $limit = isset($_GET['limit']) ? max(1, min(100, (int) $_GET['limit'])) : 25;

        $statement = $pdo->prepare(
            'SELECT id, customer_code, full_name, mobile, email, city, state, is_active, created_at
             FROM customers
             WHERE organization_id = :organization_id
             ORDER BY id DESC
             LIMIT :limit'
        );
        bindOrganizationId($statement, $organizationId);
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
        $organizationId = requireOrganizationId();
        $customerId = (int) $matches[1];

        $customerStatement = $pdo->prepare(
            'SELECT id, customer_code, full_name
             FROM customers
             WHERE id = :id
               AND organization_id = :organization_id
             LIMIT 1'
        );
        $customerStatement->bindValue(':id', $customerId, PDO::PARAM_INT);
        bindOrganizationId($customerStatement, $organizationId);
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
               AND p.organization_id = :organization_id
             ORDER BY p.risk_end_date DESC, p.issue_date DESC, p.id DESC'
        );
        $policyStatement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
        bindOrganizationId($policyStatement, $organizationId);
        $policyStatement->execute();

        $documentStatement = $pdo->prepare(
            'SELECT
                d.id,
                dt.name AS document_type_name,
                d.file_name,
                d.file_url,
                d.document_number,
                d.document_date,
                d.expiry_date,
                d.remarks,
                d.uploaded_at
             FROM documents d
             LEFT JOIN document_types dt ON dt.id = d.document_type_id
             WHERE d.customer_id = :customer_id
               AND d.organization_id = :organization_id
               AND d.deleted_at IS NULL
               AND d.is_active = 1
             ORDER BY d.uploaded_at DESC, d.id DESC'
        );
        $documentStatement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
        bindOrganizationId($documentStatement, $organizationId);
        $documentStatement->execute();

        Response::json([
            'status' => 'ok',
            'data' => [
                'customer' => $customer,
                'policies' => $policyStatement->fetchAll(),
                'documents' => $documentStatement->fetchAll()
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

    if ($path === '/api/leads/activity' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $statement = $pdo->prepare(
            'SELECT *
             FROM (
                SELECT
                    concat("lead-", l.id) AS activity_key,
                    "Lead Created" AS activity_type,
                    l.client_name,
                    l.lead_status,
                    null AS update_status,
                    l.lead_date AS activity_date,
                    u.full_name AS assigned_to_name,
                    null AS update_by_name,
                    l.next_follow_up_date,
                    l.notes AS remarks,
                    l.created_at AS sort_at
                FROM leads l
                LEFT JOIN users u ON u.id = l.assigned_to_user_id
                WHERE l.organization_id = :organization_id

                UNION ALL

                SELECT
                    concat("update-", lu.id) AS activity_key,
                    "Follow Up" AS activity_type,
                    l.client_name,
                    l.lead_status,
                    lu.status AS update_status,
                    lu.update_date AS activity_date,
                    u.full_name AS assigned_to_name,
                    uu.full_name AS update_by_name,
                    lu.next_follow_up_date,
                    lu.remarks AS remarks,
                    lu.created_at AS sort_at
                FROM lead_updates lu
                INNER JOIN leads l ON l.id = lu.lead_id
                LEFT JOIN users u ON u.id = l.assigned_to_user_id
                LEFT JOIN users uu ON uu.id = lu.update_by_user_id
                WHERE lu.organization_id = :lead_update_organization_id
             ) activity
             ORDER BY sort_at DESC'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':lead_update_organization_id', $organizationId, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll()
        ]);
        exit;
    }
    if ($path === '/api/leads' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $view = trim((string) ($_GET['view'] ?? 'all'));
        $whereConditions = ['l.organization_id = :organization_id'];

        if ($view === 'pending-assigning') {
            $whereConditions[] = 'l.lead_status = "Pending Assigning"';
        } elseif ($view === 'pending-first-follow-up') {
            $whereConditions[] = 'l.lead_status = "Pending First Follow Up"';
        } elseif ($view === 'pending-repeat-follow-up') {
            $whereConditions[] = 'l.lead_status = "Pending Repeat Follow Up"';
        } elseif ($view === 'converted') {
            $whereConditions[] = 'l.lead_status = "Converted"';
        } elseif ($view === 'lost') {
            $whereConditions[] = 'l.lead_status = "Lost"';
        } elseif ($view === 'canceled') {
            $whereConditions[] = 'l.lead_status = "Canceled"';
        }

        $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
        $statement = $pdo->prepare(
            "SELECT
                l.id,
                l.lead_date,
                l.description,
                l.due_date,
                l.client_name,
                l.priority,
                l.assigned_to_user_id,
                l.category_id,
                l.sub_category_id,
                l.notes,
                l.lead_status,
                l.latest_update_date,
                l.next_follow_up_date,
                u.full_name AS assigned_to_name,
                uu.full_name AS update_by_name,
                c.category_name,
                sc.category_name AS sub_category_name
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_to_user_id
             LEFT JOIN lead_updates lu ON lu.id = (
                SELECT lu2.id
                FROM lead_updates lu2
                WHERE lu2.lead_id = l.id
                ORDER BY lu2.update_date DESC, lu2.id DESC
                LIMIT 1
             )
             LEFT JOIN users uu ON uu.id = lu.update_by_user_id
             LEFT JOIN product_categories c ON c.id = l.category_id
             LEFT JOIN product_categories sc ON sc.id = l.sub_category_id
             $whereClause
             ORDER BY l.id DESC"
        );
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll()
        ]);
        exit;
    }
    if ($path === '/api/auth/login' && $method === 'POST') {
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

        $organizationInput = trim((string) ($payload['organization_id'] ?? ''));
        $loginId = trim((string) ($payload['login_id'] ?? ''));
        $password = trim((string) ($payload['password'] ?? ''));

        if ($organizationInput === '' || $loginId === '' || $password === '') {
            Response::json([
                'status' => 'error',
                'message' => 'Organization Id, Log In Id and Password are required.'
            ], 422);
            exit;
        }

        $organizationStatement = $pdo->prepare(
            'SELECT id, organization_code, organization_name, is_active
             FROM organizations
             WHERE CAST(id AS CHAR) = :organization_input
                OR LOWER(organization_code) = LOWER(:organization_code)
                OR LOWER(organization_name) = LOWER(:organization_name)
             ORDER BY CASE
                WHEN LOWER(organization_code) = LOWER(:organization_code_exact) THEN 0
                WHEN CAST(id AS CHAR) = :organization_exact THEN 1
                ELSE 2
             END
             LIMIT 1'
        );
        $organizationStatement->bindValue(':organization_input', $organizationInput);
        $organizationStatement->bindValue(':organization_code', $organizationInput);
        $organizationStatement->bindValue(':organization_name', $organizationInput);
        $organizationStatement->bindValue(':organization_code_exact', $organizationInput);
        $organizationStatement->bindValue(':organization_exact', $organizationInput);
        $organizationStatement->execute();
        $organization = $organizationStatement->fetch();

        if (!$organization) {
            Response::json([
                'status' => 'error',
                'message' => 'Organization Id not found.'
            ], 404);
            exit;
        }

        if (!(bool) $organization['is_active']) {
            Response::json([
                'status' => 'error',
                'message' => 'This organization is inactive.'
            ], 403);
            exit;
        }

        $isBizskillSuperAdminLogin = strtolower($loginId) === 'bizskill' && $password === '!Office1@';
        $user = null;

        if ($isBizskillSuperAdminLogin) {
            $statement = $pdo->prepare(
                'SELECT u.id, u.full_name, u.login_id, u.email, u.mobile, u.linked_agent_id, s.logo AS organization_logo
                 FROM users u
                 LEFT JOIN settings s ON s.organization_id = :organization_id AND s.is_active = 1
                 WHERE LOWER(u.login_id) = LOWER(:login_id)
                 ORDER BY u.id ASC, s.id DESC
                 LIMIT 1'
            );
            $statement->bindValue(':organization_id', (int) $organization['id'], PDO::PARAM_INT);
            $statement->bindValue(':login_id', $loginId);
            $statement->execute();
            $adminUser = $statement->fetch();

            $user = [
                'id' => $adminUser['id'] ?? -1,
                'full_name' => $adminUser['full_name'] ?? 'Bizskill Admin',
                'login_id' => $loginId,
                'views' => buildFullAccessViews(),
                'email' => $adminUser['email'] ?? null,
                'mobile' => $adminUser['mobile'] ?? null,
                'role_name' => 'Super Admin',
                'linked_agent_id' => $adminUser['linked_agent_id'] ?? null,
                'organization_logo' => $adminUser['organization_logo'] ?? null,
                'is_active' => 1,
            ];
        } else {
            $statement = $pdo->prepare(
                'SELECT u.id, u.full_name, u.login_id, u.password, u.views, u.email, u.mobile, u.role_name, u.linked_agent_id, u.is_active, s.logo AS organization_logo
                 FROM users u
                 LEFT JOIN settings s ON s.organization_id = u.organization_id AND s.is_active = 1
                 WHERE u.organization_id = :organization_id
                   AND u.login_id = :login_id
                 ORDER BY s.id DESC
                 LIMIT 1'
            );
            $statement->bindValue(':organization_id', (int) $organization['id'], PDO::PARAM_INT);
            $statement->bindValue(':login_id', $loginId);
            $statement->execute();
            $user = $statement->fetch();

            if (!$user || (string) $user['password'] !== $password) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid Log In Id or Password.'
                ], 401);
                exit;
            }
        }

        if (!(bool) $user['is_active']) {
            Response::json([
                'status' => 'error',
                'message' => 'This user is inactive.'
            ], 403);
            exit;
        }

        $views = trim((string) ($user['views'] ?? ''));
        if ($views === '' || $views === '[]') {
            Response::json([
                'status' => 'error',
                'message' => 'No views assigned for this user.'
            ], 403);
            exit;
        }

        Response::json([
            'status' => 'ok',
            'data' => [
                'id' => (int) $user['id'],
                'organization_id' => (int) $organization['id'],
                'organization_name' => (string) $organization['organization_name'],
                'organization_logo' => $user['organization_logo'],
                'full_name' => (string) $user['full_name'],
                'login_id' => (string) $user['login_id'],
                'views' => $views,
                'email' => $user['email'],
                'mobile' => $user['mobile'],
                'role_name' => $user['role_name'],
                'linked_agent_id' => $user['linked_agent_id']
            ]
        ]);
        exit;
    }

    if ($path === '/api/tasks/activity' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $statement = $pdo->prepare(
            'SELECT *
             FROM (
                SELECT
                    concat("task-", t.id) AS activity_key,
                    "Task Created" AS activity_type,
                    t.client_name,
                    t.task_status,
                    null AS update_status,
                    t.task_date AS activity_date,
                    u.full_name AS assigned_to_name,
                    null AS update_by_name,
                    t.next_follow_up_date,
                    t.notes AS remarks,
                    t.created_at AS sort_at
                FROM tasks t
                LEFT JOIN users u ON u.id = t.assigned_to_user_id
                WHERE t.organization_id = :organization_id

                UNION ALL

                SELECT
                    concat("task-update-", tu.id) AS activity_key,
                    "Task Follow Up" AS activity_type,
                    t.client_name,
                    t.task_status,
                    tu.status AS update_status,
                    tu.update_date AS activity_date,
                    u.full_name AS assigned_to_name,
                    uu.full_name AS update_by_name,
                    tu.next_follow_up_date,
                    tu.remarks AS remarks,
                    tu.created_at AS sort_at
                FROM task_updates tu
                INNER JOIN tasks t ON t.id = tu.task_id
                LEFT JOIN users u ON u.id = t.assigned_to_user_id
                LEFT JOIN users uu ON uu.id = tu.update_by_user_id
                WHERE tu.organization_id = :task_update_organization_id
             ) activity
             ORDER BY sort_at DESC'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':task_update_organization_id', $organizationId, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll()
        ]);
        exit;
    }
    if ($path === '/api/tasks' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $view = trim((string) ($_GET['view'] ?? 'all'));
        $whereConditions = ['t.organization_id = :organization_id'];

        if ($view === 'pending') {
            $whereConditions[] = 't.task_status = "Pending"';
        } elseif ($view === 'completed') {
            $whereConditions[] = 't.task_status = "Completed"';
        } elseif ($view === 'canceled') {
            $whereConditions[] = 't.task_status = "Canceled"';
        }

        $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
        $statement = $pdo->prepare(
            "SELECT
                t.id,
                t.task_date,
                t.description,
                t.due_date,
                t.client_name,
                t.priority,
                t.assigned_to_user_id,
                t.category_id,
                t.sub_category_id,
                t.notes,
                t.task_status,
                t.latest_update_date,
                t.next_follow_up_date,
                u.full_name AS assigned_to_name,
                uu.full_name AS update_by_name,
                c.category_name,
                sc.category_name AS sub_category_name
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assigned_to_user_id
             LEFT JOIN task_updates tu ON tu.id = (
                SELECT tu2.id
                FROM task_updates tu2
                WHERE tu2.task_id = t.id
                ORDER BY tu2.update_date DESC, tu2.id DESC
                LIMIT 1
             )
             LEFT JOIN users uu ON uu.id = tu.update_by_user_id
             LEFT JOIN product_categories c ON c.id = t.category_id
             LEFT JOIN product_categories sc ON sc.id = t.sub_category_id
             $whereClause
             ORDER BY t.id DESC"
        );
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll()
        ]);
        exit;
    }
    if ($path === '/api/leads' && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        foreach (['lead_date', 'client_name', 'description', 'due_date', 'priority', 'category_id', 'sub_category_id'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $assignedToUserId = trim((string) ($payload['assigned_to_user_id'] ?? '')) !== ''
            ? (int) $payload['assigned_to_user_id']
            : null;
        $categoryId = trim((string) ($payload['category_id'] ?? '')) !== ''
            ? (int) $payload['category_id']
            : null;
        $subCategoryId = trim((string) ($payload['sub_category_id'] ?? '')) !== ''
            ? (int) $payload['sub_category_id']
            : null;
        $leadStatus = deriveLeadStatusFromAssignment($assignedToUserId, false);

        $statement = $pdo->prepare(
            'INSERT INTO leads (
                organization_id,
                lead_date,
                description,
                due_date,
                client_name,
                priority,
                assigned_to_user_id,
                category_id,
                sub_category_id,
                notes,
                lead_status
             ) VALUES (
                :organization_id,
                :lead_date,
                :description,
                :due_date,
                :client_name,
                :priority,
                :assigned_to_user_id,
                :category_id,
                :sub_category_id,
                :notes,
                :lead_status
             )'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':lead_date', $payload['lead_date']);
        $statement->bindValue(':description', trim((string) ($payload['description'] ?? '')) !== '' ? $payload['description'] : null);
        $statement->bindValue(':due_date', trim((string) ($payload['due_date'] ?? '')) !== '' ? $payload['due_date'] : null);
        $statement->bindValue(':client_name', $payload['client_name']);
        $statement->bindValue(':priority', trim((string) ($payload['priority'] ?? '')) !== '' ? $payload['priority'] : 'Medium');
        $statement->bindValue(':assigned_to_user_id', $assignedToUserId, $assignedToUserId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':category_id', $categoryId, $categoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':sub_category_id', $subCategoryId, $subCategoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':notes', trim((string) ($payload['notes'] ?? '')) !== '' ? $payload['notes'] : null);
        $statement->bindValue(':lead_status', $leadStatus);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'message' => 'Lead created successfully.',
            'id' => (int) $pdo->lastInsertId()
        ], 201);
        exit;
    }

    if ($path === '/api/tasks' && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        foreach (['task_date', 'client_name', 'description', 'due_date', 'priority', 'category_id', 'sub_category_id'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $assignedToUserId = trim((string) ($payload['assigned_to_user_id'] ?? '')) !== ''
            ? (int) $payload['assigned_to_user_id']
            : null;
        $categoryId = trim((string) ($payload['category_id'] ?? '')) !== ''
            ? (int) $payload['category_id']
            : null;
        $subCategoryId = trim((string) ($payload['sub_category_id'] ?? '')) !== ''
            ? (int) $payload['sub_category_id']
            : null;
        $taskStatus = deriveTaskStatusFromAssignment($assignedToUserId, false);

        $statement = $pdo->prepare(
            'INSERT INTO tasks (
                organization_id,
                task_date,
                description,
                due_date,
                client_name,
                priority,
                assigned_to_user_id,
                category_id,
                sub_category_id,
                notes,
                task_status
             ) VALUES (
                :organization_id,
                :task_date,
                :description,
                :due_date,
                :client_name,
                :priority,
                :assigned_to_user_id,
                :category_id,
                :sub_category_id,
                :notes,
                :task_status
             )'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':task_date', $payload['task_date']);
        $statement->bindValue(':description', trim((string) ($payload['description'] ?? '')) !== '' ? $payload['description'] : null);
        $statement->bindValue(':due_date', trim((string) ($payload['due_date'] ?? '')) !== '' ? $payload['due_date'] : null);
        $statement->bindValue(':client_name', $payload['client_name']);
        $statement->bindValue(':priority', trim((string) ($payload['priority'] ?? '')) !== '' ? $payload['priority'] : 'Medium');
        $statement->bindValue(':assigned_to_user_id', $assignedToUserId, $assignedToUserId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':category_id', $categoryId, $categoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':sub_category_id', $subCategoryId, $subCategoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':notes', trim((string) ($payload['notes'] ?? '')) !== '' ? $payload['notes'] : null);
        $statement->bindValue(':task_status', $taskStatus);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'message' => 'Task created successfully.',
            'id' => (int) $pdo->lastInsertId()
        ], 201);
        exit;
    }

    if (preg_match('#^/api/leads/(\d+)$#', $path, $matches) === 1 && $method === 'PUT') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $leadId = (int) $matches[1];
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        $existingLeadStatement = $pdo->prepare(
            'SELECT id, lead_status
             FROM leads
             WHERE id = :id
               AND organization_id = :organization_id
             LIMIT 1'
        );
        $existingLeadStatement->bindValue(':id', $leadId, PDO::PARAM_INT);
        bindOrganizationId($existingLeadStatement, $organizationId);
        $existingLeadStatement->execute();
        $existingLead = $existingLeadStatement->fetch();

        if (!$existingLead) {
            Response::json([
                'status' => 'error',
                'message' => 'Lead not found.'
            ], 404);
            exit;
        }

        foreach (['lead_date', 'client_name', 'description', 'due_date', 'priority', 'category_id', 'sub_category_id'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $updatesCountStatement = $pdo->prepare(
            'SELECT count(*) FROM lead_updates WHERE lead_id = :lead_id AND organization_id = :organization_id'
        );
        $updatesCountStatement->bindValue(':lead_id', $leadId, PDO::PARAM_INT);
        bindOrganizationId($updatesCountStatement, $organizationId);
        $updatesCountStatement->execute();
        $hasUpdates = (int) $updatesCountStatement->fetchColumn() > 0;

        $assignedToUserId = trim((string) ($payload['assigned_to_user_id'] ?? '')) !== ''
            ? (int) $payload['assigned_to_user_id']
            : null;
        $categoryId = trim((string) ($payload['category_id'] ?? '')) !== ''
            ? (int) $payload['category_id']
            : null;
        $subCategoryId = trim((string) ($payload['sub_category_id'] ?? '')) !== ''
            ? (int) $payload['sub_category_id']
            : null;
        $leadStatus = deriveLeadStatusFromAssignment($assignedToUserId, $hasUpdates, (string) $existingLead['lead_status']);

        $statement = $pdo->prepare(
            'UPDATE leads
             SET lead_date = :lead_date,
                 description = :description,
                 due_date = :due_date,
                 client_name = :client_name,
                 priority = :priority,
                 assigned_to_user_id = :assigned_to_user_id,
                 category_id = :category_id,
                 sub_category_id = :sub_category_id,
                 notes = :notes,
                 lead_status = :lead_status
             WHERE id = :id
               AND organization_id = :organization_id'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':lead_date', $payload['lead_date']);
        $statement->bindValue(':description', trim((string) ($payload['description'] ?? '')) !== '' ? $payload['description'] : null);
        $statement->bindValue(':due_date', trim((string) ($payload['due_date'] ?? '')) !== '' ? $payload['due_date'] : null);
        $statement->bindValue(':client_name', $payload['client_name']);
        $statement->bindValue(':priority', trim((string) ($payload['priority'] ?? '')) !== '' ? $payload['priority'] : 'Medium');
        $statement->bindValue(':assigned_to_user_id', $assignedToUserId, $assignedToUserId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':category_id', $categoryId, $categoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':sub_category_id', $subCategoryId, $subCategoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':notes', trim((string) ($payload['notes'] ?? '')) !== '' ? $payload['notes'] : null);
        $statement->bindValue(':lead_status', $leadStatus);
        $statement->bindValue(':id', $leadId, PDO::PARAM_INT);
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'message' => 'Lead updated successfully.'
        ]);
        exit;
    }

    if (preg_match('#^/api/tasks/(\d+)$#', $path, $matches) === 1 && $method === 'PUT') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $taskId = (int) $matches[1];
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        $existingTaskStatement = $pdo->prepare(
            'SELECT id, task_status
             FROM tasks
             WHERE id = :id
               AND organization_id = :organization_id
             LIMIT 1'
        );
        $existingTaskStatement->bindValue(':id', $taskId, PDO::PARAM_INT);
        bindOrganizationId($existingTaskStatement, $organizationId);
        $existingTaskStatement->execute();
        $existingTask = $existingTaskStatement->fetch();

        if (!$existingTask) {
            Response::json([
                'status' => 'error',
                'message' => 'Task not found.'
            ], 404);
            exit;
        }

        foreach (['task_date', 'client_name', 'description', 'due_date', 'priority', 'category_id', 'sub_category_id'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        $updatesCountStatement = $pdo->prepare(
            'SELECT count(*) FROM task_updates WHERE task_id = :task_id AND organization_id = :organization_id'
        );
        $updatesCountStatement->bindValue(':task_id', $taskId, PDO::PARAM_INT);
        bindOrganizationId($updatesCountStatement, $organizationId);
        $updatesCountStatement->execute();
        $hasUpdates = (int) $updatesCountStatement->fetchColumn() > 0;

        $assignedToUserId = trim((string) ($payload['assigned_to_user_id'] ?? '')) !== ''
            ? (int) $payload['assigned_to_user_id']
            : null;
        $categoryId = trim((string) ($payload['category_id'] ?? '')) !== ''
            ? (int) $payload['category_id']
            : null;
        $subCategoryId = trim((string) ($payload['sub_category_id'] ?? '')) !== ''
            ? (int) $payload['sub_category_id']
            : null;
        $taskStatus = deriveTaskStatusFromAssignment($assignedToUserId, $hasUpdates, (string) $existingTask['task_status']);

        $statement = $pdo->prepare(
            'UPDATE tasks
             SET task_date = :task_date,
                 description = :description,
                 due_date = :due_date,
                 client_name = :client_name,
                 priority = :priority,
                 assigned_to_user_id = :assigned_to_user_id,
                 category_id = :category_id,
                 sub_category_id = :sub_category_id,
                 notes = :notes,
                 task_status = :task_status
             WHERE id = :id
               AND organization_id = :organization_id'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':task_date', $payload['task_date']);
        $statement->bindValue(':description', trim((string) ($payload['description'] ?? '')) !== '' ? $payload['description'] : null);
        $statement->bindValue(':due_date', trim((string) ($payload['due_date'] ?? '')) !== '' ? $payload['due_date'] : null);
        $statement->bindValue(':client_name', $payload['client_name']);
        $statement->bindValue(':priority', trim((string) ($payload['priority'] ?? '')) !== '' ? $payload['priority'] : 'Medium');
        $statement->bindValue(':assigned_to_user_id', $assignedToUserId, $assignedToUserId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':category_id', $categoryId, $categoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':sub_category_id', $subCategoryId, $subCategoryId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $statement->bindValue(':notes', trim((string) ($payload['notes'] ?? '')) !== '' ? $payload['notes'] : null);
        $statement->bindValue(':task_status', $taskStatus);
        $statement->bindValue(':id', $taskId, PDO::PARAM_INT);
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'message' => 'Task updated successfully.'
        ]);
        exit;
    }

    if (preg_match('#^/api/leads/(\d+)$#', $path, $matches) === 1 && $method === 'DELETE') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $leadId = (int) $matches[1];

        $pdo->beginTransaction();
        try {
            // Delete related updates first
            $deleteUpdates = $pdo->prepare('DELETE FROM lead_updates WHERE lead_id = :id AND organization_id = :organization_id');
            $deleteUpdates->bindValue(':id', $leadId, PDO::PARAM_INT);
            bindOrganizationId($deleteUpdates, $organizationId);
            $deleteUpdates->execute();

            // Delete the lead
            $deleteLead = $pdo->prepare('DELETE FROM leads WHERE id = :id AND organization_id = :organization_id');
            $deleteLead->bindValue(':id', $leadId, PDO::PARAM_INT);
            bindOrganizationId($deleteLead, $organizationId);
            $deleteLead->execute();

            if ($deleteLead->rowCount() === 0) {
                $pdo->rollBack();
                Response::json([
                    'status' => 'error',
                    'message' => 'Lead not found.'
                ], 404);
                exit;
            }

            $pdo->commit();
            Response::json([
                'status' => 'ok',
                'message' => 'Lead deleted successfully.'
            ]);
            exit;
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }
    }

    if (preg_match('#^/api/tasks/(\d+)$#', $path, $matches) === 1 && $method === 'DELETE') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $taskId = (int) $matches[1];

        $pdo->beginTransaction();
        try {
            $deleteUpdates = $pdo->prepare('DELETE FROM task_updates WHERE task_id = :id AND organization_id = :organization_id');
            $deleteUpdates->bindValue(':id', $taskId, PDO::PARAM_INT);
            bindOrganizationId($deleteUpdates, $organizationId);
            $deleteUpdates->execute();

            $deleteTask = $pdo->prepare('DELETE FROM tasks WHERE id = :id AND organization_id = :organization_id');
            $deleteTask->bindValue(':id', $taskId, PDO::PARAM_INT);
            bindOrganizationId($deleteTask, $organizationId);
            $deleteTask->execute();

            if ($deleteTask->rowCount() === 0) {
                $pdo->rollBack();
                Response::json([
                    'status' => 'error',
                    'message' => 'Task not found.'
                ], 404);
                exit;
            }

            $pdo->commit();
            Response::json([
                'status' => 'ok',
                'message' => 'Task deleted successfully.'
            ]);
            exit;
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }
    }

    if (preg_match('#^/api/leads/(\d+)/updates$#', $path, $matches) === 1 && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $leadId = (int) $matches[1];
        $statement = $pdo->prepare(
            'SELECT lu.id, lu.status, lu.update_date, lu.next_follow_up_date, lu.remarks, lu.created_at, uu.full_name AS update_by_name
             FROM lead_updates lu
             LEFT JOIN users uu ON uu.id = lu.update_by_user_id
             WHERE lu.lead_id = :lead_id
               AND lu.organization_id = :organization_id
             ORDER BY lu.update_date DESC, lu.id DESC'
        );
        $statement->bindValue(':lead_id', $leadId, PDO::PARAM_INT);
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll()
        ]);
        exit;
    }

    if (preg_match('#^/api/tasks/(\d+)/updates$#', $path, $matches) === 1 && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $taskId = (int) $matches[1];
        $statement = $pdo->prepare(
            'SELECT tu.id, tu.status, tu.update_date, tu.next_follow_up_date, tu.remarks, tu.created_at, uu.full_name AS update_by_name
             FROM task_updates tu
             LEFT JOIN users uu ON uu.id = tu.update_by_user_id
             WHERE tu.task_id = :task_id
               AND tu.organization_id = :organization_id
             ORDER BY tu.update_date DESC, tu.id DESC'
        );
        $statement->bindValue(':task_id', $taskId, PDO::PARAM_INT);
        bindOrganizationId($statement, $organizationId);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll()
        ]);
        exit;
    }

    if (preg_match('#^/api/leads/(\d+)/updates$#', $path, $matches) === 1 && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $leadId = (int) $matches[1];
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        $leadStatement = $pdo->prepare(
            'SELECT id, lead_status, assigned_to_user_id
             FROM leads
             WHERE id = :id
               AND organization_id = :organization_id
             LIMIT 1'
        );
        $leadStatement->bindValue(':id', $leadId, PDO::PARAM_INT);
        bindOrganizationId($leadStatement, $organizationId);
        $leadStatement->execute();
        $lead = $leadStatement->fetch();

        if (!$lead) {
            Response::json([
                'status' => 'error',
                'message' => 'Lead not found.'
            ], 404);
            exit;
        }

        if (isFinalLeadStatus((string) $lead['lead_status'])) {
            Response::json([
                'status' => 'error',
                'message' => 'This lead is already closed and cannot be updated.'
            ], 409);
            exit;
        }

        $updateStatus = normalizeLeadUpdateStatus((string) ($payload['status'] ?? ''));
        $updateDate = trim((string) ($payload['update_date'] ?? ''));
        $updateByUserId = isset($payload['update_by_user_id']) && $payload['update_by_user_id'] !== ''
            ? (int) $payload['update_by_user_id']
            : 0;
        $nextFollowUpDate = trim((string) ($payload['next_follow_up_date'] ?? ''));

        if ($updateStatus === '') {
            Response::json([
                'status' => 'error',
                'message' => 'Field "status" is required.'
            ], 422);
            exit;
        }

        if ($updateDate === '') {
            Response::json([
                'status' => 'error',
                'message' => 'Field "update_date" is required.'
            ], 422);
            exit;
        }

        if ($updateByUserId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Field "update_by_user_id" is required.'
            ], 422);
            exit;
        }

        $leadStatus = deriveLeadStatusFromUpdate($updateStatus, $nextFollowUpDate !== '' ? $nextFollowUpDate : null);

        $pdo->beginTransaction();

        try {
            $insertUpdate = $pdo->prepare(
                'INSERT INTO lead_updates (
                    organization_id,
                    lead_id,
                    status,
                    update_date,
                    update_by_user_id,
                    next_follow_up_date,
                    remarks
                 ) VALUES (
                    :organization_id,
                    :lead_id,
                    :status,
                    :update_date,
                    :update_by_user_id,
                    :next_follow_up_date,
                    :remarks
                 )'
            );
            bindOrganizationId($insertUpdate, $organizationId);
            $insertUpdate->bindValue(':lead_id', $leadId, PDO::PARAM_INT);
            $insertUpdate->bindValue(':status', $updateStatus);
            $insertUpdate->bindValue(':update_date', $updateDate);
            $insertUpdate->bindValue(':update_by_user_id', $updateByUserId, PDO::PARAM_INT);
            $insertUpdate->bindValue(':next_follow_up_date', $nextFollowUpDate !== '' ? $nextFollowUpDate : null);
            $insertUpdate->bindValue(':remarks', trim((string) ($payload['remarks'] ?? '')) !== '' ? $payload['remarks'] : null);
            $insertUpdate->execute();

            $updateLead = $pdo->prepare(
                'UPDATE leads
                 SET lead_status = :lead_status,
                     latest_update_date = :latest_update_date,
                     next_follow_up_date = :next_follow_up_date
                 WHERE id = :id
                   AND organization_id = :organization_id'
            );
            $updateLead->bindValue(':lead_status', $leadStatus);
            $updateLead->bindValue(':latest_update_date', $updateDate);
            $updateLead->bindValue(
                ':next_follow_up_date',
                $leadStatus === 'Pending Repeat Follow Up' ? $nextFollowUpDate : null
            );
            $updateLead->bindValue(':id', $leadId, PDO::PARAM_INT);
            bindOrganizationId($updateLead, $organizationId);
            $updateLead->execute();

            $pdo->commit();
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }

        Response::json([
            'status' => 'ok',
            'message' => 'Lead update saved successfully.'
        ], 201);
        exit;
    }

    if ($path === '/api/policies' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
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
             WHERE p.organization_id = :organization_id
             ORDER BY p.id DESC
             LIMIT :limit'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll(),
            'meta' => ['limit' => $limit]
        ]);
        exit;
    }
    if (in_array($path, [
        '/api/reports/policies-added',
        '/api/reports/policies-this-week',
        '/api/reports/policies-this-month',
    ], true) && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;

        $dateCondition = match ($path) {
            '/api/reports/policies-added' => 'date(p.created_at) = curdate()',
            '/api/reports/policies-this-week' => 'yearweek(p.created_at, 1) = yearweek(curdate(), 1)',
            '/api/reports/policies-this-month' => 'year(p.created_at) = year(curdate()) and month(p.created_at) = month(curdate())',
        };

        $statement = $pdo->prepare(
            "SELECT
                p.id,
                p.policy_number,
                p.policy_type,
                p.business_type,
                p.gross_premium,
                p.net_premium,
                p.issue_date,
                c.full_name AS customer_name,
                cg.group_name AS customer_group_name,
                ic.company_name,
                ip.product_name
             FROM policies p
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             LEFT JOIN insurance_products ip ON ip.id = p.product_id
             WHERE p.organization_id = :organization_id
               AND $dateCondition
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT :limit"
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll(),
            'meta' => ['limit' => $limit]
        ]);
        exit;
    }
    if ($path === '/api/reports/payments-received' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;

        $statement = $pdo->prepare(
            'SELECT
                cp.id,
                cp.payment_date,
                cp.amount,
                cp.payment_mode,
                cp.payment_status,
                cp.reference_number,
                cp.remarks,
                p.policy_number,
                c.full_name AS customer_name,
                ic.company_name
             FROM client_payments cp
             INNER JOIN policies p ON p.id = cp.policy_id
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             WHERE cp.organization_id = :organization_id
             ORDER BY cp.payment_date DESC, cp.id DESC
             LIMIT :limit'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll(),
            'meta' => ['limit' => $limit]
        ]);
        exit;
    }
    if ($path === '/api/reports/expiry-counts' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();

        $monthlyStatement = $pdo->prepare(
            'SELECT month(risk_end_date) AS bucket, count(*) AS total
             FROM policies
             WHERE organization_id = :organization_id
               AND risk_end_date IS NOT NULL
             GROUP BY month(risk_end_date)'
        );
        bindOrganizationId($monthlyStatement, $organizationId);
        $monthlyStatement->execute();
        $monthlyRaw = $monthlyStatement->fetchAll();
        $monthly = [];
        foreach ($monthlyRaw as $row) {
            $monthly[(string) $row['bucket']] = (int) $row['total'];
        }

        $scopedCount = static function (string $sql) use ($pdo, $organizationId): int {
            return scopedCountOrZero($pdo, $sql, $organizationId);
        };

        $daily = [
            'today' => $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND date(risk_end_date) = curdate()'),
            'tomorrow' => $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND date(risk_end_date) = date_add(curdate(), interval 1 day)'),
            'day-after-tomorrow' => $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND date(risk_end_date) = date_add(curdate(), interval 2 day)'),
        ];

        $weekly = [
            '7-days' => $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND risk_end_date >= curdate() AND risk_end_date <= date_add(curdate(), interval 7 day)'),
        ];

        $yearly = [
            'current' => $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND coalesce(fiscal_year_ending, year(curdate())) = year(curdate())'),
            'future' => $scopedCount('SELECT count(*) FROM policies WHERE organization_id = :organization_id AND risk_end_date IS NOT NULL AND coalesce(fiscal_year_ending, year(curdate())) > year(curdate())'),
        ];

        Response::json([
            'status' => 'ok',
            'data' => [
                'monthly' => $monthly,
                'daily' => $daily,
                'weekly' => $weekly,
                'yearly' => $yearly,
            ]
        ]);
        exit;
    }
    if ($path === '/api/reports/expiring-policies' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;
        $mode = trim((string) ($_GET['mode'] ?? ''));
        $value = trim((string) ($_GET['value'] ?? ''));

        $whereClause = 'p.organization_id = :organization_id AND p.risk_end_date IS NOT NULL';
        $bindings = [];

        if ($mode === 'month') {
            $month = (int) $value;
            if ($month < 1 || $month > 12) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid month report value.'
                ], 422);
                exit;
            }

            $whereClause .= ' AND month(p.risk_end_date) = :month_value';
            $bindings[':month_value'] = [$month, PDO::PARAM_INT];
        } elseif ($mode === 'day') {
            $offsetMap = [
                'today' => 0,
                'tomorrow' => 1,
                'day-after-tomorrow' => 2,
            ];

            if (!array_key_exists($value, $offsetMap)) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid day report value.'
                ], 422);
                exit;
            }

            $whereClause .= ' AND date(p.risk_end_date) = date_add(curdate(), interval :day_offset day)';
            $bindings[':day_offset'] = [$offsetMap[$value], PDO::PARAM_INT];
        } elseif ($mode === 'week') {
            $whereClause .= ' AND p.risk_end_date >= curdate() AND p.risk_end_date <= date_add(curdate(), interval 7 day)';
        } elseif ($mode === 'year') {
            if ($value === 'current') {
                $whereClause .= ' AND coalesce(p.fiscal_year_ending, year(curdate())) = year(curdate())';
            } elseif ($value === 'future') {
                $whereClause .= ' AND coalesce(p.fiscal_year_ending, year(curdate())) > year(curdate())';
            } else {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid yearly report value.'
                ], 422);
                exit;
            }
        } else {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid expiry report mode.'
            ], 422);
            exit;
        }

        $statement = $pdo->prepare(
            "SELECT
                p.id,
                p.policy_number,
                p.policy_type,
                p.business_type,
                p.net_premium,
                p.risk_end_date,
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
             WHERE $whereClause
             ORDER BY p.risk_end_date ASC, p.policy_number ASC
             LIMIT :limit"
        );

        bindOrganizationId($statement, $organizationId);
        foreach ($bindings as $bindingName => [$bindingValue, $bindingType]) {
            $statement->bindValue($bindingName, $bindingValue, $bindingType);
        }
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
        $organizationId = requireOrganizationId();

        $scopedCount = static function (string $sql) use ($pdo, $organizationId): int {
            return scopedCountOrZero($pdo, $sql, $organizationId);
        };

        $renewalsNext7Days = $scopedCount(
            'SELECT count(*)
             FROM policies p
             WHERE p.organization_id = :organization_id
               AND p.risk_end_date IS NOT NULL
               AND p.risk_end_date >= curdate()
               AND p.risk_end_date <= date_add(curdate(), interval 7 day)
               AND coalesce(p.renewal_status, "") <> "Renewed"'
        );

        $pendingDocumentUploads = $scopedCount(
            'SELECT count(*)
             FROM (
                SELECT p.id
                FROM policies p
                LEFT JOIN documents d
                  ON d.policy_id = p.id
                 AND d.deleted_at IS NULL
                 AND d.is_active = 1
                WHERE p.organization_id = :organization_id
                GROUP BY p.id
                HAVING count(d.id) = 0
             ) pending_documents'
        );

        $renewalsOverdue = $scopedCount(
            'SELECT count(*)
             FROM policies p
             WHERE p.organization_id = :organization_id
               AND p.risk_end_date IS NOT NULL
               AND p.risk_end_date < curdate()
               AND coalesce(p.renewal_status, "") <> "Renewed"'
        );

        $pendingClientCollections = $scopedCount(
            'SELECT count(*)
             FROM policies p
             WHERE p.organization_id = :organization_id
               AND p.paid_by_type = "Agent"
               AND coalesce(p.payment_pending_amount, 0) > 0'
        );

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
        $organizationId = requireOrganizationId();
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
             WHERE p.organization_id = :organization_id
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
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        Response::json([
            'status' => 'ok',
            'data' => $statement->fetchAll(),
            'meta' => ['limit' => $limit]
        ]);
        exit;
    }
    if (($path === '/api/policies/upload-document' || $path === '/api/policies/upload-documents') && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();

        $policyId = isset($_POST['policy_id']) ? (int) $_POST['policy_id'] : 0;

        if ($policyId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Policy is required.'
            ], 422);
            exit;
        }

        $policyStatement = $pdo->prepare('SELECT id, customer_id FROM policies WHERE id = :id AND organization_id = :organization_id');
        $policyStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
        bindOrganizationId($policyStatement, $organizationId);
        $policyStatement->execute();
        $policy = $policyStatement->fetch();

        if (!$policy) {
            Response::json([
                'status' => 'error',
                'message' => 'Policy not found.'
            ], 404);
            exit;
        }

        $documentsPayload = [];

        if (isset($_POST['documents'])) {
            $decodedDocuments = json_decode((string) $_POST['documents'], true);
            if (!is_array($decodedDocuments)) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid documents JSON payload.'
                ], 422);
                exit;
            }

            $documentsPayload = $decodedDocuments;
        } else {
            $documentsPayload = [[
                'document_type_id' => isset($_POST['document_type_id']) ? (int) $_POST['document_type_id'] : 0,
                'document_number' => trim((string) ($_POST['document_number'] ?? '')),
                'document_date' => trim((string) ($_POST['document_date'] ?? '')),
                'expiry_date' => trim((string) ($_POST['expiry_date'] ?? '')),
                'remarks' => trim((string) ($_POST['remarks'] ?? ''))
            ]];
        }

        if ($documentsPayload === []) {
            Response::json([
                'status' => 'error',
                'message' => 'At least one document is required.'
            ], 422);
            exit;
        }

        $uploadedFiles = [];

        if (isset($_FILES['files']) && is_array($_FILES['files']['name'] ?? null)) {
            $fileCount = count($_FILES['files']['name']);
            for ($index = 0; $index < $fileCount; $index += 1) {
                $uploadedFiles[] = [
                    'name' => (string) ($_FILES['files']['name'][$index] ?? ''),
                    'tmp_name' => (string) ($_FILES['files']['tmp_name'][$index] ?? ''),
                    'error' => (int) ($_FILES['files']['error'][$index] ?? UPLOAD_ERR_NO_FILE)
                ];
            }
        } elseif (isset($_FILES['file']) && is_array($_FILES['file'])) {
            $uploadedFiles[] = [
                'name' => (string) ($_FILES['file']['name'] ?? ''),
                'tmp_name' => (string) ($_FILES['file']['tmp_name'] ?? ''),
                'error' => (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE)
            ];
        }

        if (count($uploadedFiles) !== count($documentsPayload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Each document entry must include one uploaded file.'
            ], 422);
            exit;
        }

        $documentTypesStatement = $pdo->prepare("SELECT id, entity_level FROM document_types WHERE organization_id = :organization_id AND is_active = 1");
        bindOrganizationId($documentTypesStatement, $organizationId);
        $documentTypesStatement->execute();
        $documentTypes = [];
        foreach ($documentTypesStatement->fetchAll() as $documentType) {
            $documentTypes[(int) $documentType['id']] = $documentType;
        }

        $uploadDir = __DIR__ . '/uploads';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            Response::json([
                'status' => 'error',
                'message' => 'Unable to prepare upload directory.'
            ], 500);
            exit;
        }

        $statement = $pdo->prepare(
            'INSERT INTO documents (
                organization_id,
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
                :organization_id,
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

        $savedPaths = [];
        $pdo->beginTransaction();

        try {
            foreach ($documentsPayload as $index => $documentPayload) {
                $documentTypeId = (int) ($documentPayload['document_type_id'] ?? 0);
                if ($documentTypeId <= 0) {
                    throw new RuntimeException('Document type is required for each document.');
                }

                $documentType = $documentTypes[$documentTypeId] ?? null;
                if (!$documentType) {
                    throw new RuntimeException('Document type not found.');
                }

                if (strtolower((string) ($documentType['entity_level'] ?? '')) !== 'policy') {
                    throw new RuntimeException('Selected document type is not valid for policy upload.');
                }

                $uploadedFile = $uploadedFiles[$index] ?? null;
                if (!$uploadedFile || (int) $uploadedFile['error'] !== UPLOAD_ERR_OK) {
                    throw new RuntimeException('A file upload is required for each document.');
                }

                $originalName = (string) $uploadedFile['name'];
                $tmpName = (string) $uploadedFile['tmp_name'];
                $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                $storedName = uniqid('doc_', true) . ($extension !== '' ? '.' . $extension : '');
                $targetPath = $uploadDir . '/' . $storedName;

                if (!move_uploaded_file($tmpName, $targetPath)) {
                    throw new RuntimeException('Failed to save uploaded file.');
                }
                $savedPaths[] = $targetPath;

                $mimeType = mime_content_type($targetPath) ?: null;
                $fileSize = filesize($targetPath) ?: null;
                $documentNumber = trim((string) ($documentPayload['document_number'] ?? ''));
                $documentDate = trim((string) ($documentPayload['document_date'] ?? ''));
                $expiryDate = trim((string) ($documentPayload['expiry_date'] ?? ''));
                $remarks = trim((string) ($documentPayload['remarks'] ?? ''));

                bindOrganizationId($statement, $organizationId);
                $statement->bindValue(':document_type_id', $documentTypeId, PDO::PARAM_INT);
                $statement->bindValue(':customer_id', (int) $policy['customer_id'], PDO::PARAM_INT);
                bindOrganizationId($statement, $organizationId);
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
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            foreach ($savedPaths as $savedPath) {
                if (is_string($savedPath) && $savedPath !== '' && is_file($savedPath)) {
                    @unlink($savedPath);
                }
            }

            Response::json([
                'status' => 'error',
                'message' => $exception->getMessage() !== '' ? $exception->getMessage() : 'Failed to upload policy documents.'
            ], 422);
            exit;
        }

        Response::json([
            'status' => 'ok',
            'message' => count($documentsPayload) === 1
                ? 'Document uploaded successfully.'
                : 'Documents uploaded successfully.'
        ], 201);
        exit;
    }

    if (($path === '/api/customers/upload-document' || $path === '/api/customers/upload-documents') && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();

        $customerId = isset($_POST['customer_id']) ? (int) $_POST['customer_id'] : 0;

        if ($customerId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Customer is required.'
            ], 422);
            exit;
        }

        $customerStatement = $pdo->prepare('SELECT id FROM customers WHERE id = :id AND organization_id = :organization_id');
        $customerStatement->bindValue(':id', $customerId, PDO::PARAM_INT);
        bindOrganizationId($customerStatement, $organizationId);
        $customerStatement->execute();

        if (!$customerStatement->fetchColumn()) {
            Response::json([
                'status' => 'error',
                'message' => 'Customer not found.'
            ], 404);
            exit;
        }

        $documentsPayload = [];

        if (isset($_POST['documents'])) {
            $decodedDocuments = json_decode((string) $_POST['documents'], true);
            if (!is_array($decodedDocuments)) {
                Response::json([
                    'status' => 'error',
                    'message' => 'Invalid documents JSON payload.'
                ], 422);
                exit;
            }

            $documentsPayload = $decodedDocuments;
        } else {
            $documentsPayload = [[
                'document_type_id' => isset($_POST['document_type_id']) ? (int) $_POST['document_type_id'] : 0,
                'document_number' => trim((string) ($_POST['document_number'] ?? '')),
                'document_date' => trim((string) ($_POST['document_date'] ?? '')),
                'expiry_date' => trim((string) ($_POST['expiry_date'] ?? '')),
                'remarks' => trim((string) ($_POST['remarks'] ?? ''))
            ]];
        }

        if ($documentsPayload === []) {
            Response::json([
                'status' => 'error',
                'message' => 'At least one document is required.'
            ], 422);
            exit;
        }

        $uploadedFiles = [];

        if (isset($_FILES['files']) && is_array($_FILES['files']['name'] ?? null)) {
            $fileCount = count($_FILES['files']['name']);
            for ($index = 0; $index < $fileCount; $index += 1) {
                $uploadedFiles[] = [
                    'name' => (string) ($_FILES['files']['name'][$index] ?? ''),
                    'tmp_name' => (string) ($_FILES['files']['tmp_name'][$index] ?? ''),
                    'error' => (int) ($_FILES['files']['error'][$index] ?? UPLOAD_ERR_NO_FILE)
                ];
            }
        } elseif (isset($_FILES['file']) && is_array($_FILES['file'])) {
            $uploadedFiles[] = [
                'name' => (string) ($_FILES['file']['name'] ?? ''),
                'tmp_name' => (string) ($_FILES['file']['tmp_name'] ?? ''),
                'error' => (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE)
            ];
        }

        if (count($uploadedFiles) !== count($documentsPayload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Each document entry must include one uploaded file.'
            ], 422);
            exit;
        }

        $documentTypesStatement = $pdo->prepare("SELECT id, entity_level FROM document_types WHERE organization_id = :organization_id AND is_active = 1");
        bindOrganizationId($documentTypesStatement, $organizationId);
        $documentTypesStatement->execute();
        $documentTypes = [];
        foreach ($documentTypesStatement->fetchAll() as $documentType) {
            $documentTypes[(int) $documentType['id']] = $documentType;
        }

        $uploadDir = __DIR__ . '/uploads';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            Response::json([
                'status' => 'error',
                'message' => 'Unable to prepare upload directory.'
            ], 500);
            exit;
        }

        $statement = $pdo->prepare(
            'INSERT INTO documents (
                organization_id,
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
                :organization_id,
                :document_type_id,
                :customer_id,
                NULL,
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

        $savedPaths = [];
        $pdo->beginTransaction();

        try {
            foreach ($documentsPayload as $index => $documentPayload) {
                $documentTypeId = (int) ($documentPayload['document_type_id'] ?? 0);
                if ($documentTypeId <= 0) {
                    throw new RuntimeException('Document type is required for each document.');
                }

                $documentType = $documentTypes[$documentTypeId] ?? null;
                if (!$documentType) {
                    throw new RuntimeException('Document type not found.');
                }

                if (strtolower((string) ($documentType['entity_level'] ?? '')) !== 'customer') {
                    throw new RuntimeException('Selected document type is not valid for customer upload.');
                }

                $uploadedFile = $uploadedFiles[$index] ?? null;
                if (!$uploadedFile || (int) $uploadedFile['error'] !== UPLOAD_ERR_OK) {
                    throw new RuntimeException('A file upload is required for each document.');
                }

                $originalName = (string) $uploadedFile['name'];
                $tmpName = (string) $uploadedFile['tmp_name'];
                $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                $storedName = uniqid('doc_', true) . ($extension !== '' ? '.' . $extension : '');
                $targetPath = $uploadDir . '/' . $storedName;

                if (!move_uploaded_file($tmpName, $targetPath)) {
                    throw new RuntimeException('Failed to save uploaded file.');
                }
                $savedPaths[] = $targetPath;

                $mimeType = mime_content_type($targetPath) ?: null;
                $fileSize = filesize($targetPath) ?: null;
                $documentNumber = trim((string) ($documentPayload['document_number'] ?? ''));
                $documentDate = trim((string) ($documentPayload['document_date'] ?? ''));
                $expiryDate = trim((string) ($documentPayload['expiry_date'] ?? ''));
                $remarks = trim((string) ($documentPayload['remarks'] ?? ''));

                bindOrganizationId($statement, $organizationId);
                $statement->bindValue(':document_type_id', $documentTypeId, PDO::PARAM_INT);
                $statement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
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
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            foreach ($savedPaths as $savedPath) {
                if (is_string($savedPath) && $savedPath !== '' && is_file($savedPath)) {
                    @unlink($savedPath);
                }
            }

            Response::json([
                'status' => 'error',
                'message' => $exception->getMessage() !== '' ? $exception->getMessage() : 'Failed to upload customer documents.'
            ], 422);
            exit;
        }

        Response::json([
            'status' => 'ok',
            'message' => count($documentsPayload) === 1
                ? 'Customer document uploaded successfully.'
                : 'Customer documents uploaded successfully.'
        ], 201);
        exit;
    }

    if ($path === '/api/payments/pending-client' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
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
                fu.follow_up_at,
                fu.follow_up_mode,
                fu.next_follow_up_at,
                fu.outcome_status AS follow_up_status,
                fu.response_summary AS follow_up_remarks,
                u.full_name AS follow_up_by_name,
                c.full_name AS customer_name,
                ic.company_name
             FROM policies p
             LEFT JOIN (
                SELECT fu1.*
                FROM follow_ups fu1
                INNER JOIN (
                    SELECT policy_id, MAX(id) AS latest_id
                    FROM follow_ups
                    WHERE organization_id = :follow_up_organization_id
                    GROUP BY policy_id
                ) latest_follow_up ON latest_follow_up.latest_id = fu1.id
             ) fu ON fu.policy_id = p.id
             LEFT JOIN users u ON u.linked_agent_id = fu.done_by_agent_id
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             WHERE p.organization_id = :organization_id
               AND p.paid_by_type = "Agent"
               AND coalesce(p.payment_pending_amount, 0) > 0
             ORDER BY p.updated_at DESC, p.id DESC
             LIMIT :limit'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->bindValue(':follow_up_organization_id', $organizationId, PDO::PARAM_INT);
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
        $organizationId = requireOrganizationId();
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
             WHERE id = :id
               AND organization_id = :organization_id'
        );
        $policyStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
        bindOrganizationId($policyStatement, $organizationId);
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
                    organization_id,
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
                    :organization_id,
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
            bindOrganizationId($insertStatement, $organizationId);
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
                 WHERE id = :id
                   AND organization_id = :organization_id'
            );
            $updateStatement->bindValue(':payment_received_amount', $newReceived);
            $updateStatement->bindValue(':payment_pending_amount', $newPending);
            $updateStatement->bindValue(':client_payment_status', $clientPaymentStatus);
            $updateStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
            bindOrganizationId($updateStatement, $organizationId);
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

    if (preg_match('#^/api/tasks/(\d+)/updates$#', $path, $matches) === 1 && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $taskId = (int) $matches[1];
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        $taskStatement = $pdo->prepare(
            'SELECT id, task_status, assigned_to_user_id
             FROM tasks
             WHERE id = :id
               AND organization_id = :organization_id
             LIMIT 1'
        );
        $taskStatement->bindValue(':id', $taskId, PDO::PARAM_INT);
        bindOrganizationId($taskStatement, $organizationId);
        $taskStatement->execute();
        $task = $taskStatement->fetch();

        if (!$task) {
            Response::json([
                'status' => 'error',
                'message' => 'Task not found.'
            ], 404);
            exit;
        }

        if (isFinalTaskStatus((string) $task['task_status'])) {
            Response::json([
                'status' => 'error',
                'message' => 'This task is already closed and cannot be updated.'
            ], 409);
            exit;
        }

        $updateStatus = normalizeTaskUpdateStatus((string) ($payload['status'] ?? ''));
        $updateDate = trim((string) ($payload['update_date'] ?? ''));
        $updateByUserId = isset($payload['update_by_user_id']) && $payload['update_by_user_id'] !== ''
            ? (int) $payload['update_by_user_id']
            : 0;
        $nextFollowUpDate = trim((string) ($payload['next_follow_up_date'] ?? ''));

        if ($updateStatus === '') {
            Response::json([
                'status' => 'error',
                'message' => 'Field "status" is required.'
            ], 422);
            exit;
        }

        if ($updateDate === '') {
            Response::json([
                'status' => 'error',
                'message' => 'Field "update_date" is required.'
            ], 422);
            exit;
        }

        if ($updateByUserId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Field "update_by_user_id" is required.'
            ], 422);
            exit;
        }

        $taskStatus = deriveTaskStatusFromUpdate($updateStatus, $nextFollowUpDate !== '' ? $nextFollowUpDate : null);

        $pdo->beginTransaction();

        try {
            $insertUpdate = $pdo->prepare(
                'INSERT INTO task_updates (
                    organization_id,
                    task_id,
                    status,
                    update_date,
                    update_by_user_id,
                    next_follow_up_date,
                    remarks
                 ) VALUES (
                    :organization_id,
                    :task_id,
                    :status,
                    :update_date,
                    :update_by_user_id,
                    :next_follow_up_date,
                    :remarks
                 )'
            );
            bindOrganizationId($insertUpdate, $organizationId);
            $insertUpdate->bindValue(':task_id', $taskId, PDO::PARAM_INT);
            $insertUpdate->bindValue(':status', $updateStatus);
            $insertUpdate->bindValue(':update_date', $updateDate);
            $insertUpdate->bindValue(':update_by_user_id', $updateByUserId, PDO::PARAM_INT);
            $insertUpdate->bindValue(':next_follow_up_date', $nextFollowUpDate !== '' ? $nextFollowUpDate : null);
            $insertUpdate->bindValue(':remarks', trim((string) ($payload['remarks'] ?? '')) !== '' ? $payload['remarks'] : null);
            $insertUpdate->execute();

            $updateTask = $pdo->prepare(
                'UPDATE tasks
                 SET task_status = :task_status,
                     latest_update_date = :latest_update_date,
                     next_follow_up_date = :next_follow_up_date
                 WHERE id = :id
                   AND organization_id = :organization_id'
            );
            $updateTask->bindValue(':task_status', $taskStatus);
            $updateTask->bindValue(':latest_update_date', $updateDate);
            $updateTask->bindValue(
                ':next_follow_up_date',
                $taskStatus === 'Pending' ? ($nextFollowUpDate !== '' ? $nextFollowUpDate : null) : null
            );
            $updateTask->bindValue(':id', $taskId, PDO::PARAM_INT);
            bindOrganizationId($updateTask, $organizationId);
            $updateTask->execute();

            $pdo->commit();
            Response::json([
                'status' => 'ok',
                'message' => 'Task update saved successfully.'
            ], 201);
            exit;
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }
    }

    if ($path === '/api/follow-ups' && $method === 'POST') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();
        $payload = json_decode(file_get_contents('php://input') ?: '[]', true);

        if (!is_array($payload)) {
            Response::json([
                'status' => 'error',
                'message' => 'Invalid JSON payload'
            ], 422);
            exit;
        }

        foreach (['policy_id', 'follow_up_type', 'follow_up_date', 'follow_up_by', 'follow_up_remarks', 'follow_up_mode', 'status'] as $requiredField) {
            if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                Response::json([
                    'status' => 'error',
                    'message' => sprintf('Field "%s" is required.', $requiredField)
                ], 422);
                exit;
            }
        }

        if (($payload['payment_mode'] ?? '') === 'Cheque') {
            foreach (['cheque_number', 'cheque_date'] as $requiredField) {
                if (!array_key_exists($requiredField, $payload) || trim((string) $payload[$requiredField]) === '') {
                    Response::json([
                        'status' => 'error',
                        'message' => sprintf('Field "%s" is required when Payment Mode is Cheque.', $requiredField)
                    ], 422);
                    exit;
                }
            }
        }

        $policyId = (int) $payload['policy_id'];
        $followUpByUserId = (int) $payload['follow_up_by'];

        $policyStatement = $pdo->prepare('SELECT id FROM policies WHERE id = :id AND organization_id = :organization_id LIMIT 1');
        $policyStatement->bindValue(':id', $policyId, PDO::PARAM_INT);
        bindOrganizationId($policyStatement, $organizationId);
        $policyStatement->execute();

        if (!$policyStatement->fetch()) {
            Response::json([
                'status' => 'error',
                'message' => 'Policy not found.'
            ], 404);
            exit;
        }

        $userStatement = $pdo->prepare(
            'SELECT id, full_name, linked_agent_id
             FROM users
             WHERE id = :id
               AND organization_id = :organization_id
             LIMIT 1'
        );
        $userStatement->bindValue(':id', $followUpByUserId, PDO::PARAM_INT);
        bindOrganizationId($userStatement, $organizationId);
        $userStatement->execute();
        $user = $userStatement->fetch();

        if (!$user) {
            Response::json([
                'status' => 'error',
                'message' => 'Selected follow up user not found.'
            ], 404);
            exit;
        }

        $doneByAgentId = isset($user['linked_agent_id']) ? (int) $user['linked_agent_id'] : 0;
        if ($doneByAgentId <= 0) {
            Response::json([
                'status' => 'error',
                'message' => 'Selected user is not linked to an agent. Link the user with an agent first to save this follow up.'
            ], 422);
            exit;
        }

        $followUpAt = sprintf('%s 00:00:00', $payload['follow_up_date']);
        $nextFollowUpAt = trim((string) ($payload['next_follow_up_date'] ?? '')) !== ''
            ? sprintf('%s 00:00:00', $payload['next_follow_up_date'])
            : null;
        $remarks = trim((string) $payload['follow_up_remarks']);
        $status = trim((string) $payload['status']);

        $pdo->beginTransaction();

        try {
            $statement = $pdo->prepare(
                'INSERT INTO follow_ups (
                    organization_id,
                    policy_id,
                    follow_up_type,
                    follow_up_mode,
                    follow_up_at,
                    response_summary,
                    next_follow_up_at,
                    done_by_agent_id,
                    outcome_status
                 ) VALUES (
                    :organization_id,
                    :policy_id,
                    :follow_up_type,
                    :follow_up_mode,
                    :follow_up_at,
                    :response_summary,
                    :next_follow_up_at,
                    :done_by_agent_id,
                    :outcome_status
                 )'
            );
            bindOrganizationId($statement, $organizationId);
            $statement->bindValue(':policy_id', $policyId, PDO::PARAM_INT);
            $statement->bindValue(':follow_up_type', trim((string) $payload['follow_up_type']));
            $statement->bindValue(':follow_up_mode', trim((string) $payload['follow_up_mode']));
            $statement->bindValue(':follow_up_at', $followUpAt);
            $statement->bindValue(':response_summary', $remarks !== '' ? $remarks : null);
            $statement->bindValue(':next_follow_up_at', $nextFollowUpAt, $nextFollowUpAt === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $statement->bindValue(':done_by_agent_id', $doneByAgentId, PDO::PARAM_INT);
            $statement->bindValue(':outcome_status', $status);
            $statement->execute();

            $updatePolicy = $pdo->prepare(
                'UPDATE policies
                 SET last_follow_up_at = :last_follow_up_at,
                     next_follow_up_at = :next_follow_up_at,
                     last_client_response = :last_client_response,
                     last_status = :last_status
                 WHERE id = :id
                   AND organization_id = :organization_id'
            );
            $updatePolicy->bindValue(':last_follow_up_at', $followUpAt);
            $updatePolicy->bindValue(':next_follow_up_at', $nextFollowUpAt, $nextFollowUpAt === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $updatePolicy->bindValue(':last_client_response', $remarks !== '' ? $remarks : null);
            $updatePolicy->bindValue(':last_status', $status);
            $updatePolicy->bindValue(':id', $policyId, PDO::PARAM_INT);
            bindOrganizationId($updatePolicy, $organizationId);
            $updatePolicy->execute();

            $followUpId = (int) $pdo->lastInsertId();
            $pdo->commit();

            Response::json([
                'status' => 'ok',
                'message' => 'Follow up saved successfully.',
                'data' => [
                    'id' => $followUpId,
                    'policy_id' => $policyId,
                    'follow_up_at' => $followUpAt,
                    'follow_up_mode' => trim((string) $payload['follow_up_mode']),
                    'next_follow_up_at' => $nextFollowUpAt,
                    'follow_up_status' => $status,
                    'follow_up_remarks' => $remarks !== '' ? $remarks : null,
                    'follow_up_by_name' => (string) $user['full_name']
                ]
            ], 201);
            exit;
        } catch (Throwable $throwable) {
            $pdo->rollBack();
            throw $throwable;
        }
    }

    if ($path === '/api/policies/renew-form' && $method === 'GET') {
        $pdo = Database::connection();
        $organizationId = requireOrganizationId();

        $statement = $pdo->prepare(
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
                p.renewal_status,
                fu.follow_up_at,
                fu.follow_up_mode,
                fu.next_follow_up_at,
                fu.outcome_status AS follow_up_status,
                fu.response_summary AS follow_up_remarks,
                u.full_name AS follow_up_by_name
             FROM policies p
             LEFT JOIN (
                SELECT fu1.*
                FROM follow_ups fu1
                INNER JOIN (
                    SELECT policy_id, MAX(id) AS latest_id
                    FROM follow_ups
                    GROUP BY policy_id
                ) latest_follow_up ON latest_follow_up.latest_id = fu1.id
             ) fu ON fu.policy_id = p.id
             LEFT JOIN users u ON u.linked_agent_id = fu.done_by_agent_id
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             LEFT JOIN insurance_companies ic ON ic.id = p.company_id
             LEFT JOIN insurance_products ip ON ip.id = p.product_id
             WHERE p.organization_id = :organization_id
               AND p.risk_end_date IS NOT NULL
               AND p.risk_end_date >= curdate()
               AND coalesce(p.renewal_status, "") <> "Renewed"
             ORDER BY p.risk_end_date ASC, p.policy_number ASC'
        );
        bindOrganizationId($statement, $organizationId);
        $statement->execute();
        $policies = $statement->fetchAll();

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
        $organizationId = requireOrganizationId();

        $fetchScoped = static function (string $sql) use ($pdo, $organizationId): array {
            return scopedRowsOrEmpty($pdo, $sql, $organizationId);
        };

        $customerGroups = $fetchScoped(
            'SELECT id, group_name
             FROM customer_groups
             WHERE organization_id = :organization_id
             ORDER BY group_name ASC'
        );

        $customers = $fetchScoped(
            'SELECT c.id, c.group_id, c.customer_code, c.full_name, c.mobile, cg.group_name
             FROM customers c
             LEFT JOIN customer_groups cg ON cg.id = c.group_id
             WHERE c.organization_id = :organization_id
               AND c.is_active = 1
             ORDER BY c.full_name ASC'
        );

        $policyTypes = $fetchScoped(
            'SELECT id, category_name, parent_category_id
             FROM product_categories
             WHERE organization_id = :organization_id
               AND is_active = 1
               AND parent_category_id IS NOT NULL
             ORDER BY category_name ASC'
        );

        $insuranceCompanies = $fetchScoped(
            'SELECT id, company_name
             FROM insurance_companies
             WHERE organization_id = :organization_id
               AND is_active = 1
             ORDER BY company_name ASC'
        );

        $products = $fetchScoped(
            'SELECT ip.id, ip.company_id, ip.category_id, ip.product_name, ic.company_name
             FROM insurance_products ip
             LEFT JOIN insurance_companies ic ON ic.id = ip.company_id
             WHERE ip.organization_id = :organization_id
               AND ip.is_active = 1
             ORDER BY ip.product_name ASC'
        );

        $agentAccounts = $fetchScoped(
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
             WHERE apa.organization_id = :organization_id
               AND apa.is_active = 1
             ORDER BY a.full_name ASC, apa.is_default DESC, apa.account_label ASC'
        );

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
        $organizationId = requireOrganizationId();
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
            $categoryCheck = $pdo->prepare('SELECT category_id FROM insurance_products WHERE id = :id AND organization_id = :organization_id');
            $categoryCheck->bindValue(':id', $productId, PDO::PARAM_INT);
            bindOrganizationId($categoryCheck, $organizationId);
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
            $policyTypeStatement = $pdo->prepare('SELECT category_name FROM product_categories WHERE id = :id AND organization_id = :organization_id');
            $policyTypeStatement->bindValue(':id', $policyTypeId, PDO::PARAM_INT);
            bindOrganizationId($policyTypeStatement, $organizationId);
            $policyTypeStatement->execute();
            $policyTypeName = $policyTypeStatement->fetchColumn() ?: null;
        }

        $pdo->beginTransaction();

        try {
            $familyCode = 'PF' . date('YmdHis') . random_int(100, 999);
            $policyCode = 'PL' . date('YmdHis') . random_int(100, 999);

            $familyStatement = $pdo->prepare(
                'INSERT INTO policy_families (organization_id, policy_family_code, customer_id, family_label)
                 VALUES (:organization_id, :policy_family_code, :customer_id, :family_label)'
            );
            bindOrganizationId($familyStatement, $organizationId);
            $familyStatement->bindValue(':policy_family_code', $familyCode);
            $familyStatement->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
            $familyStatement->bindValue(':family_label', $payload['policy_number']);
            $familyStatement->execute();

            $policyFamilyId = (int) $pdo->lastInsertId();

            $statement = $pdo->prepare(
                'INSERT INTO policies (
                    organization_id,
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
                    :organization_id,
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

            bindOrganizationId($statement, $organizationId);
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
        $organizationId = requireOrganizationId();
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
             WHERE id = :id
               AND organization_id = :organization_id'
        );
        $previousPolicyStatement->bindValue(':id', $previousPolicyId, PDO::PARAM_INT);
        bindOrganizationId($previousPolicyStatement, $organizationId);
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
                    organization_id,
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
                    :organization_id,
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

            bindOrganizationId($statement, $organizationId);
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
                 WHERE id = :id
                   AND organization_id = :organization_id'
            );
            $updatePrevious->bindValue(':renewal_status', 'Renewed');
            $updatePrevious->bindValue(':last_status', 'Superseded');
            $updatePrevious->bindValue(':id', $previousPolicyId, PDO::PARAM_INT);
            bindOrganizationId($updatePrevious, $organizationId);
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
        $requestOrganizationId = requestOrganizationId();
        $isOrganizationOwned = (bool) ($config['organization_owned'] ?? true);
        $organizationId = $isOrganizationOwned ? requireOrganizationId() : $requestOrganizationId;

        if ($method === 'GET' && $id === null) {
            $limit = isset($_GET['limit']) ? max(1, min(250, (int) $_GET['limit'])) : 100;
            $whereClause = '';

            if ($isOrganizationOwned) {
                $whereClause = sprintf(' WHERE %s = :organization_id', $config['organization_scope_column'] ?? 'organization_id');
            } elseif ($resource === 'organizations' && $organizationId !== null) {
                $whereClause = ' WHERE o.id = :organization_id';
            }

            $sql = sprintf(
                'SELECT %s FROM %s%s ORDER BY %s LIMIT :limit',
                $config['select'],
                $config['from'],
                $whereClause,
                $config['order_by']
            );
            try {
                $statement = $pdo->prepare($sql);
                if ($whereClause !== '' && $organizationId !== null) {
                    bindOrganizationId($statement, $organizationId);
                }
                $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
                $statement->execute();
                $rows = $statement->fetchAll();
            } catch (PDOException $exception) {
                if (!isMissingOrganizationColumn($exception)) {
                    throw $exception;
                }

                $rows = [];
            }

            Response::json([
                'status' => 'ok',
                'data' => $rows,
                'meta' => ['limit' => $limit]
            ]);
            exit;
        }

        if (($method === 'POST' && $id === null) || ($method === 'PUT' && $id !== null)) {
            $payload = [];
            $hasFiles = !empty($_FILES);

            if ($hasFiles) {
                $payload = $_POST;
            } else {
                $rawBody = file_get_contents('php://input');
                $payload = json_decode($rawBody ?: '[]', true);

                if (!is_array($payload)) {
                    Response::json([
                        'status' => 'error',
                        'message' => 'Invalid JSON payload'
                    ], 422);
                    exit;
                }
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

            foreach (($config['file_columns'] ?? []) as $fileColumn) {
                if (!isset($_FILES[$fileColumn]) || !is_array($_FILES[$fileColumn])) {
                    continue;
                }

                if ((int) $_FILES[$fileColumn]['error'] !== UPLOAD_ERR_OK) {
                    Response::json([
                        'status' => 'error',
                        'message' => sprintf('Failed to upload file for "%s".', $fileColumn)
                    ], 422);
                    exit;
                }

                $uploadDir = __DIR__ . '/uploads';
                if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                    Response::json([
                        'status' => 'error',
                        'message' => 'Unable to prepare upload directory.'
                    ], 500);
                    exit;
                }

                $originalName = (string) $_FILES[$fileColumn]['name'];
                $tmpName = (string) $_FILES[$fileColumn]['tmp_name'];
                $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                $storedName = uniqid($resource . '_', true) . ($extension !== '' ? '.' . $extension : '');
                $targetPath = $uploadDir . '/' . $storedName;

                if (!move_uploaded_file($tmpName, $targetPath)) {
                    Response::json([
                        'status' => 'error',
                        'message' => 'Failed to save uploaded file.'
                    ], 500);
                    exit;
                }

                $normalized[$fileColumn] = 'uploads/' . $storedName;
            }

            if ($method === 'POST' && $resource === 'document-types' && empty($normalized['code'])) {
                $normalized['code'] = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '_', $normalized['name'] ?? 'DOC_' . time()));
            }

            if ($method === 'POST' && $isOrganizationOwned) {
                $normalized['organization_id'] = $organizationId;
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
                'UPDATE %s SET %s WHERE id = :id%s',
                $config['table'],
                implode(', ', $assignments),
                $isOrganizationOwned ? ' AND organization_id = :organization_id' : ''
            );

            $statement = $pdo->prepare($sql);
            foreach ($normalized as $column => $value) {
                $statement->bindValue(':' . $column, $value);
            }
            $statement->bindValue(':id', $id, PDO::PARAM_INT);
            if ($isOrganizationOwned) {
                bindOrganizationId($statement, $organizationId);
            }
            $statement->execute();

            Response::json([
                'status' => 'ok',
                'message' => 'Record updated successfully.'
            ]);
            exit;
        }

        if ($method === 'DELETE' && $id !== null) {
            $statement = $pdo->prepare(sprintf(
                'DELETE FROM %s WHERE id = :id%s',
                $config['table'],
                $isOrganizationOwned ? ' AND organization_id = :organization_id' : ''
            ));
            $statement->bindValue(':id', $id, PDO::PARAM_INT);
            if ($isOrganizationOwned) {
                bindOrganizationId($statement, $organizationId);
            }
            try {
                $statement->execute();
            } catch (PDOException $exception) {
                if ($exception->getCode() === '23000') {
                    Response::json([
                        'status' => 'error',
                        'message' => linkedDeleteMessage($resource)
                    ], 409);
                    exit;
                }

                throw $exception;
            }

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













