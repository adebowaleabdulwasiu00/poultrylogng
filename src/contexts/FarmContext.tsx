import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db, getActiveFarmId, setActiveFarmId, DEFAULT_FARM_ID } from '@/db/database';
import { useAuth } from './AuthContext';
import type { Farm } from '@/db/types';

interface FarmContextValue {
  currentFarmId: string;
  currentFarm: Farm | null;
  farms: Farm[];
  loading: boolean;
  switchFarm: (farmId: string) => Promise<void>;
  refreshFarms: () => Promise<void>;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { phase, memberships, currentMembership } = useAuth();
  const [currentFarmId, setCurrentFarmId] = useState<string>(DEFAULT_FARM_ID);
  const [currentFarm, setCurrentFarm] = useState<Farm | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFarms = useCallback(async () => {
    if (phase !== 'farm_selected' || memberships.length === 0) {
      setFarms([]);
      return [];
    }
    const farmIds = memberships.map(m => m.farmId);
    const all = await db.farms.where('farmId').anyOf(farmIds).toArray();
    const active = all.filter(f => f.status === 'active');
    setFarms(active);
    return active;
  }, [phase, memberships]);

  const loadCurrentFarm = useCallback(async (farmId: string) => {
    const farm = await db.farms.where('farmId').equals(farmId).first();
    setCurrentFarm(farm || null);
  }, []);

  useEffect(() => {
    if (phase !== 'farm_selected') {
      setLoading(false);
      return;
    }
    (async () => {
      if (currentMembership) {
        setCurrentFarmId(currentMembership.farmId);
        localStorage.setItem('activeFarmId', currentMembership.farmId);
        await loadCurrentFarm(currentMembership.farmId);
      } else {
        const farmId = await getActiveFarmId();
        setCurrentFarmId(farmId);
        await loadCurrentFarm(farmId);
      }
      await loadFarms();
      setLoading(false);
    })();
  }, [phase, currentMembership, loadFarms, loadCurrentFarm]);

  const switchFarm = useCallback(async (farmId: string) => {
    await setActiveFarmId(farmId);
    setCurrentFarmId(farmId);
    await loadCurrentFarm(farmId);
  }, [loadCurrentFarm]);

  const refreshFarms = useCallback(async () => {
    await loadFarms();
    await loadCurrentFarm(currentFarmId);
  }, [loadFarms, loadCurrentFarm, currentFarmId]);

  return (
    <FarmContext.Provider value={{ currentFarmId, currentFarm, farms, loading, switchFarm, refreshFarms }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used within FarmProvider');
  return ctx;
}
