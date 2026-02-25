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
  const isWon = gameStatus === "won";
  const gameOver = gameStatus === "won" || gameStatus === "lost";

  return (
    <div className="relative w-full h-full">
      {/* Grid container */}
      <div className="grid grid-cols-5 grid-rows-5 gap-[5px] sm:gap-2 w-full h-full p-2 sm:p-3 rounded-2xl glass-surface">
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

      {/* Result overlay */}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-float-up">
          <div className={cn(
            "rounded-2xl px-8 py-5 text-center backdrop-blur-xl",
            "border shadow-2xl",
            isWon
              ? "border-game-win/40 bg-[hsl(225_25%_6%/0.88)] shadow-[0_0_40px_hsl(145_72%_44%/0.15)]"
              : "border-game-lose/40 bg-[hsl(225_25%_6%/0.88)] shadow-[0_0_40px_hsl(0_75%_55%/0.15)]"
          )}>
            {/* Shine effect on win */}
            {isWon && (
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[hsl(0_0%_100%/0.06)] to-transparent"
                     style={{ animation: 'win-shine 1.5s ease-in-out 0.3s' }} />
              </div>
            )}
            <p className={cn(
              "text-4xl font-extrabold font-mono tracking-tight text-shadow-glow",
              isWon ? "text-game-win" : "text-game-lose"
            )}>
              {isWon ? `${currentMultiplier}×` : "0.00×"}
            </p>
            <div className="w-12 h-px bg-muted-foreground/15 mx-auto my-2.5" />
            <p className={cn(
              "text-base font-mono font-bold",
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
