import { ConceptDetailClient } from '../_components/concept-detail-client';

interface ConceptDetailPageProps {
  params: Promise<{
    conceptId: string;
  }>;
}

export default async function ConceptDetailPage({ params }: ConceptDetailPageProps) {
  const { conceptId } = await params;
  return <ConceptDetailClient conceptId={conceptId} />;
}
