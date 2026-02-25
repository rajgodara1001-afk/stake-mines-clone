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

const GRID_SIZE = 25; // 5x5

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
  // House edge ~1%
  return Math.round(multiplier * 0.99 * 100) / 100;
}

function generateMines(count: number): Set<number> {
  const mines = new Set<number>();
  while (mines.size < count) {
    mines.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return mines;
}

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
    const mines = generateMines(state.mineCount);
    setState((prev) => ({
      ...prev,
      grid: Array(GRID_SIZE).fill("hidden"),
      minePositions: mines,
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

      const newRevealed = new Set(prev.revealed);
      newRevealed.add(index);
      const newGrid = [...prev.grid];

      if (prev.minePositions.has(index)) {
        // Hit a mine - reveal all
        newGrid[index] = "mine";
        prev.minePositions.forEach((pos) => {
          newGrid[pos] = "mine";
        });
        newRevealed.forEach((pos) => {
          if (!prev.minePositions.has(pos)) newGrid[pos] = "diamond";
        });
        return {
          ...prev,
          grid: newGrid,
          revealed: newRevealed,
          gameStatus: "lost",
          currentMultiplier: 0,
          currentProfit: -prev.betAmount,
        };
      }

      newGrid[index] = "diamond";
      const safeRevealed = Array.from(newRevealed).filter(
        (i) => !prev.minePositions.has(i)
      ).length;
      const multiplier = calculateMultiplier(prev.mineCount, safeRevealed);
      const profit = prev.betAmount * multiplier - prev.betAmount;

      // Check if all safe tiles revealed
      const totalSafe = GRID_SIZE - prev.mineCount;
      if (safeRevealed >= totalSafe) {
        return {
          ...prev,
          grid: newGrid,
          revealed: newRevealed,
          gameStatus: "won",
          currentMultiplier: multiplier,
          currentProfit: profit,
          balance: prev.balance + prev.betAmount * multiplier,
        };
      }

      return {
        ...prev,
        grid: newGrid,
        revealed: newRevealed,
        gameStatus: "playing",
        currentMultiplier: multiplier,
        currentProfit: profit,
      };
    });
  }, []);

  const cashOut = useCallback(() => {
    setState((prev) => {
      if (prev.gameStatus !== "playing" || prev.revealed.size === 0) return prev;
      const winnings = prev.betAmount * prev.currentMultiplier;
      // Reveal all mines
      const newGrid = [...prev.grid];
      prev.minePositions.forEach((pos) => {
        newGrid[pos] = "mine";
      });
      return {
        ...prev,
        grid: newGrid,
        gameStatus: "won",
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
    Array.from(state.revealed).filter((i) => !state.minePositions.has(i)).length + 1
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
