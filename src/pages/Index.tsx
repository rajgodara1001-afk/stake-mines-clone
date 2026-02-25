import { useMinesGame } from "@/hooks/useMinesGame";
import { MinesGrid } from "@/components/MinesGrid";
import { Bomb, Minus, Plus, Wallet, Gem, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_BETS = [50, 100, 200, 500, 1000];
const MINE_OPTIONS = [1, 3, 5, 10, 15, 20, 24];

const Index = () => {
  const game = useMinesGame();
  const isPlaying = game.gameStatus === "playing";
  const isIdle = game.gameStatus === "idle";

  return (
    <div className="h-[100dvh] bg-game-bg grid grid-rows-[auto_1fr_auto] overflow-hidden">
      {/* Header - Sleek dark bar */}
      <header className="flex items-center justify-between px-4 py-2.5 header-bar">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/25 shadow-[0_0_15px_hsl(145_72%_44%/0.15)]">
            <Bomb className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <span className="font-extrabold text-foreground text-base tracking-tight block leading-tight">MINES</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em]">Pro Edition</span>
          </div>
        </div>
        <div className="balance-chip">
          <Wallet className="w-3.5 h-3.5 text-game-gold" />
          <span className="font-mono text-sm text-foreground font-bold">
            ₹{game.balance.toLocaleString("en-IN")}
          </span>
        </div>
      </header>

      {/* Grid area */}
      <div className="min-h-0 flex-1 flex items-stretch justify-center p-2 sm:p-3">
        <div className="w-full max-w-[500px]">
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

      {/* Bottom controls - Casino grade */}
      <div className="controls-panel px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Live stats during game */}
        {isPlaying && game.revealed.size > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2.5 animate-float-up">
            {[
              { label: "Multiplier", value: `${game.currentMultiplier}×`, icon: TrendingUp, accent: true },
              { label: "Next", value: `${game.nextMultiplier}×`, icon: Gem, accent: false },
              { label: "Profit", value: `+₹${game.currentProfit.toFixed(0)}`, icon: Wallet, accent: game.currentProfit > 0 },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className="flex items-center gap-1 justify-center mb-0.5">
                  <stat.icon className="w-2.5 h-2.5 text-muted-foreground" />
                  <p className="text-[8px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">{stat.label}</p>
                </div>
                <p className={cn(
                  "font-mono font-extrabold text-sm",
                  stat.accent ? "text-game-win text-shadow-glow" : "text-foreground"
                )}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mines selector */}
        <div className="mb-2">
          <label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1.5 block flex items-center gap-1">
            <Bomb className="w-3 h-3" />
            Mines
          </label>
          <div className="flex gap-1.5">
            {MINE_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => game.setMineCount(count)}
                disabled={isPlaying}
                className={cn(
                  "flex-1 h-8 sm:h-9 rounded-xl text-xs font-bold transition-all duration-200",
                  game.mineCount === count
                    ? "mine-btn-active"
                    : "mine-btn-inactive",
                  isPlaying && "opacity-25 cursor-not-allowed"
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Bet amount */}
        <div className="mb-2.5">
          <label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1.5 block">
            Bet Amount
          </label>
          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              onClick={() => game.setBetAmount(Math.max(10, game.betAmount - 50))}
              disabled={isPlaying}
              className="bet-adjust-btn"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-game-gold text-xs font-mono font-bold">₹</span>
              <input
                type="number"
                value={game.betAmount}
                onChange={(e) => game.setBetAmount(Number(e.target.value))}
                disabled={isPlaying}
                className="bet-input"
              />
            </div>
            <button
              onClick={() => game.setBetAmount(game.betAmount + 50)}
              disabled={isPlaying}
              className="bet-adjust-btn"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Quick bets */}
          <div className="flex gap-1">
            <button
              onClick={() => game.setBetAmount(Math.max(10, Math.floor(game.betAmount / 2)))}
              disabled={isPlaying}
              className="quick-bet-btn"
            >
              ½
            </button>
            {QUICK_BETS.map((amt) => (
              <button
                key={amt}
                onClick={() => game.setBetAmount(amt)}
                disabled={isPlaying}
                className={cn(
                  game.betAmount === amt ? "quick-bet-btn-active" : "quick-bet-btn"
                )}
              >
                {amt >= 1000 ? `${amt/1000}K` : amt}
              </button>
            ))}
            <button
              onClick={() => game.setBetAmount(Math.min(game.balance, game.betAmount * 2))}
              disabled={isPlaying}
              className="quick-bet-btn"
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
              "w-full h-11 sm:h-12 rounded-2xl text-sm font-extrabold transition-all duration-200",
              "cashout-btn",
              "disabled:opacity-30 disabled:shadow-none"
            )}
          >
            <Zap className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            CASH OUT • {game.currentMultiplier}× (₹{(game.betAmount * game.currentMultiplier).toFixed(0)})
          </button>
        ) : (
          <button
            onClick={game.startGame}
            disabled={game.betAmount > game.balance || game.betAmount <= 0}
            className={cn(
              "w-full h-11 sm:h-12 rounded-2xl text-sm font-extrabold transition-all duration-200",
              "start-btn",
              "disabled:opacity-30 disabled:shadow-none"
            )}
          >
            BET ₹{game.betAmount.toLocaleString("en-IN")}
          </button>
        )}
      </div>
    </div>
  );
};

export default Index;
