import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Folder, FolderPlus, Check, X, Settings2 } from 'lucide-react';
import {
  PositionFolder,
  getFolderThemeStyle,
  useAssignPositionFolder,
  useUnassignPositionFolder,
} from '@/services/positionFolderService';
import { renderFolderIcon } from './PositionFolderManagerModal';

interface PositionFolderDropdownProps {
  positionKey: string;
  symbol: string;
  currentFolder?: PositionFolder | null;
  folders: PositionFolder[];
  onOpenFolderManager?: () => void;
  compact?: boolean;
}

export function PositionFolderDropdown({
  positionKey,
  symbol,
  currentFolder,
  folders,
  onOpenFolderManager,
  compact = false,
}: PositionFolderDropdownProps) {
  const assignMutation = useAssignPositionFolder();
  const unassignMutation = useUnassignPositionFolder();

  const handleSelectFolder = async (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.stopPropagation();
    if (currentFolder?.id === folderId) return;

    try {
      await assignMutation.mutateAsync({
        folderId,
        positionKey,
        symbol,
      });
      toast.success(`Filed ${symbol} into "${folderName}"`);
    } catch (err: any) {
      toast.error(err.message || `Failed to assign ${symbol} to folder`);
    }
  };

  const handleUnassign = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await unassignMutation.mutateAsync(positionKey);
      toast.info(`Removed ${symbol} from "${currentFolder?.name || 'Folder'}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove position from folder');
    }
  };

  const themeStyle = currentFolder ? getFolderThemeStyle(currentFolder.color) : null;

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {currentFolder ? (
            <button
              type="button"
              className={cn(
                "group/btn inline-flex items-center gap-1 text-[9px] px-1.5 py-0 h-4 rounded font-bold border transition-all cursor-pointer shadow-sm hover:scale-105",
                themeStyle?.badgeClass
              )}
              title={`Filed under: ${currentFolder.name}. Click to move or manage.`}
            >
              {renderFolderIcon(currentFolder.icon, "w-2.5 h-2.5 shrink-0")}
              <span className="truncate max-w-[85px]">{currentFolder.name}</span>
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 text-[9px] px-1.5 py-0 h-4 rounded font-medium border border-dashed border-white/20 text-muted-foreground/70 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all cursor-pointer",
                compact && "px-1"
              )}
              title={`Add ${symbol} to a folder`}
            >
              <FolderPlus className="w-2.5 h-2.5" />
              {!compact && <span>Folder</span>}
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-48 bg-slate-950 border-white/10 text-foreground shadow-2xl p-1 rounded-xl"
        >
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Organize Position
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-white/10" />

          {folders.length === 0 ? (
            <div className="p-2 text-center text-xs text-muted-foreground">
              No folders created
            </div>
          ) : (
            folders.map((f) => {
              const isSelected = currentFolder?.id === f.id;
              const fStyle = getFolderThemeStyle(f.color);
              return (
                <DropdownMenuItem
                  key={f.id}
                  onClick={(e) => handleSelectFolder(e, f.id, f.name)}
                  className={cn(
                    "flex items-center justify-between text-xs px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-white/15 text-foreground font-bold"
                      : "hover:bg-white/10 text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", fStyle.dotColor)} />
                    {renderFolderIcon(f.icon, cn("w-3.5 h-3.5 shrink-0", fStyle.iconColor))}
                    <span className="truncate">{f.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                </DropdownMenuItem>
              );
            })
          )}

          {currentFolder && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleUnassign}
                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remove from Folder</span>
              </DropdownMenuItem>
            </>
          )}

          {onOpenFolderManager && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolderManager();
                }}
                className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Manage Folders...</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
