import PostsClient from '@/components/autoposter/PostsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Posts · AutoPoster',
  description: 'Create, review, and manage your LinkedIn posts.',
};

export default function PostsPage() {
  return <PostsClient />;
}
