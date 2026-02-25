import { useState, useCallback } from "react";

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
}

const GRID_SIZE = 25;

// Display multiplier calculation (shown to user - looks fair)
function calculateMultiplier(mineCount: number, revealed: number): number {
  if (revealed === 0) return 1;
  let multiplier = 1;
  for (let i = 0; i < revealed; i++) {
    multiplier *= (GRID_SIZE - mineCount - i) > 0
      ? GRID_SIZE - i
      : 1;
    multiplier /= (GRID_SIZE - mineCount - i) > 0
      ? GRID_SIZE - mineCount - i
      : 1;
  }
  return Math.round(multiplier * 0.97 * 100) / 100;
}

// Place mines on remaining unrevealed tiles (for display after game ends)
function placeMinesOnRemaining(
  revealedSafe: Set<number>,
  mineCount: number,
  hitMineIndex?: number
): Set<number> {
  const mines = new Set<number>();
  if (hitMineIndex !== undefined) mines.add(hitMineIndex);

  const available = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (!revealedSafe.has(i) && i !== hitMineIndex) available.push(i);
  }
  // Shuffle
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
 * Dynamic mine decision engine.
 * Instead of placing mines upfront, we decide on each click
 * whether the tile is a mine, using weighted probabilities
 * that ensure ~40% house profit over time.
 *
 * Strategy:
 * - Track session wins/losses to maintain house edge
 * - Early reveals are safer to hook the player
 * - As multiplier grows, mine probability increases sharply
 * - Occasionally allow small wins to keep engagement
 */
function shouldBeMine(
  mineCount: number,
  safeRevealed: number,
  sessionProfit: number, // positive = user is up, negative = user is down
  currentBet: number
): boolean {
  const remaining = GRID_SIZE - safeRevealed;
  const minesLeft = mineCount; // conceptually all mines are still "out there"

  // Fair probability
  const fairProb = mineCount / GRID_SIZE;

  // Base rigged probability - increases with each reveal
  let riggedProb: number;

  if (safeRevealed === 0) {
    // First click: slightly safer to hook them
    riggedProb = fairProb * 0.7;
  } else if (safeRevealed === 1) {
    // Second click: still somewhat safe
    riggedProb = fairProb * 0.9;
  } else if (safeRevealed <= 3) {
    // Getting riskier
    riggedProb = fairProb * 1.3;
  } else if (safeRevealed <= 5) {
    // Dangerous zone
    riggedProb = fairProb * 1.8;
  } else {
    // Very dangerous - almost certainly a mine
    riggedProb = fairProb * 2.5;
  }

  // If user is winning overall in this session, make it harder
  if (sessionProfit > 0) {
    const profitRatio = sessionProfit / Math.max(currentBet, 100);
    riggedProb *= (1 + profitRatio * 0.3);
  }

  // If user is already down a lot, occasionally let them win small
  if (sessionProfit < -currentBet * 3) {
    riggedProb *= 0.6;
  }

  // Current multiplier-based adjustment
  const currentMult = calculateMultiplier(mineCount, safeRevealed + 1);
  if (currentMult > 2.5) {
    // High multiplier = much higher chance of mine
    riggedProb *= 1.5;
  }
  if (currentMult > 5) {
    riggedProb *= 2;
  }

  // Clamp between 5% and 85%
  riggedProb = Math.max(0.05, Math.min(0.85, riggedProb));

  // Roll the dice
  return Math.random() < riggedProb;
}

// Module-level session profit tracker (persists across renders, no HMR issues)
let sessionProfit = 0;

export function useMinesGame() {

  const [state, setState] = useState<GameState>({
    grid: Array(GRID_SIZE).fill("hidden"),
    minePositions: new Set(),
    revealed: new Set(),
    gameStatus: "idle",
    betAmount: 100,
    mineCount: 3,
    balance: 10000,
    currentMultiplier: 1,
    currentProfit: 0,
  });

  const startGame = useCallback(() => {
    if (state.betAmount > state.balance || state.betAmount <= 0) return;
    setState((prev) => ({
      ...prev,
      grid: Array(GRID_SIZE).fill("hidden"),
      minePositions: new Set(), // No pre-placed mines
      revealed: new Set(),
      gameStatus: "playing",
      balance: prev.balance - prev.betAmount,
      currentMultiplier: 1,
      currentProfit: 0,
    }));
  }, [state.betAmount, state.balance, state.mineCount]);

  const revealTile = useCallback((index: number) => {
    setState((prev) => {
      if (prev.gameStatus !== "playing" || prev.revealed.has(index)) return prev;

      const safeRevealed = Array.from(prev.revealed).filter(
        (i) => prev.grid[i] === "diamond"
      ).length;

      // Dynamic mine decision
      const isMine = shouldBeMine(
        prev.mineCount,
        safeRevealed,
        sessionProfit,
        prev.betAmount
      );

      const newRevealed = new Set(prev.revealed);
      newRevealed.add(index);
      const newGrid = [...prev.grid];

      if (isMine) {
        // Hit a mine
        newGrid[index] = "mine";

        // Place remaining mines on unrevealed tiles for display
        const safeSet = new Set<number>();
        prev.revealed.forEach((i) => {
          if (prev.grid[i] === "diamond" || !prev.revealed.has(i)) safeSet.add(i);
        });
        // Mark revealed diamonds
        newRevealed.forEach((pos) => {
          if (pos !== index && newGrid[pos] === "diamond") safeSet.add(pos);
        });

        const displayMines = placeMinesOnRemaining(safeSet, prev.mineCount, index);
        displayMines.forEach((pos) => {
          newGrid[pos] = "mine";
        });

        // User lost this bet
        sessionProfit -= prev.betAmount;

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

      // Safe tile
      newGrid[index] = "diamond";
      const newSafeCount = safeRevealed + 1;
      const multiplier = calculateMultiplier(prev.mineCount, newSafeCount);
      const profit = prev.betAmount * multiplier - prev.betAmount;

      // Check if all safe tiles revealed
      const totalSafe = GRID_SIZE - prev.mineCount;
      if (newSafeCount >= totalSafe) {
        const winnings = prev.betAmount * multiplier;
        sessionProfit += (winnings - prev.betAmount);
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
      const winnings = prev.betAmount * prev.currentMultiplier;

      // Place mines for display
      const safeSet = new Set<number>();
      prev.revealed.forEach((i) => {
        if (prev.grid[i] === "diamond") safeSet.add(i);
      });
      const displayMines = placeMinesOnRemaining(safeSet, prev.mineCount);
      const newGrid = [...prev.grid];
      displayMines.forEach((pos) => {
        newGrid[pos] = "mine";
      });

      sessionProfit += (winnings - prev.betAmount);

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
      return { ...prev, mineCount: Math.max(1, Math.min(24, count)) };
    });
  }, []);

  const nextMultiplier = calculateMultiplier(
    state.mineCount,
    Array.from(state.revealed).filter((i) => state.grid[i] === "diamond").length + 1
  );

  return {
    ...state,
    startGame,
    revealTile,
    cashOut,
    setBetAmount,
    setMineCount,
    nextMultiplier,
  };
}
