import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Check, Copy, KeyRound, Lock, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCountdown, formatCurrency, formatMatchTime, MAP_ARTWORK } from '../lib/maps';
import { RoomCredential, Tournament, TournamentRegistration } from '../types';

interface TournamentCardProps {
  tournament: Tournament;
  registration?: TournamentRegistration;
  nowMs: number;
  isSignedIn: boolean;
  onJoinClick: (tournament: Tournament) => void;
  onSignInPrompt: () => void;
}

export function TournamentCard({
  tournament,
  registration,
  nowMs,
  isSignedIn,
  onJoinClick,
  onSignInPrompt,
}: TournamentCardProps) {
  const artwork = MAP_ARTWORK[tournament.mapType] || MAP_ARTWORK.Bermuda;
  const [imgError, setImgError] = useState(false);
  const [roomCred, setRoomCred] = useState<RoomCredential | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credStatusNote, setCredStatusNote] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'pw' | null>(null);

  const revealAtMs = tournament.revealAt.toMillis();
  const startMs = tournament.startTime.toMillis();
  const isRevealWindowOpen = nowMs >= revealAtMs;
  const isFull = tournament.filledSlots >= tournament.maxSlots;
  const slotPercent = Math.min(100, Math.round((tournament.filledSlots / tournament.maxSlots) * 100));

  const fetchCredentials = async () => {
    if (!registration || !isSignedIn || !isRevealWindowOpen) return;
    setCredLoading(true);
    setCredStatusNote(null);
    try {
      const snap = await getDoc(doc(db, 'tournaments', tournament.id, 'roomCredentials', 'access'));
      if (snap.exists()) {
        setRoomCred(snap.data() as RoomCredential);
      } else {
        setCredStatusNote('Host is finalizing the custom room credentials.');
      }
    } catch {
      setCredStatusNote('Room unlocks right at the scheduled reveal window.');
    } finally {
      setCredLoading(false);
    }
  };

  useEffect(() => {
    if (registration && isRevealWindowOpen && tournament.roomReady && !roomCred) {
      void fetchCredentials();
    }
  }, [registration, isRevealWindowOpen, tournament.roomReady, tournament.id]);

  const handleCopy = async (value: string, field: 'id' | 'pw') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Clipboard blocked in restricted iframe fallback
    }
  };

  const statusText =
    tournament.status === 'completed'
      ? 'Completed'
      : tournament.status === 'live'
        ? 'Live Match'
        : isFull
          ? 'Slots Full'
          : 'Open';

  const statusColor =
    tournament.status === 'completed'
      ? 'text-slate-400'
      : tournament.status === 'live'
        ? 'text-emerald-400'
        : isFull
          ? 'text-red-400'
          : 'text-orange-400';

  return (
    <article className="bg-[#131822] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col justify-between transition-colors hover:border-white/[0.15]">
      <div>
        <div className="relative h-40 w-full bg-[#0B0E14] overflow-hidden">
          {!imgError ? (
            <img
              src={artwork.image}
              alt={`${tournament.mapType} Free Fire map arena`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${artwork.gradient} flex items-center justify-center`}>
              <span className="font-display text-2xl font-bold text-white/30 tracking-wider">
                {tournament.mapType}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#131822] via-[#131822]/45 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <h3 className="font-display text-xl font-bold text-white tracking-wide leading-tight line-clamp-1">
              {tournament.title}
            </h3>
            <span className={`text-xs font-semibold shrink-0 ${statusColor}`}>
              {statusText}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span className="text-slate-200 font-medium">{tournament.mode}</span>
            <span aria-hidden="true">·</span>
            <span>{tournament.mapType}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatMatchTime(tournament.startTime.toDate())}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 py-3 border-y border-white/[0.06]">
            <div>
              <div className="text-[11px] text-slate-400">Prize Pool</div>
              <div className="font-mono text-sm font-semibold text-emerald-400 tabular-nums mt-0.5">
                {formatCurrency(tournament.prizePool)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Per Kill</div>
              <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums mt-0.5">
                {formatCurrency(tournament.perKillReward)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Entry Fee</div>
              <div className="font-mono text-sm font-semibold text-orange-400 tabular-nums mt-0.5">
                {tournament.entryFee === 0 ? 'Free' : formatCurrency(tournament.entryFee)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Registered Players
              </span>
              <span className="font-mono text-slate-200 tabular-nums">
                {tournament.filledSlots} / {tournament.maxSlots}
              </span>
            </div>
            <div className="h-1.5 w-full bg-[#0B0E14] rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-200"
                style={{ width: `${slotPercent}%` }}
              />
            </div>
          </div>

          {registration && (
            <div className="pt-2 space-y-2.5 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-semibold">
                  Joined · Slot #{registration.slotNumber}
                </span>
                <span className="font-mono text-slate-400 truncate max-w-[160px]">
                  {registration.ign} ({registration.ffUid})
                </span>
              </div>

              {registration.resultStatus === 'settled' ? (
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#0B0E14] border border-emerald-500/25 text-xs">
                  <div>
                    <div className="text-slate-400">Rank</div>
                    <div className="font-mono font-semibold text-white tabular-nums mt-0.5">
                      #{registration.placement || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Kills</div>
                    <div className="font-mono font-semibold text-white tabular-nums mt-0.5">
                      {registration.kills}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Won</div>
                    <div className="font-mono font-semibold text-emerald-400 tabular-nums mt-0.5">
                      {formatCurrency(registration.prizeAwarded)}
                    </div>
                  </div>
                </div>
              ) : isRevealWindowOpen ? (
                <div className="p-3 rounded-xl bg-[#0B0E14] border border-orange-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-300">
                      <KeyRound className="w-3.5 h-3.5" />
                      Custom Room Access
                    </span>
                    <button
                      type="button"
                      onClick={fetchCredentials}
                      disabled={credLoading}
                      className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${credLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                  {roomCred ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(roomCred.roomId, 'id')}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#131822] border border-white/10 text-left hover:border-orange-500/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400">Room ID</div>
                          <div className="font-mono text-xs font-semibold text-white truncate">
                            {roomCred.roomId}
                          </div>
                        </div>
                        {copiedField === 'id' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(roomCred.roomPassword, 'pw')}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#131822] border border-white/10 text-left hover:border-orange-500/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400">Password</div>
                          <div className="font-mono text-xs font-semibold text-white truncate">
                            {roomCred.roomPassword}
                          </div>
                        </div>
                        {copiedField === 'pw' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {credStatusNote || 'Click Refresh to fetch Room ID & Password.'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#0B0E14] border border-white/[0.06] text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Room ID &amp; Password locked
                  </span>
                  <span className="font-mono text-orange-400 tabular-nums">
                    {formatCountdown(revealAtMs, nowMs)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        {!registration ? (
          isSignedIn ? (
            <button
              type="button"
              disabled={tournament.status !== 'upcoming' || isFull}
              onClick={() => onJoinClick(tournament)}
              className="w-full min-h-[44px] px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              {tournament.status !== 'upcoming'
                ? 'Registration Closed'
                : isFull
                  ? 'Tournament Full'
                  : 'Join with FF UID'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignInPrompt}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#1D2534] hover:bg-[#263044] text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Sign In to Join
            </button>
          )
        ) : (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              {nowMs < startMs ? `Starts in ${formatCountdown(startMs, nowMs)}` : 'Match Window Active'}
            </span>
            <span className="font-mono text-slate-300">Slot #{registration.slotNumber}</span>
          </div>
        )}
      </div>
    </article>
  );
}
