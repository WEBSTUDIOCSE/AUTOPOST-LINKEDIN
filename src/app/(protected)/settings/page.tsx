/**
 * Settings Page
 *
 * User can configure:
 * - LinkedIn account connection
 * - Posting schedule (days + times)
 * - AI persona / writing style
 * - Draft generation hour & review deadline
 * - Notification preferences
 * - Timezone
 */

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Configure your autoposter preferences.
      </p>

      <div className="mt-8 space-y-8">
        {/* LinkedIn Connection */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">LinkedIn Account</h2>
          <p className="mt-2 text-muted-foreground">
            Connect your LinkedIn account to enable auto-posting.
          </p>
          {/* TODO: Connect/Disconnect button, show connected status */}
        </section>

        {/* Posting Schedule */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Posting Schedule</h2>
          <p className="mt-2 text-muted-foreground">
            Choose which days and times your posts go live.
          </p>
          {/* TODO: Day toggles + time pickers */}
        </section>

        {/* AI Persona */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Writing Style</h2>
          <p className="mt-2 text-muted-foreground">
            Describe how you write — the AI will match your tone.
          </p>
          {/* TODO: Textarea for persona description */}
        </section>

        {/* Draft & Review Timing */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Draft Timing</h2>
          <p className="mt-2 text-muted-foreground">
            When should drafts be generated and when is the review cutoff?
          </p>
          {/* TODO: Hour selectors for draftGenerationHour & reviewDeadlineHour */}
        </section>

        {/* Notifications */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="mt-2 text-muted-foreground">
            Enable push notifications to get reminders when drafts are ready.
          </p>
          {/* TODO: Enable notifications button (calls requestNotificationPermission) */}
        </section>
      </div>
    </div>
  );
}
