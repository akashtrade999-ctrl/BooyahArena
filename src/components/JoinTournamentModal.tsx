import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { X, Crosshair, Users, ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatMatchTime } from '../lib/maps';
import { SCHEMA_LIMITS, Tournament } from '../types';

interface JoinTournamentModalProps {
  tournament: Tournament | null;
  onClose: () => void;
  onJoined: () => void;
}

export function JoinTournamentModal({
  tournament,
  onClose,
  onJoined,
}: JoinTournamentModalProps) {
  const { user, profile, updatePlayerIdentity } = useAuth();
  const [ffUid, setFfUid] = useState('');
  const [ign, setIgn] = useState('');
  const [teamName, setTeamName] = useState('');
  const [partnerIgn, setPartnerIgn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFfUid(profile.ffUid || '');
      setIgn(profile.ign || '');
    }
  }, [profile, tournament]);

  if (!tournament || !user) return null;

  const isTeamMode = tournament.mode === 'Duo' || tournament.mode === 'Squad';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUid = ffUid.trim();
    const cleanIgn = ign.trim();
    const cleanTeam = teamName.trim().slice(0, SCHEMA_LIMITS.TEAM_NAME_MAX);
    const cleanPartners = partnerIgn.trim().slice(0, SCHEMA_LIMITS.PARTNER_IGN_MAX);

    if (
      cleanUid.length < SCHEMA_LIMITS.FF_UID_MIN ||
      cleanUid.length > SCHEMA_LIMITS.FF_UID_MAX ||
      !SCHEMA_LIMITS.FF_UID_PATTERN.test(cleanUid)
    ) {
      setErrorMsg('Free Fire UID must be 5 to 20 numeric digits.');
      return;
    }

    if (
      cleanIgn.length < SCHEMA_LIMITS.IGN_MIN ||
      cleanIgn.length > SCHEMA_LIMITS.IGN_MAX
    ) {
      setErrorMsg('In-Game Name (IGN) must be between 2 and 40 characters.');
      return;
    }

    if (tournament.filledSlots >= tournament.maxSlots) {
      setErrorMsg('This tournament is already full.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePlayerIdentity(cleanUid, cleanIgn);

      const batch = writeBatch(db);
      const regRef = doc(db, 'tournaments', tournament.id, 'registrations', user.uid);
      const tournamentRef = doc(db, 'tournaments', tournament.id);

      const registrationPayload: Record<string, unknown> = {
        tournamentId: tournament.id,
        userId: user.uid,
        ffUid: cleanUid,
        ign: cleanIgn,
        slotNumber: Math.min(tournament.filledSlots + 1, tournament.maxSlots),
        kills: 0,
        placement: 0,
        pointsAwarded: 0,
        prizeAwarded: 0,
        resultStatus: 'pending',
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (cleanTeam) {
        registrationPayload.teamName = cleanTeam;
      }
      if (cleanPartners) {
        registrationPayload.partnerIgn = cleanPartners;
      }

      batch.set(regRef, registrationPayload);
      batch.update(tournamentRef, {
        filledSlots: increment(1),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `tournaments/${tournament.id}/registrations/${user.uid}`
        );
      }

      onJoined();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete registration.';
      if (msg.includes('Missing or insufficient permissions')) {
        setErrorMsg('Registration blocked: match may be full, closed, or you already joined.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-[#131822] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id="join-modal-title" className="text-xl font-bold text-white tracking-tight">
              Register for Match
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {tournament.title} · {tournament.mode} · {tournament.mapType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close registration modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#0B0E14] border border-white/[0.06] mb-5 text-xs">
          <div>
            <div className="text-slate-400">Entry Fee</div>
            <div className="font-mono font-semibold text-white mt-0.5 tabular-nums">
              {tournament.entryFee === 0 ? 'Free' : formatCurrency(tournament.entryFee)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Prize Pool</div>
            <div className="font-mono font-semibold text-emerald-400 mt-0.5 tabular-nums">
              {formatCurrency(tournament.prizePool)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Match Start</div>
            <div className="font-medium text-slate-200 mt-0.5 truncate">
              {formatMatchTime(tournament.startTime.toDate())}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ff-uid-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Free Fire UID (Numeric)
            </label>
            <div className="relative">
              <Crosshair className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="ff-uid-input"
                type="text"
                inputMode="numeric"
                value={ffUid}
                onChange={(e) => setFfUid(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 2489104572"
                maxLength={SCHEMA_LIMITS.FF_UID_MAX}
                className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="ff-ign-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              In-Game Name (IGN)
            </label>
            <input
              id="ff-ign-input"
              type="text"
              value={ign}
              onChange={(e) => setIgn(e.target.value)}
              placeholder="Exact Free Fire nickname"
              maxLength={SCHEMA_LIMITS.IGN_MAX}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
              required
            />
          </div>

          {isTeamMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="team-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Team Name
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="team-name-input"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Alpha Squad"
                    maxLength={SCHEMA_LIMITS.TEAM_NAME_MAX}
                    className="w-full min-h-[44px] pl-10 pr-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="partner-ign-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                  {tournament.mode === 'Duo' ? 'Partner IGN' : 'Squad Teammates IGNs'}
                </label>
                <input
                  id="partner-ign-input"
                  type="text"
                  value={partnerIgn}
                  onChange={(e) => setPartnerIgn(e.target.value)}
                  placeholder={tournament.mode === 'Duo' ? 'Teammate IGN' : 'Player2, Player3, Player4'}
                  maxLength={SCHEMA_LIMITS.PARTNER_IGN_MAX}
                  className="w-full min-h-[44px] px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0B0E14] border border-white/[0.06] text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Your assigned slot and Room ID / Password will unlock automatically inside this match card before start time.
            </span>
          </div>

          {errorMsg && (
            <p className="p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 py-3 bg-[#0B0E14] border border-white/10 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[48px] px-5 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {submitting ? 'Confirming Slot...' : 'Confirm Join Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
