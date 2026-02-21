import SettingsClient from '@/components/autoposter/SettingsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings — AutoPoster',
  description: 'Configure your autoposter preferences.',
};

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return <SettingsClient />;
}
