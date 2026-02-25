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
        "relative aspect-square rounded-lg transition-all duration-200 border border-border",
        "flex items-center justify-center overflow-hidden",
        !isRevealed && !disabled && "bg-game-tile hover:bg-game-tile-hover hover:scale-105 cursor-pointer active:scale-95",
        !isRevealed && disabled && "bg-game-tile opacity-60 cursor-not-allowed",
        state === "diamond" && "bg-game-win/20 tile-glow-green animate-tile-reveal",
        state === "mine" && "bg-game-lose/20 tile-glow-red animate-tile-shake"
      )}
    >
      {state === "hidden" && (
        <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
      )}
      {state === "diamond" && (
        <img src={diamondImg} alt="Diamond" className="w-3/4 h-3/4 object-contain drop-shadow-lg" />
      )}
      {state === "mine" && (
        <img src={mineImg} alt="Mine" className="w-3/4 h-3/4 object-contain drop-shadow-lg" />
      )}
    </button>
  );
}
