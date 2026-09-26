'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, Users } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { TeamJourney } from '@/components/team-journey';
import { buttonVariants } from '@/components/ui/button';
import { fetchCurrentUser, readJson, type User } from '@/lib/client';

type TeamMember = { id: string; firstName: string; lastName: string; joinedAt: number };
type TeamActivity = { id: string; userId: string; readingDate: string; passage: string; verseCount: number };
type TeamJourneyReading = { userId: string; readingDate: string; verseCount: number };
type TeamDetailData = {
  team: { id: string; name: string; members: TeamMember[] };
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

  useEffect(() => {
    Promise.all([
      fetchCurrentUser(),
      fetch(`/api/teams?teamId=${encodeURIComponent(teamId)}`, { cache: 'no-store' })
        .then((response) => readJson<TeamDetailData>(response)),
    ])
      .then(([currentUser, teamData]) => {
        setUser(currentUser);
        setData(teamData);
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
            <h1>{data.team.name}</h1>
            <p>{data.team.members.length} {data.team.members.length === 1 ? 'member' : 'members'} reading together</p>
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

          <div className="team-journey-summary" aria-label="Team reading summary for the last year">
            <div><strong>{data.team.members.length}</strong><small>Members</small></div>
            <div><strong>{teamTotals.totalVerses.toLocaleString()}</strong><small>Verses Together</small></div>
            <div><strong>{teamTotals.activeDays}</strong><small>Total Active Days</small></div>
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
      </main>
    </div>
  );
}
