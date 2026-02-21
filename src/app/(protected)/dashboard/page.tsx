/**
 * Dashboard Page — main hub for the LinkedIn Autoposter
 *
 * Shows:
 * - Next scheduled post (with approve/edit/reject actions)
 * - Upcoming posts calendar
 * - Published posts history
 * - Active series & progress
 * - Quick stats (streak, published count, etc.)
 */

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Your LinkedIn autoposter command center.
      </p>

      {/* TODO: Implement these components */}
      <div className="mt-8 grid gap-6">
        {/* Stats Row */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="text-2xl font-bold">—</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="text-2xl font-bold">—</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">—</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active Series</p>
            <p className="text-2xl font-bold">—</p>
          </div>
        </section>

        {/* Next Post Preview */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Next Scheduled Post</h2>
          <p className="mt-2 text-muted-foreground">No posts scheduled yet.</p>
        </section>

        {/* Upcoming Posts */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Upcoming</h2>
          <p className="mt-2 text-muted-foreground">Calendar view coming soon.</p>
        </section>

        {/* Recent History */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Recent Posts</h2>
          <p className="mt-2 text-muted-foreground">Your published posts will appear here.</p>
        </section>
      </div>
    </div>
  );
}
