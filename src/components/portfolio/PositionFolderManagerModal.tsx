import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Folder,
  Briefcase,
  Shield,
  Zap,
  DollarSign,
  Flame,
  Layers,
  Target,
  Compass,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Boxes,
} from 'lucide-react';
import {
  PositionFolder,
  FOLDER_COLOR_PALETTES,
  getFolderThemeStyle,
  usePositionFolders,
  useCreatePositionFolder,
  useUpdatePositionFolder,
  useDeletePositionFolder,
} from '@/services/positionFolderService';

interface PositionFolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Folder,
  Briefcase,
  Shield,
  Zap,
  DollarSign,
  Flame,
  Layers,
  Target,
  Compass,
  Sparkles,
  Boxes,
};

export function renderFolderIcon(iconName?: string | null, className?: string) {
  const IconComponent = (iconName && FOLDER_ICONS[iconName]) ? FOLDER_ICONS[iconName] : Folder;
  return <IconComponent className={className || "w-4 h-4"} />;
}

export function PositionFolderManagerModal({
  isOpen,
  onClose,
}: PositionFolderManagerModalProps) {
  const { data: folders = [], isLoading } = usePositionFolders();
  const createFolderMutation = useCreatePositionFolder();
  const updateFolderMutation = useUpdatePositionFolder();
  const deleteFolderMutation = useDeletePositionFolder();

  // Mode: 'list' | 'create' | 'edit'
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Form State
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedIcon, setSelectedIcon] = useState('Folder');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setFolderName('');
    setFolderDescription('');
    setSelectedColor('blue');
    setSelectedIcon('Folder');
    setEditingFolderId(null);
    setMode('list');
    setConfirmDeleteId(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setMode('create');
  };

  const handleStartEdit = (folder: PositionFolder) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setFolderDescription(folder.description || '');
    setSelectedColor(folder.color || 'blue');
    setSelectedIcon(folder.icon || 'Folder');
    setMode('edit');
    setConfirmDeleteId(null);
  };

  const handleSave = async () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    try {
      if (mode === 'create') {
        await createFolderMutation.mutateAsync({
          name: folderName.trim(),
          description: folderDescription.trim() || undefined,
          color: selectedColor,
          icon: selectedIcon,
        });
        toast.success(`Folder "${folderName.trim()}" created successfully`);
      } else if (mode === 'edit' && editingFolderId) {
        await updateFolderMutation.mutateAsync({
          id: editingFolderId,
          payload: {
            name: folderName.trim(),
            description: folderDescription.trim() || undefined,
            color: selectedColor,
            icon: selectedIcon,
          },
        });
        toast.success('Folder updated successfully');
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save folder');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteFolderMutation.mutateAsync(id);
      toast.success(`Folder "${name}" deleted. Positions unfiled.`);
      setConfirmDeleteId(null);
      if (editingFolderId === id) {
        resetForm();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete folder');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (resetForm(), onClose())}>
      <DialogContent className="max-w-2xl bg-slate-950 border-white/10 text-foreground shadow-2xl p-0 overflow-hidden sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Portfolio Position Folders
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Organize positions into custom sleeves, strategies, and portfolio buckets.
                </DialogDescription>
              </div>
            </div>

            {mode === 'list' && (
              <Button
                onClick={handleStartCreate}
                size="sm"
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold gap-1.5 h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Folder
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
          {mode === 'list' ? (
            /* Folder List View */
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Loading position folders...
                </div>
              ) : folders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No folders yet. Click "New Folder" to create your first organization sleeve!
                </div>
              ) : (
                folders.map((folder) => {
                  const style = getFolderThemeStyle(folder.color);
                  const isConfirmingDelete = confirmDeleteId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border transition-all bg-slate-900/30 hover:bg-slate-900/60",
                        style.cardBorder
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-transform",
                            style.badgeClass
                          )}
                        >
                          {renderFolderIcon(folder.icon, cn("w-4 h-4", style.iconColor))}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {folder.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 h-4 font-mono font-medium", style.badgeClass)}
                            >
                              {folder.positionCount} {folder.positionCount === 1 ? 'position' : 'positions'}
                            </Badge>
                          </div>
                          {folder.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                              {folder.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 bg-rose-950/60 p-1 rounded-lg border border-rose-500/40">
                            <span className="text-[11px] text-rose-300 font-medium px-1">Unfile & Delete?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 px-2 text-[10px] font-bold"
                              onClick={() => handleDelete(folder.id, folder.name)}
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-white/10"
                              onClick={() => handleStartEdit(folder)}
                              title="Edit folder"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20"
                              onClick={() => setConfirmDeleteId(folder.id)}
                              title="Delete folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Create / Edit Form */
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="folder-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Folder Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. Core Compounders, Hedges, Tech Momentum..."
                  className="bg-slate-900 border-white/10 focus:border-cyan-500 text-sm h-10"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="folder-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Description (Optional)
                </Label>
                <Input
                  id="folder-desc"
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  placeholder="e.g. Long-term positions held for multi-year compound growth"
                  className="bg-slate-900 border-white/10 text-sm h-10"
                />
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Theme Color
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(FOLDER_COLOR_PALETTES).map(([key, palette]) => {
                    const isSelected = selectedColor === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedColor(key)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all text-left",
                          palette.badgeClass,
                          isSelected
                            ? "ring-2 ring-white/80 font-bold shadow-lg"
                            : "opacity-75 hover:opacity-100"
                        )}
                      >
                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", palette.dotColor)} />
                        <span className="truncate">{palette.name}</span>
                        {isSelected && <Check className="w-3 h-3 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Folder Icon
                </Label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(FOLDER_ICONS).map((iconKey) => {
                    const isSelected = selectedIcon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setSelectedIcon(iconKey)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all",
                          isSelected
                            ? "bg-white/15 text-foreground border-white/40 font-bold shadow-sm"
                            : "bg-slate-900/80 text-muted-foreground border-white/5 hover:text-foreground hover:bg-slate-900"
                        )}
                      >
                        {renderFolderIcon(iconKey, "w-3.5 h-3.5")}
                        <span>{iconKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="pt-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Live Preview
                </Label>
                {(() => {
                  const style = getFolderThemeStyle(selectedColor);
                  return (
                    <div className={cn("p-3.5 rounded-xl border flex items-center gap-3 bg-slate-900/40", style.cardBorder)}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", style.badgeClass)}>
                        {renderFolderIcon(selectedIcon, cn("w-4 h-4", style.iconColor))}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {folderName.trim() || 'Untitled Folder'}
                          </span>
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", style.badgeClass)}>
                            0 positions
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {folderDescription.trim() || 'No description provided'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-white/10 bg-slate-900/50 flex items-center justify-between sm:justify-between">
          {mode === 'list' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="border-white/10 hover:bg-white/10 text-xs ml-auto"
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={createFolderMutation.isPending || updateFolderMutation.isPending}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs"
              >
                {mode === 'create' ? 'Create Folder' : 'Save Changes'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
