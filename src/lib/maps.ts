import { MapType } from '../types';

export const HERO_BANNER_IMAGE = '/src/assets/images/hero_ff_arena_1794851103538.jpg';

export const MAP_ARTWORK: Record<MapType, { image: string; terrain: string; gradient: string }> = {
  Bermuda: {
    image: '/src/assets/images/map_bermuda_1794851103634.jpg',
    terrain: 'Coastal Compound & Watchtower',
    gradient: 'from-emerald-950 via-slate-900 to-slate-950',
  },
  Purgatory: {
    image: '/src/assets/images/map_purgatory_1794851105568.jpg',
    terrain: 'Highland Valley & Suspension Bridge',
    gradient: 'from-sky-950 via-slate-900 to-slate-950',
  },
  Kalahari: {
    image: '/src/assets/images/map_kalahari_1794851104758.jpg',
    terrain: 'Arid Canyon & Refinery Outpost',
    gradient: 'from-amber-950 via-slate-900 to-slate-950',
  },
  Alpine: {
    image: '/src/assets/images/map_purgatory_1794851105568.jpg',
    terrain: 'Snowline Ridge & Garrison',
    gradient: 'from-slate-800 via-slate-900 to-slate-950',
  },
  NeXTerra: {
    image: '/src/assets/images/map_kalahari_1794851104758.jpg',
    terrain: 'Tactical Testing Sector',
    gradient: 'from-orange-950 via-slate-900 to-slate-950',
  },
};

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatMatchTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return 'Unlocked';
  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}
