import { useMinesGame } from "@/hooks/useMinesGame";
import { MinesGrid } from "@/components/MinesGrid";
import { Button } from "@/components/ui/button";
import { Bomb, Minus, Plus, Wallet, Gem, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_BETS = [50, 100, 200, 500];
const MINE_OPTIONS = [1, 3, 5, 10, 15, 20, 24];

const Index = () => {
  const game = useMinesGame();
  const isPlaying = game.gameStatus === "playing";
  const isIdle = game.gameStatus === "idle";

  return (
    <div className="h-[100dvh] bg-game-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 glass-surface border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
            <Bomb className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground text-base tracking-tight">Mines</span>
        </div>
        <div className="glass-surface rounded-full px-3.5 py-1.5 flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-game-gold" />
          <span className="font-mono text-sm text-foreground font-bold">
            ₹{game.balance.toLocaleString("en-IN")}
          </span>
        </div>
      </header>

      {/* Grid area - centered */}
      <div className="flex-1 flex items-center justify-center px-3 py-2 min-h-0">
        <div className="w-full max-w-[380px] sm:max-w-[420px]">
          <MinesGrid
            grid={game.grid}
            onTileClick={game.revealTile}
            disabled={game.gameStatus !== "playing"}
            gameStatus={game.gameStatus}
            currentMultiplier={game.currentMultiplier}
            betAmount={game.betAmount}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex-shrink-0 glass-surface border-t border-border/50 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Live stats - only during game */}
        {isPlaying && game.revealed.size > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3 animate-float-up">
            {[
              { label: "Multiplier", value: `${game.currentMultiplier}×`, accent: true },
              { label: "Next", value: `${game.nextMultiplier}×`, accent: false },
              { label: "Profit", value: `+₹${game.currentProfit.toFixed(0)}`, accent: game.currentProfit > 0 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl px-2 py-2 text-center bg-secondary/60 border border-border/40">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">{stat.label}</p>
                <p className={cn(
                  "font-mono font-bold text-sm mt-0.5",
                  stat.accent ? "text-game-win text-shadow-glow" : "text-foreground"
                )}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mines selector */}
        <div className="mb-2.5">
          <label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1.5 block">
            <Gem className="w-3 h-3 inline-block mr-1 -mt-0.5" />
            Mines Count
          </label>
          <div className="flex gap-1.5">
            {MINE_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => game.setMineCount(count)}
                disabled={isPlaying}
                className={cn(
                  "flex-1 h-9 rounded-lg text-xs font-bold transition-all duration-150",
                  game.mineCount === count
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(145_72%_44%/0.3)] scale-[1.05]"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80",
                  isPlaying && "opacity-30 cursor-not-allowed"
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Bet amount */}
        <div className="mb-3">
          <label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1.5 block">
            Bet Amount
          </label>
          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              onClick={() => game.setBetAmount(Math.max(10, game.betAmount - 50))}
              disabled={isPlaying}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 active:scale-95 disabled:opacity-30 transition-all"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">₹</span>
              <input
                type="number"
                value={game.betAmount}
                onChange={(e) => game.setBetAmount(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full bg-secondary rounded-xl pl-7 pr-3 py-2.5 font-mono text-foreground text-sm text-center border border-border/40 outline-none focus:border-primary/50 focus:shadow-[0_0_0_2px_hsl(145_72%_44%/0.1)] disabled:opacity-30 transition-all"
              />
            </div>
            <button
              onClick={() => game.setBetAmount(game.betAmount + 50)}
              disabled={isPlaying}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 active:scale-95 disabled:opacity-30 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {/* Quick bets */}
          <div className="flex gap-1.5">
            <button
              onClick={() => game.setBetAmount(Math.max(10, Math.floor(game.betAmount / 2)))}
              disabled={isPlaying}
              className="flex-1 h-8 rounded-lg bg-secondary/70 text-muted-foreground text-[11px] font-bold hover:text-foreground hover:bg-secondary active:scale-95 disabled:opacity-30 transition-all border border-border/30"
            >
              ½
            </button>
            {QUICK_BETS.map((amt) => (
              <button
                key={amt}
                onClick={() => game.setBetAmount(amt)}
                disabled={isPlaying}
                className={cn(
                  "flex-1 h-8 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-30 border",
                  game.betAmount === amt
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-secondary/70 text-muted-foreground hover:text-foreground border-border/30 hover:bg-secondary"
                )}
              >
                {amt}
              </button>
            ))}
            <button
              onClick={() => game.setBetAmount(Math.min(game.balance, game.betAmount * 2))}
              disabled={isPlaying}
              className="flex-1 h-8 rounded-lg bg-secondary/70 text-muted-foreground text-[11px] font-bold hover:text-foreground hover:bg-secondary active:scale-95 disabled:opacity-30 transition-all border border-border/30"
            >
              2×
            </button>
          </div>
        </div>

        {/* Action button */}
        {isPlaying ? (
          <button
            onClick={game.cashOut}
            disabled={game.revealed.size === 0}
            className={cn(
              "w-full h-12 rounded-xl text-base font-extrabold transition-all duration-200",
              "bg-game-win text-primary-foreground btn-glow-green",
              "hover:brightness-110 active:scale-[0.98]",
              "disabled:opacity-40 disabled:shadow-none"
            )}
          >
            <Zap className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Cash Out • {game.currentMultiplier}× (₹{(game.betAmount * game.currentMultiplier).toFixed(0)})
          </button>
        ) : (
          <button
            onClick={game.startGame}
            disabled={game.betAmount > game.balance || game.betAmount <= 0}
            className={cn(
              "w-full h-12 rounded-xl text-base font-extrabold transition-all duration-200",
              "bg-primary text-primary-foreground btn-glow-primary",
              "hover:brightness-110 active:scale-[0.98]",
              "disabled:opacity-40 disabled:shadow-none"
            )}
          >
            Bet ₹{game.betAmount.toLocaleString("en-IN")}
          </button>
        )}
      </div>
    </div>
  );
};

export default Index;
