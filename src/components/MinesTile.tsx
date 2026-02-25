import { TileState } from "@/hooks/useMinesGame";
import diamondImg from "@/assets/diamond.png";
import mineImg from "@/assets/mine.png";
import { cn } from "@/lib/utils";

interface MinesTileProps {
  state: TileState;
  index: number;
  onClick: (index: number) => void;
  disabled: boolean;
}

export function MinesTile({ state, index, onClick, disabled }: MinesTileProps) {
  const isRevealed = state !== "hidden";

  return (
    <button
      onClick={() => onClick(index)}
      disabled={disabled || isRevealed}
      className={cn(
        "relative aspect-square rounded-xl transition-all duration-200",
        "flex items-center justify-center overflow-hidden",
        // Hidden state
        !isRevealed && !disabled && "bg-game-tile hover:bg-game-tile-hover active:scale-[0.90] cursor-pointer border border-border/50 hover:border-primary/30",
        !isRevealed && disabled && "bg-game-tile opacity-40 cursor-not-allowed border border-border/30",
        // Revealed states
        state === "diamond" && "bg-game-win/10 border border-game-win/30 tile-glow-green animate-tile-reveal",
        state === "mine" && "bg-game-lose/10 border border-game-lose/30 tile-glow-red animate-tile-shake"
      )}
    >
      {state === "hidden" && (
        <div className="w-3 h-3 rounded-full bg-muted-foreground/10" />
      )}
      {state === "diamond" && (
        <img src={diamondImg} alt="Diamond" className="w-[60%] h-[60%] object-contain drop-shadow-lg" />
      )}
      {state === "mine" && (
        <img src={mineImg} alt="Mine" className="w-[60%] h-[60%] object-contain drop-shadow-lg" />
      )}
    </button>
  );
}
