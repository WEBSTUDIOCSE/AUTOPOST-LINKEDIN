import DashboardClient from '@/components/autoposter/DashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — AutoPoster',
  description: 'Your LinkedIn content engine at a glance.',
};

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return <DashboardClient />;
}
