import { type FormEvent, useMemo, useState } from 'react';
import { usePeople } from '@/hooks/usePeople';
import { useLocations } from '@/hooks/useLocations';
import { useMemberships } from '@/hooks/useMemberships';
import { useTranscriptDigest } from '@/hooks/useTranscriptDigest';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import type { ChapterLocation, MeetingDigest, Person } from '@/types/database';

type View =
  | { kind: 'list' }
  | { kind: 'officer'; personId: string }
  | { kind: 'chapter'; locationId: string };

export function Officers() {
  const { people, isLoading: peopleLoading, addPerson } = usePeople();
  const { locations, isLoading: locationsLoading, addLocation } = useLocations();
  const { locationIdsByPerson, personIdsByLocation, addMembership, removeMembership } =
    useMemberships();
  const { digests } = useTranscriptDigest();

  const [view, setView] = useState<View>({ kind: 'list' });
  const [newPersonName, setNewPersonName] = useState('');

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const locationsById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const handleAddPerson = async (event: FormEvent) => {
    event.preventDefault();
    const person = await addPerson(newPersonName);
    if (person) {
      setNewPersonName('');
      setView({ kind: 'officer', personId: person.id });
    }
  };

  const isLoading = peopleLoading || locationsLoading;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        title="Officers"
        description="Directory of chaptering members — click a name to see their chapters, then a chapter to see who's in it and what's been filed."
      />

      <Breadcrumb
        view={view}
        onNavigate={setView}
        personName={view.kind === 'officer' ? peopleById.get(view.personId)?.name : undefined}
        locationName={
          view.kind === 'chapter' ? locationsById.get(view.locationId)?.name : undefined
        }
      />

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : view.kind === 'list' ? (
        <div className="mt-4">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add yourself
            </p>
            <form className="mt-2 flex gap-2" onSubmit={handleAddPerson}>
              <Input
                aria-label="Your name"
                placeholder="Your name…"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
              />
              <Button type="submit" disabled={newPersonName.trim().length === 0}>
                Add
              </Button>
            </form>
          </Card>

          <div className="mt-4">
            {people.length === 0 ? (
              <p className="text-sm text-slate-500">No chaptering members yet.</p>
            ) : (
              <ul className="space-y-3">
                {people.map((person) => {
                  const memberLocationIds = locationIdsByPerson.get(person.id) ?? [];
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => setView({ kind: 'officer', personId: person.id })}
                        className="w-full text-left"
                      >
                        <Card className="transition-colors hover:border-slate-300">
                          <h3 className="text-sm font-semibold text-slate-900">{person.name}</h3>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {memberLocationIds.length === 0 ? (
                              <span className="text-xs text-slate-400">
                                Not part of any chapter yet
                              </span>
                            ) : (
                              memberLocationIds.map((locationId) => (
                                <span
                                  key={locationId}
                                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                                >
                                  {locationsById.get(locationId)?.name}
                                </span>
                              ))
                            )}
                          </div>
                        </Card>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : view.kind === 'officer' ? (
        <OfficerView
          personId={view.personId}
          people={people}
          locations={locations}
          locationIdsByPerson={locationIdsByPerson}
          onAddLocation={addLocation}
          onAddMembership={addMembership}
          onRemoveMembership={removeMembership}
          onSelectChapter={(locationId) => setView({ kind: 'chapter', locationId })}
        />
      ) : (
        <ChapterView
          locationId={view.locationId}
          location={locationsById.get(view.locationId)}
          memberIds={personIdsByLocation.get(view.locationId) ?? []}
          peopleById={peopleById}
          digests={digests}
          onSelectPerson={(personId) => setView({ kind: 'officer', personId })}
        />
      )}
    </div>
  );
}

function Breadcrumb({
  view,
  onNavigate,
  personName,
  locationName,
}: {
  view: View;
  onNavigate: (view: View) => void;
  personName?: string;
  locationName?: string;
}) {
  return (
    <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm text-slate-500">
      <button
        type="button"
        onClick={() => onNavigate({ kind: 'list' })}
        className={view.kind === 'list' ? 'font-semibold text-slate-900' : 'hover:underline'}
      >
        Officers
      </button>
      {view.kind !== 'list' && view.kind === 'officer' && (
        <>
          <span>/</span>
          <span className="font-semibold text-slate-900">{personName ?? '…'}</span>
        </>
      )}
      {view.kind === 'chapter' && (
        <>
          <span>/</span>
          <span className="font-semibold text-slate-900">{locationName ?? '…'}</span>
        </>
      )}
    </nav>
  );
}

function OfficerView({
  personId,
  people,
  locations,
  locationIdsByPerson,
  onAddLocation,
  onAddMembership,
  onRemoveMembership,
  onSelectChapter,
}: {
  personId: string;
  people: Person[];
  locations: ChapterLocation[];
  locationIdsByPerson: Map<string, string[]>;
  onAddLocation: (name: string) => Promise<ChapterLocation | null>;
  onAddMembership: (personId: string, locationId: string) => Promise<boolean>;
  onRemoveMembership: (personId: string, locationId: string) => Promise<boolean>;
  onSelectChapter: (locationId: string) => void;
}) {
  const [addingChapterId, setAddingChapterId] = useState('');
  const [addingNewLocation, setAddingNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const person = people.find((p) => p.id === personId);
  const memberLocationIds = locationIdsByPerson.get(personId) ?? [];
  const availableLocations = locations.filter((l) => !memberLocationIds.includes(l.id));

  if (!person) {
    return <p className="mt-4 text-sm text-slate-500">This member no longer exists.</p>;
  }

  const handleAddExisting = async (event: FormEvent) => {
    event.preventDefault();
    if (!addingChapterId) return;
    await onAddMembership(personId, addingChapterId);
    setAddingChapterId('');
  };

  const handleAddNew = async (event: FormEvent) => {
    event.preventDefault();
    const location = await onAddLocation(newLocationName);
    if (location) {
      await onAddMembership(personId, location.id);
      setNewLocationName('');
      setAddingNewLocation(false);
    }
  };

  return (
    <Card className="mt-4">
      <h2 className="text-base font-semibold text-slate-900">{person.name}</h2>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chapters</p>
        {memberLocationIds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Not part of any chapter yet.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {memberLocationIds.map((locationId) => {
              const location = locations.find((l) => l.id === locationId);
              return (
                <li
                  key={locationId}
                  className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-3 pr-1 text-xs font-medium text-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => onSelectChapter(locationId)}
                    className="hover:underline"
                  >
                    {location?.name ?? 'Unknown chapter'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${person.name} from ${location?.name ?? 'this chapter'}`}
                    onClick={() => onRemoveMembership(personId, locationId)}
                    className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Add to a chapter
          </p>
          <button
            type="button"
            onClick={() => setAddingNewLocation((v) => !v)}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
          >
            {addingNewLocation ? 'Cancel' : '+ New chapter'}
          </button>
        </div>

        {addingNewLocation ? (
          <form className="mt-2 flex gap-2" onSubmit={handleAddNew}>
            <Input
              aria-label="New chapter location name"
              placeholder="e.g. Downtown Chapter"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              autoFocus
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={newLocationName.trim().length === 0}
            >
              Add
            </Button>
          </form>
        ) : availableLocations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Already part of every existing chapter — add a new one instead.
          </p>
        ) : (
          <form className="mt-2 flex gap-2" onSubmit={handleAddExisting}>
            <select
              aria-label="Chapter to add"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={addingChapterId}
              onChange={(e) => setAddingChapterId(e.target.value)}
            >
              <option value="">Choose a chapter…</option>
              {availableLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" disabled={!addingChapterId}>
              Add
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function ChapterView({
  location,
  memberIds,
  peopleById,
  digests,
  onSelectPerson,
}: {
  locationId: string;
  location: ChapterLocation | undefined;
  memberIds: string[];
  peopleById: Map<string, Person>;
  digests: MeetingDigest[];
  onSelectPerson: (personId: string) => void;
}) {
  const memberIdSet = useMemo(() => new Set(memberIds), [memberIds]);
  const chapterDigests = useMemo(
    () => digests.filter((d) => d.person_id && memberIdSet.has(d.person_id)),
    [digests, memberIdSet],
  );

  if (!location) {
    return <p className="mt-4 text-sm text-slate-500">This chapter no longer exists.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-slate-900">{location.name}</h2>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</p>
          {memberIds.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No members in this chapter yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {memberIds.map((personId) => (
                <li key={personId}>
                  <button
                    type="button"
                    onClick={() => onSelectPerson(personId)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {peopleById.get(personId)?.name ?? 'Unknown member'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Transcripts filed by this chapter
        </p>
        {chapterDigests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No transcripts filed under this chapter yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {chapterDigests.map((digest) => (
              <li key={digest.id}>
                <Card>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {digest.title || 'Untitled meeting'}
                    </h3>
                    <span className="shrink-0 text-xs text-slate-400">
                      {new Date(digest.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {peopleById.get(digest.person_id ?? '')?.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{digest.overview}</p>
                  {digest.notes && (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-sm text-slate-600">
                      {digest.notes}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
