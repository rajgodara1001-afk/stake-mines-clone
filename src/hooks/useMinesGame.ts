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

function shouldBeMine(
  mineCount: number,
  safeRevealed: number,
  currentBet: number,
  gridSize: number
): boolean {
  const stats = getStats();
  const config = getConfig();
  const houseProfit = getHouseProfitPercent();
  const target = config.houseEdgeTarget * 100;

  const fairProb = mineCount / (gridSize - safeRevealed);

  let riggedProb: number;
  if (safeRevealed === 0) {
    riggedProb = fairProb * 0.6;
  } else if (safeRevealed === 1) {
    riggedProb = fairProb * 0.85;
  } else if (safeRevealed <= 3) {
    riggedProb = fairProb * 1.4;
  } else if (safeRevealed <= 5) {
    riggedProb = fairProb * 2.0;
  } else {
    riggedProb = fairProb * 3.0;
  }

  if (stats.totalWagered > 0) {
    if (houseProfit < target - 10) riggedProb *= 1.6;
    else if (houseProfit < target - 5) riggedProb *= 1.3;
    else if (houseProfit > target + 15) riggedProb *= 0.5;
    else if (houseProfit > target + 8) riggedProb *= 0.7;
  }

  if (stats.consecutiveWins >= 2) riggedProb *= 1.8;
  if (stats.consecutiveWins >= 3) riggedProb *= 2.0;
  if (stats.consecutiveLosses >= 3) riggedProb *= 0.4;
  if (stats.consecutiveLosses >= 5) riggedProb *= 0.3;

  const currentMult = calculateMultiplier(mineCount, safeRevealed + 1, gridSize);
  if (currentMult > 3) riggedProb *= 1.5;
  if (currentMult > 5) riggedProb *= 1.8;
  if (currentMult > 10) riggedProb *= 2.5;

  if (currentBet > 1000) riggedProb *= 1.2;
  if (currentBet > 5000) riggedProb *= 1.4;

  riggedProb = Math.max(0.03, Math.min(0.90, riggedProb));
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
