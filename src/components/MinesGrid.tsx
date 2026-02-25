import { TileState } from "@/hooks/useMinesGame";
import { MinesTile } from "./MinesTile";
import { cn } from "@/lib/utils";

interface MinesGridProps {
  grid: TileState[];
  rows: number;
  onTileClick: (index: number) => void;
  disabled: boolean;
  gameStatus: "idle" | "playing" | "won" | "lost";
  currentMultiplier: number;
  betAmount: number;
}

const rowsClass: Record<number, string> = {
  3: "grid-rows-3",
  4: "grid-rows-4",
  5: "grid-rows-5",
};

export function MinesGrid({ grid, rows, onTileClick, disabled, gameStatus, currentMultiplier, betAmount }: MinesGridProps) {
  const showOverlay = gameStatus === "won" || gameStatus === "lost";
  const isWon = gameStatus === "won";
  const gameOver = gameStatus === "won" || gameStatus === "lost";

  return (
    <div className="relative w-full h-full">
      <div className={cn(
        "grid grid-cols-5 gap-1.5 sm:gap-2.5 w-full h-full p-2.5 sm:p-4",
        "rounded-2xl sm:rounded-3xl",
        "grid-container",
        rowsClass[rows] || "grid-rows-3",
        gameStatus === "lost" && "grid-container-lost"
      )}>
        {grid.map((tile, i) => (
          <MinesTile
            key={i}
            state={tile}
            index={i}
            onClick={onTileClick}
            disabled={disabled}
            gameOver={gameOver}
          />
        ))}
      </div>

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-float-up z-20">
          <div className={cn(
            "rounded-3xl px-10 py-6 text-center relative overflow-hidden",
            "border-2 backdrop-blur-2xl",
            isWon
              ? "border-game-win/50 bg-[hsl(225_28%_4%/0.92)] shadow-[0_0_60px_hsl(145_72%_44%/0.2),0_0_120px_hsl(145_72%_44%/0.08)]"
              : "border-game-lose/50 bg-[hsl(225_28%_4%/0.92)] shadow-[0_0_60px_hsl(0_75%_55%/0.2),0_0_120px_hsl(0_75%_55%/0.08)]"
          )}>
            {isWon && (
              <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                <div className="absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-[hsl(0_0%_100%/0.08)] to-transparent animate-shine-sweep" />
              </div>
            )}
            <p className={cn(
              "text-5xl font-extrabold font-mono tracking-tight",
              isWon ? "text-game-win text-shadow-glow" : "text-game-lose text-shadow-glow"
            )}>
              {isWon ? `${currentMultiplier}×` : "0.00×"}
            </p>
            <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent mx-auto my-3" />
            <p className={cn(
              "text-lg font-mono font-bold",
              isWon ? "text-game-win" : "text-game-lose"
            )}>
              {isWon
                ? `+₹${(betAmount * currentMultiplier - betAmount).toFixed(0)}`
                : `-₹${betAmount.toFixed(0)}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
