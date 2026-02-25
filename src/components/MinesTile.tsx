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
        "relative rounded-xl sm:rounded-2xl transition-all duration-200 select-none",
        "flex items-center justify-center overflow-hidden",
        "aspect-square",
        // Hidden - playable: 3D layered look
        !isRevealed && !disabled &&
          "tile-3d cursor-pointer hover:tile-3d-hover active:scale-[0.92] group",
        // Hidden - disabled
        !isRevealed && disabled && !gameOver &&
          "tile-3d opacity-25 cursor-not-allowed",
        !isRevealed && disabled && gameOver &&
          "tile-3d opacity-40 cursor-default",
        // Diamond revealed
        state === "diamond" &&
          "tile-diamond animate-tile-reveal",
        // Mine revealed
        state === "mine" &&
          "tile-mine animate-tile-shake"
      )}
    >
      {/* Hidden tile inner design */}
      {state === "hidden" && (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-[15%] right-[15%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-[hsl(0_0%_100%/0.12)] to-transparent" />
          {/* Center star/sparkle */}
          <div className="relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors duration-200">
              <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
          </div>
          {/* Bottom shadow bar */}
          <div className="absolute bottom-0 left-[10%] right-[10%] h-[3px] rounded-full bg-[hsl(0_0%_0%/0.4)]" />
        </div>
      )}

      {/* Diamond */}
      {state === "diamond" && (
        <div className="relative flex items-center justify-center w-full h-full">
          {/* Glow background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(145_72%_44%/0.15)_0%,transparent_70%)]" />
          <img
            src={diamondImg}
            alt="Diamond"
            className="w-[60%] h-[60%] object-contain drop-shadow-[0_0_12px_hsl(145_72%_44%/0.6)] z-10"
          />
          {/* Pulse ring */}
          <div className="absolute inset-[10%] rounded-full border-2 border-game-win/40 animate-ping opacity-30" />
        </div>
      )}

      {/* Mine */}
      {state === "mine" && (
        <div className="relative flex items-center justify-center w-full h-full">
          {/* Red glow background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(0_75%_55%/0.2)_0%,transparent_70%)]" />
          <img
            src={mineImg}
            alt="Mine"
            className="w-[60%] h-[60%] object-contain drop-shadow-[0_0_12px_hsl(0_75%_55%/0.6)] z-10"
          />
          {/* Red flash overlay */}
          <div className="absolute inset-0 bg-game-lose/10 rounded-xl sm:rounded-2xl animate-pulse" />
        </div>
      )}
    </button>
  );
}
