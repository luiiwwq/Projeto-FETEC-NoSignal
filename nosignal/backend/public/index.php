<?php
/**
 * No Signal — Backend API Endpoint
 * 
 * Handles player registration data.
 * Uses PDO with Prepared Statements for secure database access.
 * 
 * Routes:
 *   POST /    → Create or update a player profile
 *   OPTIONS / → CORS preflight
 */

declare(strict_types=1);

// ─────────────────────────────────────────────
//  CORS Headers (allow local XAMPP dev origin)
// ─────────────────────────────────────────────
$allowed_origins = [
    'http://localhost',
    'http://localhost:80',
    'http://127.0.0.1',
    'http://127.0.0.1:80',
    'http://localhost:3000',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Allow any localhost variant during development
    header('Access-Control-Allow-Origin: http://localhost');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=UTF-8');

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// ─────────────────────────────────────────────
//  Parse JSON Body
// ─────────────────────────────────────────────
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

// ─────────────────────────────────────────────
//  Input Validation & Sanitization
// ─────────────────────────────────────────────
$name = isset($data['name']) ? trim((string) $data['name']) : '';

// Validate name
if ($name === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'O nome do astronauta é obrigatório.']);
    exit;
}

if (mb_strlen($name) > 50) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'O nome deve ter no máximo 50 caracteres.']);
    exit;
}

// ─────────────────────────────────────────────
//  Database Connection via PDO
// ─────────────────────────────────────────────
$db_host = getenv('DB_HOST')     ?: 'localhost';
$db_name = getenv('DB_NAME')     ?: 'nosignal_db';
$db_user = getenv('DB_USER')     ?: 'root';
$db_pass = getenv('DB_PASSWORD') ?: '';
$db_port = getenv('DB_PORT')     ?: '3306';

$dsn = "mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4";

$pdo_options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $db_user, $db_pass, $pdo_options);
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error'   => 'Não foi possível conectar ao banco de dados.',
        'detail'  => $e->getMessage(), // Remove in production
    ]);
    exit;
}

// ─────────────────────────────────────────────
//  Insert Player with Prepared Statement
// ─────────────────────────────────────────────
$sql = '
    INSERT INTO players (name)
    VALUES (:name)
';

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':name' => $name,
    ]);

    $player_id = (int) $pdo->lastInsertId();

    http_response_code(201);
    echo json_encode([
        'success'   => true,
        'player_id' => $player_id,
        'message'   => "Astronauta $name pronto para a missão!",
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Erro ao salvar o perfil do jogador.',
        'detail'  => $e->getMessage(), // Remove in production
    ]);
}
