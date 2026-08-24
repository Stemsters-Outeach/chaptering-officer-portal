import { useCallback, useEffect, useState } from 'react';
import {
  deleteDigest,
  fetchDigests,
  saveDigest,
  ServiceError,
  summarizeTranscript,
  updateDigest,
  type MeetingDigestUpdate,
} from '@/services/supabase/transcriptService';
import type { MeetingDigest, TranscriptDigest } from '@/types/database';

interface UseTranscriptDigestResult {
  digests: MeetingDigest[];
  isLoading: boolean;
  isSummarizing: boolean;
  isSaving: boolean;
  isMutating: boolean;
  error: string | null;
  pendingDigest: TranscriptDigest | null;
  summarize: (transcript: string) => Promise<void>;
  save: (transcript: string, personId: string | null, notes: string) => Promise<boolean>;
  discardPending: () => void;
  update: (id: string, patch: MeetingDigestUpdate) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useTranscriptDigest(): UseTranscriptDigestResult {
  const [digests, setDigests] = useState<MeetingDigest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDigest, setPendingDigest] = useState<TranscriptDigest | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDigests();
      setDigests(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summarize = useCallback(async (transcript: string) => {
    setIsSummarizing(true);
    setError(null);
    setPendingDigest(null);
    try {
      const digest = await summarizeTranscript(transcript);
      setPendingDigest(digest);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  const save = useCallback(
    async (transcript: string, personId: string | null, notes: string) => {
      if (!pendingDigest) return false;
      setIsSaving(true);
      setError(null);
      try {
        await saveDigest({
          ...pendingDigest,
          transcript: transcript.trim(),
          person_id: personId,
          notes: notes.trim(),
        });
        setPendingDigest(null);
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [pendingDigest, refresh],
  );

  const discardPending = useCallback(() => setPendingDigest(null), []);

  const update = useCallback(async (id: string, patch: MeetingDigestUpdate) => {
    setIsMutating(true);
    setError(null);
    try {
      const updated = await updateDigest(id, patch);
      setDigests((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return true;
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setIsMutating(true);
    setError(null);
    try {
      await deleteDigest(id);
      setDigests((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return {
    digests,
    isLoading,
    isSummarizing,
    isSaving,
    isMutating,
    error,
    pendingDigest,
    summarize,
    save,
    discardPending,
    update,
    remove,
  };
}
