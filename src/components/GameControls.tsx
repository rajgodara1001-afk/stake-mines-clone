import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GameControlsProps {
  betAmount: number;
  mineCount: number;
  balance: number;
  gameStatus: "idle" | "playing" | "won" | "lost";
  currentMultiplier: number;
  currentProfit: number;
  nextMultiplier: number;
  onBetChange: (amount: number) => void;
  onMineCountChange: (count: number) => void;
  onStart: () => void;
  onCashOut: () => void;
  revealedCount: number;
}

export function GameControls({
  betAmount,
  mineCount,
  balance,
  gameStatus,
  currentMultiplier,
  currentProfit,
  nextMultiplier,
  onBetChange,
  onMineCountChange,
  onStart,
  onCashOut,
  revealedCount,
}: GameControlsProps) {
  const isPlaying = gameStatus === "playing";

  return (
    <div className="bg-card rounded-xl p-5 space-y-5 border border-border w-full max-w-[320px]">
      {/* Balance */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
        <p className="text-2xl font-bold font-mono text-game-gold">
          ₹{balance.toLocaleString("en-IN")}
        </p>
      </div>

      {/* Bet Amount */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Bet Amount
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBetChange(betAmount / 2)}
            disabled={isPlaying}
            className="px-3 py-2 bg-secondary rounded-md text-sm text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            ½
          </button>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => onBetChange(Number(e.target.value))}
            disabled={isPlaying}
            className="flex-1 bg-muted rounded-md px-3 py-2 text-center font-mono text-foreground border-none outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={() => onBetChange(betAmount * 2)}
            disabled={isPlaying}
            className="px-3 py-2 bg-secondary rounded-md text-sm text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            2×
          </button>
        </div>
      </div>

      {/* Mine Count */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Mines ({mineCount})
        </label>
        <input
          type="range"
          min={1}
          max={24}
          value={mineCount}
          onChange={(e) => onMineCountChange(Number(e.target.value))}
          disabled={isPlaying}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>24</span>
        </div>
      </div>

      {/* Multiplier Info */}
      {isPlaying && (
        <div className="bg-muted rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current</span>
            <span className={cn("font-mono font-bold", currentMultiplier > 1 ? "text-game-win" : "text-foreground")}>
              {currentMultiplier}×
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Next</span>
            <span className="font-mono text-foreground">{nextMultiplier}×</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Profit</span>
            <span className={cn("font-mono font-bold", currentProfit > 0 ? "text-game-win" : "text-foreground")}>
              {currentProfit > 0 ? "+" : ""}₹{currentProfit.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Game result */}
      {(gameStatus === "won" || gameStatus === "lost") && (
        <div className={cn(
          "rounded-lg p-3 text-center font-bold text-lg",
          gameStatus === "won" ? "bg-game-win/20 text-game-win" : "bg-game-lose/20 text-game-lose"
        )}>
          {gameStatus === "won"
            ? `+₹${(betAmount * currentMultiplier - betAmount).toFixed(2)} Won!`
            : `−₹${betAmount.toFixed(2)} Lost!`}
        </div>
      )}

      {/* Action Button */}
      {isPlaying ? (
        <Button
          onClick={onCashOut}
          disabled={revealedCount === 0}
          className="w-full h-12 text-lg font-bold bg-game-win hover:bg-game-win/90 text-primary-foreground"
        >
          Cash Out ({currentMultiplier}×)
        </Button>
      ) : (
        <Button
          onClick={onStart}
          disabled={betAmount > balance || betAmount <= 0}
          className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Bet
        </Button>
      )}
    </div>
  );
}
