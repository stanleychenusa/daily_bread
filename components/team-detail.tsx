'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, Pencil, Trash2, Users } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { TeamJourney } from '@/components/team-journey';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fetchCurrentUser, readJson, type User } from '@/lib/client';

type TeamMember = { id: string; firstName: string; lastName: string; joinedAt: number; totalVerseCount: number };
type TeamActivity = { id: string; userId: string; readingDate: string; passage: string; verseCount: number };
type TeamJourneyReading = { userId: string; readingDate: string; verseCount: number };
type TeamDetailData = {
  team: { id: string; name: string; joinCode: string; description: string; ownerId: string; canDelete: boolean; members: TeamMember[] };
  journey: TeamJourneyReading[];
  activity: TeamActivity[];
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

export function TeamDetail({ teamId }: { teamId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchCurrentUser(),
      fetch(`/api/teams?teamId=${encodeURIComponent(teamId)}`, { cache: 'no-store' })
        .then((response) => readJson<TeamDetailData>(response)),
    ])
      .then(([currentUser, teamData]) => {
        setUser(currentUser);
        setData(teamData);
        setNameDraft(teamData.team.name);
        setDescriptionDraft(teamData.team.description);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [teamId]);

  const activityByMember = useMemo(() => {
    const grouped = new Map<string, TeamActivity[]>();
    for (const reading of data?.activity ?? []) {
      grouped.set(reading.userId, [...(grouped.get(reading.userId) ?? []), reading]);
    }
    return grouped;
  }, [data]);

  const teamTotals = useMemo(() => {
    const totalVerses = (data?.journey ?? []).reduce((total, reading) => total + reading.verseCount, 0);
    const activeDays = new Set((data?.journey ?? []).map((reading) => reading.readingDate)).size;
    return { totalVerses, activeDays };
  }, [data]);

  const breadwinner = useMemo(() => {
    let leader: TeamMember | null = null;
    for (const member of data?.team.members ?? []) {
      if (!leader || member.totalVerseCount > leader.totalVerseCount) leader = member;
    }
    return leader && leader.totalVerseCount > 0 ? leader : null;
  }, [data]);

  const teamOwner = data?.team.members.find((member) => member.id === data.team.ownerId) ?? null;

  async function saveName() {
    setNameSaving(true);
    setNameError('');
    try {
      const result = await readJson<{ name: string }>(await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, name: nameDraft }),
      }));
      setData((current) => current
        ? { ...current, team: { ...current.team, name: result.name } }
        : current);
      setNameDraft(result.name);
      setEditingName(false);
    } catch (saveError) {
      setNameError(saveError instanceof Error ? saveError.message : 'Could not save the team name.');
    } finally {
      setNameSaving(false);
    }
  }

  async function saveDescription() {
    setDescriptionSaving(true);
    setDescriptionError('');
    try {
      const result = await readJson<{ description: string }>(await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, description: descriptionDraft }),
      }));
      setData((current) => current
        ? { ...current, team: { ...current.team, description: result.description } }
        : current);
      setDescriptionDraft(result.description);
      setEditingDescription(false);
    } catch (saveError) {
      setDescriptionError(saveError instanceof Error ? saveError.message : 'Could not save the team description.');
    } finally {
      setDescriptionSaving(false);
    }
  }

  async function deleteTeam() {
    setDeleting(true);
    setDeleteError('');
    try {
      await readJson<{ ok: boolean }>(await fetch(`/api/teams?teamId=${encodeURIComponent(teamId)}`, {
        method: 'DELETE',
      }));
      window.location.assign('/teams');
    } catch (deleteRequestError) {
      setDeleteError(deleteRequestError instanceof Error ? deleteRequestError.message : 'Could not delete this team.');
      setDeleting(false);
    }
  }

  if (loading) {
    return <main className="page-loading"><span className="loading-mark"><Users /></span><p>Opening your team…</p></main>;
  }

  if (!user || !data) {
    return (
      <div className="app-shell">
        {user && <AppHeader name={`${user.firstName} ${user.lastName}`} active="teams" />}
        <main className="team-detail-main">
          <div className="team-detail-error">
            <Users aria-hidden="true" />
            <h1>We couldn’t open this team.</h1>
            <p>{error || 'Please return to your teams and try again.'}</p>
            <button
              type="button"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
              onClick={() => window.location.assign('/teams')}
            >
              Back to teams
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader name={`${user.firstName} ${user.lastName}`} active="teams" />
      <main className="team-detail-main">
        <div className="teams-title-row team-detail-title-row">
          <button
            type="button"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
            onClick={() => window.location.assign('/teams')}
          >
            <ArrowLeft aria-hidden="true" /> Back to teams
          </button>
          <div>
            {editingName ? (
              <div className="team-name-editor">
                <label htmlFor="team-name">Team name</label>
                <div>
                  <Input
                    id="team-name"
                    value={nameDraft}
                    maxLength={60}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void saveName();
                      if (event.key === 'Escape') {
                        setNameDraft(data.team.name);
                        setNameError('');
                        setEditingName(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={nameSaving}
                    onClick={() => {
                      setNameDraft(data.team.name);
                      setNameError('');
                      setEditingName(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={nameSaving} onClick={saveName}>
                    {nameSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
                {nameError && <p className="team-description-error" role="alert">{nameError}</p>}
              </div>
            ) : (
              <div className="team-name-display">
                <h1>{data.team.name}</h1>
                {teamOwner && (
                  <span className="team-owner-badge">
                    Owner: {teamOwner.firstName} {teamOwner.lastName}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit team name"
                  onClick={() => {
                    setNameDraft(data.team.name);
                    setNameError('');
                    setEditingDescription(false);
                    setEditingName(true);
                  }}
                >
                  <Pencil aria-hidden="true" /> Edit
                </Button>
              </div>
            )}
            {editingDescription ? (
              <div className="team-description-editor">
                <label htmlFor="team-description">Team description</label>
                <Textarea
                  id="team-description"
                  value={descriptionDraft}
                  maxLength={280}
                  rows={3}
                  placeholder="What brings your team together?"
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                />
                <div className="team-description-actions">
                  <small>{descriptionDraft.length} / 280</small>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={descriptionSaving}
                    onClick={() => {
                      setDescriptionDraft(data.team.description);
                      setDescriptionError('');
                      setEditingDescription(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={descriptionSaving} onClick={saveDescription}>
                    {descriptionSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
                {descriptionError && <p className="team-description-error" role="alert">{descriptionError}</p>}
              </div>
            ) : (
              <div className="team-description-display">
                <p>{data.team.description || 'Add a team description.'}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit team description"
                  onClick={() => {
                    setDescriptionDraft(data.team.description);
                    setDescriptionError('');
                    setEditingName(false);
                    setEditingDescription(true);
                  }}
                >
                  <Pencil aria-hidden="true" /> Edit
                </Button>
              </div>
            )}
            <div className="team-id-row">
              <span>Team ID</span>
              <code>{data.team.joinCode}</code>
            </div>
          </div>
        </div>

        <section className="team-journey-section" aria-labelledby="team-journey-title">
          <div className="section-heading team-journey-heading">
            <div className="team-detail-heading-group">
              <span className="section-icon"><BookOpen aria-hidden="true" /></span>
              <h2 id="team-journey-title">Team Reading Journey</h2>
            </div>
            <div className="heat-legend" aria-label={`Reading volume scaled for ${data.team.members.length} team members: less to more`}>
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heat-cell level-${level}`} />)}
              <span>More</span>
            </div>
          </div>

          <div className="team-journey-summary" aria-label="Team reading summary">
            <div><strong>{data.team.members.length}</strong><small>Members</small></div>
            <div><strong>{teamTotals.totalVerses.toLocaleString()}</strong><small>Verses Together</small></div>
            <div><strong>{teamTotals.activeDays}</strong><small>Total Active Days</small></div>
            <div className="breadwinner-stat">
              <strong>{breadwinner ? `${breadwinner.firstName} ${breadwinner.lastName}` : '—'}</strong>
              <small>{breadwinner ? `Breadwinner · ${breadwinner.totalVerseCount.toLocaleString()} verses` : 'Breadwinner'}</small>
            </div>
          </div>

          <TeamJourney members={data.team.members} readings={data.journey} />
        </section>

        <section className="member-activity-section" aria-labelledby="member-activity-title">
          <div className="section-heading">
            <div className="team-detail-heading-group">
              <span className="section-icon"><Users aria-hidden="true" /></span>
              <h2 id="member-activity-title">Recent Member Activity</h2>
            </div>
          </div>

          <div className="member-activity-grid">
            {data.team.members.map((member) => {
              const memberActivity = activityByMember.get(member.id) ?? [];
              const memberYearVerses = data.journey
                .filter((reading) => reading.userId === member.id)
                .reduce((total, reading) => total + reading.verseCount, 0);
              return (
                <article className="member-activity-card" key={member.id}>
                  <header>
                    <span className="member-avatar" aria-hidden="true">{member.firstName.slice(0, 1)}{member.lastName.slice(0, 1)}</span>
                    <div>
                      <h3>{member.firstName} {member.lastName}</h3>
                      <p>{memberYearVerses.toLocaleString()} verses in the last year</p>
                    </div>
                  </header>

                  {memberActivity.length > 0 ? (
                    <ul className="member-reading-list">
                      {memberActivity.map((reading) => (
                        <li key={reading.id}>
                          <div>
                            <strong>{reading.passage}</strong>
                            <time dateTime={reading.readingDate}><CalendarDays aria-hidden="true" /> {displayDate(reading.readingDate)}</time>
                          </div>
                          <span>{reading.verseCount} {reading.verseCount === 1 ? 'verse' : 'verses'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="member-activity-empty">No readings logged yet.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {data.team.canDelete && (
          <section className="team-danger-zone" aria-labelledby="delete-team-title">
            <div>
              <h2 id="delete-team-title">Delete team</h2>
              <p>Remove this team and its shared membership. Everyone’s personal reading history will stay intact.</p>
            </div>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden="true" /> Delete team
            </Button>
          </section>
        )}
      </main>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2 aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>Delete {data.team.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the team, its membership list, and its shared journey. Members’ personal readings and reflections will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="team-delete-error" role="alert">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep team</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void deleteTeam()}>
              {deleting ? 'Deleting…' : 'Yes, delete team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
