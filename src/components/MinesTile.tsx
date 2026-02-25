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
        "relative aspect-square rounded-lg transition-all duration-150",
        "flex items-center justify-center overflow-hidden",
        !isRevealed && !disabled && "bg-game-tile hover:bg-game-tile-hover active:scale-[0.92] cursor-pointer",
        !isRevealed && disabled && "bg-game-tile opacity-50 cursor-not-allowed",
        state === "diamond" && "bg-game-win/15 tile-glow-green animate-tile-reveal",
        state === "mine" && "bg-game-lose/15 tile-glow-red animate-tile-shake"
      )}
    >
      {state === "hidden" && (
        <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
      )}
      {state === "diamond" && (
        <img src={diamondImg} alt="Diamond" className="w-[70%] h-[70%] object-contain" />
      )}
      {state === "mine" && (
        <img src={mineImg} alt="Mine" className="w-[70%] h-[70%] object-contain" />
      )}
    </button>
  );
}
