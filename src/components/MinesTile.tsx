import { TileState } from "@/hooks/useMinesGame";
import diamondImg from "@/assets/diamond.png";
import mineImg from "@/assets/mine.png";
import { cn } from "@/lib/utils";

interface MinesTileProps {
  state: TileState;
  index: number;
  onClick: (index: number) => void;
  disabled: boolean;
  gameOver: boolean;
}

export function MinesTile({ state, index, onClick, disabled, gameOver }: MinesTileProps) {
  const isRevealed = state !== "hidden";

  return (
    <button
      onClick={() => onClick(index)}
      disabled={disabled || isRevealed}
      className={cn(
        "relative aspect-square rounded-xl transition-all duration-150 select-none",
        "flex items-center justify-center overflow-hidden",
        // Hidden - playable
        !isRevealed && !disabled &&
          "bg-game-tile hover:bg-game-tile-hover active:bg-game-tile-active active:scale-[0.92] cursor-pointer tile-idle-glow hover:scale-[1.03]",
        // Hidden - disabled (game over, show dimmed)
        !isRevealed && disabled && !gameOver &&
          "bg-game-tile opacity-30 cursor-not-allowed",
        !isRevealed && disabled && gameOver &&
          "bg-game-tile opacity-50 cursor-default",
        // Diamond revealed
        state === "diamond" &&
          "bg-gradient-to-br from-[hsl(145_72%_44%/0.15)] to-[hsl(145_72%_44%/0.05)] tile-glow-green animate-tile-reveal",
        // Mine revealed
        state === "mine" &&
          "bg-gradient-to-br from-[hsl(0_75%_55%/0.15)] to-[hsl(0_75%_55%/0.05)] tile-glow-red animate-tile-shake"
      )}
    >
      {/* Hidden dot indicator */}
      {state === "hidden" && (
        <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
      )}

      {/* Diamond */}
      {state === "diamond" && (
        <div className="relative">
          <img
            src={diamondImg}
            alt="Diamond"
            className="w-[55%] h-[55%] mx-auto object-contain drop-shadow-[0_0_8px_hsl(145_72%_44%/0.5)]"
          />
          {/* Pulse ring effect */}
          <div className="absolute inset-0 rounded-full border border-game-win/30" 
               style={{ animation: 'pulse-ring 0.6s ease-out forwards' }} />
        </div>
      )}

      {/* Mine */}
      {state === "mine" && (
        <img
          src={mineImg}
          alt="Mine"
          className="w-[55%] h-[55%] object-contain drop-shadow-[0_0_8px_hsl(0_75%_55%/0.5)]"
        />
      )}
    </button>
  );
}
