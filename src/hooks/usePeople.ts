import { useCallback, useEffect, useState } from 'react';
import { createPerson, fetchPeople, ServiceError } from '@/services/supabase/personService';
import type { Person } from '@/types/database';

interface UsePeopleResult {
  people: Person[];
  isLoading: boolean;
  error: string | null;
  addPerson: (name: string) => Promise<Person | null>;
}

export function usePeople(): UsePeopleResult {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPeople();
      setPeople(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPerson = useCallback(async (name: string) => {
    setError(null);
    try {
      const person = await createPerson(name);
      setPeople((prev) => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)));
      return person;
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
      return null;
    }
  }, []);

  return { people, isLoading, error, addPerson };
}
