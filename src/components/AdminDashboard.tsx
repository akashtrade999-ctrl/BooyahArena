import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  Award,
  KeyRound,
  Plus,
  Search,
  Trash2,
  Unlock,
  Users,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatMatchTime } from '../lib/maps';
import {
  MapType,
  MatchMode,
  RoomCredential,
  SCHEMA_LIMITS,
  Tournament,
  TournamentRegistration,
  TournamentStatus,
} from '../types';

interface AdminDashboardProps {
  tournaments: Tournament[];
}

type AdminSection = 'manage' | 'create' | 'players';

interface DraftSettlement {
  placement: string;
  kills: string;
  bonusPrize: string;
  points: string;
}

const PLACEMENT_POINTS_TABLE: Record<number, number> = {
  1: 15,
  2: 12,
  3: 10,
  4: 8,
  5: 6,
  6: 4,
  7: 2,
  8: 1,
};

function computeDefaultPoints(placement: number, kills: number): number {
  const rankPts = PLACEMENT_POINTS_TABLE[placement] || 0;
  return rankPts + kills * 2;
}

function getDefaultStartInput(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminDashboard({ tournaments }: AdminDashboardProps) {
  const { user, isAdmin } = useAuth();
  const [section, setSection] = useState<AdminSection>('manage');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');

  // Create tournament form state
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<MatchMode>('Squad');
  const [mapType, setMapType] = useState<MapType>('Bermuda');
  const [prizePool, setPrizePool] = useState('1500');
  const [perKillReward, setPerKillReward] = useState('25');
  const [entryFee, setEntryFee] = useState('50');
  const [maxSlots, setMaxSlots] = useState('48');
  const [startInput, setStartInput] = useState(getDefaultStartInput);
  const [revealMinutes, setRevealMinutes] = useState('15');
  const [rulesSummary, setRulesSummary] = useState('No emulators, no teaming, screenshots recommended.');
  const [initialRoomId, setInitialRoomId] = useState('');
  const [initialRoomPassword, setInitialRoomPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Room credentials editor
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [roomPwInput, setRoomPwInput] = useState('');
  const [savingCred, setSavingCred] = useState(false);

  // Settlement drafts keyed by userId
  const [drafts, setDrafts] = useState<Record<string, DraftSettlement>>({});
  const [settling, setSettling] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!selectedTournamentId && tournaments.length > 0) {
      setSelectedTournamentId(tournaments[0].id);
    }
  }, [tournaments, selectedTournamentId]);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) || null,
    [tournaments, selectedTournamentId]
  );

  // Listen to registrations for selected tournament
  useEffect(() => {
    if (!selectedTournamentId || !isAdmin) {
      setRegistrations([]);
      return;
    }
    setRegsLoading(true);
    const q = query(
      collection(db, 'tournaments', selectedTournamentId, 'registrations'),
      orderBy('slotNumber', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TournamentRegistration);
        setRegistrations(list);

        const nextDrafts: Record<string, DraftSettlement> = {};
        for (const r of list) {
          nextDrafts[r.userId] = {
            placement: String(r.placement || 0),
            kills: String(r.kills || 0),
            bonusPrize: String(
              Math.max(0, (r.prizeAwarded || 0) - (r.kills || 0) * (selectedTournament?.perKillReward || 0))
            ),
            points: String(r.pointsAwarded || 0),
          };
        }
        setDrafts(nextDrafts);
        setRegsLoading(false);
      },
      (err) => {
        setRegsLoading(false);
        handleFirestoreError(
          err,
          OperationType.LIST,
          `tournaments/${selectedTournamentId}/registrations`
        );
      }
    );
    return () => unsub();
  }, [selectedTournamentId, isAdmin, selectedTournament?.perKillReward]);

  const filteredRegistrations = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter(
      (r) =>
        r.ign.toLowerCase().includes(q) ||
        r.ffUid.includes(q) ||
        (r.teamName && r.teamName.toLowerCase().includes(q))
    );
  }, [registrations, playerSearch]);

  const stats = useMemo(() => {
    const active = tournaments.filter((t) => t.status !== 'completed').length;
    const totalPlayers = tournaments.reduce((acc, t) => acc + t.filledSlots, 0);
    const totalPool = tournaments.reduce((acc, t) => acc + t.prizePool, 0);
    const completed = tournaments.filter((t) => t.status === 'completed').length;
    return { active, totalPlayers, totalPool, completed };
  }, [tournaments]);

  if (!isAdmin || !user) {
    return (
      <div className="bg-[#131822] border border-white/[0.08] rounded-2xl p-8 max-w-lg mx-auto my-8 text-center">
        <h2 className="text-lg font-semibold text-white">Administrator Access Required</h2>
        <p className="text-sm text-slate-400 mt-2">
          Sign in with an authorized administrator account to create tournaments, manage room credentials, and settle prizes.
        </p>
      </div>
    );
  }

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanTitle = title.trim().slice(0, SCHEMA_LIMITS.TOURNAMENT_TITLE_MAX);
    if (cleanTitle.length < SCHEMA_LIMITS.TOURNAMENT_TITLE_MIN) {
      setFeedback({ type: 'err', text: 'Tournament title must be at least 3 characters.' });
      return;
    }

    const startDate = new Date(startInput);
    if (Number.isNaN(startDate.getTime())) {
      setFeedback({ type: 'err', text: 'Please select a valid match start date and time.' });
      return;
    }

    const revealMins = Math.max(0, Number(revealMinutes) || 0);
    const revealDate = new Date(startDate.getTime() - revealMins * 60 * 1000);
    const tournamentId = `ff_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setCreating(true);
    try {
      const batch = writeBatch(db);
      const tRef = doc(db, 'tournaments', tournamentId);
      const hasCreds = initialRoomId.trim().length >= 2 && initialRoomPassword.trim().length >= 1;

      const tPayload: Record<string, unknown> = {
        id: tournamentId,
        title: cleanTitle,
        mode,
        mapType,
        prizePool: Math.max(0, Number(prizePool) || 0),
        perKillReward: Math.max(0, Number(perKillReward) || 0),
        entryFee: Math.max(0, Number(entryFee) || 0),
        maxSlots: Math.min(100, Math.max(2, Number(maxSlots) || 48)),
        filledSlots: 0,
        startTime: Timestamp.fromDate(startDate),
        revealAt: Timestamp.fromDate(revealDate),
        roomReady: hasCreds,
        status: 'upcoming',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (rulesSummary.trim()) {
        tPayload.rulesSummary = rulesSummary.trim().slice(0, SCHEMA_LIMITS.RULES_MAX);
      }

      batch.set(tRef, tPayload);

      if (hasCreds) {
        const credRef = doc(db, 'tournaments', tournamentId, 'roomCredentials', 'access');
        batch.set(credRef, {
          roomId: initialRoomId.trim().slice(0, SCHEMA_LIMITS.ROOM_CRED_MAX),
          roomPassword: initialRoomPassword.trim().slice(0, SCHEMA_LIMITS.ROOM_CRED_MAX),
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tournaments/${tournamentId}`);
      }

      setTitle('');
      setInitialRoomId('');
      setInitialRoomPassword('');
      setSelectedTournamentId(tournamentId);
      setSection('manage');
      setFeedback({ type: 'ok', text: `Tournament "${cleanTitle}" created.` });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRoomEditor = async (t: Tournament) => {
    setEditingCredId(t.id);
    setRoomIdInput('');
    setRoomPwInput('');
    try {
      const snap = await getDoc(doc(db, 'tournaments', t.id, 'roomCredentials', 'access'));
      if (snap.exists()) {
        const data = snap.data() as RoomCredential;
        setRoomIdInput(data.roomId);
        setRoomPwInput(data.roomPassword);
      }
    } catch {
      // Ignore empty initial credential
    }
  };

  const handleSaveRoomCredentials = async (t: Tournament, unlockNow: boolean) => {
    setFeedback(null);
    const rId = roomIdInput.trim().slice(0, SCHEMA_LIMITS.ROOM_CRED_MAX);
    const rPw = roomPwInput.trim().slice(0, SCHEMA_LIMITS.ROOM_CRED_MAX);
    if (rId.length < 2 || rPw.length < 1) {
      setFeedback({ type: 'err', text: 'Enter both a Room ID (min 2 chars) and Password.' });
      return;
    }

    setSavingCred(true);
    try {
      const batch = writeBatch(db);
      const credRef = doc(db, 'tournaments', t.id, 'roomCredentials', 'access');
      const tRef = doc(db, 'tournaments', t.id);

      batch.set(credRef, {
        roomId: rId,
        roomPassword: rPw,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      const tUpdate: Record<string, unknown> = {
        roomReady: true,
        updatedAt: serverTimestamp(),
      };
      if (unlockNow) {
        tUpdate.revealAt = serverTimestamp();
      }
      batch.update(tRef, tUpdate);

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tournaments/${t.id}/roomCredentials/access`);
      }

      setEditingCredId(null);
      setFeedback({
        type: 'ok',
        text: unlockNow
          ? `Room credentials saved and unlocked immediately for joined players.`
          : `Room credentials saved for "${t.title}".`,
      });
    } finally {
      setSavingCred(false);
    }
  };

  const handleUpdateStatus = async (t: Tournament, status: TournamentStatus) => {
    setFeedback(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tournaments', t.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setFeedback({ type: 'ok', text: `"${t.title}" marked as ${status}.` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${t.id}`);
    }
  };

  const handleUnlockRoomNow = async (t: Tournament) => {
    setFeedback(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tournaments', t.id), {
        revealAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setFeedback({ type: 'ok', text: `Room reveal window unlocked now for "${t.title}".` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${t.id}`);
    }
  };

  const handleDeleteTournament = async (t: Tournament) => {
    setFeedback(null);
    try {
      await deleteDoc(doc(db, 'tournaments', t.id));
      setFeedback({ type: 'ok', text: `Deleted "${t.title}".` });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tournaments/${t.id}`);
    }
  };

  const updateDraftField = (
    userId: string,
    field: keyof DraftSettlement,
    value: string,
    perKillRewardRate: number
  ) => {
    setDrafts((prev) => {
      const current = prev[userId] || { placement: '0', kills: '0', bonusPrize: '0', points: '0' };
      const updated = { ...current, [field]: value };
      if (field === 'placement' || field === 'kills') {
        const pl = Math.max(0, Number(updated.placement) || 0);
        const kl = Math.max(0, Number(updated.kills) || 0);
        updated.points = String(computeDefaultPoints(pl, kl));
        if (field === 'placement' && pl === 1 && Number(updated.bonusPrize) === 0 && selectedTournament) {
          updated.bonusPrize = String(Math.round(selectedTournament.prizePool * 0.5));
        }
      }
      // Keep unused param acknowledged cleanly
      void perKillRewardRate;
      return { ...prev, [userId]: updated };
    });
  };

  const handleSettleTournament = async () => {
    if (!selectedTournament || registrations.length === 0) return;
    setFeedback(null);
    setSettling(true);

    try {
      const batch = writeBatch(db);
      const perKillRate = selectedTournament.perKillReward || 0;

      for (const reg of registrations) {
        const d = drafts[reg.userId] || { placement: '0', kills: '0', bonusPrize: '0', points: '0' };
        const newPlacement = Math.max(0, Math.min(100, Math.round(Number(d.placement) || 0)));
        const newKills = Math.max(0, Math.min(100, Math.round(Number(d.kills) || 0)));
        const bonusPrize = Math.max(0, Number(d.bonusPrize) || 0);
        const newPrize = Math.round(bonusPrize + newKills * perKillRate);
        const newPoints = Math.max(0, Math.round(Number(d.points) || 0));

        const deltaKills = newKills - (reg.kills || 0);
        const deltaPoints = newPoints - (reg.pointsAwarded || 0);
        const deltaPrize = newPrize - (reg.prizeAwarded || 0);
        const deltaMatches = reg.resultStatus === 'settled' ? 0 : 1;

        const regRef = doc(db, 'tournaments', selectedTournament.id, 'registrations', reg.userId);
        batch.update(regRef, {
          placement: newPlacement,
          kills: newKills,
          pointsAwarded: newPoints,
          prizeAwarded: newPrize,
          resultStatus: 'settled',
          updatedAt: serverTimestamp(),
        });

        const userSnap = await getDoc(doc(db, 'users', reg.userId));
        if (userSnap.exists()) {
          batch.update(doc(db, 'users', reg.userId), {
            totalKills: increment(deltaKills),
            totalPoints: increment(deltaPoints),
            totalWinnings: increment(deltaPrize),
            matchesPlayed: increment(deltaMatches),
            updatedAt: serverTimestamp(),
          });
        }

        const lbRef = doc(db, 'leaderboard', reg.userId);
        const lbSnap = await getDoc(lbRef);
        if (lbSnap.exists()) {
          batch.update(lbRef, {
            ign: reg.ign,
            ffUid: reg.ffUid,
            totalKills: increment(deltaKills),
            totalPoints: increment(deltaPoints),
            totalWinnings: increment(deltaPrize),
            matchesPlayed: increment(deltaMatches),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(lbRef, {
            uid: reg.userId,
            ign: reg.ign,
            ffUid: reg.ffUid,
            totalKills: Math.max(0, newKills),
            totalPoints: Math.max(0, newPoints),
            totalWinnings: Math.max(0, newPrize),
            matchesPlayed: 1,
            updatedAt: serverTimestamp(),
          });
        }
      }

      batch.update(doc(db, 'tournaments', selectedTournament.id), {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `tournaments/${selectedTournament.id}/registrations`
        );
      }

      setFeedback({
        type: 'ok',
        text: `Match settled and points/prizes distributed to ${registrations.length} players.`,
      });
    } finally {
      setSettling(false);
    }
  };

  const handleSeedSamples = async () => {
    setFeedback(null);
    setSeeding(true);
    try {
      const now = Date.now();
      const samples: Array<{
        id: string;
        title: string;
        mode: MatchMode;
        mapType: MapType;
        prizePool: number;
        perKillReward: number;
        entryFee: number;
        maxSlots: number;
        offsetMin: number;
        revealMin: number;
        roomId: string;
        roomPassword: string;
      }> = [
        {
          id: `ff_bermuda_squad_${now}`,
          title: 'Bermuda Prime Cup',
          mode: 'Squad',
          mapType: 'Bermuda',
          prizePool: 2500,
          perKillReward: 30,
          entryFee: 60,
          maxSlots: 48,
          offsetMin: 45,
          revealMin: 15,
          roomId: '88429104',
          roomPassword: 'BOOYAH99',
        },
        {
          id: `ff_purgatory_duo_${now + 1}`,
          title: 'Purgatory Clash Duo',
          mode: 'Duo',
          mapType: 'Purgatory',
          prizePool: 1200,
          perKillReward: 25,
          entryFee: 40,
          maxSlots: 48,
          offsetMin: 90,
          revealMin: 15,
          roomId: '55192044',
          roomPassword: 'DUO2026',
        },
        {
          id: `ff_kalahari_solo_${now + 2}`,
          title: 'Kalahari Solo Showdown',
          mode: 'Solo',
          mapType: 'Kalahari',
          prizePool: 800,
          perKillReward: 20,
          entryFee: 0,
          maxSlots: 48,
          offsetMin: 20,
          revealMin: 25,
          roomId: '77301928',
          roomPassword: 'SOLO77',
        },
      ];

      const batch = writeBatch(db);
      for (const s of samples) {
        const startDate = new Date(now + s.offsetMin * 60 * 1000);
        const revealDate = new Date(startDate.getTime() - s.revealMin * 60 * 1000);
        batch.set(doc(db, 'tournaments', s.id), {
          id: s.id,
          title: s.title,
          mode: s.mode,
          mapType: s.mapType,
          prizePool: s.prizePool,
          perKillReward: s.perKillReward,
          entryFee: s.entryFee,
          maxSlots: s.maxSlots,
          filledSlots: 0,
          startTime: Timestamp.fromDate(startDate),
          revealAt: Timestamp.fromDate(revealDate),
          roomReady: true,
          status: 'upcoming',
          rulesSummary: 'Standard custom room settings. No hacking or teaming.',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'tournaments', s.id, 'roomCredentials', 'access'), {
          roomId: s.roomId,
          roomPassword: s.roomPassword,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setFeedback({ type: 'ok', text: 'Created 3 sample tournaments (Solo, Duo, Squad).' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tournaments');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
      {/* Sidebar navigation */}
      <aside className="bg-[#131822] border border-white/[0.08] rounded-2xl p-3 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400">
          Admin Console
        </div>
        <button
          type="button"
          onClick={() => setSection('manage')}
          className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition-colors ${
            section === 'manage'
              ? 'bg-orange-600 text-white'
              : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="truncate">Tournaments &amp; Rooms</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('create')}
          className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition-colors ${
            section === 'create'
              ? 'bg-orange-600 text-white'
              : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="truncate">Create Tournament</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('players')}
          className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-2.5 transition-colors ${
            section === 'players'
              ? 'bg-orange-600 text-white'
              : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="truncate">Players &amp; Payouts</span>
        </button>
      </aside>

      {/* Main Console Viewport */}
      <div className="space-y-6 min-w-0">
        {/* Top Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-4">
            <div className="text-xs text-slate-400">Active Matches</div>
            <div className="font-mono text-2xl font-semibold text-white tabular-nums mt-1">
              {stats.active}
            </div>
          </div>
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-4">
            <div className="text-xs text-slate-400">Joined Players</div>
            <div className="font-mono text-2xl font-semibold text-orange-400 tabular-nums mt-1">
              {stats.totalPlayers}
            </div>
          </div>
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-4">
            <div className="text-xs text-slate-400">Total Prize Pools</div>
            <div className="font-mono text-2xl font-semibold text-emerald-400 tabular-nums mt-1">
              {formatCurrency(stats.totalPool)}
            </div>
          </div>
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-4">
            <div className="text-xs text-slate-400">Completed</div>
            <div className="font-mono text-2xl font-semibold text-slate-200 tabular-nums mt-1">
              {stats.completed}
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              feedback.type === 'ok'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-red-950/50 border-red-500/30 text-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SECTION 1: MANAGE TOURNAMENTS & ROOM CREDENTIALS */}
        {section === 'manage' && (
          <div className="bg-[#131822] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Tournaments &amp; Room Control</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Publish Room ID &amp; Password, unlock rooms early, or update match lifecycle
                </p>
              </div>
              <div className="flex items-center gap-2">
                {tournaments.length === 0 && (
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={handleSeedSamples}
                    className="min-h-[40px] px-3.5 py-2 bg-[#1D2534] hover:bg-[#263044] text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    {seeding ? 'Seeding...' : 'Seed 3 Sample Matches'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSection('create')}
                  className="min-h-[40px] px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  + New Tournament
                </button>
              </div>
            </div>

            {tournaments.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-medium text-white">No tournaments created yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Create your first Solo, Duo, or Squad Free Fire tournament or seed sample matches to test player registration and room unlocks.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {tournaments.map((t) => (
                  <div key={t.id} className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white truncate">{t.title}</h3>
                          <span className="text-xs text-slate-400">
                            {t.mode} · {t.mapType} · {t.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                          <span>Start: {formatMatchTime(t.startTime.toDate())}</span>
                          <span>·</span>
                          <span>Reveal: {formatMatchTime(t.revealAt.toDate())}</span>
                          <span>·</span>
                          <span>
                            Slots: <strong className="text-slate-200 font-mono">{t.filledSlots}/{t.maxSlots}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Prize: <strong className="text-emerald-400 font-mono">{formatCurrency(t.prizePool)}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Room: <strong className={t.roomReady ? 'text-emerald-400' : 'text-amber-400'}>{t.roomReady ? 'Configured' : 'Not set'}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenRoomEditor(t)}
                          className="min-h-[40px] px-3 py-2 bg-[#1D2534] hover:bg-[#263044] text-slate-100 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                          <span>Set Room ID/PW</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnlockRoomNow(t)}
                          className="min-h-[40px] px-3 py-2 bg-[#0B0E14] border border-white/10 hover:border-orange-500/40 text-slate-200 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Unlock Room Now</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTournamentId(t.id);
                            setSection('players');
                          }}
                          className="min-h-[40px] px-3 py-2 bg-[#0B0E14] border border-white/10 hover:border-white/25 text-slate-200 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Players &amp; Results</span>
                        </button>
                        <select
                          aria-label={`Status for ${t.title}`}
                          value={t.status}
                          onChange={(e) => handleUpdateStatus(t, e.target.value as TournamentStatus)}
                          className="min-h-[40px] px-2.5 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="live">Live</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteTournament(t)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                          aria-label={`Delete ${t.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {editingCredId === t.id && (
                      <div className="p-4 rounded-xl bg-[#0B0E14] border border-orange-500/30 space-y-3">
                        <div className="text-xs font-semibold text-orange-300">
                          Room Credentials for {t.title}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={roomIdInput}
                            onChange={(e) => setRoomIdInput(e.target.value)}
                            placeholder="Room ID (e.g. 88429104)"
                            maxLength={SCHEMA_LIMITS.ROOM_CRED_MAX}
                            className="min-h-[40px] px-3 py-2 bg-[#131822] border border-white/10 rounded-lg text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                          />
                          <input
                            type="text"
                            value={roomPwInput}
                            onChange={(e) => setRoomPwInput(e.target.value)}
                            placeholder="Room Password"
                            maxLength={SCHEMA_LIMITS.ROOM_CRED_MAX}
                            className="min-h-[40px] px-3 py-2 bg-[#131822] border border-white/10 rounded-lg text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={savingCred}
                            onClick={() => handleSaveRoomCredentials(t, false)}
                            className="min-h-[40px] px-4 py-2 bg-[#1D2534] hover:bg-[#263044] text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            {savingCred ? 'Saving...' : 'Save (Scheduled Reveal)'}
                          </button>
                          <button
                            type="button"
                            disabled={savingCred}
                            onClick={() => handleSaveRoomCredentials(t, true)}
                            className="min-h-[40px] px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            {savingCred ? 'Saving...' : 'Save & Unlock Immediately'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCredId(null)}
                            className="min-h-[40px] px-3 py-2 text-xs text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: CREATE NEW TOURNAMENT */}
        {section === 'create' && (
          <form
            onSubmit={handleCreateTournament}
            className="bg-[#131822] border border-white/[0.08] rounded-2xl p-6 space-y-5"
          >
            <div>
              <h2 className="text-base font-semibold text-white">Create New Tournament</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure map type, match mode, prize pool, entry fee, and Room ID reveal timing
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="t-title" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tournament Title
                </label>
                <input
                  id="t-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bermuda Night Scrims #12"
                  maxLength={SCHEMA_LIMITS.TOURNAMENT_TITLE_MAX}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="t-mode" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Match Mode
                </label>
                <select
                  id="t-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as MatchMode)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="Solo">Solo</option>
                  <option value="Duo">Duo</option>
                  <option value="Squad">Squad</option>
                </select>
              </div>

              <div>
                <label htmlFor="t-map" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Map Type
                </label>
                <select
                  id="t-map"
                  value={mapType}
                  onChange={(e) => setMapType(e.target.value as MapType)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="Bermuda">Bermuda</option>
                  <option value="Purgatory">Purgatory</option>
                  <option value="Kalahari">Kalahari</option>
                  <option value="Alpine">Alpine</option>
                  <option value="NeXTerra">NeXTerra</option>
                </select>
              </div>

              <div>
                <label htmlFor="t-prize" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Total Prize Pool (₹)
                </label>
                <input
                  id="t-prize"
                  type="number"
                  min={0}
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="t-kill" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Per-Kill Reward (₹)
                </label>
                <input
                  id="t-kill"
                  type="number"
                  min={0}
                  value={perKillReward}
                  onChange={(e) => setPerKillReward(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="t-fee" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Entry Fee (₹, 0 = Free)
                </label>
                <input
                  id="t-fee"
                  type="number"
                  min={0}
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="t-slots" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Max Slots (2–100)
                </label>
                <input
                  id="t-slots"
                  type="number"
                  min={2}
                  max={100}
                  value={maxSlots}
                  onChange={(e) => setMaxSlots(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="t-start" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Match Start Time
                </label>
                <input
                  id="t-start"
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="t-reveal" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Reveal Room ID Before Start
                </label>
                <select
                  id="t-reveal"
                  value={revealMinutes}
                  onChange={(e) => setRevealMinutes(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="5">5 minutes before start</option>
                  <option value="10">10 minutes before start</option>
                  <option value="15">15 minutes before start</option>
                  <option value="30">30 minutes before start</option>
                  <option value="1440">Immediately upon joining</option>
                </select>
              </div>

              <div>
                <label htmlFor="t-roomid" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room ID (Optional — can add later)
                </label>
                <input
                  id="t-roomid"
                  type="text"
                  value={initialRoomId}
                  onChange={(e) => setInitialRoomId(e.target.value)}
                  placeholder="e.g. 92018412"
                  maxLength={SCHEMA_LIMITS.ROOM_CRED_MAX}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label htmlFor="t-roompw" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Password (Optional)
                </label>
                <input
                  id="t-roompw"
                  type="text"
                  value={initialRoomPassword}
                  onChange={(e) => setInitialRoomPassword(e.target.value)}
                  placeholder="e.g. FF2026"
                  maxLength={SCHEMA_LIMITS.ROOM_CRED_MAX}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="t-rules" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Match Rules Summary
                </label>
                <textarea
                  id="t-rules"
                  rows={2}
                  value={rulesSummary}
                  onChange={(e) => setRulesSummary(e.target.value)}
                  maxLength={SCHEMA_LIMITS.RULES_MAX}
                  className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSection('manage')}
                className="min-h-[44px] px-5 py-2.5 bg-[#0B0E14] border border-white/10 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="min-h-[44px] px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {creating ? 'Publishing...' : 'Publish Tournament'}
              </button>
            </div>
          </form>
        )}

        {/* SECTION 3: JOINED PLAYERS LIST & WINNER/KILL PRIZE SETTLEMENT */}
        {section === 'players' && (
          <div className="bg-[#131822] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Joined Players &amp; Prize Settlement
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect joined UIDs and distribute points/prizes by Placement &amp; Kills
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select tournament"
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                  className="min-h-[40px] px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500 max-w-[240px]"
                >
                  {tournaments.length === 0 ? (
                    <option value="">No tournaments available</option>
                  ) : (
                    tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.filledSlots}/{t.maxSlots})
                      </option>
                    ))
                  )}
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Search IGN or FF UID"
                    className="min-h-[40px] pl-8 pr-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {selectedTournament && (
              <div className="px-5 py-3 bg-[#0B0E14]/60 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
                  <span>Mode: <strong className="text-slate-200">{selectedTournament.mode}</strong></span>
                  <span>Per-Kill Rate: <strong className="text-emerald-400 font-mono">{formatCurrency(selectedTournament.perKillReward)}</strong></span>
                  <span>Prize Pool: <strong className="text-emerald-400 font-mono">{formatCurrency(selectedTournament.prizePool)}</strong></span>
                </div>
                <span className="text-slate-400">
                  Total Payout = Rank Bonus + (Kills × {formatCurrency(selectedTournament.perKillReward)})
                </span>
              </div>
            )}

            {regsLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((r) => (
                  <div key={r} className="h-11 bg-white/[0.04] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-medium text-white">No joined players found</p>
                <p className="text-xs text-slate-400">
                  Players who register with their Free Fire UID and IGN for this match will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-xs font-medium text-slate-400">
                        <th className="py-3 px-4 w-16">Slot</th>
                        <th className="py-3 px-4">Player IGN / Team</th>
                        <th className="py-3 px-4">FF UID</th>
                        <th className="py-3 px-4 w-24">Rank #</th>
                        <th className="py-3 px-4 w-24">Kills</th>
                        <th className="py-3 px-4 w-28">Rank Bonus (₹)</th>
                        <th className="py-3 px-4 w-24">Points</th>
                        <th className="py-3 px-4 text-right">Total Prize</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-xs">
                      {filteredRegistrations.map((reg) => {
                        const d = drafts[reg.userId] || {
                          placement: '0',
                          kills: '0',
                          bonusPrize: '0',
                          points: '0',
                        };
                        const perKillRate = selectedTournament?.perKillReward || 0;
                        const killAmt = Math.max(0, Number(d.kills) || 0) * perKillRate;
                        const totalAmt = Math.round((Math.max(0, Number(d.bonusPrize) || 0)) + killAmt);

                        return (
                          <tr key={reg.userId} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4 font-mono text-slate-300 tabular-nums">
                              #{reg.slotNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white text-sm">{reg.ign}</div>
                              {(reg.teamName || reg.partnerIgn) && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {[reg.teamName, reg.partnerIgn].filter(Boolean).join(' · ')}
                                </div>
                              )}
                              {reg.resultStatus === 'settled' && (
                                <div className="inline-flex items-center gap-1 text-[11px] text-emerald-400 mt-0.5">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Settled</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300 tabular-nums">
                              {reg.ffUid}
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                aria-label={`Placement for ${reg.ign}`}
                                value={d.placement}
                                onChange={(e) =>
                                  updateDraftField(reg.userId, 'placement', e.target.value, perKillRate)
                                }
                                className="w-20 min-h-[36px] px-2.5 py-1 bg-[#0B0E14] border border-white/10 rounded-lg font-mono text-white tabular-nums focus:outline-none focus:border-orange-500"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                aria-label={`Kills for ${reg.ign}`}
                                value={d.kills}
                                onChange={(e) =>
                                  updateDraftField(reg.userId, 'kills', e.target.value, perKillRate)
                                }
                                className="w-20 min-h-[36px] px-2.5 py-1 bg-[#0B0E14] border border-white/10 rounded-lg font-mono text-white tabular-nums focus:outline-none focus:border-orange-500"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                aria-label={`Rank bonus prize for ${reg.ign}`}
                                value={d.bonusPrize}
                                onChange={(e) =>
                                  updateDraftField(reg.userId, 'bonusPrize', e.target.value, perKillRate)
                                }
                                className="w-24 min-h-[36px] px-2.5 py-1 bg-[#0B0E14] border border-white/10 rounded-lg font-mono text-white tabular-nums focus:outline-none focus:border-orange-500"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                aria-label={`Points for ${reg.ign}`}
                                value={d.points}
                                onChange={(e) =>
                                  updateDraftField(reg.userId, 'points', e.target.value, perKillRate)
                                }
                                className="w-20 min-h-[36px] px-2.5 py-1 bg-[#0B0E14] border border-white/10 rounded-lg font-mono text-orange-400 tabular-nums focus:outline-none focus:border-orange-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums text-sm">
                              {formatCurrency(totalAmt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    Rank #1 = 15 pts · #2 = 12 pts · #3 = 10 pts · +2 pts per kill (editable per player)
                  </div>
                  <button
                    type="button"
                    disabled={settling}
                    onClick={handleSettleTournament}
                    className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Award className="w-4 h-4" />
                    <span>{settling ? 'Distributing...' : 'Distribute Points & Prizes'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
