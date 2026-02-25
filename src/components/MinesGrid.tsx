import { TileState } from "@/hooks/useMinesGame";
import { MinesTile } from "./MinesTile";
import { cn } from "@/lib/utils";

interface MinesGridProps {
  grid: TileState[];
  onTileClick: (index: number) => void;
  disabled: boolean;
  gameStatus: "idle" | "playing" | "won" | "lost";
  currentMultiplier: number;
  betAmount: number;
}

export function MinesGrid({ grid, onTileClick, disabled, gameStatus, currentMultiplier, betAmount }: MinesGridProps) {
  const showOverlay = gameStatus === "won" || gameStatus === "lost";

  return (
    <div className="relative w-full">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
        {grid.map((tile, i) => (
          <MinesTile
            key={i}
            state={tile}
            index={i}
            onClick={onTileClick}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Multiplier overlay like Stake */}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={cn(
            "rounded-xl border-2 px-6 py-4 text-center backdrop-blur-sm",
            gameStatus === "won"
              ? "border-game-win bg-background/80"
              : "border-game-lose bg-background/80"
          )}>
            <p className={cn(
              "text-3xl sm:text-4xl font-bold font-mono",
              gameStatus === "won" ? "text-game-win" : "text-game-lose"
            )}>
              {gameStatus === "won" ? `${currentMultiplier}×` : "0.00×"}
            </p>
            <div className="w-12 h-0.5 bg-muted-foreground/30 mx-auto my-2" />
            <p className={cn(
              "text-sm font-mono",
              gameStatus === "won" ? "text-game-win" : "text-game-lose"
            )}>
              {gameStatus === "won"
                ? `+₹${(betAmount * currentMultiplier - betAmount).toFixed(2)}`
                : `-₹${betAmount.toFixed(2)}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
