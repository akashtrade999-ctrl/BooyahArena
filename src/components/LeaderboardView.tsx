import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Trophy } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatCurrency } from '../lib/maps';
import { PlayerStanding } from '../types';

export function LeaderboardView() {
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('totalPoints', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStandings(snap.docs.map((d) => d.data() as PlayerStanding));
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'leaderboard');
      }
    );
    return () => unsub();
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white tracking-wide">
            Season Standings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cumulative tournament points, eliminations, and settled winnings
          </p>
        </div>
      </div>

      <div className="bg-[#131822] border border-white/[0.08] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <div className="p-10 text-center">
            <Trophy className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-white">No standings recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Standings populate automatically as players register and matches are settled by admins.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs font-medium text-slate-400">
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Player IGN</th>
                  <th className="py-3 px-4">FF UID</th>
                  <th className="py-3 px-4 text-right">Matches</th>
                  <th className="py-3 px-4 text-right">Kills</th>
                  <th className="py-3 px-4 text-right">Points</th>
                  <th className="py-3 px-4 text-right">Winnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-sm">
                {standings.map((player, idx) => (
                  <tr key={player.uid} className="hover:bg-white/[0.02] transition-colors h-11">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-300 tabular-nums">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-white">
                      {player.ign}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400 tabular-nums">
                      {player.ffUid || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                      {player.matchesPlayed}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                      {player.totalKills}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-orange-400 tabular-nums">
                      {player.totalPoints}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                      {formatCurrency(player.totalWinnings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
