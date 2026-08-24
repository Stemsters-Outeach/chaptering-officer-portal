import { useCallback, useEffect, useState } from 'react';
import { createMessage, fetchMessages, ServiceError } from '@/services/supabase/messageService';
import type { DemoMessage } from '@/types/database';

interface UseMessagesResult {
  messages: DemoMessage[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: (message: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useMessages(): UseMessagesResult {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMessages();
      setMessages(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveMessage = useCallback(
    async (message: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await createMessage(message);
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refresh],
  );

  return { messages, isLoading, isSaving, error, saveMessage, refresh };
}
