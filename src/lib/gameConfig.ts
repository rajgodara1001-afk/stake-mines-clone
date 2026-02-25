// Shared game configuration & stats tracking
// Admin panel reads/writes this, game engine reads from it

export interface GameConfig {
  houseEdgeTarget: number; // 0.35-0.60, default 0.40
  maxMultiplier: number;   // cap multiplier payouts
  minBet: number;
  maxBet: number;
}

export interface GameStats {
  totalWagered: number;
  totalPaidOut: number;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  gameHistory: GameHistoryEntry[];
}

export interface GameHistoryEntry {
  id: number;
  timestamp: number;
  betAmount: number;
  mineCount: number;
  result: "win" | "loss";
  multiplier: number;
  profit: number; // positive = user profit, negative = house profit
}

// Module-level singletons
let config: GameConfig = {
  houseEdgeTarget: 0.40,
  maxMultiplier: 25,
  minBet: 10,
  maxBet: 50000,
};

let stats: GameStats = {
  totalWagered: 0,
  totalPaidOut: 0,
  totalGames: 0,
  totalWins: 0,
  totalLosses: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  gameHistory: [],
};

let historyIdCounter = 0;

// Config getters/setters
export function getConfig(): GameConfig {
  return { ...config };
}

export function updateConfig(partial: Partial<GameConfig>) {
  config = { ...config, ...partial };
}

// Stats getters
export function getStats(): GameStats {
  return {
    ...stats,
    gameHistory: [...stats.gameHistory],
  };
}

export function getHouseProfitPercent(): number {
  if (stats.totalWagered === 0) return 0;
  return ((stats.totalWagered - stats.totalPaidOut) / stats.totalWagered) * 100;
}

// Record a completed game
export function recordGame(entry: Omit<GameHistoryEntry, "id" | "timestamp">) {
  historyIdCounter++;
  const fullEntry: GameHistoryEntry = {
    ...entry,
    id: historyIdCounter,
    timestamp: Date.now(),
  };

  stats.totalGames++;
  stats.totalWagered += entry.betAmount;

  if (entry.result === "win") {
    stats.totalPaidOut += entry.betAmount + entry.profit;
    stats.totalWins++;
    stats.consecutiveWins++;
    stats.consecutiveLosses = 0;
  } else {
    stats.totalLosses++;
    stats.consecutiveLosses++;
    stats.consecutiveWins = 0;
  }

  // Keep last 100 entries
  stats.gameHistory.unshift(fullEntry);
  if (stats.gameHistory.length > 100) {
    stats.gameHistory = stats.gameHistory.slice(0, 100);
  }
}

// Reset stats (admin action)
export function resetStats() {
  stats = {
    totalWagered: 0,
    totalPaidOut: 0,
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    gameHistory: [],
  };
}
