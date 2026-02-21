'use client';

/**
 * Ideas Bank — Quick-capture post ideas.
 *
 * Ideas override the series topic queue when it's time to generate a draft.
 * Unused ideas are picked first, by priority.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Lightbulb,
  Trash2,
  Pencil,
  Check,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { Idea } from '@/lib/linkedin/types';

// ── Idea Row ─────────────────────────────────────────────────────────────────

function IdeaRow({
  idea,
  onEdit,
  onDelete,
}: {
  idea: Idea;
  onEdit: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
}) {
  return (
    <div className="group flex items-start gap-3 py-3">
      <div className="shrink-0 mt-0.5 rounded-lg bg-secondary p-2">
        <Lightbulb className={`h-3.5 w-3.5 ${idea.used ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${idea.used ? 'text-muted-foreground line-through' : ''}`}>
          {idea.text}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant={idea.used ? 'secondary' : 'outline'} className="text-[10px]">
            {idea.used ? 'Used' : 'Unused'}
          </Badge>
          {idea.seriesId && (
            <Badge variant="secondary" className="text-[10px]">
              Series
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(idea.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(idea)}
              disabled={idea.used}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(idea)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function IdeasClient() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchIdeas = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/ideas');
      const data = await res.json();
      if (data.success) setIdeas(data.data ?? []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  // Quick add
  const handleAdd = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      setNewText('');
      inputRef.current?.focus();
      fetchIdeas();
    } catch {
      // TODO: toast
    } finally {
      setAdding(false);
    }
  };

  // Edit
  const handleEdit = async () => {
    if (!editingIdea || !editText.trim()) return;
    try {
      await fetch('/api/ideas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId: editingIdea.id, text: editText.trim() }),
      });
      setEditingIdea(null);
      fetchIdeas();
    } catch {
      // TODO: toast
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/ideas?id=${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchIdeas();
    } catch {
      // TODO: toast
    }
  };

  const openEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setEditText(idea.text);
  };

  const unused = ideas.filter((i) => !i.used);
  const used = ideas.filter((i) => i.used);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ideas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Jot down post ideas — the AI picks them up at draft time.
        </p>
      </div>

      {/* Quick Add */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          placeholder="What should your next post be about?"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1"
          disabled={adding}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newText.trim() || adding}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-secondary p-3 mb-4">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No ideas yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Drop in a quick thought above — it takes 10 seconds. The AI will pick it up
              next time it generates a draft.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Unused */}
          {unused.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Unused
                </h2>
                <Badge variant="secondary" className="text-[10px]">{unused.length}</Badge>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className={unused.length > 6 ? 'h-[28rem]' : undefined}>
                    <div className="divide-y px-4">
                      {unused.map((idea) => (
                        <IdeaRow
                          key={idea.id}
                          idea={idea}
                          onEdit={openEdit}
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Used */}
          {used.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Used
                </h2>
                <Badge variant="outline" className="text-[10px]">{used.length}</Badge>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className={used.length > 4 ? 'h-56' : undefined}>
                    <div className="divide-y px-4">
                      {used.map((idea) => (
                        <IdeaRow
                          key={idea.id}
                          idea={idea}
                          onEdit={openEdit}
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingIdea} onOpenChange={(v) => !v && setEditingIdea(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Idea</DialogTitle>
          </DialogHeader>
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            autoFocus
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" onClick={handleEdit} disabled={!editText.trim()}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete idea?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground line-clamp-3">
            &ldquo;{deleteTarget?.text}&rdquo;
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
