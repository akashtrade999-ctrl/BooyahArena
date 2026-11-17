import React from 'react';
import { Tournament, TournamentRegistration } from '../types';
import { TournamentCard } from './TournamentCard';
import { CalendarClock } from 'lucide-react';

interface MyMatchesViewProps {
  tournaments: Tournament[];
  registrationsByTournament: Record<string, TournamentRegistration>;
  nowMs: number;
  isSignedIn: boolean;
  onBrowseTournaments: () => void;
  onSignInPrompt: () => void;
  onJoinClick: (t: Tournament) => void;
}

export function MyMatchesView({
  tournaments,
  registrationsByTournament,
  nowMs,
  isSignedIn,
  onBrowseTournaments,
  onSignInPrompt,
  onJoinClick,
}: MyMatchesViewProps) {
  if (!isSignedIn) {
    return (
      <div className="bg-[#131822] border border-white/[0.08] rounded-2xl p-8 text-center max-w-lg mx-auto my-8">
        <CalendarClock className="w-8 h-8 text-orange-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-white">Sign in to view your matches</h2>
        <p className="text-sm text-slate-400 mt-1.5 mb-5">
          Track your registered Solo, Duo, and Squad slots, unlock Room IDs before start time, and view your kill payouts.
        </p>
        <button
          type="button"
          onClick={onSignInPrompt}
          className="min-h-[44px] px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  const joinedTournaments = tournaments.filter((t) => Boolean(registrationsByTournament[t.id]));

  if (joinedTournaments.length === 0) {
    return (
      <div className="bg-[#131822] border border-white/[0.08] rounded-2xl p-8 text-center max-w-lg mx-auto my-8">
        <CalendarClock className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-white">No joined matches yet</h2>
        <p className="text-sm text-slate-400 mt-1.5 mb-5">
          Register for an upcoming Free Fire tournament with your UID and IGN to receive your slot and Room ID.
        </p>
        <button
          type="button"
          onClick={onBrowseTournaments}
          className="min-h-[44px] px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Browse Tournaments
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white tracking-wide">
            My Registered Matches
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Room ID &amp; Password appear automatically inside each card once the reveal window opens
          </p>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">
          {joinedTournaments.length} {joinedTournaments.length === 1 ? 'Match' : 'Matches'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {joinedTournaments.map((t) => (
          <TournamentCard
            key={t.id}
            tournament={t}
            registration={registrationsByTournament[t.id]}
            nowMs={nowMs}
            isSignedIn={isSignedIn}
            onJoinClick={onJoinClick}
            onSignInPrompt={onSignInPrompt}
          />
        ))}
      </div>
    </section>
  );
}
