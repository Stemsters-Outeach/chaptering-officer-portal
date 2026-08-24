import { useCallback, useEffect, useState } from 'react';
import { createLocation, fetchLocations, ServiceError } from '@/services/supabase/locationService';
import type { ChapterLocation } from '@/types/database';

interface UseLocationsResult {
  locations: ChapterLocation[];
  isLoading: boolean;
  error: string | null;
  addLocation: (name: string) => Promise<ChapterLocation | null>;
}

export function useLocations(): UseLocationsResult {
  const [locations, setLocations] = useState<ChapterLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLocations();
      setLocations(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addLocation = useCallback(async (name: string) => {
    setError(null);
    try {
      const location = await createLocation(name);
      setLocations((prev) => [...prev, location].sort((a, b) => a.name.localeCompare(b.name)));
      return location;
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong.');
      return null;
    }
  }, []);

  return { locations, isLoading, error, addLocation };
}
