import { useMinesGame } from "@/hooks/useMinesGame";
import { MinesGrid } from "@/components/MinesGrid";
import { MinesSelector } from "@/components/MinesSelector";
import { Button } from "@/components/ui/button";
import { Bomb } from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const game = useMinesGame();
  const isPlaying = game.gameStatus === "playing";
  const isDisabled = game.gameStatus !== "playing";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bomb className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground text-lg">Mines</span>
        </div>
        <div className="bg-secondary rounded-full px-4 py-1.5 flex items-center gap-2">
          <span className="font-mono text-sm text-foreground font-semibold">
            ₹{game.balance.toLocaleString("en-IN")}
          </span>
          <span className="text-game-gold text-xs">💰</span>
        </div>
      </header>

      {/* Grid area - takes main space */}
      <div className="flex-1 flex items-center justify-center px-3 py-4">
        <div className="w-full max-w-[380px]">
          <MinesGrid
            grid={game.grid}
            onTileClick={game.revealTile}
            disabled={isDisabled}
            gameStatus={game.gameStatus}
            currentMultiplier={game.currentMultiplier}
            betAmount={game.betAmount}
          />
        </div>
      </div>

      {/* Bottom controls panel - fixed at bottom like Stake */}
      <div className="bg-card border-t border-border px-4 pt-3 pb-5 space-y-3">
        {/* Multiplier bar when playing */}
        {isPlaying && game.revealed.size > 0 && (
          <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Current</span>
              <span className="font-mono font-bold text-game-win text-sm">
                {game.currentMultiplier}×
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Next</span>
              <span className="font-mono text-foreground text-sm">
                {game.nextMultiplier}×
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Profit</span>
              <span className={cn("font-mono font-bold text-sm", game.currentProfit > 0 ? "text-game-win" : "text-foreground")}>
                +₹{game.currentProfit.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Mines selector */}
        <MinesSelector
          value={game.mineCount}
          onChange={game.setMineCount}
          disabled={isPlaying}
        />

        {/* Bet Amount */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground uppercase tracking-widest">
              Bet Amount
            </label>
            <span className="text-xs text-muted-foreground">
              ₹{game.betAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={game.betAmount}
              onChange={(e) => game.setBetAmount(Number(e.target.value))}
              disabled={isPlaying}
              className="flex-1 bg-muted rounded-lg px-3 py-2.5 font-mono text-foreground text-sm border-none outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={() => game.setBetAmount(game.betAmount / 2)}
              disabled={isPlaying}
              className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors border border-border"
            >
              ½
            </button>
            <button
              onClick={() => game.setBetAmount(game.betAmount * 2)}
              disabled={isPlaying}
              className="px-4 py-2.5 bg-secondary rounded-lg text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors border border-border"
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
            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
          >
            Cash Out ({game.currentMultiplier}×)
          </Button>
        ) : (
          <Button
            onClick={game.startGame}
            disabled={game.betAmount > game.balance || game.betAmount <= 0}
            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
          >
            Bet
          </Button>
        )}
      </div>
    </div>
  );
};

export default Index;
