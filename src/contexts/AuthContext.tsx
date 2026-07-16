import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, getGoogleProvider } from '@/db/firebase';
import { db, nowISO, generateId } from '@/db/database';
import type { AuthUser, FarmMembership, FarmRole, Notification } from '@/db/types';

type AuthPhase = 'loading' | 'unauthenticated' | 'no_farm' | 'farm_selected';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_KEY = 'authSessionStart';

interface AuthContextValue {
  phase: AuthPhase;
  authUser: AuthUser | null;
  memberships: FarmMembership[];
  pendingMemberships: FarmMembership[];
  currentMembership: FarmMembership | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  selectFarm: (farmId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  createFarm: (farmData: Record<string, string>) => Promise<string>;
  requestJoinFarm: (farmId: string, message?: string) => Promise<void>;
  getMembershipForFarm: (farmId: string) => Promise<FarmMembership | null>;
  getNotifications: (farmId: string) => Promise<Notification[]>;
  markNotificationRead: (id: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userToAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || '',
    providerId: user.providerData[0]?.providerId || 'google.com',
    emailVerified: user.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>('loading');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<FarmMembership[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<FarmMembership[]>([]);
  const [currentMembership, setCurrentMembership] = useState<FarmMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const loadMemberships = useCallback(async (authUser: AuthUser) => {
    const all = await db.memberships
      .where('userEmail')
      .equals(authUser.email)
      .toArray();
    const active = all.filter(m => m.status === 'active');
    const pending = all.filter(m => m.status === 'pending');
    setMemberships(active);
    setPendingMemberships(pending);
    return { active, pending };
  }, []);

  const resolvePhase = useCallback(async (authUser: AuthUser, mems: FarmMembership[]) => {
    if (mems.length === 0) {
      setPhase('no_farm');
      return;
    }
    const lastFarmId = localStorage.getItem('lastFarmId');
    const lastFarm = lastFarmId ? mems.find(m => m.farmId === lastFarmId) : null;
    const target = lastFarm || mems[0];
    setCurrentMembership(target);
    localStorage.setItem('lastFarmId', target.farmId);
    setPhase('farm_selected');
  }, []);

  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  const scheduleSessionExpiry = useCallback((expiresAt: number) => {
    clearSessionTimer();
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      return false;
    }
    sessionTimerRef.current = setTimeout(async () => {
      const auth = getFirebaseAuth();
      if (auth) await firebaseSignOut(auth);
      localStorage.removeItem(SESSION_KEY);
      setAuthUser(null);
      setUser(null);
      setMemberships([]);
      setCurrentMembership(null);
      setPhase('unauthenticated');
    }, remaining);
    return true;
  }, [clearSessionTimer]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      (async () => {
        const localUser: AuthUser = {
          uid: 'local-user',
          email: 'local@localhost',
          displayName: 'Local User',
          photoURL: '',
          providerId: 'local',
          emailVerified: true,
        };
        setAuthUser(localUser);

        const existingMembership = await db.memberships
          .where({ userEmail: localUser.email, farmId: 'default-farm' })
          .first();
        if (!existingMembership) {
          const now = nowISO();
          await db.memberships.add({
            membershipId: 'local-owner',
            farmId: 'default-farm',
            farmName: 'Default Farm',
            userEmail: localUser.email,
            firebaseUid: localUser.uid,
            userName: localUser.displayName,
            userPhoto: '',
            role: 'owner',
            status: 'active',
            invitationStatus: 'none',
            joinedDate: now,
            lastAccessedDate: now,
            createdBy: localUser.email,
            createdAt: now,
            updatedAt: now,
          });
        }
        const membership = await db.memberships
          .where({ userEmail: localUser.email, farmId: 'default-farm' })
          .first();
        if (membership) {
          setMemberships([membership]);
          setCurrentMembership(membership);
        }
        setPhase('farm_selected');
        setLoading(false);
      })();
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let sessionStart = Number(localStorage.getItem(SESSION_KEY) || '0');
        const now = Date.now();

        if (!sessionStart || (now - sessionStart) > SESSION_DURATION_MS) {
          sessionStart = now;
          localStorage.setItem(SESSION_KEY, String(sessionStart));
        }

        const expiresAt = sessionStart + SESSION_DURATION_MS;
        if (now >= expiresAt) {
          await firebaseSignOut(auth);
          localStorage.removeItem(SESSION_KEY);
          clearSessionTimer();
          setAuthUser(null);
          setUser(null);
          setMemberships([]);
          setCurrentMembership(null);
          setPhase('unauthenticated');
          setLoading(false);
          return;
        }

        scheduleSessionExpiry(expiresAt);

        const au = userToAuthUser(user);
        setAuthUser(au);
        setUser(user);
        const { active } = await loadMemberships(au);
        await resolvePhase(au, active);
      } else {
        clearSessionTimer();
        localStorage.removeItem(SESSION_KEY);
        setAuthUser(null);
        setUser(null);
        setMemberships([]);
        setCurrentMembership(null);
        setPhase('unauthenticated');
      }
      setLoading(false);
    });
    return () => {
      clearSessionTimer();
      unsubscribe();
    };
  }, [loadMemberships, resolvePhase, scheduleSessionExpiry, clearSessionTimer]);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase is not configured. Set VITE_FIREBASE_* environment variables.');
      return;
    }
    setError(null);
    try {
      await signInWithPopup(auth, getGoogleProvider());
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your internet connection.');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    clearSessionTimer();
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('lastFarmId');
    localStorage.removeItem('activeFarmId');
    const auth = getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
    setPhase('unauthenticated');
    setAuthUser(null);
    setUser(null);
    setMemberships([]);
    setPendingMemberships([]);
    setCurrentMembership(null);
  }, [clearSessionTimer]);

  const selectFarm = useCallback(async (farmId: string) => {
    const mem = memberships.find(m => m.farmId === farmId);
    if (mem) {
      setCurrentMembership(mem);
      localStorage.setItem('lastFarmId', farmId);
      setPhase('farm_selected');
      if (mem.id) {
        await db.memberships.update(mem.id, { lastAccessedDate: nowISO() });
      }
    }
  }, [memberships]);

  const refreshMemberships = useCallback(async () => {
    if (!authUser) return;
    const { active } = await loadMemberships(authUser);
    if (currentMembership) {
      const updated = active.find(m => m.farmId === currentMembership.farmId);
      if (updated) setCurrentMembership(updated);
    }
  }, [authUser, loadMemberships, currentMembership]);

  const createFarm = useCallback(async (farmData: Record<string, string>): Promise<string> => {
    if (!authUser) throw new Error('Not authenticated');
    const now = nowISO();
    const farmId = generateId();
    const farmCode = `FRM-${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await db.farms.add({
      farmId, farmCode,
      farmName: farmData.farmName || '',
      businessName: farmData.businessName || '',
      ownerName: authUser.displayName,
      contactPerson: authUser.displayName,
      phone: farmData.phone || '',
      email: farmData.email || authUser.email,
      address: farmData.address || '',
      state: farmData.state || '',
      lga: farmData.lga || '',
      country: farmData.country || 'Nigeria',
      farmType: farmData.farmType || 'Poultry',
      logo: farmData.logo || '',
      subscriptionStatus: 'active',
      registrationDate: now,
      status: 'active',
      createdAt: now, updatedAt: now, syncStatus: 'pending',
    });

    const membershipId = generateId();
    await db.memberships.add({
      membershipId, farmId, farmName: farmData.farmName || '',
      userEmail: authUser.email, firebaseUid: authUser.uid,
      userName: authUser.displayName, userPhoto: authUser.photoURL,
      role: 'owner', status: 'active', invitationStatus: 'none',
      joinedDate: now, lastAccessedDate: now,
      createdBy: authUser.email, createdAt: now, updatedAt: now,
    });

    await loadMemberships(authUser);
    localStorage.setItem('lastFarmId', farmId);
    setCurrentMembership(await db.memberships.where('membershipId').equals(membershipId).first() as FarmMembership);
    setPhase('farm_selected');
    return farmId;
  }, [authUser, loadMemberships]);

  const requestJoinFarm = useCallback(async (farmId: string, message?: string) => {
    if (!authUser) throw new Error('Not authenticated');
    const now = nowISO();
    const farm = await db.farms.where('farmId').equals(farmId).first();
    const membershipId = generateId();

    await db.memberships.add({
      membershipId, farmId, farmName: farm?.farmName || '',
      userEmail: authUser.email, firebaseUid: authUser.uid,
      userName: authUser.displayName, userPhoto: authUser.photoURL,
      role: 'farm_staff', status: 'pending', invitationStatus: 'none',
      joinedDate: '', lastAccessedDate: '',
      createdBy: authUser.email, createdAt: now, updatedAt: now,
      requestMessage: message || '',
    });

    const admins = await db.memberships
      .where({ farmId })
      .filter(m => m.status === 'active' && (m.role === 'owner' || m.role === 'admin'))
      .toArray();

    for (const admin of admins) {
      await db.notifications.add({
        farmId, type: 'membership_request',
        title: 'New Join Request',
        message: `${authUser.displayName} (${authUser.email}) has requested to join ${farm?.farmName || 'your farm'}.`,
        targetEmail: admin.userEmail,
        fromUser: authUser.displayName,
        fromEmail: authUser.email,
        read: false,
        createdAt: now,
      });
    }

    await loadMemberships(authUser);
  }, [authUser, loadMemberships]);

  const getMembershipForFarm = useCallback(async (farmId: string): Promise<FarmMembership | null> => {
    if (!authUser) return null;
    const result = await db.memberships.where({ farmId, userEmail: authUser.email, status: 'active' }).first();
    return result ?? null;
  }, [authUser]);

  const getNotifications = useCallback(async (farmId: string): Promise<Notification[]> => {
    if (!authUser) return [];
    return db.notifications
      .where({ farmId, targetEmail: authUser.email })
      .reverse()
      .sortBy('createdAt')
      .then(n => n.slice(0, 50));
  }, [authUser]);

  const markNotificationRead = useCallback(async (id: number) => {
    await db.notifications.update(id, { read: true });
  }, []);

  return (
    <AuthContext.Provider value={{
      phase, authUser, memberships, pendingMemberships, currentMembership,
      loading, error, signInWithGoogle, signOut, selectFarm, refreshMemberships,
      createFarm, requestJoinFarm, getMembershipForFarm,
      getNotifications, markNotificationRead,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
