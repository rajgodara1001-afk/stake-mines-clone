import { useMinesGame } from "@/hooks/useMinesGame";
import { MinesGrid } from "@/components/MinesGrid";
import { GameControls } from "@/components/GameControls";
import { Bomb } from "lucide-react";

const Index = () => {
  const game = useMinesGame();

  const isDisabled = game.gameStatus !== "playing";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Bomb className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground tracking-tight">Mines</h1>
      </header>

      {/* Game Area */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 p-4 lg:p-8">
        {/* Controls - on top for mobile, left for desktop */}
        <div className="order-2 lg:order-1">
          <GameControls
            betAmount={game.betAmount}
            mineCount={game.mineCount}
            balance={game.balance}
            gameStatus={game.gameStatus}
            currentMultiplier={game.currentMultiplier}
            currentProfit={game.currentProfit}
            nextMultiplier={game.nextMultiplier}
            onBetChange={game.setBetAmount}
            onMineCountChange={game.setMineCount}
            onStart={game.startGame}
            onCashOut={game.cashOut}
            revealedCount={game.revealed.size}
          />
        </div>

        {/* Grid */}
        <div className="order-1 lg:order-2 bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <MinesGrid
            grid={game.grid}
            onTileClick={game.revealTile}
            disabled={isDisabled}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
