/**
 * Series Management Page
 *
 * Create, view, edit, reorder, and delete topic series.
 * Each series has a queue of topics the AI covers sequentially.
 */

export const dynamic = 'force-dynamic';

export default function SeriesPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Series</h1>
          <p className="mt-2 text-muted-foreground">
            Organize your posts into themed topic sequences.
          </p>
        </div>
        {/* TODO: Add "New Series" button */}
      </div>

      <div className="mt-8 space-y-4">
        {/* TODO: Series list with cards showing:
          - Title, category, status badge
          - Progress bar (currentIndex / topicQueue.length)
          - Topic list (expandable)
          - Edit / Pause / Delete actions
        */}
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">No series created yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a series to start auto-generating LinkedIn posts.
          </p>
        </div>
      </div>
    </div>
  );
}
