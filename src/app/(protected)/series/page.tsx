import SeriesClient from '@/components/autoposter/SeriesClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Series — AutoPoster',
  description: 'Organize your posts into themed topic sequences.',
};

export const dynamic = 'force-dynamic';

export default function SeriesPage() {
  return <SeriesClient />;
}
