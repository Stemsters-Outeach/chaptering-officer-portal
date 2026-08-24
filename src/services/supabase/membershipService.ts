import { isSupabaseConfigured, supabase } from './client';
import type { PersonChapterLocation } from '@/types/database';

const TABLE = 'person_chapter_locations';

export class ServiceError extends Error {}

function logError(context: string, error: unknown): void {
  console.error(`[membershipService] ${context}:`, error);
}

export async function fetchMemberships(): Promise<PersonChapterLocation[]> {
  if (!isSupabaseConfigured) {
    throw new ServiceError('Database is not configured yet. Set up your .env file to continue.');
  }

  const { data, error } = await supabase.from(TABLE).select('person_id, location_id');

  if (error) {
    logError('fetchMemberships', error);
    throw new ServiceError('Could not load chapter memberships. Please try again.');
  }

  return data ?? [];
}

export async function addMembership(
  personId: string,
  locationId: string,
): Promise<PersonChapterLocation> {
  if (!isSupabaseConfigured) {
    throw new ServiceError('Database is not configured yet. Set up your .env file to continue.');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ person_id: personId, location_id: locationId })
    .select('person_id, location_id')
    .single();

  if (error) {
    logError('addMembership', error);
    throw new ServiceError('Could not add that chapter membership. Please try again.');
  }

  return data;
}

export async function removeMembership(personId: string, locationId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new ServiceError('Database is not configured yet. Set up your .env file to continue.');
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('person_id', personId)
    .eq('location_id', locationId);

  if (error) {
    logError('removeMembership', error);
    throw new ServiceError('Could not remove that chapter membership. Please try again.');
  }
}
