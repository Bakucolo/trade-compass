import { useState } from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/services/themeService';
import { ThemeStylingModal } from './ThemeStylingModal';

interface ThemeSwitcherButtonProps {
  collapsed?: boolean;
  className?: string;
  variant?: 'sidebar' | 'header' | 'floating' | 'card';
}

export function ThemeSwitcherButton({
  collapsed = false,
  className,
  variant = 'sidebar',
}: ThemeSwitcherButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { activePreset } = useTheme();

  return (
    <>
      {variant === 'sidebar' && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 group shadow-sm',
            className
          )}
          title={`Website Stylings & Theme (${activePreset.name})`}
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary group-hover:rotate-45 transition-transform duration-300" />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background"
              style={{ backgroundColor: activePreset.primaryColor }}
            />
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="truncate">Stylings</span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.2 rounded border"
                style={{
                  color: activePreset.primaryColor,
                  borderColor: `${activePreset.primaryColor}40`,
                  backgroundColor: `${activePreset.primaryColor}15`,
                }}
              >
                {activePreset.name.split(' ')[0]}
              </span>
            </div>
          )}
        </button>
      )}

      {variant === 'header' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className={cn(
            'h-8 px-2.5 text-xs gap-1.5 border-border/70 bg-card/60 hover:bg-accent/40 font-semibold text-foreground',
            className
          )}
          title="Switch Website Stylings"
        >
          <Palette className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Theme: {activePreset.name}</span>
          <span
            className="w-2 h-2 rounded-full ml-0.5 inline-block"
            style={{ backgroundColor: activePreset.primaryColor }}
          />
        </Button>
      )}

      {variant === 'floating' && (
        <Button
          size="icon"
          onClick={() => setIsOpen(true)}
          className={cn(
            'fixed bottom-5 right-5 z-40 rounded-full shadow-2xl bg-card border border-primary/40 hover:border-primary text-foreground hover:bg-accent h-11 w-11',
            className
          )}
          title="Customize Website Stylings"
        >
          <Palette className="w-5 h-5 text-primary animate-pulse" />
        </Button>
      )}

      {/* Theme Selection Modal */}
      <ThemeStylingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
