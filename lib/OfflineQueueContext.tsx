// lib/OfflineQueueContext.tsx
// File d'attente offline avec persistance AsyncStorage et replay automatique

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from './NetworkContext';
import { api } from './api';
import { devLog, devWarn } from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueuedActionType =
  | 'CREATE_REQUEST'
  | 'CANCEL_REQUEST'
  | 'ACCEPT_MISSION'
  | 'SUBMIT_RATING'
  | 'UPDATE_LOCATION';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
}

interface OfflineQueueContextType {
  queue: QueuedAction[];
  pendingCount: number;
  enqueue: (type: QueuedActionType, payload: Record<string, unknown>) => Promise<void>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  isProcessing: boolean;
}

const STORAGE_KEY = 'fixed:offline_queue';
const MAX_RETRIES = 3;

const OfflineQueueContext = createContext<OfflineQueueContextType>({
  queue: [],
  pendingCount: 0,
  enqueue: async () => {},
  processQueue: async () => {},
  clearQueue: async () => {},
  isProcessing: false,
});

// ─── Handlers par type d'action ───────────────────────────────────────────────

async function executeAction(action: QueuedAction): Promise<void> {
  switch (action.type) {
    case 'CREATE_REQUEST':
      await api.post('/requests', action.payload);
      break;
    case 'CANCEL_REQUEST':
      await api.post(`/requests/${action.payload.requestId}/cancel`, action.payload);
      break;
    case 'ACCEPT_MISSION':
      await api.post(`/requests/${action.payload.requestId}/accept`, action.payload);
      break;
    case 'SUBMIT_RATING':
      await api.post('/ratings', action.payload);
      break;
    case 'UPDATE_LOCATION': {
      // GPS update — drop si trop vieux (> 30 secondes)
      const ageMs = Date.now() - new Date(action.createdAt).getTime();
      if (ageMs > 30_000) return; // silently discard stale location
      await api.post('/providers/location', action.payload);
      break;
    }
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isOnline, wasOffline } = useNetwork();
  const isProcessingRef = useRef(false);
  const queueRef = useRef<QueuedAction[]>([]);

  // Keep ref in sync for use inside callbacks
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Charger la queue depuis AsyncStorage au démarrage
  useEffect(() => {
    loadQueue();
  }, []);

  // Rejouer automatiquement dès le retour en ligne
  useEffect(() => {
    if (isOnline && wasOffline && queueRef.current.length > 0) {
      processQueue();
    }
  }, [isOnline, wasOffline]);

  async function loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: QueuedAction[] = JSON.parse(stored);
        setQueue(parsed);
        queueRef.current = parsed;
      }
    } catch (err) {
      devWarn('[OfflineQueue] Erreur chargement:', err);
    }
  }

  async function persistQueue(newQueue: QueuedAction[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
      setQueue(newQueue);
      queueRef.current = newQueue;
    } catch (err) {
      devWarn('[OfflineQueue] Erreur persistance:', err);
    }
  }

  const enqueue = useCallback(async (type: QueuedActionType, payload: Record<string, unknown>) => {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: type === 'UPDATE_LOCATION' ? 0 : MAX_RETRIES,
    };

    const newQueue = [...queueRef.current, action];
    await persistQueue(newQueue);
    devLog(`[OfflineQueue] Enqueued: ${type} (id=${action.id})`);
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);

    const currentQueue = [...queueRef.current];
    const failedActions: QueuedAction[] = [];

    for (const action of currentQueue) {
      try {
        await executeAction(action);
        devLog(`[OfflineQueue] Executed: ${action.type} (id=${action.id})`);
      } catch (err) {
        const updatedAction = { ...action, retryCount: action.retryCount + 1 };
        if (updatedAction.retryCount <= updatedAction.maxRetries) {
          failedActions.push(updatedAction);
          devWarn(`[OfflineQueue] Failed (retry ${updatedAction.retryCount}/${updatedAction.maxRetries}): ${action.type}`);
        } else {
          devWarn(`[OfflineQueue] Dropped after ${updatedAction.maxRetries} retries: ${action.type}`);
        }
      }
    }

    await persistQueue(failedActions);
    isProcessingRef.current = false;
    setIsProcessing(false);
  }, []);

  const clearQueue = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setQueue([]);
    queueRef.current = [];
  }, []);

  return (
    <OfflineQueueContext.Provider value={{
      queue,
      pendingCount: queue.length,
      enqueue,
      processQueue,
      clearQueue,
      isProcessing,
    }}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export const useOfflineQueue = () => useContext(OfflineQueueContext);
