// hooks/useOfflineAction.ts
// Wrapper universel : online → exécute, offline → met en queue

import { useCallback } from 'react';
import { useNetwork } from '../lib/NetworkContext';
import { useOfflineQueue, QueuedActionType } from '../lib/OfflineQueueContext';

interface UseOfflineActionOptions {
  onQueued?: () => void;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export function useOfflineAction(
  actionType: QueuedActionType,
  options: UseOfflineActionOptions = {}
) {
  const { isOnline } = useNetwork();
  const { enqueue } = useOfflineQueue();

  const execute = useCallback(async (
    apiCall: () => Promise<unknown>,
    payload: Record<string, unknown>
  ) => {
    if (isOnline) {
      try {
        const result = await apiCall();
        options.onSuccess?.();
        return result;
      } catch (err) {
        options.onError?.(err as Error);
        throw err;
      }
    } else {
      await enqueue(actionType, payload);
      options.onQueued?.();
    }
  }, [isOnline, actionType, enqueue, options.onQueued, options.onSuccess, options.onError]);

  return { execute, isOnline };
}
