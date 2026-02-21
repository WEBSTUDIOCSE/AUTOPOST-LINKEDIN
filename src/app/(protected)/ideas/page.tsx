/**
 * Ideas Bank Page
 *
 * Quick capture of post ideas. Ideas can be standalone or attached
 * to a series. The system picks unused ideas before falling back to
 * the series topic queue.
 */

export const dynamic = 'force-dynamic';

export default function IdeasPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ideas</h1>
          <p className="mt-2 text-muted-foreground">
            Jot down post ideas — the AI will pick them up at draft time.
          </p>
        </div>
        {/* TODO: Add "Quick Add" input */}
      </div>

      <div className="mt-8 space-y-4">
        {/* TODO: Ideas list with:
          - Text preview
          - Series tag (if attached)
          - Used/unused badge
          - Edit / Delete actions
        */}
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">No ideas yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add an idea above — it takes 10 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
