import { useEffect, useState } from 'react';
import type { AppData, SystemRestorePoint } from '../types';
import { initialAppData } from '../data/initialData';
import { subscribeToRestorePoints, saveRestorePointToFirestore, deleteRestorePointFromFirestore } from '../lib/api';

import { logger } from '../lib/logger';
export const useRestorePoints = (dataRef: React.MutableRefObject<AppData>) => {
  const [restorePoints, setRestorePoints] = useState<SystemRestorePoint[]>(() => {
    try {
      const saved = localStorage.getItem('gc_v1_restore_points');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    const unsub = subscribeToRestorePoints(
      (points) => {
        setRestorePoints(points);
        try { localStorage.setItem('gc_v1_restore_points', JSON.stringify(points)); } catch {}
      },
      (err) => logger.warn('Restore points stream error:', err),
    );
    return () => unsub();
  }, []);

  const createRestorePoint = async (customName?: string, isAuto = false): Promise<SystemRestorePoint | null> => {
    try {
      const now = new Date();
      const todayDateStr = now.toISOString().split('T')[0];
      if (isAuto && localStorage.getItem('gc_v1_last_auto_restore_date') === todayDateStr) return null;
      const currentAppData = dataRef.current;
      if (isAuto && (!currentAppData || (!currentAppData.clients.length && !currentAppData.charges.length))) return null;
      const dateFormatted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const pointTitle = customName || (isAuto ? `Ponto Automático Diário (00:00) - ${now.toLocaleDateString('pt-BR')}` : `Ponto de Restauração - Sistema (${dateFormatted})`);
      const newPoint: SystemRestorePoint = {
        id: isAuto ? `rp_auto_${todayDateStr.replace(/-/g, '_')}_0000` : `rp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: pointTitle,
        createdAt: now.toISOString(),
        clientsCount: currentAppData?.clients.length || 0,
        chargesCount: currentAppData?.charges.length || 0,
        data: {
          clients: currentAppData ? JSON.parse(JSON.stringify(currentAppData.clients)) : [],
          charges: currentAppData ? JSON.parse(JSON.stringify(currentAppData.charges)) : [],
          settings: currentAppData ? JSON.parse(JSON.stringify(currentAppData.settings)) : initialAppData.settings,
        },
      };
      setRestorePoints((prev) => {
        const updated = [newPoint, ...prev.filter((p) => p.id !== newPoint.id)];
        try { localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated)); } catch {}
        return updated;
      });
      if (isAuto) localStorage.setItem('gc_v1_last_auto_restore_date', todayDateStr);
      saveRestorePointToFirestore(newPoint).catch((err) => logger.warn('Real-time restore point sync notice:', err));
      return newPoint;
    } catch (err) {
      logger.error('Error creating restore point:', err);
      return null;
    }
  };

  // Schedule automatic restore point every day at 00:00
  useEffect(() => {
    let midnightTimeout: NodeJS.Timeout | null = null;

    const checkAndTriggerDailyRestore = () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const lastAuto = localStorage.getItem('gc_v1_last_auto_restore_date');
      if (lastAuto !== todayDateStr) {
        createRestorePoint(`Ponto Automático Diário (00:00) - ${new Date().toLocaleDateString('pt-BR')}`, true);
      }
    };

    // 1. Initial check after app readiness
    const initialTimer = setTimeout(() => {
      checkAndTriggerDailyRestore();
    }, 2500);

    // 2. Exact calculation for next midnight 00:00:00
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

      midnightTimeout = setTimeout(() => {
        checkAndTriggerDailyRestore();
        scheduleNextMidnight(); // schedule next day 00:00
      }, msUntilMidnight);
    };

    scheduleNextMidnight();

    // 3. Periodic fallback check every 60 seconds (handles device sleep/tab resume across midnight)
    const intervalCheck = setInterval(() => {
      checkAndTriggerDailyRestore();
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      if (midnightTimeout) clearTimeout(midnightTimeout);
      clearInterval(intervalCheck);
    };
  }, []);

  const handleDeleteRestorePoint = async (pointId: string) => {
    setRestorePoints((prev) => {
      const updated = prev.filter((p) => p.id !== pointId);
      try { localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated)); } catch {}
      return updated;
    });
    await deleteRestorePointFromFirestore(pointId);
  };

  const importExternalRestorePoint = async (
    customName: string | undefined,
    data: { clients?: import('../types').Client[]; charges?: import('../types').Charge[]; settings?: import('../types').CompanySettings }
  ): Promise<SystemRestorePoint | null> => {
    try {
      const now = new Date();
      const dateFormatted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const title = customName?.trim() || `Ponto Externo - ${dateFormatted}`;
      const newPoint: SystemRestorePoint = {
        id: `rp_ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: title,
        createdAt: now.toISOString(),
        clientsCount: data.clients?.length || 0,
        chargesCount: data.charges?.length || 0,
        data: {
          clients: data.clients ? JSON.parse(JSON.stringify(data.clients)) : [],
          charges: data.charges ? JSON.parse(JSON.stringify(data.charges)) : [],
          settings: data.settings ? JSON.parse(JSON.stringify(data.settings)) : initialAppData.settings,
        },
      };

      setRestorePoints((prev) => {
        const updated = [newPoint, ...prev.filter((p) => p.id !== newPoint.id)];
        try { localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated)); } catch {}
        return updated;
      });

      saveRestorePointToFirestore(newPoint).catch((err) => logger.warn('External restore point cloud sync notice:', err));
      return newPoint;
    } catch (err) {
      logger.error('Error importing external restore point:', err);
      return null;
    }
  };

  return { restorePoints, createRestorePoint, handleDeleteRestorePoint, importExternalRestorePoint };
};
