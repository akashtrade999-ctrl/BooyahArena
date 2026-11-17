import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { CalendarClock, LogOut, Shield, Swords, Trophy, UserCheck } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { JoinTournamentModal } from './components/JoinTournamentModal';
import { TournamentCard } from './components/TournamentCard';
import { MyMatchesView } from './components/MyMatchesView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminDashboard } from './components/AdminDashboard';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { formatCurrency, HERO_BANNER_IMAGE } from './lib/maps';
import { MatchMode, Tournament, TournamentRegistration, TournamentStatus } from './types';

type ActiveTab = 'tournaments' | 'my-matches' | 'leaderboard' | 'admin';

function ArenaShell() {
  const { user, profile, isAdmin, authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tournaments');
  const [modeFilter, setModeFilter] = useState<'All' | MatchMode>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | TournamentStatus>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [registrationsByTournament, setRegistrationsByTournament] = useState<
    Record<string, TournamentRegistration>
  >({});
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState<Tournament | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // 1-second clock tick for Room ID unlock and match start countdowns
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live tournament catalog subscription
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('startTime', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTournaments(snap.docs.map((d) => d.data() as Tournament));
        setTournamentsLoading(false);
      },
      (err) => {
        setTournamentsLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'tournaments');
      }
    );
    return () => unsub();
  }, []);

  // Deterministic per-tournament registration listeners for the signed-in user (no collection-group index needed)
  useEffect(() => {
    if (!user || tournaments.length === 0) {
      setRegistrationsByTournament({});
      return;
    }

    const unsubscribers = tournaments.map((t) => {
      const regRef = doc(db, 'tournaments', t.id, 'registrations', user.uid);
      return onSnapshot(
        regRef,
        (snap) => {
          setRegistrationsByTournament((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              next[t.id] = snap.data() as TournamentRegistration;
            } else {
              delete next[t.id];
            }
            return next;
          });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `tournaments/${t.id}/registrations/${user.uid}`);
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, tournaments]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (modeFilter !== 'All' && t.mode !== modeFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [tournaments, modeFilter, statusFilter]);

  const openMatchesCount = useMemo(
    () => tournaments.filter((t) => t.status === 'upcoming').length,
    [tournaments]
  );

  const totalLivePool = useMemo(
    () => tournaments.reduce((sum, t) => sum + t.prizePool, 0),
    [tournaments]
  );

  const myMatchCount = Object.keys(registrationsByTournament).length;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col pb-20 md:pb-0">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0E14]/95 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('tournaments')}
            className="font-display text-2xl font-bold tracking-wide text-white whitespace-nowrap shrink-0 text-left"
          >
            BooyahArena
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium" aria-label="Primary navigation">
            <button
              type="button"
              onClick={() => setActiveTab('tournaments')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tournaments'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Tournaments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my-matches')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'my-matches'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              My Matches
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'leaderboard'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Leaderboard
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'admin'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-slate-400 hover:text-orange-300'
                }`}
              >
                Admin Panel
              </button>
            )}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {authLoading ? (
              <div className="h-9 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
            ) : user ? (
              <button
                type="button"
                onClick={() => void logout()}
                className="min-h-[40px] px-3.5 py-2 bg-[#131822] hover:bg-[#1D2534] border border-white/10 text-slate-200 text-xs font-medium rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <span className="max-w-[120px] truncate">
                  {profile?.ign || profile?.displayName || user.phoneNumber || 'Player'}
                </span>
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="min-h-[40px] px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {activeTab === 'tournaments' && (
          <>
            {/* Hero Section */}
            <section className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#131822]">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-center space-y-5 relative z-10">
                  <div className="text-xs font-medium text-orange-400">
                    Solo · Duo · Squad Custom Rooms
                  </div>
                  <h1 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-wide leading-[1.08] text-balance">
                    Compete in Daily Free Fire Custom Tournaments
                  </h1>
                  <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                    Join verified Solo, Duo, or Squad lobbies with your Free Fire UID and IGN. Room ID and Password unlock automatically before match start, with per-kill and placement prize payouts.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {!user ? (
                      <button
                        type="button"
                        onClick={() => setAuthModalOpen(true)}
                        className="min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                      >
                        Login with Google or Mobile OTP
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('my-matches')}
                        className="min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                      >
                        View My Matches ({myMatchCount})
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('admin')}
                        className="min-h-[44px] px-5 py-2.5 bg-[#1D2534] hover:bg-[#263044] text-slate-100 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                      >
                        Open Admin Console
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6 relative min-h-[220px] lg:min-h-[320px] bg-[#0B0E14]">
                  {!heroImgError ? (
                    <img
                      src={HERO_BANNER_IMAGE}
                      alt="Free Fire tournament squad overlooking coastal island"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="w-full h-full object-cover lg:absolute lg:inset-0"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-950/50 via-[#131822] to-[#0B0E14]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#131822] via-[#131822]/30 to-transparent hidden lg:block" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131822] via-transparent to-transparent lg:hidden" />
                </div>
              </div>

              {/* 4-column summary strip below hero */}
              <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-white/[0.08] divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08] bg-[#0B0E14]/60">
                <div className="p-4 sm:px-6">
                  <div className="text-xs text-slate-400">Open Lobbies</div>
                  <div className="font-mono text-xl font-semibold text-white tabular-nums mt-0.5">
                    {openMatchesCount}
                  </div>
                </div>
                <div className="p-4 sm:px-6">
                  <div className="text-xs text-slate-400">Active Prize Pools</div>
                  <div className="font-mono text-xl font-semibold text-emerald-400 tabular-nums mt-0.5">
                    {formatCurrency(totalLivePool)}
                  </div>
                </div>
                <div className="p-4 sm:px-6">
                  <div className="text-xs text-slate-400">Your Total Kills</div>
                  <div className="font-mono text-xl font-semibold text-orange-400 tabular-nums mt-0.5">
                    {profile ? profile.totalKills : 0}
                  </div>
                </div>
                <div className="p-4 sm:px-6">
                  <div className="text-xs text-slate-400">Your Winnings</div>
                  <div className="font-mono text-xl font-semibold text-emerald-400 tabular-nums mt-0.5">
                    {formatCurrency(profile ? profile.totalWinnings : 0)}
                  </div>
                </div>
              </div>
            </section>

            {/* Filter Toolbar */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white tracking-wide">
                    Available Tournaments
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Filter by squad size or match status to register with your Free Fire UID
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center p-1 bg-[#131822] border border-white/[0.08] rounded-xl">
                    {(['All', 'Solo', 'Duo', 'Squad'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModeFilter(m)}
                        className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                          modeFilter === m
                            ? 'bg-orange-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <select
                    aria-label="Filter by match status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | TournamentStatus)}
                    className="min-h-[44px] px-3 py-2 bg-[#131822] border border-white/[0.08] rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="all">All Status</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {tournamentsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-80 bg-[#131822] border border-white/[0.06] rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredTournaments.length === 0 ? (
                <div className="bg-[#131822] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
                  <Swords className="w-8 h-8 text-slate-500 mx-auto" />
                  <h3 className="text-base font-semibold text-white">
                    No tournaments match this filter
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {tournaments.length === 0
                      ? 'An admin can publish Solo, Duo, or Squad tournaments from the Admin Panel.'
                      : 'Try switching back to All modes or clearing the status filter.'}
                  </p>
                  {isAdmin && tournaments.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('admin')}
                      className="min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Go to Admin Panel to Create Matches
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredTournaments.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      registration={registrationsByTournament[t.id]}
                      nowMs={nowMs}
                      isSignedIn={Boolean(user)}
                      onJoinClick={(target) => setJoinTarget(target)}
                      onSignInPrompt={() => setAuthModalOpen(true)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'my-matches' && (
          <MyMatchesView
            tournaments={tournaments}
            registrationsByTournament={registrationsByTournament}
            nowMs={nowMs}
            isSignedIn={Boolean(user)}
            onBrowseTournaments={() => setActiveTab('tournaments')}
            onSignInPrompt={() => setAuthModalOpen(true)}
            onJoinClick={(target) => setJoinTarget(target)}
          />
        )}

        {activeTab === 'leaderboard' && <LeaderboardView />}

        {activeTab === 'admin' && <AdminDashboard tournaments={tournaments} />}
      </main>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Ergonomics) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-t border-white/[0.08]"
        aria-label="Mobile navigation"
      >
        <div className={`grid h-16 items-center ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('tournaments')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${
              activeTab === 'tournaments' ? 'text-orange-400' : 'text-slate-400'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none">Matches</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-matches')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${
              activeTab === 'my-matches' ? 'text-orange-400' : 'text-slate-400'
            }`}
          >
            <CalendarClock className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none">Joined</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${
              activeTab === 'leaderboard' ? 'text-orange-400' : 'text-slate-400'
            }`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none">Ranks</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${
                activeTab === 'admin' ? 'text-orange-400' : 'text-slate-400'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-[11px] font-medium leading-none">Admin</span>
            </button>
          )}
        </div>
      </nav>

      {/* Modals */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <JoinTournamentModal
        tournament={joinTarget}
        onClose={() => setJoinTarget(null)}
        onJoined={() => setActiveTab('my-matches')}
      />

      {/* Quiet Footer (Desktop) */}
      <footer className="hidden md:block border-t border-white/[0.06] py-5 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-slate-500">
          <span>BooyahArena · Free Fire Tournament Platform</span>
          {user ? (
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Signed in as {user.email || user.phoneNumber || user.uid}</span>
            </span>
          ) : (
            <span>Sign in to register with your Free Fire UID</span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ArenaShell />
    </AuthProvider>
  );
}
