'use client';

/**
 * Settings — Configure LinkedIn connection, posting schedule,
 * draft timing, AI model, persona, notifications, and test triggers.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Linkedin,
  Bell,
  Clock,
  Globe,
  Calendar,
  Check,
  Unplug,
  Loader2,
  Bot,
  AlertCircle,
  User,
} from 'lucide-react';
import type { AutoposterProfile, PostingDay, PostingSchedule } from '@/lib/linkedin/types';

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK: { key: keyof PostingSchedule; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}:00`,
}));

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const PROVIDER_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: '_default', label: 'Default (env config)', description: 'Uses server default' },
  { value: 'gemini', label: 'Google Gemini', description: 'gemini-2.5-flash' },
  { value: 'kieai', label: 'Kie.AI', description: 'gemini-2.5-flash via Kie proxy' },
];

const MEDIA_TYPE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'text', label: 'Text Only', description: 'Plain LinkedIn post' },
  { value: 'image', label: 'With Image', description: 'AI-generated image' },
  { value: 'html', label: 'HTML Carousel', description: 'Infographic slides' },
];

const DEFAULT_SCHEDULE: PostingSchedule = {
  monday: { enabled: false, postTime: '10:00' },
  tuesday: { enabled: true, postTime: '10:00' },
  wednesday: { enabled: true, postTime: '10:00' },
  thursday: { enabled: true, postTime: '10:00' },
  friday: { enabled: false, postTime: '10:00' },
  saturday: { enabled: false, postTime: '10:00' },
  sunday: { enabled: false, postTime: '10:00' },
};

// ── Schedule Row ─────────────────────────────────────────────────────────────

function ScheduleRow({
  day,
  value,
  onChange,
}: {
  day: { key: keyof PostingSchedule; label: string; short: string };
  value: PostingDay;
  onChange: (val: PostingDay) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
        />
        <span className={`text-sm ${value.enabled ? 'font-medium' : 'text-muted-foreground'}`}>
          <span className="hidden sm:inline">{day.label}</span>
          <span className="sm:hidden">{day.short}</span>
        </span>
      </div>
      <Input
        type="time"
        value={value.postTime}
        onChange={(e) => onChange({ ...value, postTime: e.target.value })}
        disabled={!value.enabled}
        className="w-32 text-sm touch-manipulation"
      />
    </div>
  );
}

// ── Section Wrapper ──────────────────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-secondary p-2.5 shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base leading-snug">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SettingsClient() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AutoposterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // section being saved

  // Form state
  const [schedule, setSchedule] = useState<PostingSchedule>(DEFAULT_SCHEDULE);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [draftHour, setDraftHour] = useState('21');
  const [reviewHour, setReviewHour] = useState('3');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // AI model state
  const [preferredProvider, setPreferredProvider] = useState('_default');
  const [preferredTextModel, setPreferredTextModel] = useState('');
  const [preferredMediaType, setPreferredMediaType] = useState('text');
  const [persona, setPersona] = useState('');



  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/autoposter/profile');
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data as AutoposterProfile;
        setProfile(p);
        setSchedule(p.postingSchedule ?? DEFAULT_SCHEDULE);
        setTimezone(p.timezone ?? 'Asia/Kolkata');
        setDraftHour(String(p.draftGenerationHour ?? 21));
        setReviewHour(String(p.reviewDeadlineHour ?? 3));
        setNotificationsEnabled(!!p.fcmToken);
        setPreferredProvider(p.preferredProvider ?? '_default');
        setPreferredTextModel(p.preferredTextModel ?? '');
        setPreferredMediaType(p.preferredMediaType ?? 'text');
        setPersona(p.persona ?? '');
      } else {
        // Create profile if it doesn't exist
        await fetch('/api/autoposter/profile', { method: 'POST' });
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);



  // Generic save handler
  const saveField = async (section: string, updates: Record<string, unknown>) => {
    setSaving(section);
    try {
      await fetch('/api/autoposter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchProfile();
    } catch {
      // TODO: toast
    } finally {
      setSaving(null);
    }
  };

  // Save handlers
  const saveSchedule = () => saveField('schedule', { postingSchedule: schedule });
  const saveTiming = () =>
    saveField('timing', {
      draftGenerationHour: Number(draftHour),
      reviewDeadlineHour: Number(reviewHour),
      timezone,
    });
  const saveModel = () =>
    saveField('model', {
      preferredProvider: preferredProvider === '_default' ? null : preferredProvider,
      preferredTextModel: preferredTextModel.trim() || null,
      preferredMediaType,
    });
  const savePersona = () =>
    saveField('persona', { persona: persona.trim() || null });

  const enableNotifications = async () => {
    setSaving('notifications');
    try {
      // Request permission + get token via FCM
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // In a real implementation this would get the FCM token
          // For now, save a placeholder to indicate notifications are enabled
          await saveField('notifications', { fcmToken: 'enabled' });
          setNotificationsEnabled(true);
        }
      }
    } catch {
      // TODO: toast
    } finally {
      setSaving(null);
    }
  };

  const connectLinkedIn = () => {
    // Redirect to OAuth flow
    window.location.href = '/api/linkedin/auth';
  };

  const disconnectLinkedIn = async () => {
    setSaving('linkedin');
    try {
      await fetch('/api/autoposter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinConnected: false }),
      });
      fetchProfile();
    } catch {
      // TODO: toast
    } finally {
      setSaving(null);
    }
  };



  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-60 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your autoposter preferences.
        </p>
      </div>

      {/* ── LinkedIn Connection ───────────────────────────────────────────── */}
      <SettingsSection
        icon={Linkedin}
        title="LinkedIn Account"
        description="Connect your account to enable auto-posting."
      >
        {profile?.linkedinConnected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="default" className="text-xs shrink-0">
                <Check className="mr-1 h-3 w-3" />
                Connected
              </Badge>
              {profile.linkedinMemberUrn && (
                <span className="text-xs text-muted-foreground truncate">
                  {profile.linkedinMemberUrn}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnectLinkedIn}
              disabled={saving === 'linkedin'}
              className="w-full sm:w-auto touch-manipulation"
            >
              <Unplug className="mr-1.5 h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={connectLinkedIn} className="w-full sm:w-auto touch-manipulation">
            <Linkedin className="mr-1.5 h-3.5 w-3.5" />
            Connect LinkedIn
          </Button>
        )}
      </SettingsSection>

      {/* ── AI Model & Media ──────────────────────────────────────────────── */}
      <SettingsSection
        icon={Bot}
        title="AI Model"
        description="Choose the AI provider and default media type for auto-generated drafts."
      >
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">AI Provider</Label>
              <Select value={preferredProvider} onValueChange={setPreferredProvider}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div>
                        <span>{p.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Text Model Override</Label>
              <Input
                placeholder="e.g. gemini-2.5-flash"
                value={preferredTextModel}
                onChange={(e) => setPreferredTextModel(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Leave empty to use provider default
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Default Media Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {MEDIA_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreferredMediaType(opt.value)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors touch-manipulation ${
                    preferredMediaType === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-secondary/50'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={saveModel} disabled={saving === 'model'} className="w-full sm:w-auto touch-manipulation">
              {saving === 'model' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Model
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* ── Persona ───────────────────────────────────────────────────────── */}
      <SettingsSection
        icon={User}
        title="Writing Persona"
        description="Describe your writing style so every AI draft sounds like you."
      >
        <div className="space-y-4">
          <Textarea
            placeholder="e.g. I write short, punchy LinkedIn posts with 2-3 paragraphs. I use emojis sparingly. I share what I built and what I learned."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="min-h-[100px] text-sm resize-y"
            rows={4}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={savePersona} disabled={saving === 'persona'} className="w-full sm:w-auto touch-manipulation">
              {saving === 'persona' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Persona
            </Button>
          </div>
        </div>
      </SettingsSection>

      <Separator />

      {/* ── Posting Schedule ──────────────────────────────────────────────── */}
      <SettingsSection
        icon={Calendar}
        title="Posting Schedule"
        description="Choose which days and times your posts go live."
      >
        <div className="space-y-1 divide-y">
          {DAYS_OF_WEEK.map((day) => (
            <ScheduleRow
              key={day.key}
              day={day}
              value={schedule[day.key]}
              onChange={(val) =>
                setSchedule((prev) => ({ ...prev, [day.key]: val }))
              }
            />
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={saveSchedule} disabled={saving === 'schedule'} className="w-full sm:w-auto touch-manipulation">
            {saving === 'schedule' ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save Schedule
          </Button>
        </div>
      </SettingsSection>

      {/* ── Draft Timing ──────────────────────────────────────────────────── */}
      <SettingsSection
        icon={Clock}
        title="Draft Timing"
        description="When drafts are generated and when the review window closes."
      >
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Draft Generation Time</Label>
              <Select value={draftHour} onValueChange={setDraftHour}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                The hour when the AI generates your draft (night before posting)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Review Deadline</Label>
              <Select value={reviewHour} onValueChange={setReviewHour}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Unapproved posts are skipped after this hour
              </p>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              Timezone
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={saveTiming} disabled={saving === 'timing'} className="w-full sm:w-auto touch-manipulation">
              {saving === 'timing' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Timing
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <SettingsSection
        icon={Bell}
        title="Notifications"
        description="Get push reminders when drafts are ready to review."
      >
        {notificationsEnabled ? (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              <Bell className="mr-1 h-3 w-3" />
              Enabled
            </Badge>
            <span className="text-xs text-muted-foreground">
              You&apos;ll be notified when drafts are generated.
            </span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={enableNotifications}
            disabled={saving === 'notifications'}
            className="w-full sm:w-auto touch-manipulation"
          >
            {saving === 'notifications' ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="mr-1.5 h-3.5 w-3.5" />
            )}
            Enable Notifications
          </Button>
        )}
      </SettingsSection>
    </div>
  );
}
