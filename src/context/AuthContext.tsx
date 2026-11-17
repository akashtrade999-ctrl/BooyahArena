import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ConfirmationResult,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { BOOTSTRAPPED_ADMIN_EMAIL, SCHEMA_LIMITS, UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phoneNumber: string, containerId: string) => Promise<ConfirmationResult>;
  verifyPhoneOtp: (confirmation: ConfirmationResult, otpCode: string) => Promise<void>;
  updatePlayerIdentity: (ffUid: string, ign: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      try {
        const isBootstrapped =
          firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL &&
          firebaseUser.emailVerified === true;

        let adminFlag = isBootstrapped;
        if (!adminFlag) {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
            adminFlag = adminSnap.exists();
          } catch {
            adminFlag = false;
          }
        }
        setIsAdmin(adminFlag);

        const userRef = doc(db, 'users', firebaseUser.uid);
        const existingSnap = await getDoc(userRef);

        if (!existingSnap.exists()) {
          const rawName =
            firebaseUser.displayName ||
            firebaseUser.phoneNumber ||
            firebaseUser.email?.split('@')[0] ||
            'Player';
          const safeDisplayName = rawName.trim().slice(0, SCHEMA_LIMITS.DISPLAY_NAME_MAX) || 'Player';

          const newProfilePayload: Record<string, unknown> = {
            uid: firebaseUser.uid,
            displayName: safeDisplayName,
            totalPoints: 0,
            totalWinnings: 0,
            totalKills: 0,
            matchesPlayed: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (firebaseUser.email) {
            newProfilePayload.email = firebaseUser.email.slice(0, 120);
          }
          if (firebaseUser.phoneNumber) {
            newProfilePayload.phoneNumber = firebaseUser.phoneNumber.slice(0, 30);
          }

          try {
            await setDoc(userRef, newProfilePayload);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`);
          }
        }

        unsubscribeProfile = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            }
            setAuthLoading(false);
          },
          (err) => {
            setAuthLoading(false);
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        );
      } catch (err) {
        setAuthLoading(false);
        console.error('Auth initialization error:', err);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const sendPhoneOtp = async (phoneNumber: string, containerId: string) => {
    const existingEl = document.getElementById(containerId);
    if (existingEl) {
      existingEl.innerHTML = '';
    }
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    });
    return await signInWithPhoneNumber(auth, phoneNumber, verifier);
  };

  const verifyPhoneOtp = async (confirmation: ConfirmationResult, otpCode: string) => {
    await confirmation.confirm(otpCode);
  };

  const updatePlayerIdentity = async (ffUid: string, ign: string) => {
    if (!user) return;
    const cleanUid = ffUid.trim().slice(0, SCHEMA_LIMITS.FF_UID_MAX);
    const cleanIgn = ign.trim().slice(0, SCHEMA_LIMITS.IGN_MAX);

    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        ffUid: cleanUid,
        ign: cleanIgn,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }

    const lbRef = doc(db, 'leaderboard', user.uid);
    try {
      const lbSnap = await getDoc(lbRef);
      if (lbSnap.exists()) {
        await updateDoc(lbRef, {
          ign: cleanIgn,
          ffUid: cleanUid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(lbRef, {
          uid: user.uid,
          ign: cleanIgn,
          ffUid: cleanUid,
          totalPoints: 0,
          totalWinnings: 0,
          totalKills: 0,
          matchesPlayed: 0,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaderboard/${user.uid}`);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        authLoading,
        signInWithGoogle,
        sendPhoneOtp,
        verifyPhoneOtp,
        updatePlayerIdentity,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
