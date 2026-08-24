import { type FormEvent, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { useTranscriptDigest } from '@/hooks/useTranscriptDigest';
import { usePeople } from '@/hooks/usePeople';
import { useLocations } from '@/hooks/useLocations';
import { useMemberships } from '@/hooks/useMemberships';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import type { ActionItem, ChapterLocation, MeetingDigest, Person } from '@/types/database';

const UNASSIGNED = '__unassigned__';
const selectClassName =
  'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200';

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function actionItemsToText(items: ActionItem[]): string {
  return items.map((item) => [item.owner, item.task, item.due].join(' | ')).join('\n');
}

function textToActionItems(text: string): ActionItem[] {
  return linesToArray(text).map((line) => {
    const [owner = '', task = '', due = ''] = line.split('|').map((part) => part.trim());
    return { owner, task, due };
  });
}

interface DigestFormState {
  title: string;
  overview: string;
  decisions: string;
  actionItems: string;
  keyPoints: string;
  openQuestions: string;
  attendees: string;
  personId: string;
  notes: string;
}

function digestToFormState(digest: MeetingDigest): DigestFormState {
  return {
    title: digest.title,
    overview: digest.overview,
    decisions: digest.decisions.join('\n'),
    actionItems: actionItemsToText(digest.action_items),
    keyPoints: digest.key_points.join('\n'),
    openQuestions: digest.open_questions.join('\n'),
    attendees: digest.attendees.join(', '),
    personId: digest.person_id ?? '',
    notes: digest.notes,
  };
}

export function Transcripts() {
  const {
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
  } = useTranscriptDigest();
  const { people, addPerson } = usePeople();
  const { locations, addLocation } = useLocations();
  const { locationIdsByPerson, addMembership } = useMemberships();
  const [transcript, setTranscript] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [notes, setNotes] = useState('');
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DigestFormState | null>(null);

  const personCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const digest of digests) {
      if (digest.person_id) {
        map.set(digest.person_id, (map.get(digest.person_id) ?? 0) + 1);
      }
    }
    return map;
  }, [digests]);

  const locationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const [personId, count] of personCounts) {
      const locationIds = locationIdsByPerson.get(personId) ?? [];
      if (locationIds.length === 0) {
        map.set(UNASSIGNED, (map.get(UNASSIGNED) ?? 0) + count);
      } else {
        for (const locationId of locationIds) {
          map.set(locationId, (map.get(locationId) ?? 0) + count);
        }
      }
    }
    return map;
  }, [personCounts, locationIdsByPerson]);

  const isPersonInLocationBucket = (personId: string, locationId: string) => {
    const locationIds = locationIdsByPerson.get(personId) ?? [];
    return locationId === UNASSIGNED ? locationIds.length === 0 : locationIds.includes(locationId);
  };

  const visibleDigests = useMemo(() => {
    if (activePersonId) {
      return digests.filter((digest) => digest.person_id === activePersonId);
    }
    if (activeLocationId) {
      return digests.filter(
        (digest) =>
          digest.person_id && isPersonInLocationBucket(digest.person_id, activeLocationId),
      );
    }
    return digests;
  }, [digests, activeLocationId, activePersonId, locationIdsByPerson]);

  const selectLocationFilter = (id: string | null) => {
    setActiveLocationId(id);
    setActivePersonId(null);
  };

  const handleSummarize = async (event: FormEvent) => {
    event.preventDefault();
    await summarize(transcript);
  };

  const handleSave = async () => {
    const saved = await save(transcript, selectedPersonId || null, notes);
    if (saved) {
      setTranscript('');
      setSelectedPersonId('');
      setNotes('');
    }
  };

  const startEditing = (digest: MeetingDigest) => {
    setEditingId(digest.id);
    setEditForm(digestToFormState(digest));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !editForm) return;
    const saved = await update(editingId, {
      title: editForm.title.trim(),
      overview: editForm.overview.trim(),
      decisions: linesToArray(editForm.decisions),
      action_items: textToActionItems(editForm.actionItems),
      key_points: linesToArray(editForm.keyPoints),
      open_questions: linesToArray(editForm.openQuestions),
      attendees: editForm.attendees
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      person_id: editForm.personId || null,
      notes: editForm.notes.trim(),
    });
    if (saved) {
      cancelEditing();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this digest? This cannot be undone.')) return;
    await remove(id);
    if (editingId === id) cancelEditing();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        title="Meeting Transcript Summarizer"
        description="Paste a meeting transcript, get a concise digest, then save it for the chapter's records."
      />

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Transcript</h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSummarize}>
          <Textarea
            aria-label="Meeting transcript"
            placeholder="Paste the raw meeting transcript here…"
            rows={10}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={isSummarizing}
          />
          <div>
            <Button type="submit" disabled={isSummarizing || transcript.trim().length === 0}>
              {isSummarizing ? 'Summarizing…' : 'Summarize'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      {pendingDigest && (
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Review &amp; save
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                {pendingDigest.title || 'Digest'}
              </h2>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={discardPending} disabled={isSaving}>
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-700">{pendingDigest.overview}</p>

          <DigestSection title="Decisions" items={pendingDigest.decisions} />

          {pendingDigest.action_items.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action items
              </h3>
              <ul className="mt-2 space-y-1">
                {pendingDigest.action_items.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <span className="font-medium">{item.owner}:</span> {item.task}
                    {item.due && <span className="text-slate-500"> (due {item.due})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DigestSection title="Key points" items={pendingDigest.key_points} />
          <DigestSection title="Open questions" items={pendingDigest.open_questions} />

          {pendingDigest.attendees.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              Attendees: {pendingDigest.attendees.join(', ')}
            </p>
          )}

          <div className="mt-5 rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              File this transcript
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Choose your chapter location, then yourself (or add either if they're new).
            </p>
            <div className="mt-3">
              <PersonPicker
                people={people}
                locations={locations}
                locationIdsByPerson={locationIdsByPerson}
                personId={selectedPersonId}
                onPersonChange={setSelectedPersonId}
                onAddPerson={addPerson}
                onAddLocation={addLocation}
                onAddMembership={addMembership}
                disabled={isSaving}
              />
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes (optional)
              </label>
              <Textarea
                className="mt-2"
                aria-label="Notes"
                placeholder="Add any extra notes about this meeting…"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
        </Card>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Saved digests</h2>

        {(locations.length > 0 || people.length > 0) && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filter by chapter location
              </p>
              {(activeLocationId || activePersonId) && (
                <button
                  type="button"
                  onClick={() => selectLocationFilter(null)}
                  className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterPill
                active={activeLocationId === null}
                onClick={() => selectLocationFilter(null)}
                label={`All (${digests.length})`}
              />
              {locations.map((location) => (
                <FilterPill
                  key={location.id}
                  active={activeLocationId === location.id}
                  onClick={() => selectLocationFilter(location.id)}
                  label={`${location.name} (${locationCounts.get(location.id) ?? 0})`}
                />
              ))}
              {(locationCounts.get(UNASSIGNED) ?? 0) > 0 && (
                <FilterPill
                  active={activeLocationId === UNASSIGNED}
                  onClick={() => selectLocationFilter(UNASSIGNED)}
                  label={`No chapter location (${locationCounts.get(UNASSIGNED) ?? 0})`}
                />
              )}
            </div>

            {activeLocationId && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {activeLocationId === UNASSIGNED
                    ? 'People with no chapter location'
                    : `People in ${locations.find((l) => l.id === activeLocationId)?.name ?? ''}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {people
                    .filter((p) => isPersonInLocationBucket(p.id, activeLocationId))
                    .map((person) => (
                      <FilterPill
                        key={person.id}
                        active={activePersonId === person.id}
                        onClick={() => setActivePersonId(person.id)}
                        label={`${person.name} (${personCounts.get(person.id) ?? 0})`}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading digests…</p>
          ) : visibleDigests.length === 0 ? (
            <p className="text-sm text-slate-500">
              {activeLocationId
                ? 'No digests filed under this category yet.'
                : 'No digests saved yet.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleDigests.map((digest) => {
                const person = people.find((p) => p.id === digest.person_id);

                if (editingId === digest.id && editForm) {
                  return (
                    <li key={digest.id}>
                      <Card>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Editing digest
                        </p>
                        <form className="mt-2 flex flex-col gap-5" onSubmit={handleUpdate}>
                          <div className="flex flex-col gap-3">
                            <Input
                              aria-label="Title"
                              placeholder="Title"
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            />
                            <Textarea
                              aria-label="Overview"
                              placeholder="Overview"
                              rows={3}
                              value={editForm.overview}
                              onChange={(e) =>
                                setEditForm({ ...editForm, overview: e.target.value })
                              }
                            />
                          </div>

                          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
                            <EditField
                              label="Decisions (one per line)"
                              value={editForm.decisions}
                              onChange={(v) => setEditForm({ ...editForm, decisions: v })}
                            />
                            <EditField
                              label="Action items (owner | task | due, one per line)"
                              value={editForm.actionItems}
                              onChange={(v) => setEditForm({ ...editForm, actionItems: v })}
                            />
                            <EditField
                              label="Key points (one per line)"
                              value={editForm.keyPoints}
                              onChange={(v) => setEditForm({ ...editForm, keyPoints: v })}
                            />
                            <EditField
                              label="Open questions (one per line)"
                              value={editForm.openQuestions}
                              onChange={(v) => setEditForm({ ...editForm, openQuestions: v })}
                            />
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Attendees (comma separated)
                              </label>
                              <Input
                                className="mt-1"
                                aria-label="Attendees"
                                value={editForm.attendees}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, attendees: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Filed under
                            </p>
                            <div className="mt-3">
                              <PersonPicker
                                people={people}
                                locations={locations}
                                locationIdsByPerson={locationIdsByPerson}
                                personId={editForm.personId}
                                onPersonChange={(personId) =>
                                  setEditForm({ ...editForm, personId })
                                }
                                onAddPerson={addPerson}
                                onAddLocation={addLocation}
                                onAddMembership={addMembership}
                                disabled={isMutating}
                              />
                            </div>
                          </div>

                          <EditField
                            label="Notes"
                            value={editForm.notes}
                            onChange={(v) => setEditForm({ ...editForm, notes: v })}
                          />

                          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={cancelEditing}
                              disabled={isMutating}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={isMutating}>
                              {isMutating ? 'Saving…' : 'Save changes'}
                            </Button>
                          </div>
                        </form>
                      </Card>
                    </li>
                  );
                }

                return (
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
                      {person && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {(locationIdsByPerson.get(person.id) ?? []).map((locationId) => (
                            <span
                              key={locationId}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                            >
                              {locations.find((l) => l.id === locationId)?.name}
                            </span>
                          ))}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {person.name}
                          </span>
                        </div>
                      )}
                      <p className="mt-2 text-sm text-slate-700">{digest.overview}</p>
                      {digest.notes && (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-sm text-slate-600">
                          {digest.notes}
                        </p>
                      )}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => startEditing(digest)}
                          disabled={isMutating}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(digest.id)}
                          disabled={isMutating}
                        >
                          Delete
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function PersonPicker({
  people,
  locations,
  locationIdsByPerson,
  personId,
  onPersonChange,
  onAddPerson,
  onAddLocation,
  onAddMembership,
  disabled,
}: {
  people: Person[];
  locations: ChapterLocation[];
  locationIdsByPerson: Map<string, string[]>;
  personId: string;
  onPersonChange: (personId: string) => void;
  onAddPerson: (name: string) => Promise<Person | null>;
  onAddLocation: (name: string) => Promise<ChapterLocation | null>;
  onAddMembership: (personId: string, locationId: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [locationScopeId, setLocationScopeId] = useState(
    () => (locationIdsByPerson.get(personId) ?? [])[0] ?? '',
  );
  const [addingLocation, setAddingLocation] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');

  const peopleInScope = people.filter((p) => {
    const locationIds = locationIdsByPerson.get(p.id) ?? [];
    return locationScopeId === ''
      ? locationIds.length === 0
      : locationIds.includes(locationScopeId);
  });

  const handleLocationScopeChange = (value: string) => {
    setLocationScopeId(value);
    onPersonChange('');
  };

  const handleAddLocation = async (event: FormEvent) => {
    event.preventDefault();
    const location = await onAddLocation(newLocationName);
    if (location) {
      setNewLocationName('');
      setAddingLocation(false);
      setLocationScopeId(location.id);
      onPersonChange('');
    }
  };

  const handleAddPerson = async (event: FormEvent) => {
    event.preventDefault();
    const person = await onAddPerson(newPersonName);
    if (person) {
      if (locationScopeId) {
        await onAddMembership(person.id, locationScopeId);
      }
      setNewPersonName('');
      setAddingPerson(false);
      onPersonChange(person.id);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            1. Chapter location
          </label>
          <button
            type="button"
            onClick={() => setAddingLocation((v) => !v)}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            disabled={disabled}
          >
            {addingLocation ? 'Cancel' : '+ New location'}
          </button>
        </div>
        {addingLocation ? (
          <form className="mt-1 flex gap-2" onSubmit={handleAddLocation}>
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
        ) : (
          <select
            aria-label="Chapter location"
            className={cn('mt-1 w-full', selectClassName)}
            value={locationScopeId}
            onChange={(e) => handleLocationScopeChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">No chapter location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            2. Person
          </label>
          <button
            type="button"
            onClick={() => setAddingPerson((v) => !v)}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            disabled={disabled}
          >
            {addingPerson ? 'Cancel' : '+ Add yourself'}
          </button>
        </div>
        {addingPerson ? (
          <form className="mt-1 flex gap-2" onSubmit={handleAddPerson}>
            <Input
              aria-label="Your name"
              placeholder="Your name…"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              autoFocus
            />
            <Button type="submit" variant="secondary" disabled={newPersonName.trim().length === 0}>
              Add
            </Button>
          </form>
        ) : (
          <select
            aria-label="Person"
            className={cn('mt-1 w-full', selectClassName)}
            value={personId}
            onChange={(e) => onPersonChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">No person</option>
            {peopleInScope.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <Textarea
        className="mt-1"
        aria-label={label}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function DigestSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
