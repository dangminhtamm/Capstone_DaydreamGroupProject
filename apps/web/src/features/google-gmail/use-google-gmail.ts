'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useAuth } from '@/contexts/AuthContext';
import {
  fetchGmailMessages,
  fetchGmailStatus,
  syncGmailMessages,
} from './google-gmail-api';
import type {
  GmailConnectionStatus,
  GmailFeedback,
  GmailMessage,
} from './google-gmail-types';

type AuthContextValue = ReturnType<typeof useAuth>;

export function useGoogleGmailIntegration(auth: AuthContextValue) {
  const { isAuthenticated, getAccessToken } = auth;
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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
    setFeedback(null);
  }, [isAuthenticated, loadGmail]);

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
    isLoading,
    isSyncing,
    feedback,
    loadGmail,
    syncGmail,
    clearFeedback,
  };
}
