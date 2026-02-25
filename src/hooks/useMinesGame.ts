import { useState, useCallback } from "react";
import {
  getConfig,
  getStats,
  getHouseProfitPercent,
  recordGame,
} from "@/lib/gameConfig";

export type TileState = "hidden" | "diamond" | "mine";

interface GameState {
  grid: TileState[];
  minePositions: Set<number>;
  revealed: Set<number>;
  gameStatus: "idle" | "playing" | "won" | "lost";
  betAmount: number;
  mineCount: number;
  balance: number;
  currentMultiplier: number;
  currentProfit: number;
  rows: number;
}

const COLS = 5;

function getGridSize(rows: number) {
  return rows * COLS;
}

// Display multiplier calculation
function calculateMultiplier(mineCount: number, revealed: number, gridSize: number): number {
  if (revealed === 0) return 1;
  const config = getConfig();
  let multiplier = 1;
  for (let i = 0; i < revealed; i++) {
    const safe = gridSize - mineCount - i;
    if (safe > 0) {
      multiplier *= (gridSize - i) / safe;
    }
  }
  multiplier *= 0.97;
  multiplier = Math.min(multiplier, config.maxMultiplier);
  return Math.round(multiplier * 100) / 100;
}

function placeMinesOnRemaining(
  revealedSafe: Set<number>,
  mineCount: number,
  gridSize: number,
  hitMineIndex?: number
): Set<number> {
  const mines = new Set<number>();
  if (hitMineIndex !== undefined) mines.add(hitMineIndex);

  const available: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    if (!revealedSafe.has(i) && i !== hitMineIndex) available.push(i);
  }
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  for (let i = 0; mines.size < mineCount && i < available.length; i++) {
    mines.add(available[i]);
  }
  return mines;
}

/**
 * Smart Rigging Engine — Decides mine/diamond based on:
 * 
 * 1. CURRENT ROUND: Kitna lagaya hai, kitna jeetega agar safe nikla
 *    → Potential payout = bet × nextMultiplier
 *    → Jitna zyada payout, utna zyada mine chance
 * 
 * 2. CUMULATIVE HISTORY: User ne total kitna lagaya, kitna jeeta
 *    → Agar user overall profit mein hai → mine probability badhao
 *    → Agar user overall loss mein hai → thoda easy karo (hook)
 * 
 * 3. STREAKS: Consecutive wins/losses
 *    → 2+ wins → ab crash karo
 *    → 3+ losses → ek chhota win do (engagement)
 * 
 * 4. HOUSE PROFIT TARGET: 40% maintain karna hai
 *    → Agar house profit < 30% → aggressively crash
 *    → Agar house profit > 55% → ease up
 */
function shouldBeMine(
  mineCount: number,
  safeRevealed: number,
  currentBet: number,
  gridSize: number
): boolean {
  const stats = getStats();
  const config = getConfig();
  const houseProfit = getHouseProfitPercent();
  const target = config.houseEdgeTarget * 100; // e.g. 40

  // === LAYER 1: Fair base probability ===
  const remaining = gridSize - safeRevealed;
  const fairProb = mineCount / Math.max(remaining, 1);

  // First click slightly safe to hook, but not for big bets
  let riggedProb: number;
  const isBigBet = currentBet >= 1000;
  if (safeRevealed === 0) {
    riggedProb = fairProb * (isBigBet ? 0.8 : 0.5);
  } else if (safeRevealed === 1) {
    riggedProb = fairProb * (isBigBet ? 1.2 : 0.8);
  } else {
    // Exponential escalation instead of linear for big bets
    const escalation = isBigBet 
      ? (1 + safeRevealed * 0.5 + Math.pow(safeRevealed, 1.5) * 0.1)
      : (1 + safeRevealed * 0.35);
    riggedProb = fairProb * escalation;
  }

  // === LAYER 2: Current round — potential payout analysis ===
  const nextMult = calculateMultiplier(mineCount, safeRevealed + 1, gridSize);
  const potentialPayout = currentBet * nextMult;
  const potentialProfit = potentialPayout - currentBet;

  // Kitna jeetega relative to bet — yeh sabse important factor hai
  const profitRatio = potentialProfit / Math.max(currentBet, 1);

  if (profitRatio > 8) {
    // 8x+ profit — almost certainly crash
    riggedProb *= 4.0;
  } else if (profitRatio > 4) {
    // 4-8x profit — very likely crash
    riggedProb *= 2.8;
  } else if (profitRatio > 2) {
    // 2-4x profit — increased danger
    riggedProb *= 2.0;
  } else if (profitRatio > 1) {
    // 1-2x profit — getting risky
    riggedProb *= 1.5;
  } else if (profitRatio > 0.5) {
    riggedProb *= 1.2;
  }
  // Under 0.5x profit ratio — let them play (small wins hook them)

  // Absolute payout protection — bade amount nahi jaane dena
  if (potentialPayout > 5000) riggedProb *= 1.5;
  if (potentialPayout > 10000) riggedProb *= 2.0;
  if (potentialPayout > 25000) riggedProb *= 3.0;

  // === LAYER 3: Cumulative user profit/loss ===
  // Only ease up after minimum 5 games to prevent early exploitation
  if (stats.totalWagered > 0) {
    const userNetProfit = stats.totalPaidOut - stats.totalWagered;

    if (userNetProfit > 0) {
      // User is in profit overall — recover house money
      const profitPercent = (userNetProfit / stats.totalWagered) * 100;

      if (profitPercent > 30) {
        riggedProb *= 2.5;
      } else if (profitPercent > 15) {
        riggedProb *= 1.8;
      } else if (profitPercent > 5) {
        riggedProb *= 1.4;
      }
    } else if (stats.totalGames >= 5) {
      // Only ease up after 5+ games — don't give free wins early
      const lossPercent = Math.abs(userNetProfit / stats.totalWagered) * 100;

      if (lossPercent > 60) {
        riggedProb *= 0.5; // Reduced from 0.3 — don't ease too much
      } else if (lossPercent > 45) {
        riggedProb *= 0.7;
      } else if (lossPercent > 35) {
        riggedProb *= 0.85;
      }
    }

    // House profit enforcement — only after 5+ games, pick ONE adjustment (not stacking)
    if (stats.totalGames >= 5) {
      if (houseProfit < target - 15) {
        riggedProb *= 2.0;
      } else if (houseProfit < target - 8) {
        riggedProb *= 1.5;
      } else if (houseProfit > target + 20) {
        riggedProb *= 0.6; // Reduced from 0.4
      } else if (houseProfit > target + 10) {
        riggedProb *= 0.75;
      }
    }
  }

  // === LAYER 4: Win/Loss streak management ===
  if (stats.consecutiveWins >= 4) {
    // 4+ wins in a row — must crash now
    riggedProb *= 3.5;
  } else if (stats.consecutiveWins >= 3) {
    riggedProb *= 2.5;
  } else if (stats.consecutiveWins >= 2) {
    riggedProb *= 1.8;
  }

  if (stats.consecutiveLosses >= 5) {
    // 5+ losses — give them a win, they might leave
    riggedProb *= 0.15;
  } else if (stats.consecutiveLosses >= 4) {
    riggedProb *= 0.25;
  } else if (stats.consecutiveLosses >= 3) {
    riggedProb *= 0.4;
  }

  // === LAYER 5: Bet size risk ===
  // Bade bets pe zyada careful — house ka zyada paisa risk pe
  if (currentBet > 10000) riggedProb *= 1.6;
  else if (currentBet > 5000) riggedProb *= 1.4;
  else if (currentBet > 2000) riggedProb *= 1.2;
  // Chhote bets pe thoda loose raho — user ko confidence aaye
  else if (currentBet <= 50) riggedProb *= 0.8;

  // === FINAL: Clamp between 2% and 92% ===
  riggedProb = Math.max(0.02, Math.min(0.92, riggedProb));

  return Math.random() < riggedProb;
}

export function useMinesGame() {
  const [state, setState] = useState<GameState>({
    grid: Array(getGridSize(3)).fill("hidden"),
    minePositions: new Set(),
    revealed: new Set(),
    gameStatus: "idle",
    betAmount: 100,
    mineCount: 3,
    balance: 10000,
    currentMultiplier: 1,
    currentProfit: 0,
    rows: 3,
  });

  const gridSize = getGridSize(state.rows);
  const maxMines = gridSize - 1;

  const setRows = useCallback((rows: number) => {
    setState((prev) => {
      if (prev.gameStatus === "playing") return prev;
      const newRows = Math.max(3, Math.min(5, rows));
      const newGridSize = getGridSize(newRows);
      const newMineCount = Math.min(prev.mineCount, newGridSize - 1);
      return {
        ...prev,
        rows: newRows,
        grid: Array(newGridSize).fill("hidden"),
        minePositions: new Set(),
        revealed: new Set(),
        mineCount: newMineCount,
        gameStatus: "idle",
        currentMultiplier: 1,
        currentProfit: 0,
      };
    });
  }, []);

  const startGame = useCallback(() => {
    const config = getConfig();
    if (state.betAmount > state.balance || state.betAmount < config.minBet) return;
    if (state.betAmount > config.maxBet) return;

    setState((prev) => ({
      ...prev,
      grid: Array(getGridSize(prev.rows)).fill("hidden"),
      minePositions: new Set(),
      revealed: new Set(),
      gameStatus: "playing",
      balance: prev.balance - prev.betAmount,
      currentMultiplier: 1,
      currentProfit: 0,
    }));
  }, [state.betAmount, state.balance]);

  const revealTile = useCallback((index: number) => {
    setState((prev) => {
      if (prev.gameStatus !== "playing" || prev.revealed.has(index)) return prev;
      const gs = getGridSize(prev.rows);

      const safeRevealed = Array.from(prev.revealed).filter(
        (i) => prev.grid[i] === "diamond"
      ).length;

      const isMine = shouldBeMine(prev.mineCount, safeRevealed, prev.betAmount, gs);

      const newRevealed = new Set(prev.revealed);
      newRevealed.add(index);
      const newGrid = [...prev.grid];

      if (isMine) {
        newGrid[index] = "mine";
        const safeSet = new Set<number>();
        prev.revealed.forEach((i) => {
          if (prev.grid[i] === "diamond") safeSet.add(i);
        });

        const displayMines = placeMinesOnRemaining(safeSet, prev.mineCount, gs, index);
        displayMines.forEach((pos) => { newGrid[pos] = "mine"; });

        recordGame({
          betAmount: prev.betAmount,
          mineCount: prev.mineCount,
          result: "loss",
          multiplier: 0,
          profit: -prev.betAmount,
        });

        return {
          ...prev,
          grid: newGrid,
          minePositions: displayMines,
          revealed: newRevealed,
          gameStatus: "lost" as const,
          currentMultiplier: 0,
          currentProfit: -prev.betAmount,
        };
      }

      newGrid[index] = "diamond";
      const newSafeCount = safeRevealed + 1;
      const multiplier = calculateMultiplier(prev.mineCount, newSafeCount, gs);
      const profit = prev.betAmount * multiplier - prev.betAmount;

      const totalSafe = gs - prev.mineCount;
      if (newSafeCount >= totalSafe) {
        const winnings = prev.betAmount * multiplier;
        recordGame({
          betAmount: prev.betAmount,
          mineCount: prev.mineCount,
          result: "win",
          multiplier,
          profit: winnings - prev.betAmount,
        });
        return {
          ...prev,
          grid: newGrid,
          revealed: newRevealed,
          gameStatus: "won" as const,
          currentMultiplier: multiplier,
          currentProfit: profit,
          balance: prev.balance + winnings,
        };
      }

      return {
        ...prev,
        grid: newGrid,
        revealed: newRevealed,
        gameStatus: "playing" as const,
        currentMultiplier: multiplier,
        currentProfit: profit,
      };
    });
  }, []);

  const cashOut = useCallback(() => {
    setState((prev) => {
      if (prev.gameStatus !== "playing" || prev.revealed.size === 0) return prev;
      const gs = getGridSize(prev.rows);
      const winnings = prev.betAmount * prev.currentMultiplier;

      const safeSet = new Set<number>();
      prev.revealed.forEach((i) => {
        if (prev.grid[i] === "diamond") safeSet.add(i);
      });
      const displayMines = placeMinesOnRemaining(safeSet, prev.mineCount, gs);
      const newGrid = [...prev.grid];
      displayMines.forEach((pos) => { newGrid[pos] = "mine"; });

      recordGame({
        betAmount: prev.betAmount,
        mineCount: prev.mineCount,
        result: "win",
        multiplier: prev.currentMultiplier,
        profit: winnings - prev.betAmount,
      });

      return {
        ...prev,
        grid: newGrid,
        minePositions: displayMines,
        gameStatus: "won" as const,
        balance: prev.balance + winnings,
      };
    });
  }, []);

  const setBetAmount = useCallback((amount: number) => {
    setState((prev) => {
      if (prev.gameStatus === "playing") return prev;
      return { ...prev, betAmount: Math.max(0, amount) };
    });
  }, []);

  const setMineCount = useCallback((count: number) => {
    setState((prev) => {
      if (prev.gameStatus === "playing") return prev;
      const gs = getGridSize(prev.rows);
      return { ...prev, mineCount: Math.max(1, Math.min(gs - 1, count)) };
    });
  }, []);

  const nextMultiplier = calculateMultiplier(
    state.mineCount,
    Array.from(state.revealed).filter((i) => state.grid[i] === "diamond").length + 1,
    gridSize
  );

  return {
    ...state,
    gridSize,
    maxMines,
    startGame,
    revealTile,
    cashOut,
    setBetAmount,
    setMineCount,
    setRows,
    nextMultiplier,
  };
}
