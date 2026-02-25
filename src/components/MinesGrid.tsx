import { TileState } from "@/hooks/useMinesGame";
import { MinesTile } from "./MinesTile";

interface MinesGridProps {
  grid: TileState[];
  onTileClick: (index: number) => void;
  disabled: boolean;
}

export function MinesGrid({ grid, onTileClick, disabled }: MinesGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full max-w-[400px] mx-auto">
      {grid.map((tile, i) => (
        <MinesTile
          key={i}
          state={tile}
          index={i}
          onClick={onTileClick}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
