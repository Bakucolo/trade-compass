import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Bot,
  Copy,
  Check,
  FileCode2,
  Loader2,
  CheckCircle2,
  Clock,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AppIdea,
  generateAntigravityPrompt,
  useSaveAntigravitySpec,
  useToggleAppIdea,
} from '@/services/appIdeaService';
import { cn } from '@/lib/utils';

export interface AntigravityCodingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  idea: AppIdea | null;
  logId?: string;
  initialPrompt?: string;
}

export function AntigravityCodingModal({
  isOpen,
  onOpenChange,
  idea,
  logId,
  initialPrompt,
}: AntigravityCodingModalProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [specFilePath, setSpecFilePath] = useState<string | null>(null);

  const saveSpecMutation = useSaveAntigravitySpec();
  const toggleMutation = useToggleAppIdea();

  useEffect(() => {
    if (idea) {
      const generated = generateAntigravityPrompt(idea);
      setCustomPrompt(initialPrompt || generated);
      setSpecFilePath(null);
    }
  }, [idea, initialPrompt]);

  if (!idea) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(customPrompt);
      setHasCopied(true);
      toast.success('Prompt copied to clipboard!', {
        description: 'Switch to Antigravity chat and press Ctrl+V to start coding.',
      });
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const handleSaveSpec = async () => {
    try {
      const res = await saveSpecMutation.mutateAsync({
        ideaId: idea.id,
        logId: logId || idea.thoughtLogId || undefined,
      });
      setSpecFilePath(res.filename);
      toast.success(`Spec saved to .agents/specs/${res.filename}`, {
        description: 'Active task pointer updated at .agents/specs/ACTIVE_TASK.md',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save spec to workspace');
    }
  };

  const handleDispatchBoth = async () => {
    // 1. Copy Prompt
    await handleCopyPrompt();

    // 2. Save Spec in Workspace
    try {
      const res = await saveSpecMutation.mutateAsync({
        ideaId: idea.id,
        logId: logId || idea.thoughtLogId || undefined,
      });
      setSpecFilePath(res.filename);
      toast.success('Task dispatched & spec saved!', {
        description: 'Prompt copied! Paste into Antigravity chat to begin execution.',
      });
    } catch (err: any) {
      // Prompt was already copied even if spec saving had an issue
      console.warn('Spec save error during dispatch:', err);
    }
  };

  const handleToggleFulfilled = async () => {
    try {
      const updated = await toggleMutation.mutateAsync(idea.id);
      toast.success(
        updated.isFulfilled ? 'Marked as fulfilled!' : 'Marked as pending'
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border/80 shadow-2xl p-0 overflow-hidden">
        {/* Modal Top Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-950/70 via-indigo-950/70 to-slate-900/90 border-b border-border/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white shrink-0">
                <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                    <span>Code with Antigravity AI</span>
                  </DialogTitle>
                  <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 text-[10px] font-bold">
                    Autonomous Agent
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Direct pairing with your Antigravity coding agent to implement this Telegram feature.
                </DialogDescription>
              </div>
            </div>

            {/* Status indicator */}
            <div className="shrink-0 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleFulfilled}
                disabled={toggleMutation.isPending}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5",
                  idea.isFulfilled
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                )}
                title={idea.isFulfilled ? "Status: Fulfilled (click to toggle)" : "Status: Pending (click to mark fulfilled)"}
              >
                {idea.isFulfilled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fulfilled</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pending Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Feature Header Card */}
          <div className="p-3.5 rounded-xl bg-accent/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background/60 text-xs font-semibold">
                  Topic: {idea.topic}
                </Badge>
                <Badge variant="outline" className="bg-background/60 text-xs font-semibold">
                  Category: {idea.category}
                </Badge>
                {idea.telegramMsgId && (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                    Telegram #{idea.telegramMsgId}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {new Date(idea.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <h3 className="text-sm font-bold text-foreground">
              {idea.title}
            </h3>

            {idea.description && (
              <div className="text-xs text-muted-foreground bg-background/50 p-2.5 rounded-lg border border-border/40 font-mono whitespace-pre-wrap">
                {idea.description}
              </div>
            )}
          </div>

          {/* Active Spec Notification if saved */}
          {specFilePath && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-[11px]">
                  Saved: .agents/specs/{specFilePath} (also synced to ACTIVE_TASK.md)
                </span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                Ready for IDE
              </span>
            </div>
          )}

          {/* Antigravity Prompt Editor / Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Antigravity Coding Prompt Preview</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Editable before copying
              </span>
            </div>

            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="font-mono text-xs h-40 bg-background/80 border-border/80 text-foreground resize-none leading-relaxed p-3 focus-visible:ring-indigo-500/50"
              placeholder="Antigravity instruction prompt..."
            />
          </div>

          {/* Quick instructions box */}
          <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 text-xs text-violet-200/90 flex items-start gap-2.5">
            <Bot className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                How to execute this task with Antigravity:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11.5px] text-muted-foreground">
                <li>
                  Click <strong className="text-violet-300">Copy Prompt</strong> and paste it directly into your Antigravity chat window (<kbd className="px-1 py-0.2 bg-background border rounded text-[10px]">Ctrl+V</kbd>).
                </li>
                <li>
                  Or click <strong className="text-violet-300">Save Spec to Project</strong> and simply tell Antigravity: <em className="text-foreground">"Implement the active task in .agents/specs/ACTIVE_TASK.md"</em>.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <DialogFooter className="p-4 bg-accent/15 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveSpec}
              disabled={saveSpecMutation.isPending}
              className="text-xs font-semibold gap-1.5 border-border/80 hover:bg-accent/60 w-full sm:w-auto"
              title="Save specification file to .agents/specs/ in your workspace"
            >
              {saveSpecMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>Save Spec (.agents/specs)</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPrompt}
              className="text-xs font-semibold gap-1.5 border-border/80 hover:bg-accent/60"
            >
              {hasCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Copy Prompt</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDispatchBoth}
              disabled={saveSpecMutation.isPending}
              className="text-xs font-bold gap-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-indigo-500/25 border-0"
            >
              {saveSpecMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              )}
              <span>Dispatch & Copy</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
