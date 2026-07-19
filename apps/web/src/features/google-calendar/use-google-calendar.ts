'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { useAuth } from '@/contexts/AuthContext';
import type {
  CalendarConnectionStatus,
  CalendarEvent,
  CalendarFeedback,
  CalendarError,
} from './google-calendar-types';
import {
  fetchCalendarStatus,
  fetchCalendarEvents,
  fetchCalendarConnectUrl,
  syncCalendar,
  toCalendarError,
} from './google-calendar-api';
import {
  parseCalendarCallbackParams,
  buildCalendarFeedback,
  isSafeRedirectUrl,
} from './google-calendar-utils';

type AuthContextValue = ReturnType<typeof useAuth>;

export function useGoogleCalendarIntegration(auth: AuthContextValue) {
  const { isAuthenticated, getAccessToken } = auth;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);
  const [feedback, setFeedback] = useState<CalendarFeedback | null>(null);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCalendar = useCallback(async () => {
    if (!isAuthenticated) return;
    if (loadingRef.current) return;
    loadingRef.current = true;

    setIsLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const [statusResult, eventsResult] = await Promise.all([
        fetchCalendarStatus(token),
        fetchCalendarEvents(token),
      ]);
      if (!mountedRef.current) return;
      setStatus(statusResult);
      setEvents(eventsResult);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(toCalendarError(err, 'Could not load Calendar status.'));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      loadingRef.current = false;
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) void loadCalendar();
      });
      return () => { cancelled = true; };
    }
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setStatus(null);
      setEvents([]);
      setError(null);
      setFeedback(null);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, loadCalendar]);

  useEffect(() => {
    const { result, reason } = parseCalendarCallbackParams(searchParams);
    if (!result) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled || !mountedRef.current) return;
      setFeedback(buildCalendarFeedback(result, reason));
      if (result === 'connected') {
        void loadCalendar();
      }
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete('calendar');
    params.delete('reason');
    const remaining = params.toString();
    router.replace(remaining ? `${pathname}?${remaining}` : pathname);
    return () => { cancelled = true; };
  }, [searchParams, router, pathname, loadCalendar]);

  const connectCalendar = useCallback(async () => {
    setIsConnecting(true);
    setFeedback(null);
    setError(null);
    try {
      const token = getAccessToken();
      const url = await fetchCalendarConnectUrl(token);
      if (!isSafeRedirectUrl(url)) {
        throw new Error('Received an invalid redirect URL from the server.');
      }
      window.location.href = url;
    } catch (err) {
      if (!mountedRef.current) return;
      const calendarError = toCalendarError(err, 'Could not start Google Calendar connection.');
      setError(calendarError);
      setFeedback({ type: 'error', text: calendarError.message });
      setIsConnecting(false);
    }
  }, [getAccessToken]);

  const reconnectCalendar = useCallback(async () => {
    await connectCalendar();
  }, [connectCalendar]);

  const syncCalendarEvents = useCallback(async (limit?: number) => {
    setIsSyncing(true);
    setFeedback(null);
    setError(null);
    try {
      const token = getAccessToken();
      const result = await syncCalendar(token, limit);
      if (!mountedRef.current) return;
      setFeedback({
        type: 'success',
        text: `Calendar synced: ${result.syncedCount} event${result.syncedCount === 1 ? '' : 's'} synced.`,
      });
      await loadCalendar();
    } catch (err) {
      if (!mountedRef.current) return;
      const calendarError = toCalendarError(err, 'Could not sync Google Calendar.');
      setError(calendarError);
      setFeedback({ type: 'error', text: calendarError.message });
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [getAccessToken, loadCalendar]);

  const refreshCalendar = useCallback(async () => {
    loadingRef.current = false;
    await loadCalendar();
  }, [loadCalendar]);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    setError(null);
  }, []);

  return {
    status,
    events,
    isLoading,
    isConnecting,
    isSyncing,
    error,
    feedback,
    loadCalendar,
    connectCalendar,
    reconnectCalendar,
    syncCalendar: syncCalendarEvents,
    refreshCalendar,
    clearFeedback,
  };
}
