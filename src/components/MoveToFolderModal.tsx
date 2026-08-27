import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  FolderPlus,
  Check,
  Smartphone,
  Mic,
  Lightbulb,
  Search,
  Eye,
  Globe,
  BarChart2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useUpdateThoughtLog,
  useThoughtLogFolders,
  ThoughtLogRecord,
} from '@/services/thoughtLogService';
import { cn } from '@/lib/utils';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLog: ThoughtLogRecord | null;
  onMoved?: (newFolder: string) => void;
}

const PRESET_FOLDERS = [
  { name: 'General', icon: Folder, color: 'text-slate-400' },
  { name: 'Telegram', icon: Smartphone, color: 'text-indigo-400' },
  { name: 'Voice Notes', icon: Mic, color: 'text-sky-400' },
  { name: 'Ideas', icon: Lightbulb, color: 'text-amber-400' },
  { name: 'Research', icon: Search, color: 'text-purple-400' },
  { name: 'Watchlist', icon: Eye, color: 'text-emerald-400' },
  { name: 'Macro', icon: Globe, color: 'text-blue-400' },
  { name: 'Earnings', icon: BarChart2, color: 'text-rose-400' },
  { name: 'Trading', icon: Zap, color: 'text-orange-400' },
];

export function MoveToFolderModal({
  isOpen,
  onClose,
  targetLog,
  onMoved,
}: MoveToFolderModalProps) {
  const { data: folderData } = useThoughtLogFolders();
  const updateLogMutation = useUpdateThoughtLog();
  const [selectedFolder, setSelectedFolder] = useState<string>(
    targetLog?.folder || 'General'
  );
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  // Combine presets with any user-created custom folders
  const allFolderNames = Array.from(
    new Set([
      ...PRESET_FOLDERS.map((f) => f.name),
      ...(folderData?.folders.map((f) => f.name) || []),
    ])
  );

  const handleSelectFolder = (name: string) => {
    setSelectedFolder(name);
    setIsCreatingCustom(false);
  };

  const handleConfirmMove = async () => {
    if (!targetLog) return;
    const finalFolder = isCreatingCustom
      ? customFolderInput.trim()
      : selectedFolder;

    if (!finalFolder) {
      toast.error('Please select or specify a folder name.');
      return;
    }

    try {
      await updateLogMutation.mutateAsync({
        id: targetLog.id,
        data: { folder: finalFolder },
      });
      toast.success(`Note moved to "${finalFolder}"!`);
      if (onMoved) onMoved(finalFolder);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move note to folder.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Move Note to Folder
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {targetLog?.title || 'Organize into categories or workspaces'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Folders Grid */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Select Destination Folder
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {allFolderNames.map((folderName) => {
                const preset = PRESET_FOLDERS.find((p) => p.name === folderName);
                const Icon = preset ? preset.icon : Folder;
                const isSelected = !isCreatingCustom && selectedFolder === folderName;
                const count =
                  folderData?.folders.find((f) => f.name === folderName)?.count || 0;

                return (
                  <button
                    key={folderName}
                    type="button"
                    onClick={() => handleSelectFolder(folderName)}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition-all text-left group',
                      isSelected
                        ? 'bg-primary/15 border-primary/50 text-primary shadow-sm'
                        : 'bg-background/60 border-border/60 hover:bg-accent/40 text-foreground/90'
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon
                        className={cn(
                          'w-3.5 h-3.5 shrink-0',
                          preset ? preset.color : 'text-slate-400'
                        )}
                      />
                      <span className="truncate">{folderName}</span>
                    </div>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />
                    ) : count > 0 ? (
                      <span className="text-[10px] text-muted-foreground font-mono ml-1">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Folder Creator */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <FolderPlus className="w-3 h-3 text-primary" />
                Or Create New Folder
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g. Q3 Earnings, Crypto, Energy DCA..."
                value={customFolderInput}
                onChange={(e) => {
                  setCustomFolderInput(e.target.value);
                  if (e.target.value.trim()) {
                    setIsCreatingCustom(true);
                  }
                }}
                className="h-8 text-xs bg-background/80"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmMove}
            disabled={updateLogMutation.isPending}
            className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            {updateLogMutation.isPending ? 'Moving...' : 'Move Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
