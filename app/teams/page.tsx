'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { StatusToast } from '@/components/status-toast';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchCurrentUser, readJson, type User } from '@/lib/client';

type Team = {
  id: string;
  name: string;
  members: { id: string; firstName: string; lastName: string }[];
};

export default function TeamsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  async function loadTeams() {
    const data = await readJson<{ teams: Team[] }>(await fetch('/api/teams', { cache: 'no-store' }));
    setTeams(data.teams);
  }

  useEffect(() => {
    Promise.all([fetchCurrentUser(), loadTeams()])
      .then(([currentUser]) => setUser(currentUser))
      .catch((error: Error) => setStatus({ message: error.message, tone: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4200);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function submitTeam(event: FormEvent<HTMLFormElement>, action: 'create' | 'join') {
    event.preventDefault();
    const name = action === 'create' ? createName : joinName;
    setBusy(action);
    try {
      await readJson<{ ok: boolean }>(await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name }),
      }));
      await loadTeams();
      if (action === 'create') setCreateName(''); else setJoinName('');
      setStatus({ message: action === 'create' ? `${name} is ready for your group.` : `You joined ${name}.`, tone: 'success' });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : 'Could not update your teams.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  if (loading || !user) return <main className="page-loading"><span className="loading-mark"><Users /></span><p>Gathering your teams…</p></main>;

  return (
    <div className="app-shell">
      <AppHeader name={`${user.firstName} ${user.lastName}`} active="teams" />
      <main className="teams-main">
        <div className="teams-title-row">
          <a href="/home" className={buttonVariants({ variant: 'outline', size: 'lg' })} onClick={(event) => { event.preventDefault(); window.location.assign('/home'); }}><ArrowLeft aria-hidden="true" /> Back home</a>
          <div><h1>Teams</h1><p>Read alongside friends and keep one another encouraged.</p></div>
        </div>

        <section className="team-actions" aria-label="Create or join a team">
          <form className="team-action-card create-team" onSubmit={(event) => submitTeam(event, 'create')}>
            <span className="team-action-icon"><Plus aria-hidden="true" /></span>
            <h2>Create a team</h2>
            <label>Team name<Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="e.g., Sunday School Group" required /></label>
            <Button type="submit" size="lg" disabled={busy !== null}>{busy === 'create' ? 'Creating…' : 'Create team'}<ChevronRight /></Button>
          </form>

          <form className="team-action-card join-team" onSubmit={(event) => submitTeam(event, 'join')}>
            <span className="team-action-icon"><Search aria-hidden="true" /></span>
            <h2>Join a team</h2>
            <label>Team name<Input value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="Enter team name to join" required /></label>
            <Button type="submit" size="lg" variant="secondary" disabled={busy !== null}>{busy === 'join' ? 'Joining…' : 'Join team'}<ChevronRight /></Button>
          </form>
        </section>

        <section className="your-teams" aria-labelledby="your-teams-title">
          <div className="section-heading">
            <div><h2 id="your-teams-title">Your teams</h2></div>
            <span className="team-count">{teams.length} {teams.length === 1 ? 'team' : 'teams'}</span>
          </div>

          {teams.length === 0 ? (
            <div className="empty-teams">
              <span><Users /></span>
              <h3>Your table has room.</h3>
              <p>Create a team or join one above, and your reading circle will appear here.</p>
            </div>
          ) : (
            <div className="team-list">
              {teams.map((team) => (
                <button
                  type="button"
                  key={team.id}
                  className="team-row"
                  onClick={() => window.location.assign(`/teams/${team.id}`)}
                >
                  <span className="team-monogram">{team.name.slice(0, 2).toUpperCase()}</span>
                  <span className="team-info">
                    <strong>{team.name}</strong>
                    <small>{team.members.length} {team.members.length === 1 ? 'member' : 'members'}</small>
                  </span>
                  <span className="member-names">{team.members.map((member) => `${member.firstName} ${member.lastName}`).join(', ')}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      {status && <StatusToast message={status.message} tone={status.tone} />}
    </div>
  );
}
