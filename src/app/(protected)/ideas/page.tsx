import IdeasClient from '@/components/autoposter/IdeasClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ideas — AutoPoster',
  description: 'Quick-capture post ideas for your LinkedIn content.',
};

export const dynamic = 'force-dynamic';

export default function IdeasPage() {
  return <IdeasClient />;
}
