import { Timestamp } from 'firebase/firestore';

export type MatchMode = 'Solo' | 'Duo' | 'Squad';
export type MapType = 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NeXTerra';
export type TournamentStatus = 'upcoming' | 'live' | 'completed';
export type ResultStatus = 'pending' | 'settled';

export const SCHEMA_LIMITS = {
  UID_MAX: 128,
  UID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 80,
  IGN_MIN: 2,
  IGN_MAX: 40,
  FF_UID_MIN: 5,
  FF_UID_MAX: 20,
  FF_UID_PATTERN: /^[0-9]+$/,
  TEAM_NAME_MAX: 40,
  PARTNER_IGN_MAX: 100,
  TOURNAMENT_TITLE_MIN: 3,
  TOURNAMENT_TITLE_MAX: 100,
  RULES_MAX: 500,
  ROOM_CRED_MAX: 40,
} as const;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'akashtrade999@gmail.com';

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  ffUid?: string;
  ign?: string;
  totalPoints: number;
  totalWinnings: number;
  totalKills: number;
  matchesPlayed: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PlayerStanding {
  uid: string;
  ign: string;
  ffUid?: string;
  totalPoints: number;
  totalWinnings: number;
  totalKills: number;
  matchesPlayed: number;
  updatedAt: Timestamp;
}

export interface Tournament {
  id: string;
  title: string;
  mode: MatchMode;
  mapType: MapType;
  prizePool: number;
  perKillReward: number;
  entryFee: number;
  maxSlots: number;
  filledSlots: number;
  startTime: Timestamp;
  revealAt: Timestamp;
  roomReady: boolean;
  status: TournamentStatus;
  rulesSummary?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RoomCredential {
  roomId: string;
  roomPassword: string;
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface TournamentRegistration {
  tournamentId: string;
  userId: string;
  ffUid: string;
  ign: string;
  teamName?: string;
  partnerIgn?: string;
  slotNumber: number;
  kills: number;
  placement: number;
  pointsAwarded: number;
  prizeAwarded: number;
  resultStatus: ResultStatus;
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}
