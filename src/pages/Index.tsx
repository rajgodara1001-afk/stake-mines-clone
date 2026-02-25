import { useMinesGame } from "@/hooks/useMinesGame";
import { MinesGrid } from "@/components/MinesGrid";
import { Button } from "@/components/ui/button";
import { Bomb, Minus, Plus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_BETS = [50, 100, 200, 500, 1000];
const MINE_OPTIONS = [1, 3, 5, 10, 15, 20, 24];

const Index = () => {
  const game = useMinesGame();
  const isPlaying = game.gameStatus === "playing";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bomb className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground text-base tracking-tight">Mines</span>
        </div>
        <div className="bg-muted rounded-full px-3.5 py-1.5 flex items-center gap-2 border border-border">
          <Wallet className="w-3.5 h-3.5 text-game-gold" />
          <span className="font-mono text-sm text-foreground font-semibold">
            ₹{game.balance.toLocaleString("en-IN")}
          </span>
        </div>
      </header>

      {/* Grid area */}
      <div className="flex-1 flex items-center justify-center px-3 py-3">
        <div className="w-full max-w-[360px]">
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
      <div className="bg-card border-t border-border px-4 pt-3 pb-5 space-y-3">
        {/* Live stats bar */}
        {isPlaying && game.revealed.size > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Current", value: `${game.currentMultiplier}×`, color: "text-game-win" },
              { label: "Next", value: `${game.nextMultiplier}×`, color: "text-foreground" },
              { label: "Profit", value: `+₹${game.currentProfit.toFixed(0)}`, color: game.currentProfit > 0 ? "text-game-win" : "text-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="bg-muted rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className={cn("font-mono font-bold text-sm", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mines selector - scrollable chips */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            Mines
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {MINE_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => game.setMineCount(count)}
                disabled={isPlaying}
                className={cn(
                  "flex-shrink-0 min-w-[42px] h-9 rounded-lg text-sm font-semibold transition-all",
                  game.mineCount === count
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
                  isPlaying && "opacity-40 cursor-not-allowed"
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount - improved with quick bet chips */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            Bet Amount
          </label>
          {/* Input row */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => game.setBetAmount(Math.max(10, game.betAmount - 50))}
              disabled={isPlaying}
              className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
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
                className="w-full bg-muted rounded-lg pl-7 pr-3 py-2.5 font-mono text-foreground text-sm text-center border-none outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
              />
            </div>
            <button
              onClick={() => game.setBetAmount(game.betAmount + 50)}
              disabled={isPlaying}
              className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {/* Quick bet chips */}
          <div className="flex gap-1.5">
            <button
              onClick={() => game.setBetAmount(Math.max(10, Math.floor(game.betAmount / 2)))}
              disabled={isPlaying}
              className="flex-1 h-8 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 disabled:opacity-40 transition-colors border border-border"
            >
              ½
            </button>
            {QUICK_BETS.slice(0, 3).map((amt) => (
              <button
                key={amt}
                onClick={() => game.setBetAmount(amt)}
                disabled={isPlaying}
                className={cn(
                  "flex-1 h-8 rounded-md text-xs font-semibold transition-colors border border-border disabled:opacity-40",
                  game.betAmount === amt
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                ₹{amt}
              </button>
            ))}
            <button
              onClick={() => game.setBetAmount(Math.min(game.balance, game.betAmount * 2))}
              disabled={isPlaying}
              className="flex-1 h-8 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 disabled:opacity-40 transition-colors border border-border"
            >
              2×
            </button>
          </div>
        </div>

        {/* Action Button */}
        {isPlaying ? (
          <Button
            onClick={game.cashOut}
            disabled={game.revealed.size === 0}
            className="w-full h-12 text-base font-bold bg-game-win hover:bg-game-win/90 text-primary-foreground rounded-xl shadow-lg shadow-game-win/25"
          >
            Cash Out • {game.currentMultiplier}× (₹{(game.betAmount * game.currentMultiplier).toFixed(0)})
          </Button>
        ) : (
          <Button
            onClick={game.startGame}
            disabled={game.betAmount > game.balance || game.betAmount <= 0}
            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/25"
          >
            Bet ₹{game.betAmount.toLocaleString("en-IN")}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Index;
