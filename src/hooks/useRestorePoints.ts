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
      const pointTitle = customName || (isAuto ? `Ponto Automático - ${now.toLocaleDateString('pt-BR')}` : `Ponto de Restauração - Sistema (${dateFormatted})`);
      const newPoint: SystemRestorePoint = {
        id: `rp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      if (localStorage.getItem('gc_v1_last_auto_restore_date') !== todayDateStr) createRestorePoint(`Ponto Automático - ${new Date().toLocaleDateString('pt-BR')}`, true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDeleteRestorePoint = async (pointId: string) => {
    setRestorePoints((prev) => {
      const updated = prev.filter((p) => p.id !== pointId);
      try { localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated)); } catch {}
      return updated;
    });
    await deleteRestorePointFromFirestore(pointId);
  };

  return { restorePoints, createRestorePoint, handleDeleteRestorePoint };
};
