# Mines Game — Complete PHP + MySQL Backend

> **IMPORTANT**: Saari game logic (mine decide karna, multiplier, balance) SERVER pe hogi. Frontend sirf UI render karega. Client pe koi game decision nahi — warna user cheat karega.

---

## Architecture

```
React Frontend → HTTP JSON API → PHP Backend → MySQL Database
```

| Frontend Action | API Endpoint | Method |
|---|---|---|
| Register | `/api/auth.php` | POST |
| Login | `/api/auth.php` | POST |
| Start game | `/api/start.php` | POST |
| Click tile | `/api/reveal.php` | POST |
| Cash out | `/api/cashout.php` | POST |
| Get balance | `/api/balance.php` | GET |
| Game history | `/api/history.php` | GET |
| Admin ops | `/api/admin.php` | POST/GET |

---

## 1. MySQL Schema (`schema.sql`)

```sql
CREATE DATABASE IF NOT EXISTS mines_game;
USE mines_game;

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

CREATE TABLE game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    mine_count INT NOT NULL,
    grid_size INT NOT NULL DEFAULT 15,
    rows_count INT NOT NULL DEFAULT 3,
    revealed_tiles JSON DEFAULT '[]',
    safe_count INT DEFAULT 0,
    current_multiplier DECIMAL(10,4) DEFAULT 1.0000,
    status ENUM('active','won','lost','cashed_out') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    mine_count INT NOT NULL,
    grid_size INT NOT NULL,
    tiles_revealed INT DEFAULT 0,
    result ENUM('win','loss') NOT NULL,
    multiplier DECIMAL(10,4) NOT NULL,
    profit DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
('base_house_edge','0.03','Base edge on multiplier (3%)',NOW()),
('max_mine_probability','0.90','Max mine probability cap',NOW()),
('min_mine_probability','0.03','Min mine probability floor',NOW());

-- Default admin (password: admin123 — CHANGE THIS!)
INSERT INTO users (username,email,password_hash,balance,role) VALUES
('admin','admin@mines.com','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',999999,'admin');
INSERT INTO user_stats (user_id) VALUES (1);

CREATE VIEW global_stats AS
SELECT COUNT(*) as total_games,
    SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as total_wins,
    SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as total_losses,
    SUM(bet_amount) as total_wagered,
    SUM(CASE WHEN result='win' THEN bet_amount*multiplier ELSE 0 END) as total_paid_out,
    ROUND((SUM(bet_amount)-SUM(CASE WHEN result='win' THEN bet_amount*multiplier ELSE 0 END))/NULLIF(SUM(bet_amount),0)*100,2) as house_profit_percent
FROM game_history;
```

---

## 2. PHP Files

### `config.php`

```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') { http_response_code(200); exit; }

define('DB_HOST','localhost');
define('DB_NAME','mines_game');
define('DB_USER','root');
define('DB_PASS','');
define('JWT_SECRET','CHANGE-THIS-SECRET-KEY-IN-PRODUCTION');
define('JWT_EXPIRY',86400*7);

function getDB(): PDO {
    static $pdo=null;
    if(!$pdo) {
        $pdo=new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",DB_USER,DB_PASS,[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false
        ]);
    }
    return $pdo;
}

function getConfigValue(string $k, string $d=''): string {
    $s=getDB()->prepare("SELECT config_value FROM game_config WHERE config_key=?");
    $s->execute([$k]); $r=$s->fetch();
    return $r?$r['config_value']:$d;
}

function jsonSuccess(array $d, int $c=200) { http_response_code($c); echo json_encode(['success'=>true,...$d]); exit; }
function jsonError(string $m, int $c=400) { http_response_code($c); echo json_encode(['success'=>false,'error'=>$m]); exit; }

function generateToken(int $uid): string {
    $h=base64_encode(json_encode(['typ'=>'JWT','alg'=>'HS256']));
    $p=base64_encode(json_encode(['user_id'=>$uid,'exp'=>time()+JWT_EXPIRY,'iat'=>time()]));
    $s=base64_encode(hash_hmac('sha256',"$h.$p",JWT_SECRET,true));
    return "$h.$p.$s";
}

function verifyToken(string $t): ?array {
    $parts=explode('.',$t);
    if(count($parts)!==3) return null;
    [$h,$p,$s]=$parts;
    $expected=base64_encode(hash_hmac('sha256',"$h.$p",JWT_SECRET,true));
    if(!hash_equals($expected,$s)) return null;
    $d=json_decode(base64_decode($p),true);
    return ($d && $d['exp']>=time()) ? $d : null;
}

function requireAuth(): int {
    $h=$_SERVER['HTTP_AUTHORIZATION']??'';
    if(!preg_match('/Bearer\s+(.+)/',$h,$m)) jsonError('Auth required',401);
    $d=verifyToken($m[1]);
    if(!$d) jsonError('Invalid token',401);
    return $d['user_id'];
}

function getRequestBody(): array {
    return json_decode(file_get_contents('php://input'),true)?:[];
}
```

### `auth.php`

```php
<?php
require_once 'config.php';
$body=getRequestBody();
$action=$body['action']??'';

if($action==='register') {
    $u=trim($body['username']??''); $e=trim($body['email']??''); $pw=$body['password']??'';
    if(strlen($u)<3) jsonError('Username min 3 chars');
    if(!filter_var($e,FILTER_VALIDATE_EMAIL)) jsonError('Invalid email');
    if(strlen($pw)<6) jsonError('Password min 6 chars');
    $db=getDB();
    $s=$db->prepare("SELECT id FROM users WHERE email=? OR username=?"); $s->execute([$e,$u]);
    if($s->fetch()) jsonError('Already exists');
    $db->beginTransaction();
    $s=$db->prepare("INSERT INTO users(username,email,password_hash)VALUES(?,?,?)");
    $s->execute([$u,$e,password_hash($pw,PASSWORD_DEFAULT)]);
    $id=(int)$db->lastInsertId();
    $db->prepare("INSERT INTO user_stats(user_id)VALUES(?)")->execute([$id]);
    $db->commit();
    jsonSuccess(['token'=>generateToken($id),'user'=>['id'=>$id,'username'=>$u,'balance'=>10000]],201);
} elseif($action==='login') {
    $e=trim($body['email']??''); $pw=$body['password']??'';
    if(!$e||!$pw) jsonError('Email & password required');
    $db=getDB();
    $s=$db->prepare("SELECT id,username,password_hash,balance,is_active FROM users WHERE email=?");
    $s->execute([$e]); $u=$s->fetch();
    if(!$u||!password_verify($pw,$u['password_hash'])) jsonError('Invalid credentials',401);
    if(!$u['is_active']) jsonError('Account disabled',403);
    $db->prepare("UPDATE users SET last_login=NOW() WHERE id=?")->execute([$u['id']]);
    jsonSuccess(['token'=>generateToken((int)$u['id']),'user'=>['id'=>$u['id'],'username'=>$u['username'],'balance'=>(float)$u['balance']]]);
} else jsonError('Use action: register or login');
```

### `start.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $body=getRequestBody();
$bet=(float)($body['bet_amount']??0); $mines=(int)($body['mine_count']??3); $rows=(int)($body['rows']??3);
$minBet=(float)getConfigValue('min_bet','10'); $maxBet=(float)getConfigValue('max_bet','50000');
if($bet<$minBet) jsonError("Min bet ₹$minBet");
if($bet>$maxBet) jsonError("Max bet ₹$maxBet");
if($rows<3||$rows>5) jsonError('Rows 3-5 only');
$gs=$rows*5;
if($mines<1||$mines>=$gs) jsonError('Invalid mine count');
$db=getDB();
$s=$db->prepare("SELECT id FROM game_sessions WHERE user_id=? AND status='active'");
$s->execute([$userId]); if($s->fetch()) jsonError('Finish current game first');
$db->beginTransaction();
$s=$db->prepare("SELECT balance FROM users WHERE id=? FOR UPDATE"); $s->execute([$userId]); $u=$s->fetch();
if(!$u||$u['balance']<$bet) { $db->rollBack(); jsonError('Insufficient balance'); }
$db->prepare("UPDATE users SET balance=balance-? WHERE id=?")->execute([$bet,$userId]);
$s=$db->prepare("INSERT INTO game_sessions(user_id,bet_amount,mine_count,grid_size,rows_count)VALUES(?,?,?,?,?)");
$s->execute([$userId,$bet,$mines,$gs,$rows]); $sid=(int)$db->lastInsertId();
$s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]); $bal=(float)$s->fetch()['balance'];
$db->commit();
jsonSuccess(['session_id'=>$sid,'grid_size'=>$gs,'rows'=>$rows,'mine_count'=>$mines,'bet_amount'=>$bet,'balance'=>$bal]);
```

### `reveal.php` — CORE RIGGING ENGINE

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $body=getRequestBody();
$sid=(int)($body['session_id']??0); $ti=(int)($body['tile_index']??-1);
if(!$sid) jsonError('Session ID required'); if($ti<0) jsonError('Invalid tile');

$db=getDB(); $db->beginTransaction();
try {
    $s=$db->prepare("SELECT * FROM game_sessions WHERE id=? AND user_id=? AND status='active' FOR UPDATE");
    $s->execute([$sid,$userId]); $ses=$s->fetch();
    if(!$ses) { $db->rollBack(); jsonError('No active session'); }
    if($ti>=$ses['grid_size']) { $db->rollBack(); jsonError('Invalid tile index'); }
    $rev=json_decode($ses['revealed_tiles'],true)?:[];
    if(in_array($ti,$rev)) { $db->rollBack(); jsonError('Already revealed'); }

    $s=$db->prepare("SELECT * FROM user_stats WHERE user_id=?"); $s->execute([$userId]); $us=$s->fetch();

    $isMine=shouldBeMine($ses['mine_count'],$ses['safe_count'],$ses['bet_amount'],$ses['grid_size'],$us);

    if($isMine) {
        $mines=[$ti]; $avail=[];
        for($i=0;$i<$ses['grid_size'];$i++) if(!in_array($i,$rev)&&$i!==$ti) $avail[]=$i;
        shuffle($avail);
        for($i=0;count($mines)<$ses['mine_count']&&$i<count($avail);$i++) $mines[]=$avail[$i];

        $db->prepare("UPDATE game_sessions SET status='lost',ended_at=NOW(),revealed_tiles=? WHERE id=?")
           ->execute([json_encode([...$rev,$ti]),$sid]);
        $db->prepare("INSERT INTO game_history(user_id,session_id,bet_amount,mine_count,grid_size,tiles_revealed,result,multiplier,profit)VALUES(?,?,?,?,?,?,'loss',0,?)")
           ->execute([$userId,$sid,$ses['bet_amount'],$ses['mine_count'],$ses['grid_size'],count($rev),-$ses['bet_amount']]);
        $db->prepare("UPDATE user_stats SET total_wagered=total_wagered+?,total_games=total_games+1,total_losses=total_losses+1,consecutive_losses=consecutive_losses+1,consecutive_wins=0,biggest_loss=GREATEST(biggest_loss,?),session_profit=session_profit-?,last_game_at=NOW() WHERE user_id=?")
           ->execute([$ses['bet_amount'],$ses['bet_amount'],$ses['bet_amount'],$userId]);

        $s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]); $bal=(float)$s->fetch()['balance'];
        $db->commit();
        jsonSuccess(['result'=>'mine','tile_index'=>$ti,'mine_positions'=>$mines,'multiplier'=>0,'profit'=>-$ses['bet_amount'],'balance'=>$bal,'game_over'=>true]);
    } else {
        $newRev=[...$rev,$ti]; $sc=$ses['safe_count']+1;
        $mult=calcMult($ses['mine_count'],$sc,$ses['grid_size']);
        $profit=$ses['bet_amount']*$mult-$ses['bet_amount'];
        $totalSafe=$ses['grid_size']-$ses['mine_count'];
        $allDone=($sc>=$totalSafe);

        if($allDone) {
            $win=$ses['bet_amount']*$mult;
            $db->prepare("UPDATE users SET balance=balance+? WHERE id=?")->execute([$win,$userId]);
            $db->prepare("UPDATE game_sessions SET status='won',ended_at=NOW(),safe_count=?,current_multiplier=?,revealed_tiles=? WHERE id=?")
               ->execute([$sc,$mult,json_encode($newRev),$sid]);
            $db->prepare("INSERT INTO game_history(user_id,session_id,bet_amount,mine_count,grid_size,tiles_revealed,result,multiplier,profit)VALUES(?,?,?,?,?,?,'win',?,?)")
               ->execute([$userId,$sid,$ses['bet_amount'],$ses['mine_count'],$ses['grid_size'],$sc,$mult,$profit]);
            statsWin($db,$userId,$ses['bet_amount'],$profit);
        } else {
            $db->prepare("UPDATE game_sessions SET safe_count=?,current_multiplier=?,revealed_tiles=? WHERE id=?")
               ->execute([$sc,$mult,json_encode($newRev),$sid]);
        }

        $s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]); $bal=(float)$s->fetch()['balance'];
        $db->commit();
        jsonSuccess(['result'=>'diamond','tile_index'=>$ti,'multiplier'=>$mult,'profit'=>round($profit,2),'balance'=>$bal,'game_over'=>$allDone,
            'next_multiplier'=>$allDone?null:calcMult($ses['mine_count'],$sc+1,$ses['grid_size'])]);
    }
} catch(Exception $e) { $db->rollBack(); jsonError('Error: '.$e->getMessage(),500); }

function shouldBeMine(int $mc, int $sr, float $bet, int $gs, ?array $us): bool {
    $target=(float)getConfigValue('house_edge_target','0.40');
    $maxP=(float)getConfigValue('max_mine_probability','0.90');
    $minP=(float)getConfigValue('min_mine_probability','0.03');
    $rem=$gs-$sr; $fair=$mc/max($rem,1);

    // Escalating base probability
    if($sr===0) $rp=$fair*0.6;
    elseif($sr===1) $rp=$fair*0.85;
    elseif($sr<=3) $rp=$fair*1.4;
    elseif($sr<=5) $rp=$fair*2.0;
    else $rp=$fair*3.0;

    // Per-user house edge enforcement
    if($us) {
        $tw=(float)$us['total_wagered']; $tp=(float)$us['total_paid_out'];
        if($tw>0) {
            $hp=(($tw-$tp)/$tw)*100; $t=$target*100;
            if($hp<$t-10) $rp*=1.6;
            elseif($hp<$t-5) $rp*=1.3;
            elseif($hp>$t+15) $rp*=0.5;
            elseif($hp>$t+8) $rp*=0.7;
        }
        $ws=(int)$us['consecutive_wins'];
        if($ws>=3) $rp*=2.5; elseif($ws>=2) $rp*=1.8;
        $ls=(int)$us['consecutive_losses'];
        if($ls>=5) $rp*=0.25; elseif($ls>=3) $rp*=0.4;
        $sp=(float)$us['session_profit'];
        if($sp>$bet*3) $rp*=1.4; elseif($sp<-$bet*5) $rp*=0.6;
    }

    // Multiplier & bet size protection
    $cm=calcMult($mc,$sr+1,$gs);
    if($cm>10) $rp*=2.5; elseif($cm>5) $rp*=1.8; elseif($cm>3) $rp*=1.5;
    if($bet>5000) $rp*=1.4; elseif($bet>1000) $rp*=1.2;

    return (mt_rand()/mt_getrandmax()) < max($minP,min($maxP,$rp));
}

function calcMult(int $mc, int $r, int $gs): float {
    if($r===0) return 1.0;
    $max=(float)getConfigValue('max_multiplier','25');
    $edge=(float)getConfigValue('base_house_edge','0.03');
    $m=1.0;
    for($i=0;$i<$r;$i++) { $s=$gs-$mc-$i; if($s>0) $m*=($gs-$i)/$s; }
    return round(min($m*(1-$edge),$max),4);
}

function statsWin(PDO $db, int $uid, float $bet, float $profit) {
    $win=$bet+$profit;
    $db->prepare("UPDATE user_stats SET total_wagered=total_wagered+?,total_paid_out=total_paid_out+?,total_games=total_games+1,total_wins=total_wins+1,consecutive_wins=consecutive_wins+1,consecutive_losses=0,biggest_win=GREATEST(biggest_win,?),session_profit=session_profit+?,last_game_at=NOW() WHERE user_id=?")
       ->execute([$bet,$win,$profit,$profit,$uid]);
}
```

### `cashout.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $body=getRequestBody();
$sid=(int)($body['session_id']??0); if(!$sid) jsonError('Session ID required');
$db=getDB(); $db->beginTransaction();
try {
    $s=$db->prepare("SELECT * FROM game_sessions WHERE id=? AND user_id=? AND status='active' FOR UPDATE");
    $s->execute([$sid,$userId]); $ses=$s->fetch();
    if(!$ses) { $db->rollBack(); jsonError('No active session'); }
    if($ses['safe_count']===0) { $db->rollBack(); jsonError('Reveal at least 1 tile'); }
    $mult=(float)$ses['current_multiplier']; $win=$ses['bet_amount']*$mult; $profit=$win-$ses['bet_amount'];
    $db->prepare("UPDATE users SET balance=balance+? WHERE id=?")->execute([$win,$userId]);
    $rev=json_decode($ses['revealed_tiles'],true)?:[]; $avail=[];
    for($i=0;$i<$ses['grid_size'];$i++) if(!in_array($i,$rev)) $avail[]=$i;
    shuffle($avail); $mines=array_slice($avail,0,$ses['mine_count']);
    $db->prepare("UPDATE game_sessions SET status='cashed_out',ended_at=NOW() WHERE id=?")->execute([$sid]);
    $db->prepare("INSERT INTO game_history(user_id,session_id,bet_amount,mine_count,grid_size,tiles_revealed,result,multiplier,profit)VALUES(?,?,?,?,?,?,'win',?,?)")
       ->execute([$userId,$sid,$ses['bet_amount'],$ses['mine_count'],$ses['grid_size'],$ses['safe_count'],$mult,$profit]);
    $w=$ses['bet_amount']+$profit;
    $db->prepare("UPDATE user_stats SET total_wagered=total_wagered+?,total_paid_out=total_paid_out+?,total_games=total_games+1,total_wins=total_wins+1,consecutive_wins=consecutive_wins+1,consecutive_losses=0,biggest_win=GREATEST(biggest_win,?),session_profit=session_profit+?,last_game_at=NOW() WHERE user_id=?")
       ->execute([$ses['bet_amount'],$w,$profit,$profit,$userId]);
    $s=$db->prepare("SELECT balance FROM users WHERE id=?"); $s->execute([$userId]); $bal=(float)$s->fetch()['balance'];
    $db->commit();
    jsonSuccess(['result'=>'cashed_out','multiplier'=>$mult,'winnings'=>round($win,2),'profit'=>round($profit,2),'balance'=>$bal,'mine_positions'=>$mines]);
} catch(Exception $e) { $db->rollBack(); jsonError('Cashout failed'); }
```

### `balance.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $db=getDB();
$s=$db->prepare("SELECT u.id,u.username,u.balance,us.total_games,us.total_wins,us.total_losses,us.total_wagered FROM users u LEFT JOIN user_stats us ON u.id=us.user_id WHERE u.id=?");
$s->execute([$userId]); $u=$s->fetch();
if(!$u) jsonError('Not found',404);
$s=$db->prepare("SELECT id,bet_amount,mine_count,grid_size,rows_count,revealed_tiles,safe_count,current_multiplier FROM game_sessions WHERE user_id=? AND status='active'");
$s->execute([$userId]); $as=$s->fetch();
jsonSuccess(['user'=>['id'=>$u['id'],'username'=>$u['username'],'balance'=>(float)$u['balance']],
    'stats'=>['total_games'=>(int)($u['total_games']??0),'total_wins'=>(int)($u['total_wins']??0),'total_losses'=>(int)($u['total_losses']??0)],
    'active_session'=>$as?['session_id'=>(int)$as['id'],'bet_amount'=>(float)$as['bet_amount'],'mine_count'=>(int)$as['mine_count'],'grid_size'=>(int)$as['grid_size'],'rows'=>(int)$as['rows_count'],'revealed_tiles'=>json_decode($as['revealed_tiles'],true),'safe_count'=>(int)$as['safe_count'],'current_multiplier'=>(float)$as['current_multiplier']]:null]);
```

### `history.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $limit=min(50,max(1,(int)($_GET['limit']??20))); $offset=max(0,(int)($_GET['offset']??0));
$db=getDB();
$s=$db->prepare("SELECT id,bet_amount,mine_count,grid_size,tiles_revealed,result,multiplier,profit,created_at FROM game_history WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?");
$s->execute([$userId,$limit,$offset]);
jsonSuccess(['history'=>$s->fetchAll()]);
```

### `admin.php`

```php
<?php
require_once 'config.php';
$userId=requireAuth(); $db=getDB();
$s=$db->prepare("SELECT role FROM users WHERE id=?"); $s->execute([$userId]); $u=$s->fetch();
if(!$u||$u['role']!=='admin') jsonError('Admin only',403);
$body=getRequestBody(); $action=$body['action']??$_GET['action']??'';

switch($action) {
    case 'stats': $s=$db->query("SELECT * FROM global_stats"); jsonSuccess(['stats'=>$s->fetch()]); break;
    case 'config': $s=$db->query("SELECT * FROM game_config"); jsonSuccess(['config'=>$s->fetchAll()]); break;
    case 'update_config':
        $k=$body['key']??''; $v=$body['value']??''; if(!$k) jsonError('Key required');
        $db->prepare("UPDATE game_config SET config_value=? WHERE config_key=?")->execute([$v,$k]);
        jsonSuccess(['message'=>'Updated']); break;
    case 'users':
        $s=$db->prepare("SELECT u.id,u.username,u.email,u.balance,u.is_active,us.total_games,us.total_wagered,us.total_paid_out,us.total_wins,us.total_losses FROM users u LEFT JOIN user_stats us ON u.id=us.user_id ORDER BY u.id DESC LIMIT 100");
        $s->execute(); jsonSuccess(['users'=>$s->fetchAll()]); break;
    case 'set_balance':
        $tid=(int)($body['user_id']??0); $nb=(float)($body['balance']??0);
        if(!$tid) jsonError('User ID required');
        $db->prepare("UPDATE users SET balance=? WHERE id=?")->execute([$nb,$tid]);
        jsonSuccess(['message'=>'Balance set']); break;
    case 'toggle_user':
        $tid=(int)($body['user_id']??0); if(!$tid) jsonError('User ID required');
        $db->prepare("UPDATE users SET is_active=NOT is_active WHERE id=?")->execute([$tid]);
        jsonSuccess(['message'=>'Toggled']); break;
    case 'recent_games':
        $s=$db->prepare("SELECT gh.*,u.username FROM game_history gh JOIN users u ON gh.user_id=u.id ORDER BY gh.created_at DESC LIMIT 100");
        $s->execute(); jsonSuccess(['games'=>$s->fetchAll()]); break;
    default: jsonError('Invalid action');
}
```

---

## 3. Frontend API Service (`src/lib/api.ts`)

```typescript
const API_BASE = 'https://your-domain.com/api';
let authToken: string | null = localStorage.getItem('mines_token');

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export const login = async (email: string, password: string) => {
  const d = await apiCall('auth.php', { method: 'POST', body: JSON.stringify({ action: 'login', email, password }) });
  authToken = d.token; localStorage.setItem('mines_token', d.token); return d.user;
};

export const register = async (username: string, email: string, password: string) => {
  const d = await apiCall('auth.php', { method: 'POST', body: JSON.stringify({ action: 'register', username, email, password }) });
  authToken = d.token; localStorage.setItem('mines_token', d.token); return d.user;
};

export const logout = () => { authToken = null; localStorage.removeItem('mines_token'); };
export const startGame = (bet: number, mines: number, rows: number) =>
  apiCall('start.php', { method: 'POST', body: JSON.stringify({ bet_amount: bet, mine_count: mines, rows }) });
export const revealTile = (sessionId: number, tileIndex: number) =>
  apiCall('reveal.php', { method: 'POST', body: JSON.stringify({ session_id: sessionId, tile_index: tileIndex }) });
export const cashOut = (sessionId: number) =>
  apiCall('cashout.php', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) });
export const getBalance = () => apiCall('balance.php');
export const getHistory = (limit = 20, offset = 0) => apiCall(`history.php?limit=${limit}&offset=${offset}`);
export const isLoggedIn = () => !!authToken;
```

---

## 4. Game Flow

```
BET clicked → POST /start.php → { session_id, balance }
Tile clicked → POST /reveal.php → { result: "diamond"|"mine", multiplier, ... }
CASH OUT → POST /cashout.php → { winnings, balance, mine_positions }
Page load → GET /balance.php → { balance, active_session (if any) }
```

---

## 5. Security Checklist

- [ ] Change `JWT_SECRET` in production
- [ ] Change admin password
- [ ] Set correct DB credentials
- [ ] Restrict CORS to frontend domain only
- [ ] HTTPS only
- [ ] Rate limit (5 req/sec per user)
- [ ] Never trust client-side game decisions

---

## 6. Server Structure

```
server/api/
├── config.php
├── auth.php
├── start.php
├── reveal.php   ← Rigging engine
├── cashout.php
├── balance.php
├── history.php
└── admin.php
```
