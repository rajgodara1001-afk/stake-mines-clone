import { useState, useEffect } from "react";
import {
  getConfig,
  updateConfig,
  getStats,
  getHouseProfitPercent,
  resetStats,
  type GameConfig,
  type GameStats,
} from "@/lib/gameConfig";
import { cn } from "@/lib/utils";
import {
  Shield,
  TrendingUp,
  DollarSign,
  Gamepad2,
  Trophy,
  XCircle,
  Settings,
  BarChart3,
  History,
  RefreshCw,
} from "lucide-react";

const Admin = () => {
  const [config, setConfig] = useState<GameConfig>(getConfig());
  const [stats, setStats] = useState<GameStats>(getStats());
  const [houseProfit, setHouseProfit] = useState(getHouseProfitPercent());

  // Auto-refresh stats every second
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getStats());
      setHouseProfit(getHouseProfitPercent());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (key: keyof GameConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateConfig({ [key]: value });
  };

  const handleReset = () => {
    if (confirm("Reset all stats? This cannot be undone.")) {
      resetStats();
      setStats(getStats());
      setHouseProfit(0);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center border border-destructive/25">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Mines Game Control Center</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 hover:bg-destructive/20 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Stats
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats Dashboard */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold">Live Dashboard</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "House Profit",
                value: `${houseProfit.toFixed(1)}%`,
                icon: TrendingUp,
                color: houseProfit >= 35 ? "text-game-win" : "text-game-lose",
                bg: houseProfit >= 35 ? "border-game-win/20" : "border-game-lose/20",
              },
              {
                label: "Total Wagered",
                value: `₹${stats.totalWagered.toLocaleString("en-IN")}`,
                icon: DollarSign,
                color: "text-game-gold",
                bg: "border-game-gold/20",
              },
              {
                label: "Total Paid Out",
                value: `₹${stats.totalPaidOut.toLocaleString("en-IN")}`,
                icon: DollarSign,
                color: "text-muted-foreground",
                bg: "border-border",
              },
              {
                label: "House Revenue",
                value: `₹${(stats.totalWagered - stats.totalPaidOut).toLocaleString("en-IN")}`,
                icon: TrendingUp,
                color: stats.totalWagered - stats.totalPaidOut >= 0 ? "text-game-win" : "text-game-lose",
                bg: "border-border",
              },
              {
                label: "Total Games",
                value: stats.totalGames.toString(),
                icon: Gamepad2,
                color: "text-foreground",
                bg: "border-border",
              },
              {
                label: "Total Wins",
                value: stats.totalWins.toString(),
                icon: Trophy,
                color: "text-game-win",
                bg: "border-game-win/20",
              },
              {
                label: "Total Losses",
                value: stats.totalLosses.toString(),
                icon: XCircle,
                color: "text-game-lose",
                bg: "border-game-lose/20",
              },
              {
                label: "Win Rate",
                value: stats.totalGames > 0 ? `${((stats.totalWins / stats.totalGames) * 100).toFixed(1)}%` : "0%",
                icon: BarChart3,
                color: "text-muted-foreground",
                bg: "border-border",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-2xl p-4 bg-card border",
                  stat.bg
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                  <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                </div>
                <p className={cn("text-xl font-extrabold font-mono", stat.color)}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Settings */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold">Game Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* House Edge Target */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <label className="text-sm font-semibold mb-1 block">House Edge Target</label>
              <p className="text-xs text-muted-foreground mb-3">
                Target profit percentage. Algorithm adjusts dynamically.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="25"
                  max="65"
                  value={config.houseEdgeTarget * 100}
                  onChange={(e) => handleConfigChange("houseEdgeTarget", Number(e.target.value) / 100)}
                  className="flex-1 accent-primary h-2"
                />
                <span className="font-mono font-bold text-primary text-lg w-16 text-right">
                  {(config.houseEdgeTarget * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Max Multiplier */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <label className="text-sm font-semibold mb-1 block">Max Multiplier Cap</label>
              <p className="text-xs text-muted-foreground mb-3">
                Maximum payout multiplier allowed.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={config.maxMultiplier}
                  onChange={(e) => handleConfigChange("maxMultiplier", Number(e.target.value))}
                  className="flex-1 accent-primary h-2"
                />
                <span className="font-mono font-bold text-foreground text-lg w-16 text-right">
                  {config.maxMultiplier}×
                </span>
              </div>
            </div>

            {/* Min Bet */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <label className="text-sm font-semibold mb-1 block">Minimum Bet</label>
              <p className="text-xs text-muted-foreground mb-3">Lowest allowed bet amount.</p>
              <input
                type="number"
                value={config.minBet}
                onChange={(e) => handleConfigChange("minBet", Math.max(1, Number(e.target.value)))}
                className="w-full bg-secondary rounded-xl px-4 py-2.5 font-mono text-foreground text-sm border border-border outline-none focus:border-primary/40"
              />
            </div>

            {/* Max Bet */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <label className="text-sm font-semibold mb-1 block">Maximum Bet</label>
              <p className="text-xs text-muted-foreground mb-3">Highest allowed bet amount.</p>
              <input
                type="number"
                value={config.maxBet}
                onChange={(e) => handleConfigChange("maxBet", Math.max(100, Number(e.target.value)))}
                className="w-full bg-secondary rounded-xl px-4 py-2.5 font-mono text-foreground text-sm border border-border outline-none focus:border-primary/40"
              />
            </div>
          </div>
        </section>

        {/* Game History */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold">Game History</h2>
            <span className="text-xs text-muted-foreground ml-auto">Last 100 rounds</span>
          </div>
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card border-b border-border">
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">#</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Time</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Bet</th>
                    <th className="text-center px-4 py-3 text-xs text-muted-foreground font-semibold">Mines</th>
                    <th className="text-center px-4 py-3 text-xs text-muted-foreground font-semibold">Result</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Multi</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.gameHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No games played yet
                      </td>
                    </tr>
                  ) : (
                    stats.gameHistory.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">{entry.id}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          ₹{entry.betAmount}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono">{entry.mineCount}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-bold",
                            entry.result === "win"
                              ? "bg-game-win/15 text-game-win"
                              : "bg-game-lose/15 text-game-lose"
                          )}>
                            {entry.result.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {entry.multiplier}×
                        </td>
                        <td className={cn(
                          "px-4 py-2.5 text-right font-mono font-bold",
                          entry.profit >= 0 ? "text-game-win" : "text-game-lose"
                        )}>
                          {entry.profit >= 0 ? "+" : ""}₹{entry.profit.toFixed(0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Admin;
