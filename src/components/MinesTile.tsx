import { TileState } from "@/hooks/useMinesGame";
import { cn } from "@/lib/utils";

interface MinesTileProps {
  state: TileState;
  index: number;
  onClick: (index: number) => void;
  disabled: boolean;
  gameOver: boolean;
}

function DiamondIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-[70%] h-[70%] sm:w-[75%] sm:h-[75%] drop-shadow-[0_0_12px_hsl(145_72%_44%/0.8)]">
      {/* Diamond body */}
      <defs>
        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(145, 85%, 65%)" />
          <stop offset="40%" stopColor="hsl(155, 80%, 50%)" />
          <stop offset="100%" stopColor="hsl(165, 72%, 35%)" />
        </linearGradient>
        <linearGradient id="diamondShine" x1="0%" y1="0%" x2="50%" y2="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <filter id="diamondGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Main diamond shape */}
      <polygon points="32,4 58,24 32,60 6,24" fill="url(#diamondGrad)" filter="url(#diamondGlow)" />
      {/* Top facet */}
      <polygon points="32,4 58,24 32,28 6,24" fill="hsl(145, 90%, 60%)" opacity="0.9" />
      {/* Left facet */}
      <polygon points="6,24 32,28 32,60" fill="hsl(155, 70%, 40%)" opacity="0.8" />
      {/* Right facet */}
      <polygon points="58,24 32,28 32,60" fill="hsl(160, 65%, 45%)" opacity="0.7" />
      {/* Shine */}
      <polygon points="32,4 44,24 32,28 18,24" fill="url(#diamondShine)" />
      {/* Sparkle lines */}
      <line x1="32" y1="0" x2="32" y2="6" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <line x1="16" y1="10" x2="19" y2="14" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="48" y1="10" x2="45" y2="14" stroke="white" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function MineIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-[70%] h-[70%] sm:w-[75%] sm:h-[75%] drop-shadow-[0_0_12px_hsl(0_75%_55%/0.8)]">
      <defs>
        <radialGradient id="mineGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="hsl(0, 0%, 45%)" />
          <stop offset="60%" stopColor="hsl(0, 0%, 25%)" />
          <stop offset="100%" stopColor="hsl(0, 0%, 12%)" />
        </radialGradient>
        <radialGradient id="mineGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="hsl(0, 85%, 55%)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(0, 75%, 45%)" stopOpacity="0" />
        </radialGradient>
        <filter id="mineFilter">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Glow behind */}
      <circle cx="32" cy="34" r="22" fill="url(#mineGlow)" />
      {/* Spikes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 32 + Math.cos(rad) * 14;
        const y1 = 34 + Math.sin(rad) * 14;
        const x2 = 32 + Math.cos(rad) * 22;
        const y2 = 34 + Math.sin(rad) * 22;
        return (
          <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(0, 0%, 20%)" strokeWidth="4" strokeLinecap="round" />
        );
      })}
      {/* Main body */}
      <circle cx="32" cy="34" r="15" fill="url(#mineGrad)" filter="url(#mineFilter)" stroke="hsl(0, 0%, 15%)" strokeWidth="1" />
      {/* Inner circle highlight */}
      <circle cx="28" cy="30" r="5" fill="hsl(0, 0%, 50%)" opacity="0.3" />
      {/* Red danger indicator */}
      <circle cx="32" cy="34" r="5" fill="hsl(0, 80%, 50%)" opacity="0.9" />
      <circle cx="32" cy="34" r="3" fill="hsl(0, 85%, 60%)" opacity="0.7" />
      {/* Fuse */}
      <path d="M 32 19 Q 36 12, 40 10" stroke="hsl(35, 80%, 50%)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Spark */}
      <circle cx="41" cy="9" r="2.5" fill="hsl(45, 100%, 60%)" opacity="0.9" />
      <circle cx="41" cy="9" r="4" fill="hsl(30, 100%, 50%)" opacity="0.3" />
    </svg>
  );
}

export function MinesTile({ state, index, onClick, disabled, gameOver }: MinesTileProps) {
  const isRevealed = state !== "hidden";

  return (
    <button
      onClick={() => onClick(index)}
      disabled={disabled || isRevealed}
      className={cn(
        "relative rounded-[14px] sm:rounded-2xl lg:rounded-[18px] transition-all duration-200 select-none",
        "flex items-center justify-center overflow-hidden",
        "aspect-square w-full",
        !isRevealed && !disabled &&
          "tile-3d cursor-pointer hover:tile-3d-hover active:scale-[0.92] group",
        !isRevealed && disabled && !gameOver &&
          "tile-3d opacity-25 cursor-not-allowed",
        !isRevealed && disabled && gameOver &&
          "tile-3d opacity-40 cursor-default",
        state === "diamond" &&
          "tile-diamond animate-tile-reveal",
        state === "mine" &&
          "tile-mine animate-tile-shake"
      )}
    >
      {/* Hidden tile */}
      {state === "hidden" && (
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="absolute top-0 left-[15%] right-[15%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-[hsl(0_0%_100%/0.12)] to-transparent" />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors duration-200 sm:w-6 sm:h-6">
            <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor"/>
          </svg>
          <div className="absolute bottom-0 left-[10%] right-[10%] h-[3px] rounded-full bg-[hsl(0_0%_0%/0.4)]" />
        </div>
      )}

      {/* Diamond */}
      {state === "diamond" && (
        <div className="relative flex items-center justify-center w-full h-full animate-diamond-pop">
          <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(145_72%_44%/0.2)_0%,transparent_70%)]" />
          <DiamondIcon />
          <div className="absolute top-[10%] right-[15%] w-1.5 h-1.5 bg-game-win rounded-full animate-sparkle opacity-60" />
          <div className="absolute bottom-[15%] left-[12%] w-1 h-1 bg-game-win rounded-full animate-sparkle-delayed opacity-40" />
        </div>
      )}

      {/* Mine */}
      {state === "mine" && (
        <div className="relative flex items-center justify-center w-full h-full animate-mine-pop">
          <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(0_75%_55%/0.25)_0%,transparent_70%)]" />
          <MineIcon />
          <div className="absolute inset-0 bg-game-lose/8 rounded-[14px] sm:rounded-2xl animate-pulse" />
        </div>
      )}
    </button>
  );
}
