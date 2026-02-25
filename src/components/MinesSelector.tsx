import { cn } from "@/lib/utils";

interface MinesSelectorProps {
  value: number;
  onChange: (count: number) => void;
  disabled: boolean;
}

const MINE_OPTIONS = [1, 3, 5, 10, 15, 20, 24];

export function MinesSelector({ value, onChange, disabled }: MinesSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground uppercase tracking-widest">
        Mines
      </label>
      <div className="flex gap-1.5 flex-wrap">
        {MINE_OPTIONS.map((count) => (
          <button
            key={count}
            onClick={() => onChange(count)}
            disabled={disabled}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              "border border-border",
              value === count
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}
