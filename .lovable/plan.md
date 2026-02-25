

# Professional Mines Game Overhaul — Spribe/Jili Level

## Current Issues
- Tiles look flat and basic — no depth, no 3D feel, no premium texture
- Diamond/mine reveal animations are minimal compared to Spribe/Jili
- Hidden tiles have just a tiny dot — no visual richness
- Grid background lacks the premium dark gradient feel
- Controls look functional but not "casino-grade"
- House edge logic works but needs refinement for consistent 40% profit
- No admin panel exists

## Plan

### 1. Premium Tile UI Overhaul (`MinesTile.tsx`)
- **Hidden tiles**: Replace the tiny dot with a star/sparkle icon or subtle "?" mark. Add a layered 3D look with inner shadow, top highlight, and subtle gradient (like Stake.com/Spribe tiles)
- **Diamond reveal**: Full-size gem icon with green glow burst animation, particle-like ring expansion, and a satisfying scale bounce
- **Mine reveal**: Red explosive glow, shake + flash red overlay, bomb icon with smoke-like shadow
- **Hover state**: Lift effect with brighter border glow, cursor pointer with subtle pulse

### 2. Grid Visual Upgrade (`MinesGrid.tsx`)
- Dark rounded container with inner shadow and subtle grid pattern background
- Result overlay with blur glass card, bigger text, confetti-like shine on win
- Loss overlay with red vignette pulse effect

### 3. Professional Layout & Controls (`Index.tsx`)
- **Header**: Sleek dark bar with animated balance counter, brand logo area
- **Stats bar**: Glassmorphic cards with colored accents for multiplier/profit
- **Mine selector**: Pill-shaped buttons with active glow state
- **Bet controls**: Rounded dark input with glowing border on focus, quick-bet chips with hover effects
- **Action button**: Large gradient button with animated glow pulse when cashout available

### 4. CSS & Animation Upgrades (`index.css`, `tailwind.config.ts`)
- New keyframes: `glow-pulse`, `explosion`, `confetti-shine`, `counter-up`
- New utility classes for 3D tile surfaces, neon borders, animated gradients
- Improved color tokens for richer dark theme

### 5. House Edge Logic Refinement (`useMinesGame.ts`)
- Tighten the `shouldBeMine` algorithm:
  - Track cumulative house profit ratio (total wagered vs total paid out)
  - If house profit drops below 35%, aggressively increase mine probability
  - If house profit exceeds 50%, slightly ease up to keep user engaged
  - Add "win streak breaker" — after 2 consecutive wins, next round is very likely loss
  - Add "loss recovery hook" — after 3+ consecutive losses, give a small win to retain user
- Track `totalWagered` and `totalPaidOut` at module level for accurate house edge calculation

### 6. Admin Panel (New Route `/admin`)
- **New files**: `src/pages/Admin.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/components/admin/AdminStats.tsx`, `src/components/admin/AdminSettings.tsx`
- **Dashboard**: Shows real-time stats — total wagered, total paid out, house profit %, active sessions
- **Settings panel**: Adjustable house edge % (slider 30-60%), max win multiplier cap, min/max bet limits
- **Game history table**: Recent rounds with bet amount, mines, result, profit/loss
- **Route**: Add `/admin` route in `App.tsx`
- All admin settings stored in module-level config object that the game engine reads from

### Technical Details

```text
Architecture:
┌─────────────────────────────────────┐
│  Admin Panel (/admin)               │
│  ┌──────────┐ ┌──────────────────┐  │
│  │ Dashboard │ │ Settings         │  │
│  │ - Stats   │ │ - House Edge %   │  │
│  │ - History │ │ - Max Multiplier │  │
│  │ - P&L     │ │ - Bet Limits     │  │
│  └──────────┘ └──────────────────┘  │
└──────────────┬──────────────────────┘
               │ reads/writes
      ┌────────▼────────┐
      │ gameConfig       │  (module-level)
      │ - houseEdge: 0.4 │
      │ - maxMult: 10    │
      │ - stats tracking │
      └────────┬────────┘
               │ used by
      ┌────────▼────────┐
      │ shouldBeMine()   │
      │ Game Engine       │
      └─────────────────┘
```

**Files to create:**
- `src/pages/Admin.tsx` — Admin panel page
- `src/lib/gameConfig.ts` — Shared config + stats store

**Files to modify:**
- `src/hooks/useMinesGame.ts` — Use gameConfig, improved house edge
- `src/components/MinesTile.tsx` — Premium 3D tile design
- `src/components/MinesGrid.tsx` — Premium grid container
- `src/pages/Index.tsx` — Professional controls layout
- `src/index.css` — New animations and utility classes
- `tailwind.config.ts` — New animation keyframes
- `src/App.tsx` — Add /admin route

