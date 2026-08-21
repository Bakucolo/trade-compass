import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  FileText,
  Save,
  Trash2,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Loader2,
  X,
  Eye,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStockNote, useSaveStockNote, useDeleteStockNote, NoteSentiment } from '@/services/noteService';
import { useToast } from './ui/use-toast';
import ReactMarkdown from 'react-markdown';

interface StockNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  stockName?: string;
  currentPrice?: number;
}

const PRESET_TAGS = [
  'Long Term',
  'Earnings Play',
  'Value Thesis',
  'Growth',
  'Dividend',
  'High Conviction',
  'Swing Trade',
  'Option Strategy',
];

const TEMPLATES = [
  {
    name: 'Thesis Outline',
    text: `### 🎯 Investment Thesis
- **Core Catalyst:** 
- **Target Price:** 
- **Time Horizon:** 
- **Key Risks:** 
`,
  },
  {
    name: 'Earnings Play',
    text: `### 📊 Earnings Setup
- **Earnings Date:** 
- **Expected Move:** 
- **Implied Volatility Rank:** 
- **Strategy:** 
`,
  },
  {
    name: 'Risk & Exit Plan',
    text: `### 🛡️ Risk Management & Exit Plan
- **Stop Loss / Invalidation:** 
- **Take Profit Target 1:** 
- **Take Profit Target 2:** 
- **Max Portfolio Allocation:** 
`,
  },
];

export function StockNoteModal({
  isOpen,
  onClose,
  symbol,
  stockName,
  currentPrice,
}: StockNoteModalProps) {
  const { toast } = useToast();
  const cleanSymbol = symbol?.trim().toUpperCase() || '';

  const { data: existingNote, isLoading: isNoteLoading } = useStockNote(isOpen ? cleanSymbol : null);
  const saveMutation = useSaveStockNote();
  const deleteMutation = useDeleteStockNote();

  const [content, setContent] = useState('');
  const [sentiment, setSentiment] = useState<NoteSentiment | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync state when existingNote is loaded or symbol changes
  useEffect(() => {
    if (isOpen) {
      setConfirmDelete(false);
      if (existingNote) {
        setContent(existingNote.content || '');
        setSentiment(existingNote.sentiment || null);
        if (existingNote.tags) {
          const parsedTags = existingNote.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          setTags(parsedTags);
        } else {
          setTags([]);
        }
      } else {
        setContent('');
        setSentiment(null);
        setTags([]);
      }
    }
  }, [existingNote, isOpen, cleanSymbol]);

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleInsertTemplate = (templateText: string) => {
    setContent((prev) => (prev ? `${prev}\n\n${templateText}` : templateText));
    setActiveTab('edit');
  };

  const handleSave = async () => {
    if (!cleanSymbol) return;

    try {
      await saveMutation.mutateAsync({
        symbol: cleanSymbol,
        content: content.trim(),
        tags: tags.length > 0 ? tags.join(', ') : null,
        sentiment,
      });

      toast({
        title: 'Note Saved',
        description: `Your notes for ${cleanSymbol} have been updated.`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error Saving Note',
        description: error.message || 'Failed to save note.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!cleanSymbol) return;

    try {
      await deleteMutation.mutateAsync(cleanSymbol);
      toast({
        title: 'Note Deleted',
        description: `Notes for ${cleanSymbol} have been removed.`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error Deleting Note',
        description: error.message || 'Failed to delete note.',
        variant: 'destructive',
      });
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-background/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-mono font-black text-lg text-primary shadow-inner">
                {cleanSymbol.slice(0, 3)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-mono tracking-tight text-foreground">
                    {cleanSymbol}
                  </DialogTitle>
                  {currentPrice !== undefined && currentPrice > 0 && (
                    <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-accent/40">
                      ${currentPrice.toFixed(2)}
                    </Badge>
                  )}
                  {existingNote?.updatedAt && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-normal ml-2">
                      <Calendar className="w-3 h-3" />
                      Updated {new Date(existingNote.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">
                  {stockName || 'Stock Thesis, Catalysts & Notes'}
                </DialogDescription>
              </div>
            </div>

            {/* Sentiment Badges Selector */}
            <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setSentiment(sentiment === 'BULLISH' ? null : 'BULLISH')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                  sentiment === 'BULLISH'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                )}
                title="Mark as Bullish"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Bullish
              </button>
              <button
                type="button"
                onClick={() => setSentiment(sentiment === 'NEUTRAL' ? null : 'NEUTRAL')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                  sentiment === 'NEUTRAL'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                )}
                title="Mark as Neutral"
              >
                <Minus className="w-3.5 h-3.5" />
                Neutral
              </button>
              <button
                type="button"
                onClick={() => setSentiment(sentiment === 'BEARISH' ? null : 'BEARISH')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                  sentiment === 'BEARISH'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                )}
                title="Mark as Bearish"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Bearish
              </button>
            </div>
          </div>

          {/* Tags & Quick Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/30 flex items-center gap-1 group"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-destructive transition-colors ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}

            {/* Inline tag adder */}
            <div className="flex items-center gap-1">
              <Input
                placeholder="+ Add tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(newTagInput);
                  }
                }}
                className="h-6 text-xs w-24 px-2 bg-background/50 border-border/60 focus:w-32 transition-all"
              />
            </div>

            {/* Quick preset tags */}
            <div className="hidden md:flex items-center gap-1 ml-auto text-[11px] text-muted-foreground">
              <span>Quick:</span>
              {PRESET_TAGS.filter((t) => !tags.includes(t))
                .slice(0, 3)
                .map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddTag(preset)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors border border-border/40"
                  >
                    +{preset}
                  </button>
                ))}
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {isNoteLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs">Loading note...</p>
            </div>
          ) : (
            <>
              {/* Quick Template Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap bg-background/40 p-2 rounded-xl border border-border/40 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold text-foreground">Insert Template:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TEMPLATES.map((tmpl) => (
                    <Button
                      key={tmpl.name}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2.5 bg-card/60 hover:bg-primary/15 hover:text-primary border border-border/50"
                      onClick={() => handleInsertTemplate(tmpl.text)}
                    >
                      {tmpl.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tabs: Edit Markdown vs Live Preview */}
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'edit' | 'preview')}
                className="w-full"
              >
                <div className="flex items-center justify-between mb-2">
                  <TabsList className="h-8 bg-muted/50 p-0.5">
                    <TabsTrigger value="edit" className="text-xs h-7 gap-1 px-3">
                      <Edit3 className="w-3 h-3" /> Edit Markdown
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs h-7 gap-1 px-3">
                      <Eye className="w-3 h-3" /> Preview
                    </TabsTrigger>
                  </TabsList>

                  <div className="text-[11px] text-muted-foreground font-mono">
                    {wordCount} words • {charCount} chars
                  </div>
                </div>

                <TabsContent value="edit" className="mt-0 space-y-2">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    placeholder={`Write your thesis, trade plan, catalysts, or notes for ${cleanSymbol}...
Supports Markdown formatting (## Headers, - Lists, **bold**, \`code\`).
Press Ctrl+Enter to quick save.`}
                    rows={12}
                    className="w-full p-4 rounded-xl bg-background/70 border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary text-sm font-sans text-foreground placeholder:text-muted-foreground resize-none leading-relaxed transition-all shadow-inner focus:outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Markdown supported. Links, lists, and headings will render in preview.</span>
                    <span className="hidden sm:inline font-mono">Shortcuts: Ctrl+Enter to save</span>
                  </p>
                </TabsContent>

                <TabsContent value="preview" className="mt-0">
                  <div className="w-full min-h-[290px] max-h-[360px] p-5 rounded-xl bg-background/40 border border-border/60 overflow-y-auto prose prose-invert prose-sm max-w-none">
                    {content.trim() ? (
                      <ReactMarkdown>{content}</ReactMarkdown>
                    ) : (
                      <div className="py-16 text-center text-muted-foreground text-xs italic">
                        No content written yet. Switch to "Edit" tab to start writing.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 px-6 border-t border-border/50 bg-background/50 flex flex-row items-center justify-between gap-3 sm:justify-between">
          <div>
            {existingNote && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <span className="text-xs text-destructive font-medium">Delete note?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs px-2.5"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Delete'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs px-2"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Note
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4 text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="glow"
              size="sm"
              className="h-9 px-5 text-xs font-semibold bg-primary text-primary-foreground gap-1.5"
              onClick={handleSave}
              disabled={saveMutation.isPending || isNoteLoading}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Note
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
