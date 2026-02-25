# Mines Game — Complete PHP + MySQL Backend (Updated)

> **Rows (3-5), Mines (1 to gridSize-1), Bet Amount** — sab DB se connected hai.  
> **Rigging Engine** user ke per-round payout + cumulative stats + streaks se decide karta hai.  
> Frontend sirf UI hai — saari logic server pe.

---

## Architecture

```
React Frontend ──HTTP JSON──► PHP Backend ──► MySQL Database
                                │
                         ┌──────┴──────┐
                         │ reveal.php   │
                         │ 5-Layer      │
                         │ Rigging      │
                         │ Engine       │
                         └─────────────┘
```

---

## API Endpoints

| Action | Endpoint | Method | Body |
|---|---|---|---|
| Register | `/api/auth.php` | POST | `{action:"register", username, email, password}` |
| Login | `/api/auth.php` | POST | `{action:"login", email, password}` |
| Start Game | `/api/start.php` | POST | `{bet_amount, mine_count, rows}` |
| Click Tile | `/api/reveal.php` | POST | `{session_id, tile_index}` |
| Cash Out | `/api/cashout.php` | POST | `{session_id}` |
| Get Balance | `/api/balance.php` | GET | — |
| History | `/api/history.php` | GET | `?limit=20&offset=0` |
| Admin | `/api/admin.php` | POST/GET | `{action: "stats"|"config"|...}` |

---

## 1. MySQL Schema (`schema.sql`)

```sql
CREATE DATABASE IF NOT EXISTS mines_game;
USE mines_game;

-- Users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 10000.00,
    role ENUM('user','admin') DEFAULT 'user',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-user stats (rigging engine reads this)
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
    last_game_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Active game sessions (rows, mines, bet stored per session)
CREATE TABLE game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    mine_count INT NOT NULL,
    grid_size INT NOT NULL DEFAULT 15,    -- rows × 5
    rows_count INT NOT NULL DEFAULT 3,    -- 3, 4, or 5
    revealed_tiles JSON DEFAULT '[]',
    safe_count INT DEFAULT 0,
    current_multiplier DECIMAL(10,4) DEFAULT 1.0000,
    status ENUM('active','won','lost','cashed_out') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Completed game history
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin-controlled config
CREATE TABLE game_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO game_config VALUES
('house_edge_target','0.40','Target house profit % (0.30-0.60)',NOW()),
('max_multiplier','25','Max payout multiplier cap',NOW()),
('min_bet','10','Minimum bet amount',NOW()),
('max_bet','50000','Maximum bet amount',NOW()),
('base_house_edge','0.03','Base edge on multiplier display (3%)',NOW()),
('max_mine_probability','0.92','Max mine probability cap',NOW()),
('min_mine_probability','0.02','Min mine probability floor',NOW()),
('min_rows','3','Minimum rows allowed',NOW()),
('max_rows','5','Maximum rows allowed',NOW());

-- Default admin (password: admin123 — CHANGE!)
INSERT INTO users (username,email,password_hash,balance,role) VALUES
('admin','admin@mines.com','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',999999,'admin');
INSERT INTO user_stats (user_id) VALUES (1);

-- Stats view for admin dashboard
CREATE VIEW global_stats AS
SELECT
    COUNT(*) as total_games,
    SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as total_wins,
    SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as total_losses,
    COALESCE(SUM(bet_amount),0) as total_wagered,
    COALESCE(SUM(CASE WHEN result='win' THEN bet_amount*multiplier ELSE 0 END),0) as total_paid_out,
    ROUND(
        (COALESCE(SUM(bet_amount),0) - COALESCE(SUM(CASE WHEN result='win' THEN bet_amount*multiplier ELSE 0 END),0))
        / NULLIF(SUM(bet_amount),0) * 100, 2
    ) as house_profit_percent
FROM game_history;
```

---

## 2. PHP Files

### `config.php` — DB + Auth + Helpers

```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Production: apna domain dalo
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') { http_response_code(200); exit; }

define('DB_HOST','localhost');
define('DB_NAME','mines_game');
define('DB_USER','root');
define('DB_PASS','');
define('JWT_SECRET','CHANGE-THIS-IN-PRODUCTION-USE-RANDOM-64-CHARS');
define('JWT_EXPIRY',86400*7);

function getDB(): PDO {
    static $pdo=null;
    if(!$pdo) $pdo=new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",DB_USER,DB_PASS,[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false
    ]);
    return $pdo;
}

function cfgVal(string $k, string $d=''): string {
    $s=getDB()->prepare("SELECT config_value FROM game_config WHERE config_key=?");
    $s->execute([$k]); $r=$s->fetch(); return $r?$r['config_value']:$d;
}

function jsonOk(array $d, int $c=200) { http_response_code($c); echo json_encode(['success'=>true,...$d]); exit; }
function jsonErr(string $m, int $c=400) { http_response_code($c); echo json_encode(['success'=>false,'error'=>$m]); exit; }

function makeJWT(int $uid): string {
    $h=base64_encode(json_encode(['typ'=>'JWT','alg'=>'HS256']));
    $p=base64_encode(json_encode(['user_id'=>$uid,'exp'=>time()+JWT_EXPIRY,'iat'=>time()]));
    return "$h.$p.".base64_encode(hash_hmac('sha256',"$h.$p",JWT_SECRET,true));
}

function checkJWT(string $t): ?array {
    $parts=explode('.',$t); if(count($parts)!==3) return null;
    [$h,$p,$s]=$parts;
    if(!hash_equals(base64_encode(hash_hmac('sha256',"$h.$p",JWT_SECRET,true)),$s)) return null;
    $d=json_decode(base64_decode($p),true);
    return ($d && $d['exp']>=time()) ? $d : null;
}

function requireAuth(): int {
    $h=$_SERVER['HTTP_AUTHORIZATION']??'';
    if(!preg_match('/Bearer\s+(.+)/',$h,$m)) jsonErr('Auth required',401);
    $d=checkJWT($m[1]); if(!$d) jsonErr('Invalid token',401);
    return $d['user_id'];
}

function body(): array { return json_decode(file_get_contents('php://input'),true)?:[]; }
```

### `auth.php` — Register / Login

```php
<?php
require_once 'config.php';
$b=body(); $a=$b['action']??'';

if($a==='register') {
    $u=trim($b['username']??''); $e=trim($b['email']??''); $pw=$b['password']??'';
    if(strlen($u)<3) jsonErr('Username min 3 chars');
    if(!filter_var($e,FILTER_VALIDATE_EMAIL)) jsonErr('Invalid email');
    if(strlen($pw)<6) jsonErr('Password min 6 chars');
    $db=getDB();
    $s=$db->prepare("SELECT id FROM users WHERE email=? OR username=?"); $s->execute([$e,$u]);
    if($s->fetch()) jsonErr('Already exists');
    $db->beginTransaction();
    $s=$db->prepare("INSERT INTO users(username,email,password_hash)VALUES(?,?,?)");
    $s->execute([$u,$e,password_hash($pw,PASSWORD_DEFAULT)]);
    $id=(int)$db->lastInsertId();
    $db->prepare("INSERT INTO user_stats(user_id)VALUES(?)")->execute([$id]);
    $db->commit();
    jsonOk(['token'=>makeJWT($id),'user'=>['id'=>$id,'username'=>$u,'balance'=>10000]],201);

} elseif($a==='login') {
    $e=trim($b['email']??''); $pw=$b['password']??'';
    if(!$e||!$pw) jsonErr('Email & password required');
    $db=getDB();
    $s=$db->prepare("SELECT id,username,password_hash,balance,is_active FROM users WHERE email=?");
    $s->execute([$e]); $u=$s->fetch();
    if(!$u||!password_verify($pw,$u['password_hash'])) jsonErr('Invalid credentials',401);
    if(!$u['is_active']) jsonErr('Account disabled',403);
    $db->prepare("UPDATE users SET last_login=NOW() WHERE id=?")->execute([$u['id']]);
    jsonOk(['token'=>makeJWT((int)$u['id']),'user'=>['id'=>$u['id'],'username'=>$u['username'],'balance'=>(float)$u['balance']]]);

} else jsonErr('Use action: register or login');
```

### `start.php` — Start Game (validates rows, mines, bet)

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $b=body();

$bet=(float)($b['bet_amount']??0);
$mines=(int)($b['mine_count']??3);
$rows=(int)($b['rows']??3);

// Validate from DB config
$minBet=(float)cfgVal('min_bet','10');
$maxBet=(float)cfgVal('max_bet','50000');
$minRows=(int)cfgVal('min_rows','3');
$maxRows=(int)cfgVal('max_rows','5');

if($bet<$minBet) jsonErr("Min bet ₹$minBet");
if($bet>$maxBet) jsonErr("Max bet ₹$maxBet");
if($rows<$minRows||$rows>$maxRows) jsonErr("Rows must be $minRows-$maxRows");

$gridSize=$rows*5;
if($mines<1||$mines>=$gridSize) jsonErr("Mines must be 1-".($gridSize-1)." for {$rows}×5 grid");

$db=getDB();

// No duplicate active sessions
$s=$db->prepare("SELECT id FROM game_sessions WHERE user_id=? AND status='active'");
$s->execute([$userId]);
if($s->fetch()) jsonErr('Finish current game first');

$db->beginTransaction();
try {
    $s=$db->prepare("SELECT balance FROM users WHERE id=? FOR UPDATE");
    $s->execute([$userId]); $u=$s->fetch();
    if(!$u||$u['balance']<$bet) { $db->rollBack(); jsonErr('Insufficient balance'); }

    $db->prepare("UPDATE users SET balance=balance-? WHERE id=?")->execute([$bet,$userId]);

    $s=$db->prepare("INSERT INTO game_sessions(user_id,bet_amount,mine_count,grid_size,rows_count)VALUES(?,?,?,?,?)");
    $s->execute([$userId,$bet,$mines,$gridSize,$rows]);
    $sid=(int)$db->lastInsertId();

    $s=$db->prepare("SELECT balance FROM users WHERE id=?");
    $s->execute([$userId]); $bal=(float)$s->fetch()['balance'];

    $db->commit();
    jsonOk([
        'session_id'=>$sid,
        'grid_size'=>$gridSize,
        'rows'=>$rows,
        'mine_count'=>$mines,
        'bet_amount'=>$bet,
        'balance'=>$bal,
    ]);
} catch(Exception $e) { $db->rollBack(); jsonErr('Failed to start game'); }
```

### `reveal.php` — 5-LAYER RIGGING ENGINE (Updated)

```php
<?php
/**
 * CORE GAME FILE — All mine/diamond decisions happen here.
 * 
 * 5-Layer Rigging System:
 *   Layer 1: Fair base probability + escalation per reveal
 *   Layer 2: Current round potential payout analysis
 *   Layer 3: Cumulative user profit/loss history
 *   Layer 4: Win/loss streak management
 *   Layer 5: Bet size risk adjustment
 */

require_once 'config.php';
$userId=requireAuth(); $b=body();
$sid=(int)($b['session_id']??0);
$ti=(int)($b['tile_index']??-1);
if(!$sid) jsonErr('session_id required');
if($ti<0) jsonErr('Invalid tile_index');

$db=getDB(); $db->beginTransaction();
try {
    // Lock session row
    $s=$db->prepare("SELECT * FROM game_sessions WHERE id=? AND user_id=? AND status='active' FOR UPDATE");
    $s->execute([$sid,$userId]); $ses=$s->fetch();
    if(!$ses) { $db->rollBack(); jsonErr('No active session'); }
    if($ti>=$ses['grid_size']) { $db->rollBack(); jsonErr('tile_index out of range'); }

    $rev=json_decode($ses['revealed_tiles'],true)?:[];
    if(in_array($ti,$rev)) { $db->rollBack(); jsonErr('Tile already revealed'); }

    // Load user stats for rigging
    $s=$db->prepare("SELECT * FROM user_stats WHERE user_id=?");
    $s->execute([$userId]); $us=$s->fetch();

    // =======================================
    // 5-LAYER RIGGING ENGINE
    // =======================================
    $isMine = shouldBeMine(
        (int)$ses['mine_count'],
        (int)$ses['safe_count'],
        (float)$ses['bet_amount'],
        (int)$ses['grid_size'],
        $us
    );

    if($isMine) {
        // === MINE HIT — GAME OVER ===
        $mines=[$ti]; $avail=[];
        for($i=0;$i<$ses['grid_size'];$i++) if(!in_array($i,$rev)&&$i!==$ti) $avail[]=$i;
        shuffle($avail);
        for($i=0;count($mines)<$ses['mine_count']&&$i<count($avail);$i++) $mines[]=$avail[$i];

        $allRev=json_encode([...$rev,$ti]);
        $db->prepare("UPDATE game_sessions SET status='lost',ended_at=NOW(),revealed_tiles=? WHERE id=?")
           ->execute([$allRev,$sid]);

        $db->prepare("INSERT INTO game_history(user_id,session_id,bet_amount,mine_count,grid_size,rows_count,tiles_revealed,result,multiplier,profit)VALUES(?,?,?,?,?,?,?,'loss',0,?)")
           ->execute([$userId,$sid,$ses['bet_amount'],$ses['mine_count'],$ses['grid_size'],$ses['rows_count'],count($rev),-$ses['bet_amount']]);

        $db->prepare("UPDATE user_stats SET total_wagered=total_wagered+?,total_games=total_games+1,total_losses=total_losses+1,consecutive_losses=consecutive_losses+1,consecutive_wins=0,biggest_loss=GREATEST(biggest_loss,?),session_profit=session_profit-?,last_game_at=NOW() WHERE user_id=?")
           ->execute([$ses['bet_amount'],$ses['bet_amount'],$ses['bet_amount'],$userId]);

        $s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]);
        $bal=(float)$s->fetch()['balance'];
        $db->commit();

        jsonOk(['result'=>'mine','tile_index'=>$ti,'mine_positions'=>$mines,'multiplier'=>0,
                'profit'=>-(float)$ses['bet_amount'],'balance'=>$bal,'game_over'=>true]);

    } else {
        // === DIAMOND — SAFE ===
        $newRev=[...$rev,$ti];
        $sc=(int)$ses['safe_count']+1;
        $mult=calcMult((int)$ses['mine_count'],$sc,(int)$ses['grid_size']);
        $profit=(float)$ses['bet_amount']*$mult-(float)$ses['bet_amount'];
        $totalSafe=(int)$ses['grid_size']-(int)$ses['mine_count'];
        $allDone=($sc>=$totalSafe);

        if($allDone) {
            $win=(float)$ses['bet_amount']*$mult;
            $db->prepare("UPDATE users SET balance=balance+? WHERE id=?")->execute([$win,$userId]);
            $db->prepare("UPDATE game_sessions SET status='won',ended_at=NOW(),safe_count=?,current_multiplier=?,revealed_tiles=? WHERE id=?")
               ->execute([$sc,$mult,json_encode($newRev),$sid]);
            $db->prepare("INSERT INTO game_history(user_id,session_id,bet_amount,mine_count,grid_size,rows_count,tiles_revealed,result,multiplier,profit)VALUES(?,?,?,?,?,?,?,'win',?,?)")
               ->execute([$userId,$sid,$ses['bet_amount'],$ses['mine_count'],$ses['grid_size'],$ses['rows_count'],$sc,$mult,$profit]);
            statsWin($db,$userId,(float)$ses['bet_amount'],$profit);
        } else {
            $db->prepare("UPDATE game_sessions SET safe_count=?,current_multiplier=?,revealed_tiles=? WHERE id=?")
               ->execute([$sc,$mult,json_encode($newRev),$sid]);
        }

        $s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]);
        $bal=(float)$s->fetch()['balance'];
        $db->commit();

        jsonOk(['result'=>'diamond','tile_index'=>$ti,'multiplier'=>$mult,'profit'=>round($profit,2),
                'balance'=>$bal,'game_over'=>$allDone,
                'next_multiplier'=>$allDone?null:calcMult((int)$ses['mine_count'],$sc+1,(int)$ses['grid_size'])]);
    }
} catch(Exception $e) { $db->rollBack(); jsonErr('Error: '.$e->getMessage(),500); }


// =======================================
// 5-LAYER RIGGING ENGINE FUNCTION
// =======================================

function shouldBeMine(int $mineCount, int $safeRevealed, float $betAmount, int $gridSize, ?array $us): bool {
    $target = (float)cfgVal('house_edge_target','0.40') * 100; // e.g. 40
    $maxP   = (float)cfgVal('max_mine_probability','0.92');
    $minP   = (float)cfgVal('min_mine_probability','0.02');

    // === LAYER 1: Fair base + escalation ===
    $remaining = $gridSize - $safeRevealed;
    $fairProb  = $mineCount / max($remaining, 1);

    if ($safeRevealed === 0) {
        $rp = $fairProb * 0.5;      // Very safe first click (hook)
    } elseif ($safeRevealed === 1) {
        $rp = $fairProb * 0.8;
    } else {
        $rp = $fairProb * (1 + $safeRevealed * 0.35); // Linear escalation
    }

    // === LAYER 2: Current round — potential payout ===
    $nextMult        = calcMult($mineCount, $safeRevealed + 1, $gridSize);
    $potentialPayout = $betAmount * $nextMult;
    $potentialProfit = $potentialPayout - $betAmount;
    $profitRatio     = $potentialProfit / max($betAmount, 1);

    // Jitna zyada jeetega → utna zyada crash chance
    if ($profitRatio > 8)      $rp *= 4.0;   // 8x+ profit → almost certain crash
    elseif ($profitRatio > 4)  $rp *= 2.8;   // 4-8x
    elseif ($profitRatio > 2)  $rp *= 2.0;   // 2-4x
    elseif ($profitRatio > 1)  $rp *= 1.5;   // 1-2x
    elseif ($profitRatio > 0.5) $rp *= 1.2;
    // Under 0.5x → let them play (hooks them)

    // Absolute payout caps
    if ($potentialPayout > 25000) $rp *= 3.0;
    elseif ($potentialPayout > 10000) $rp *= 2.0;
    elseif ($potentialPayout > 5000) $rp *= 1.5;

    // === LAYER 3: Cumulative user profit/loss ===
    if ($us) {
        $tw = (float)$us['total_wagered'];
        $tp = (float)$us['total_paid_out'];

        if ($tw > 0) {
            $userNet = $tp - $tw; // positive = user profit

            if ($userNet > 0) {
                // User is in profit → recover house money
                $pct = ($userNet / $tw) * 100;
                if ($pct > 30) $rp *= 2.5;      // Won 30%+ → crash hard
                elseif ($pct > 15) $rp *= 1.8;
                elseif ($pct > 5) $rp *= 1.4;
            } else {
                // User is in loss → check if house too greedy
                $lossPct = abs($userNet / $tw) * 100;
                if ($lossPct > 60) $rp *= 0.3;      // Lost 60%+ → give hope
                elseif ($lossPct > 45) $rp *= 0.5;
                elseif ($lossPct > 35) $rp *= 0.8;
            }

            // Global house profit enforcement
            $houseProfit = (($tw - $tp) / $tw) * 100;
            if ($houseProfit < $target - 15) $rp *= 2.0;      // House losing → emergency crash
            elseif ($houseProfit < $target - 8) $rp *= 1.5;
            elseif ($houseProfit > $target + 20) $rp *= 0.4;   // House too greedy → ease up
            elseif ($houseProfit > $target + 10) $rp *= 0.6;
        }

        // === LAYER 4: Streak management ===
        $ws = (int)$us['consecutive_wins'];
        if ($ws >= 4) $rp *= 3.5;       // 4+ wins → must crash
        elseif ($ws >= 3) $rp *= 2.5;
        elseif ($ws >= 2) $rp *= 1.8;

        $ls = (int)$us['consecutive_losses'];
        if ($ls >= 5) $rp *= 0.15;      // 5+ losses → almost guaranteed safe
        elseif ($ls >= 4) $rp *= 0.25;
        elseif ($ls >= 3) $rp *= 0.4;

        // Session profit adjustment
        $sp = (float)$us['session_profit'];
        if ($sp > $betAmount * 3) $rp *= 1.4;     // Up big → harder
        elseif ($sp < -$betAmount * 5) $rp *= 0.6; // Down big → easier
    }

    // === LAYER 5: Bet size risk ===
    if ($betAmount > 10000) $rp *= 1.6;
    elseif ($betAmount > 5000) $rp *= 1.4;
    elseif ($betAmount > 2000) $rp *= 1.2;
    elseif ($betAmount <= 50) $rp *= 0.8;  // Small bets → loose (build confidence)

    // === FINAL: Clamp ===
    $rp = max($minP, min($maxP, $rp));
    return (mt_rand() / mt_getrandmax()) < $rp;
}

function calcMult(int $mc, int $r, int $gs): float {
    if ($r === 0) return 1.0;
    $max  = (float)cfgVal('max_multiplier','25');
    $edge = (float)cfgVal('base_house_edge','0.03');
    $m = 1.0;
    for ($i = 0; $i < $r; $i++) {
        $safe = $gs - $mc - $i;
        if ($safe > 0) $m *= ($gs - $i) / $safe;
    }
    return round(min($m * (1 - $edge), $max), 4);
}

function statsWin(PDO $db, int $uid, float $bet, float $profit): void {
    $win = $bet + $profit;
    $db->prepare("UPDATE user_stats SET total_wagered=total_wagered+?,total_paid_out=total_paid_out+?,total_games=total_games+1,total_wins=total_wins+1,consecutive_wins=consecutive_wins+1,consecutive_losses=0,biggest_win=GREATEST(biggest_win,?),session_profit=session_profit+?,last_game_at=NOW() WHERE user_id=?")
       ->execute([$bet, $win, $profit, $profit, $uid]);
}
```

### `cashout.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $b=body();
$sid=(int)($b['session_id']??0);
if(!$sid) jsonErr('session_id required');

$db=getDB(); $db->beginTransaction();
try {
    $s=$db->prepare("SELECT * FROM game_sessions WHERE id=? AND user_id=? AND status='active' FOR UPDATE");
    $s->execute([$sid,$userId]); $ses=$s->fetch();
    if(!$ses) { $db->rollBack(); jsonErr('No active session'); }
    if($ses['safe_count']===0) { $db->rollBack(); jsonErr('Reveal at least 1 tile'); }

    $mult=(float)$ses['current_multiplier'];
    $win=(float)$ses['bet_amount']*$mult;
    $profit=$win-(float)$ses['bet_amount'];

    $db->prepare("UPDATE users SET balance=balance+? WHERE id=?")->execute([$win,$userId]);

    // Display mines on remaining tiles
    $rev=json_decode($ses['revealed_tiles'],true)?:[]; $avail=[];
    for($i=0;$i<$ses['grid_size'];$i++) if(!in_array($i,$rev)) $avail[]=$i;
    shuffle($avail); $mines=array_slice($avail,0,(int)$ses['mine_count']);

    $db->prepare("UPDATE game_sessions SET status='cashed_out',ended_at=NOW() WHERE id=?")->execute([$sid]);

    $db->prepare("INSERT INTO game_history(user_id,session_id,bet_amount,mine_count,grid_size,rows_count,tiles_revealed,result,multiplier,profit)VALUES(?,?,?,?,?,?,?,'win',?,?)")
       ->execute([$userId,$sid,$ses['bet_amount'],$ses['mine_count'],$ses['grid_size'],$ses['rows_count'],$ses['safe_count'],$mult,$profit]);

    $w=(float)$ses['bet_amount']+$profit;
    $db->prepare("UPDATE user_stats SET total_wagered=total_wagered+?,total_paid_out=total_paid_out+?,total_games=total_games+1,total_wins=total_wins+1,consecutive_wins=consecutive_wins+1,consecutive_losses=0,biggest_win=GREATEST(biggest_win,?),session_profit=session_profit+?,last_game_at=NOW() WHERE user_id=?")
       ->execute([(float)$ses['bet_amount'],$w,$profit,$profit,$userId]);

    $s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]);
    $bal=(float)$s->fetch()['balance'];
    $db->commit();

    jsonOk(['result'=>'cashed_out','multiplier'=>$mult,'winnings'=>round($win,2),'profit'=>round($profit,2),'balance'=>$bal,'mine_positions'=>$mines]);
} catch(Exception $e) { $db->rollBack(); jsonErr('Cashout failed'); }
```

### `balance.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $db=getDB();

$s=$db->prepare("SELECT u.id,u.username,u.balance,us.total_games,us.total_wins,us.total_losses,us.total_wagered,us.total_paid_out FROM users u LEFT JOIN user_stats us ON u.id=us.user_id WHERE u.id=?");
$s->execute([$userId]); $u=$s->fetch();
if(!$u) jsonErr('Not found',404);

// Check active session (for reconnection)
$s=$db->prepare("SELECT id,bet_amount,mine_count,grid_size,rows_count,revealed_tiles,safe_count,current_multiplier FROM game_sessions WHERE user_id=? AND status='active'");
$s->execute([$userId]); $as=$s->fetch();

jsonOk([
    'user'=>['id'=>$u['id'],'username'=>$u['username'],'balance'=>(float)$u['balance']],
    'stats'=>[
        'total_games'=>(int)($u['total_games']??0),
        'total_wins'=>(int)($u['total_wins']??0),
        'total_losses'=>(int)($u['total_losses']??0),
        'total_wagered'=>(float)($u['total_wagered']??0),
        'total_paid_out'=>(float)($u['total_paid_out']??0),
    ],
    'active_session'=>$as ? [
        'session_id'=>(int)$as['id'],
        'bet_amount'=>(float)$as['bet_amount'],
        'mine_count'=>(int)$as['mine_count'],
        'grid_size'=>(int)$as['grid_size'],
        'rows'=>(int)$as['rows_count'],
        'revealed_tiles'=>json_decode($as['revealed_tiles'],true),
        'safe_count'=>(int)$as['safe_count'],
        'current_multiplier'=>(float)$as['current_multiplier'],
    ] : null,
]);
```

### `history.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth();
$limit=min(50,max(1,(int)($_GET['limit']??20)));
$offset=max(0,(int)($_GET['offset']??0));
$db=getDB();
$s=$db->prepare("SELECT id,bet_amount,mine_count,grid_size,rows_count,tiles_revealed,result,multiplier,profit,created_at FROM game_history WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?");
$s->execute([$userId,$limit,$offset]);
jsonOk(['history'=>$s->fetchAll()]);
```

### `admin.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $db=getDB();
$s=$db->prepare("SELECT role FROM users WHERE id=?"); $s->execute([$userId]);
$u=$s->fetch(); if(!$u||$u['role']!=='admin') jsonErr('Admin only',403);

$b=body(); $a=$b['action']??$_GET['action']??'';
switch($a) {
    case 'stats':
        $s=$db->query("SELECT * FROM global_stats"); jsonOk(['stats'=>$s->fetch()]); break;
    case 'config':
        $s=$db->query("SELECT * FROM game_config ORDER BY config_key"); jsonOk(['config'=>$s->fetchAll()]); break;
    case 'update_config':
        $k=$b['key']??''; $v=$b['value']??''; if(!$k) jsonErr('key required');
        $db->prepare("UPDATE game_config SET config_value=? WHERE config_key=?")->execute([$v,$k]);
        jsonOk(['message'=>'Updated']); break;
    case 'users':
        $s=$db->query("SELECT u.id,u.username,u.email,u.balance,u.is_active,us.total_games,us.total_wagered,us.total_paid_out,us.total_wins,us.total_losses FROM users u LEFT JOIN user_stats us ON u.id=us.user_id ORDER BY u.id DESC LIMIT 100");
        jsonOk(['users'=>$s->fetchAll()]); break;
    case 'set_balance':
        $tid=(int)($b['user_id']??0); $nb=(float)($b['balance']??0);
        if(!$tid) jsonErr('user_id required');
        $db->prepare("UPDATE users SET balance=? WHERE id=?")->execute([$nb,$tid]);
        jsonOk(['message'=>'Balance set']); break;
    case 'toggle_user':
        $tid=(int)($b['user_id']??0); if(!$tid) jsonErr('user_id required');
        $db->prepare("UPDATE users SET is_active=NOT is_active WHERE id=?")->execute([$tid]);
        jsonOk(['message'=>'Toggled']); break;
    case 'recent_games':
        $s=$db->query("SELECT gh.*,u.username FROM game_history gh JOIN users u ON gh.user_id=u.id ORDER BY gh.created_at DESC LIMIT 100");
        jsonOk(['games'=>$s->fetchAll()]); break;
    default: jsonErr('Invalid action');
}
```

---

## 3. Frontend API Service (`src/lib/api.ts`)

```typescript
const API_BASE = 'https://your-domain.com/api';
let token: string | null = localStorage.getItem('mines_token');

async function api(endpoint: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    ...opts,
    headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export const login = async (email: string, pw: string) => {
  const d = await api('auth.php', { method:'POST', body:JSON.stringify({action:'login',email,password:pw}) });
  token = d.token; localStorage.setItem('mines_token', d.token); return d.user;
};
export const register = async (username: string, email: string, pw: string) => {
  const d = await api('auth.php', { method:'POST', body:JSON.stringify({action:'register',username,email,password:pw}) });
  token = d.token; localStorage.setItem('mines_token', d.token); return d.user;
};
export const logout = () => { token=null; localStorage.removeItem('mines_token'); };

// Game APIs — rows, mines, bet sab yahan se jaata hai
export const startGame = (betAmount: number, mineCount: number, rows: number) =>
  api('start.php', { method:'POST', body:JSON.stringify({ bet_amount:betAmount, mine_count:mineCount, rows }) });

export const revealTile = (sessionId: number, tileIndex: number) =>
  api('reveal.php', { method:'POST', body:JSON.stringify({ session_id:sessionId, tile_index:tileIndex }) });

export const cashOut = (sessionId: number) =>
  api('cashout.php', { method:'POST', body:JSON.stringify({ session_id:sessionId }) });

export const getBalance = () => api('balance.php');
export const getHistory = (limit=20, offset=0) => api(`history.php?limit=${limit}&offset=${offset}`);
export const isLoggedIn = () => !!token;
```

---

## 4. What's Connected to DB

| Setting | DB Table | Column | Validated In |
|---|---|---|---|
| **Rows** (3-5) | `game_sessions` | `rows_count` | `start.php` (from `game_config.min_rows/max_rows`) |
| **Mines** (1 to grid-1) | `game_sessions` | `mine_count` | `start.php` (must be < gridSize) |
| **Bet Amount** | `game_sessions` | `bet_amount` | `start.php` (from `game_config.min_bet/max_bet`) |
| **Grid Size** | `game_sessions` | `grid_size` | Auto: `rows × 5` |
| **Balance** | `users` | `balance` | `start.php` deducts, `cashout.php`/`reveal.php` credits |
| **Multiplier** | `game_sessions` | `current_multiplier` | Server-calculated in `reveal.php` |
| **User Stats** | `user_stats` | all columns | Updated on every game end |
| **House Edge %** | `game_config` | `house_edge_target` | Read by rigging engine |
| **History** | `game_history` | all | Recorded on every game end |

---

## 5. Game Flow

```
1. POST /start.php { bet_amount:200, mine_count:3, rows:4 }
   → Validates: rows 3-5, mines < 20, bet 10-50000, balance >= bet
   → Creates session: grid_size=20, deducts balance
   → Returns: { session_id:42, grid_size:20, balance:9800 }

2. POST /reveal.php { session_id:42, tile_index:7 }
   → Loads user_stats (total_wagered, wins, losses, streaks)
   → Runs 5-layer rigging engine
   → Returns: { result:"diamond", multiplier:1.12, profit:24 }

3. POST /reveal.php { session_id:42, tile_index:3 }
   → Rigging: user just won, potential payout high → crash probability ↑
   → Returns: { result:"mine", mine_positions:[3,8,11], game_over:true }

4. OR: POST /cashout.php { session_id:42 }
   → Returns: { winnings:224, profit:24, balance:10024 }
```

---

## 6. Deployment Checklist

- [ ] Run `schema.sql` on MySQL
- [ ] Change `JWT_SECRET` in `config.php`
- [ ] Change admin password
- [ ] Set DB credentials in `config.php`
- [ ] Restrict CORS to frontend domain
- [ ] HTTPS only
- [ ] Rate limit (5 req/sec/user)
- [ ] Set `API_BASE` in frontend `api.ts`
- [ ] Test with Postman before connecting frontend
