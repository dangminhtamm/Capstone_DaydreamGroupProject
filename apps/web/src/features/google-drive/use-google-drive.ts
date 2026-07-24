'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useAuth } from '@/contexts/AuthContext';
import {
  fetchDriveFiles,
  fetchDriveStatus,
  syncDriveFiles,
} from './google-drive-api';
import type {
  DriveConnectionStatus,
  DriveFeedback,
  GoogleDriveFile,
} from './google-drive-types';

type AuthContextValue = ReturnType<typeof useAuth>;

export function useGoogleDriveIntegration(auth: AuthContextValue) {
  const { isAuthenticated, getAccessToken } = auth;
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<DriveFeedback | null>(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDrive = useCallback(async () => {
    if (!isAuthenticated || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const [statusResult, filesResult] = await Promise.all([
        fetchDriveStatus(token),
        fetchDriveFiles(token),
      ]);
      if (!mountedRef.current) return;
      setStatus(statusResult);
      setFiles(filesResult);
    } catch (error) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load Google Drive.',
      });
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadDrive();
      return;
    }
    setStatus(null);
    setFiles([]);
    setFeedback(null);
  }, [isAuthenticated, loadDrive]);

  const syncGoogleDrive = useCallback(async (limit?: number) => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await syncDriveFiles(token, limit);
      if (!mountedRef.current) return;
      setFeedback({
        type: 'success',
        text: `Drive synced: ${result.syncedCount} file${result.syncedCount === 1 ? '' : 's'} queued for memory indexing.`,
      });
      loadingRef.current = false;
      await loadDrive();
    } catch (error) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not sync Google Drive.',
      });
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [getAccessToken, loadDrive]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    status,
    files,
    isLoading,
    isSyncing,
    feedback,
    loadDrive,
    syncGoogleDrive,
    clearFeedback,
  };
}
