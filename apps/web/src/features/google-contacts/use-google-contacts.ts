'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useAuth } from '@/contexts/AuthContext';
import {
  fetchContacts,
  fetchContactStatus,
  syncContacts,
} from './google-contacts-api';
import type {
  ContactConnectionStatus,
  ContactFeedback,
  GoogleContact,
} from './google-contacts-types';

type AuthContextValue = ReturnType<typeof useAuth>;

export function useGoogleContactsIntegration(auth: AuthContextValue) {
  const { isAuthenticated, getAccessToken } = auth;
  const [status, setStatus] = useState<ContactConnectionStatus | null>(null);
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<ContactFeedback | null>(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadContacts = useCallback(async () => {
    if (!isAuthenticated || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const [statusResult, contactsResult] = await Promise.all([
        fetchContactStatus(token),
        fetchContacts(token),
      ]);
      if (!mountedRef.current) return;
      setStatus(statusResult);
      setContacts(contactsResult);
    } catch (error) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load Google Contacts.',
      });
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadContacts();
      return;
    }
    setStatus(null);
    setContacts([]);
    setFeedback(null);
  }, [isAuthenticated, loadContacts]);

  const syncGoogleContacts = useCallback(async (limit?: number) => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const token = getAccessToken();
      const result = await syncContacts(token, limit);
      if (!mountedRef.current) return;
      setFeedback({
        type: 'success',
        text: `Contacts synced: ${result.syncedCount} contact${result.syncedCount === 1 ? '' : 's'} queued for memory indexing.`,
      });
      loadingRef.current = false;
      await loadContacts();
    } catch (error) {
      if (!mountedRef.current) return;
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not sync Google Contacts.',
      });
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [getAccessToken, loadContacts]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    status,
    contacts,
    isLoading,
    isSyncing,
    feedback,
    loadContacts,
    syncGoogleContacts,
    clearFeedback,
  };
}
