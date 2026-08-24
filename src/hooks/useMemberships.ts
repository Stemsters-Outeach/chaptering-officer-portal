import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMembership,
  fetchMemberships,
  removeMembership,
  ServiceError,
} from '@/services/supabase/membershipService';
import type { PersonChapterLocation } from '@/types/database';

interface UseMembershipsResult {
  memberships: PersonChapterLocation[];
  isLoading: boolean;
  error: string | null;
  locationIdsByPerson: Map<string, string[]>;
  personIdsByLocation: Map<string, string[]>;
  addMembership: (personId: string, locationId: string) => Promise<boolean>;
  removeMembership: (personId: string, locationId: string) => Promise<boolean>;
}

export function useMemberships(): UseMembershipsResult {
  const [memberships, setMemberships] = useState<PersonChapterLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMemberships();
      setMemberships(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(async (personId: string, locationId: string) => {
    setError(null);
    try {
      await addMembership(personId, locationId);
      setMemberships((prev) =>
        prev.some((m) => m.person_id === personId && m.location_id === locationId)
          ? prev
          : [...prev, { person_id: personId, location_id: locationId }],
      );
      return true;
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
      return false;
    }
  }, []);

  const remove = useCallback(async (personId: string, locationId: string) => {
    setError(null);
    try {
      await removeMembership(personId, locationId);
      setMemberships((prev) =>
        prev.filter((m) => !(m.person_id === personId && m.location_id === locationId)),
      );
      return true;
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
      return false;
    }
  }, []);

  const locationIdsByPerson = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of memberships) {
      const list = map.get(m.person_id) ?? [];
      list.push(m.location_id);
      map.set(m.person_id, list);
    }
    return map;
  }, [memberships]);

  const personIdsByLocation = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of memberships) {
      const list = map.get(m.location_id) ?? [];
      list.push(m.person_id);
      map.set(m.location_id, list);
    }
    return map;
  }, [memberships]);

  return {
    memberships,
    isLoading,
    error,
    locationIdsByPerson,
    personIdsByLocation,
    addMembership: add,
    removeMembership: remove,
  };
}
