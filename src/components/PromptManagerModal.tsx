import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  FileText,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import {
  useReportPrompts,
  useCreatePromptTemplate,
  useUpdatePromptTemplate,
  useDeletePromptTemplate,
  useResetPromptTemplates,
  ReportPromptTemplate,
} from '@/services/promptService';

interface PromptManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt?: (template: ReportPromptTemplate) => void;
}

export function PromptManagerModal({
  open,
  onOpenChange,
  onSelectPrompt,
}: PromptManagerModalProps) {
  const { data: prompts = [], isLoading } = useReportPrompts();
  const createMutation = useCreatePromptTemplate();
  const updateMutation = useUpdatePromptTemplate();
  const deleteMutation = useDeletePromptTemplate();
  const resetMutation = useResetPromptTemplates();

  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');

  const activePrompt = prompts.find((p) => p.id === (selectedPromptId || prompts[0]?.id));

  // Sync state whenever modal opens or prompts load
  useEffect(() => {
    if (open && prompts.length > 0 && !isCreatingNew) {
      const current = prompts.find((p) => p.id === selectedPromptId) || prompts[0];
      if (current) {
        setSelectedPromptId(current.id);
        setName(current.name || '');
        setDescription(current.description || '');
        setSystemPrompt(current.systemPrompt || '');
        setUserPrompt(current.userPrompt || '');
      }
    }
  }, [open, prompts, isCreatingNew]);

  const handleSelectPromptToEdit = (p: ReportPromptTemplate) => {
    setIsCreatingNew(false);
    setSelectedPromptId(p.id);
    setName(p.name || '');
    setDescription(p.description || '');
    setSystemPrompt(p.systemPrompt || '');
    setUserPrompt(p.userPrompt || '');
    setSaveSuccessMsg(false);
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setSelectedPromptId(null);
    setName('');
    setDescription('');
    setSystemPrompt(
`You are an expert financial analyst. Your task is to perform an in-depth analysis for the given ticker.
Follow the ReAct loop. Use your tools to gather real-time data, macro metrics, filings, and news.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "<CUSTOM TITLE>: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Point 1", "Point 2", "Point 3"],
  "sections": [
    { "title": "Section 1", "content": "Analysis text..." },
    { "title": "Section 2", "content": "Analysis text..." }
  ]
}`
    );
    setUserPrompt('Please generate a detailed research report for: {ticker}.');
    setSaveSuccessMsg(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || (activePrompt ? activePrompt.name : '');
    const finalSystemPrompt = systemPrompt.trim() || (activePrompt ? activePrompt.systemPrompt : '');

    if (!finalName || !finalSystemPrompt) {
      alert('Report name and system prompt instructions are required.');
      return;
    }

    try {
      if (isCreatingNew) {
        const created = await createMutation.mutateAsync({
          name: finalName,
          description: description.trim(),
          systemPrompt: finalSystemPrompt,
          userPrompt: userPrompt.trim() || 'Please generate a research report for: {ticker}.',
        });
        setIsCreatingNew(false);
        setSelectedPromptId(created.id);
        setName(created.name);
        setDescription(created.description || '');
        setSystemPrompt(created.systemPrompt);
        setUserPrompt(created.userPrompt || '');
      } else if (activePrompt) {
        await updateMutation.mutateAsync({
          id: activePrompt.id,
          name: finalName,
          description: description.trim(),
          systemPrompt: finalSystemPrompt,
          userPrompt: userPrompt.trim() || 'Please generate a research report for: {ticker}.',
        });
      }
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err: any) {
      alert(`Failed to save prompt: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, promptName: string) => {
    if (prompts.length <= 1) {
      alert('You must keep at least one report prompt template.');
      return;
    }
    if (confirm(`Are you sure you want to delete the prompt template "${promptName}"?`)) {
      try {
        await deleteMutation.mutateAsync(id);
        const remaining = prompts.filter((p) => p.id !== id);
        if (remaining.length > 0) {
          handleSelectPromptToEdit(remaining[0]);
        }
      } catch (err: any) {
        alert(`Failed to delete: ${err.message}`);
      }
    }
  };

  const handleResetDefaults = async () => {
    if (confirm('Are you sure you want to reset all report prompts to standard defaults? Any custom prompt edits will be restored to default.')) {
      try {
        const reset = await resetMutation.mutateAsync();
        if (reset.length > 0) {
          handleSelectPromptToEdit(reset[0]);
        }
      } catch (err: any) {
        alert(`Failed to reset: ${err.message}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl h-[85vh] max-h-[85vh] flex flex-col bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Research Report Prompts</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Customize, create, and modify the AI prompts used to generate your Autonomous Reports.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              disabled={resetMutation.isPending}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </Button>
            <Button
              variant="glow"
              size="sm"
              onClick={handleStartNew}
              className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New Prompt
            </Button>
          </div>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Sidebar: List of Prompts */}
          <div className="md:col-span-4 border-r border-border/60 p-4 overflow-y-auto space-y-2 bg-card/30">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block px-2 mb-2">
              Report Templates ({prompts.length})
            </span>

            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading templates...</p>
              </div>
            ) : (
              prompts.map((p) => {
                const isSelected = (!isCreatingNew && (selectedPromptId === p.id || (!selectedPromptId && activePrompt?.id === p.id)));

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPromptToEdit(p)}
                    className={cn(
                      "p-3 rounded-xl border text-left cursor-pointer transition-all relative group",
                      isSelected
                        ? "bg-primary/15 border-primary/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                        : "bg-card/60 border-border/60 hover:bg-accent/40 hover:border-primary/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground truncate max-w-[170px]">{p.name}</span>
                      {p.isDefault && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                          Built-in
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {p.description || 'Custom report prompt template.'}
                    </p>

                    {!p.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id, p.name);
                        }}
                        className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Editor: Prompt Details */}
          <div className="md:col-span-8 p-6 overflow-y-auto bg-background/50">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  {isCreatingNew ? 'Create New Prompt Template' : `Editing: ${name || activePrompt?.name || ''}`}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" /> Powered by Google Gemini / OpenRouter
                </span>
              </div>

              {/* Template Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Report Title / Name</Label>
                <Input
                  placeholder="e.g. Valuation Deep Dive, Management Scorecard..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 text-sm font-semibold bg-card border-border"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Short Description</Label>
                <Input
                  placeholder="What this report analyzes and covers..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 text-xs bg-card border-border"
                />
              </div>

              {/* System Prompt (Instructions & JSON Schema) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">System Prompt (AI Instructions & Output JSON Structure)</Label>
                  <span className="text-[10px] text-muted-foreground">Must enforce valid JSON output</span>
                </div>
                <Textarea
                  rows={11}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="font-mono text-xs leading-relaxed bg-card border-border resize-none"
                  required
                />
              </div>

              {/* User Prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">User Prompt Template</Label>
                <Input
                  placeholder="e.g. Please generate an executive report for: {ticker}"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  className="h-9 text-xs font-mono bg-card border-border"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {saveSuccessMsg ? (
                  <span className="text-xs text-success flex items-center gap-1 font-semibold animate-in fade-in">
                    <Check className="w-4 h-4" /> Changes saved successfully!
                  </span>
                ) : (
                  <span />
                )}

                <Button
                  type="submit"
                  variant="glow"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold px-5"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {isCreatingNew ? 'Create Template' : 'Save Changes'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
