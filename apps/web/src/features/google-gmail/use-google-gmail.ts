'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useAuth } from '@/contexts/AuthContext';
import {
  fetchGmailImportCandidates,
  fetchGmailMessages,
  fetchGmailStatus,
  importGmailMessages,
  syncGmailMessages,
} from './google-gmail-api';
import type {
  GmailConnectionStatus,
  GmailFeedback,
  GmailImportCandidate,
  GmailMessage,
} from './google-gmail-types';

type AuthContextValue = ReturnType<typeof useAuth>;

export function useGoogleGmailIntegration(auth: AuthContextValue) {
  const { isAuthenticated, getAccessToken } = auth;
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [candidates, setCandidates] = useState<GmailImportCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isListingCandidates, setIsListingCandidates] = useState(false);
  const [feedback, setFeedback] = useState<GmailFeedback | null>(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadGmail = useCallback(async () => {
    if (!isAuthenticated || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const [statusResult, messagesResult] = await Promise.all([
        fetchGmailStatus(token),
        fetchGmailMessages(token),
      ]);
      if (!mountedRef.current) return;
      setStatus(statusResult);
      setMessages(messagesResult);
    } catch (error) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load Gmail.',
      });
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadGmail();
      return;
    }
    setStatus(null);
    setMessages([]);
    setCandidates([]);
    setFeedback(null);
  }, [isAuthenticated, loadGmail]);

  const listImportCandidates = useCallback(async (options: { limit?: number; query?: string } = {}) => {
    setIsListingCandidates(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await fetchGmailImportCandidates(token, options);
      if (!mountedRef.current) return [];
      setCandidates(result);
      if (!result.length) {
        setFeedback({
          type: 'success',
          text: 'No Gmail messages matched this import search.',
        });
      }
      return result;
    } catch (error) {
      if (mountedRef.current) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'Could not list Gmail messages.',
        });
      }
      return [];
    } finally {
      if (mountedRef.current) setIsListingCandidates(false);
    }
  }, [getAccessToken]);

  const importSelectedGmailMessages = useCallback(async (messageIds: string[]) => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await importGmailMessages(token, messageIds);
      if (!mountedRef.current) return false;
      setFeedback({
        type: 'success',
        text: `Gmail imported: ${result.syncedCount} selected message${result.syncedCount === 1 ? '' : 's'} queued for memory indexing.`,
      });
      loadingRef.current = false;
      await loadGmail();
      await listImportCandidates();
      return true;
    } catch (error) {
      if (!mountedRef.current) return false;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not import selected Gmail messages.',
      });
      return false;
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [getAccessToken, listImportCandidates, loadGmail]);

  const syncGmail = useCallback(async (limit?: number) => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await syncGmailMessages(token, limit);
      if (!mountedRef.current) return;
      setFeedback({
        type: 'success',
        text: `Gmail synced: ${result.syncedCount} message${result.syncedCount === 1 ? '' : 's'} queued for memory indexing.`,
      });
      loadingRef.current = false;
      await loadGmail();
    } catch (error) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not sync Gmail.',
      });
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [getAccessToken, loadGmail]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    status,
    messages,
    candidates,
    isLoading,
    isSyncing,
    isListingCandidates,
    feedback,
    loadGmail,
    listImportCandidates,
    importSelectedGmailMessages,
    syncGmail,
    clearFeedback,
  };
}
