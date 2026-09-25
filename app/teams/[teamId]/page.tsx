import { TeamDetail } from '@/components/team-detail';

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <TeamDetail teamId={teamId} />;
}
