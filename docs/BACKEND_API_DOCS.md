# Mines Game — Backend API & Database Documentation

## For Frontend & Backend Developers (PHP + MySQL)

---

## 1. Database Schema (MySQL)

### `users` Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(12, 2) DEFAULT 10000.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `games` Table
```sql
CREATE TABLE games (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bet_amount DECIMAL(12, 2) NOT NULL,
    mine_count TINYINT NOT NULL CHECK (mine_count BETWEEN 1 AND 24),
    mine_positions JSON NOT NULL COMMENT 'Array of mine position indexes [0-24]',
    revealed_tiles JSON DEFAULT '[]' COMMENT 'Array of revealed tile indexes',
    multiplier DECIMAL(8, 2) DEFAULT 1.00,
    profit DECIMAL(12, 2) DEFAULT 0.00,
    status ENUM('active', 'won', 'lost') DEFAULT 'active',
    client_seed VARCHAR(64) NOT NULL,
    server_seed VARCHAR(64) NOT NULL,
    server_seed_hash VARCHAR(128) NOT NULL COMMENT 'SHA256 hash shown before game starts for provably fair',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `transactions` Table
```sql
CREATE TABLE transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_id BIGINT NULL,
    type ENUM('bet', 'win', 'deposit', 'withdrawal') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    balance_before DECIMAL(12, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
    INDEX idx_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 2. API Endpoints

### Base URL: `https://yourdomain.com/api/v1`

All responses follow this format:
```json
{
    "success": true|false,
    "data": { ... },
    "message": "string",
    "error": "string (only on failure)"
}
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login & get JWT token |
| GET | `/auth/me` | Get current user info |
| POST | `/auth/logout` | Invalidate token |

**Headers (protected routes):**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

### Game Endpoints

#### `POST /game/start` — Start New Game
**Request:**
```json
{
    "bet_amount": 100,
    "mine_count": 3,
    "client_seed": "user_random_string_123"
}
```
**Response:**
```json
{
    "success": true,
    "data": {
        "game_id": 12345,
        "server_seed_hash": "a1b2c3d4e5...sha256hash",
        "balance": 9900.00,
        "grid_size": 25,
        "mine_count": 3
    }
}
```
**PHP Logic:**
```php
// game/start.php
function startGame($userId, $betAmount, $mineCount, $clientSeed) {
    $pdo = getDB();
    $pdo->beginTransaction();
    
    try {
        // 1. Check balance
        $stmt = $pdo->prepare("SELECT balance FROM users WHERE id = ? FOR UPDATE");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if ($user['balance'] < $betAmount) {
            throw new Exception("Insufficient balance");
        }
        
        // 2. Generate mines (server-side only)
        $serverSeed = bin2hex(random_bytes(32));
        $serverSeedHash = hash('sha256', $serverSeed);
        $minePositions = generateMines($mineCount, 25);
        
        // 3. Deduct balance
        $newBalance = $user['balance'] - $betAmount;
        $pdo->prepare("UPDATE users SET balance = ? WHERE id = ?")
            ->execute([$newBalance, $userId]);
        
        // 4. Create game
        $stmt = $pdo->prepare("
            INSERT INTO games (user_id, bet_amount, mine_count, mine_positions, 
                             client_seed, server_seed, server_seed_hash, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        ");
        $stmt->execute([
            $userId, $betAmount, $mineCount, 
            json_encode($minePositions),
            $clientSeed, $serverSeed, $serverSeedHash
        ]);
        $gameId = $pdo->lastInsertId();
        
        // 5. Log transaction
        logTransaction($pdo, $userId, $gameId, 'bet', -$betAmount, $user['balance'], $newBalance);
        
        $pdo->commit();
        
        return [
            'game_id' => $gameId,
            'server_seed_hash' => $serverSeedHash,
            'balance' => $newBalance,
            'grid_size' => 25,
            'mine_count' => $mineCount
        ];
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function generateMines($count, $gridSize) {
    $mines = [];
    while (count($mines) < $count) {
        $pos = random_int(0, $gridSize - 1);
        if (!in_array($pos, $mines)) {
            $mines[] = $pos;
        }
    }
    return $mines;
}
```

---

#### `POST /game/reveal` — Reveal a Tile
**Request:**
```json
{
    "game_id": 12345,
    "tile_index": 7
}
```
**Response (safe):**
```json
{
    "success": true,
    "data": {
        "result": "diamond",
        "tile_index": 7,
        "multiplier": 1.12,
        "next_multiplier": 1.26,
        "profit": 12.00,
        "revealed_count": 1
    }
}
```
**Response (mine hit):**
```json
{
    "success": true,
    "data": {
        "result": "mine",
        "tile_index": 7,
        "mine_positions": [3, 7, 19],
        "multiplier": 0,
        "profit": -100.00,
        "server_seed": "actual_server_seed_for_verification",
        "balance": 9900.00
    }
}
```
**PHP Logic:**
```php
// game/reveal.php
function revealTile($userId, $gameId, $tileIndex) {
    $pdo = getDB();
    $pdo->beginTransaction();
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM games WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE
        ");
        $stmt->execute([$gameId, $userId]);
        $game = $stmt->fetch();
        
        if (!$game) throw new Exception("Game not found or already completed");
        
        $minePositions = json_decode($game['mine_positions'], true);
        $revealed = json_decode($game['revealed_tiles'], true);
        
        if (in_array($tileIndex, $revealed)) {
            throw new Exception("Tile already revealed");
        }
        
        $revealed[] = $tileIndex;
        
        if (in_array($tileIndex, $minePositions)) {
            // MINE HIT - Game Lost
            $pdo->prepare("
                UPDATE games SET status = 'lost', revealed_tiles = ?, 
                multiplier = 0, profit = ?, completed_at = NOW()
                WHERE id = ?
            ")->execute([json_encode($revealed), -$game['bet_amount'], $gameId]);
            
            $pdo->commit();
            
            return [
                'result' => 'mine',
                'tile_index' => $tileIndex,
                'mine_positions' => $minePositions,
                'multiplier' => 0,
                'profit' => -$game['bet_amount'],
                'server_seed' => $game['server_seed']
            ];
        }
        
        // SAFE - Diamond
        $safeCount = count(array_diff($revealed, $minePositions));
        $multiplier = calculateMultiplier($game['mine_count'], $safeCount);
        $profit = $game['bet_amount'] * $multiplier - $game['bet_amount'];
        
        // Check if all safe tiles found
        $totalSafe = 25 - $game['mine_count'];
        $status = ($safeCount >= $totalSafe) ? 'won' : 'active';
        
        $pdo->prepare("
            UPDATE games SET revealed_tiles = ?, multiplier = ?, profit = ?, 
            status = ? WHERE id = ?
        ")->execute([json_encode($revealed), $multiplier, $profit, $status, $gameId]);
        
        if ($status === 'won') {
            $winnings = $game['bet_amount'] * $multiplier;
            $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
                ->execute([$winnings, $userId]);
        }
        
        $pdo->commit();
        
        return [
            'result' => 'diamond',
            'tile_index' => $tileIndex,
            'multiplier' => $multiplier,
            'next_multiplier' => calculateMultiplier($game['mine_count'], $safeCount + 1),
            'profit' => $profit,
            'revealed_count' => $safeCount
        ];
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function calculateMultiplier($mineCount, $revealed) {
    if ($revealed === 0) return 1;
    $multiplier = 1;
    for ($i = 0; $i < $revealed; $i++) {
        $safe = 25 - $mineCount - $i;
        if ($safe > 0) {
            $multiplier *= (25 - $i) / $safe;
        }
    }
    return round($multiplier * 0.99, 2); // 1% house edge
}
```

---

#### `POST /game/cashout` — Cash Out Current Game
**Request:**
```json
{
    "game_id": 12345
}
```
**Response:**
```json
{
    "success": true,
    "data": {
        "winnings": 112.00,
        "multiplier": 1.12,
        "profit": 12.00,
        "balance": 10012.00,
        "mine_positions": [3, 12, 19],
        "server_seed": "actual_server_seed"
    }
}
```

---

#### `GET /game/history` — Get Game History
**Query:** `?page=1&limit=20`

**Response:**
```json
{
    "success": true,
    "data": {
        "games": [
            {
                "id": 12345,
                "bet_amount": 100,
                "mine_count": 3,
                "multiplier": 1.12,
                "profit": 12.00,
                "status": "won",
                "created_at": "2026-02-25T10:30:00Z"
            }
        ],
        "total": 150,
        "page": 1,
        "per_page": 20
    }
}
```

---

## 3. Frontend Integration Guide

### API Service (Replace local game hook with API calls)

```typescript
// src/services/api.ts
const API_BASE = 'https://yourdomain.com/api/v1';

async function apiCall(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API Error');
    return data.data;
}

export const gameAPI = {
    start: (betAmount: number, mineCount: number) =>
        apiCall('/game/start', {
            method: 'POST',
            body: JSON.stringify({ bet_amount: betAmount, mine_count: mineCount, client_seed: crypto.randomUUID() }),
        }),

    reveal: (gameId: number, tileIndex: number) =>
        apiCall('/game/reveal', {
            method: 'POST',
            body: JSON.stringify({ game_id: gameId, tile_index: tileIndex }),
        }),

    cashout: (gameId: number) =>
        apiCall('/game/cashout', {
            method: 'POST',
            body: JSON.stringify({ game_id: gameId }),
        }),

    history: (page = 1) =>
        apiCall(`/game/history?page=${page}`),
};
```

### Key Integration Points:
1. **Replace `useMinesGame` hook** — Instead of local state, call API on each action
2. **Mine positions are SERVER-SIDE only** — Frontend never knows mine positions until game ends
3. **Balance comes from server** — Don't trust client-side balance
4. **Provably fair** — `server_seed_hash` is shown before game, `server_seed` revealed after

---

## 4. Security Notes

- ⚠️ NEVER send mine positions to frontend during active game
- ⚠️ Use `FOR UPDATE` locks on balance checks to prevent race conditions
- ⚠️ Validate all inputs: bet_amount > 0, mine_count 1-24, tile_index 0-24
- ⚠️ Rate limit API calls (max 5 reveals/second)
- ⚠️ Use prepared statements (PDO) to prevent SQL injection
- ⚠️ JWT tokens should expire in 24h, refresh tokens in 7 days
- ⚠️ Store passwords using `password_hash()` with `PASSWORD_BCRYPT`

---

## 5. Quick SQL Queries

```sql
-- Get user's total profit/loss
SELECT SUM(profit) as total_pnl FROM games WHERE user_id = ? AND status != 'active';

-- Get top winners today
SELECT u.username, SUM(g.profit) as total_profit 
FROM games g JOIN users u ON g.user_id = u.id 
WHERE g.created_at >= CURDATE() AND g.status = 'won'
GROUP BY g.user_id ORDER BY total_profit DESC LIMIT 10;

-- Get game stats
SELECT mine_count, COUNT(*) as total, 
       SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as wins,
       AVG(multiplier) as avg_multiplier
FROM games WHERE user_id = ? GROUP BY mine_count;

-- Active game check (prevent multiple active games)
SELECT id FROM games WHERE user_id = ? AND status = 'active' LIMIT 1;
```
