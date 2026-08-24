import { isSupabaseConfigured, supabase } from './client';
import type { Person } from '@/types/database';

const TABLE = 'people';

export class ServiceError extends Error {}

function logError(context: string, error: unknown): void {
  console.error(`[personService] ${context}:`, error);
}

export async function fetchPeople(): Promise<Person[]> {
  if (!isSupabaseConfigured) {
    throw new ServiceError('Database is not configured yet. Set up your .env file to continue.');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, created_at')
    .order('name', { ascending: true });

  if (error) {
    logError('fetchPeople', error);
    throw new ServiceError('Could not load people. Please try again.');
  }

  return data ?? [];
}

export async function createPerson(name: string): Promise<Person> {
  if (!isSupabaseConfigured) {
    throw new ServiceError('Database is not configured yet. Set up your .env file to continue.');
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new ServiceError('Name cannot be empty.');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name: trimmed })
    .select('id, name, created_at')
    .single();

  if (error) {
    logError('createPerson', error);
    throw new ServiceError('Could not add that person. Please try again.');
  }

  return data;
}
