'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useAuth } from '@/contexts/AuthContext';
import {
  fetchDriveImportCandidates,
  fetchDriveFiles,
  fetchDriveStatus,
  importDriveFiles,
  syncDriveFiles,
} from './google-drive-api';
import type {
  DriveConnectionStatus,
  DriveFeedback,
  GoogleDriveFile,
  GoogleDriveImportCandidate,
} from './google-drive-types';

type AuthContextValue = ReturnType<typeof useAuth>;

export function useGoogleDriveIntegration(auth: AuthContextValue) {
  const { isAuthenticated, getAccessToken } = auth;
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [candidates, setCandidates] = useState<GoogleDriveImportCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isListingCandidates, setIsListingCandidates] = useState(false);
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
    setCandidates([]);
    setFeedback(null);
  }, [isAuthenticated, loadDrive]);

  const listImportCandidates = useCallback(async (options: { limit?: number; query?: string } = {}) => {
    setIsListingCandidates(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await fetchDriveImportCandidates(token, options);
      if (!mountedRef.current) return [];
      setCandidates(result);
      if (!result.length) {
        setFeedback({
          type: 'success',
          text: 'No Drive files matched this import search.',
        });
      }
      return result;
    } catch (error) {
      if (mountedRef.current) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'Could not list Google Drive files.',
        });
      }
      return [];
    } finally {
      if (mountedRef.current) setIsListingCandidates(false);
    }
  }, [getAccessToken]);

  const importSelectedDriveFiles = useCallback(async (fileIds: string[]) => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await importDriveFiles(token, fileIds);
      if (!mountedRef.current) return false;
      setFeedback({
        type: 'success',
        text: `Drive imported: ${result.syncedCount} selected file${result.syncedCount === 1 ? '' : 's'} queued for memory indexing.`,
      });
      loadingRef.current = false;
      await loadDrive();
      await listImportCandidates();
      return true;
    } catch (error) {
      if (!mountedRef.current) return false;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not import selected Google Drive files.',
      });
      return false;
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [getAccessToken, listImportCandidates, loadDrive]);

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
    candidates,
    isLoading,
    isSyncing,
    isListingCandidates,
    feedback,
    loadDrive,
    listImportCandidates,
    importSelectedDriveFiles,
    syncGoogleDrive,
    clearFeedback,
  };
}
