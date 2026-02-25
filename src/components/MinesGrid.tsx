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
      <div className="grid grid-cols-5 gap-1.5 w-full p-2 bg-card/50 rounded-2xl border border-border/50">
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

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={cn(
            "rounded-2xl border-2 px-8 py-5 text-center backdrop-blur-md shadow-2xl",
            gameStatus === "won"
              ? "border-game-win/60 bg-background/85"
              : "border-game-lose/60 bg-background/85"
          )}>
            <p className={cn(
              "text-4xl font-bold font-mono",
              gameStatus === "won" ? "text-game-win" : "text-game-lose"
            )}>
              {gameStatus === "won" ? `${currentMultiplier}×` : "0.00×"}
            </p>
            <div className="w-10 h-px bg-muted-foreground/20 mx-auto my-2.5" />
            <p className={cn(
              "text-base font-mono font-semibold",
              gameStatus === "won" ? "text-game-win" : "text-game-lose"
            )}>
              {gameStatus === "won"
                ? `+₹${(betAmount * currentMultiplier - betAmount).toFixed(0)}`
                : `-₹${betAmount.toFixed(0)}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
