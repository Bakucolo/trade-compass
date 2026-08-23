import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Palette,
  Sparkles,
  Check,
  Sun,
  Moon,
  Terminal,
  Zap,
  Sliders,
  Eye,
  Layers,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTheme,
  THEME_PRESETS,
  ThemeId,
  GlowIntensity,
  RadiusStyle,
  DensityStyle,
} from '@/services/themeService';
import { toast } from 'sonner';

interface ThemeStylingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeStylingModal({ isOpen, onClose }: ThemeStylingModalProps) {
  const {
    currentTheme,
    glowIntensity,
    radiusStyle,
    densityStyle,
    setTheme,
    setGlowIntensity,
    setRadiusStyle,
    setDensityStyle,
    activePreset,
  } = useTheme();

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'DARK' | 'TERMINAL' | 'LIGHT'>('ALL');

  const filteredPresets = THEME_PRESETS.filter((preset) => {
    if (categoryFilter === 'DARK') return preset.category === 'Dark';
    if (categoryFilter === 'TERMINAL') return preset.category === 'Pro Terminal';
    if (categoryFilter === 'LIGHT') return preset.category === 'Light';
    return true;
  });

  const handleSelectTheme = (themeId: ThemeId, name: string) => {
    setTheme(themeId);
    toast.success(`Theme updated to ${name}`, {
      description: 'Styling applied across all charts, widgets, and cards.',
      duration: 2500,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card/95 border-border/80 p-0 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60 bg-gradient-to-r from-card via-card/90 to-primary/5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-purple-500/20 to-emerald-500/20 border border-primary/40 flex items-center justify-center text-primary shadow-sm">
                <Palette className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <span>Website Stylings & Visual Themes</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select a bespoke visual styling preset or fine-tune glow, corner radius, and interface density.
                </DialogDescription>
              </div>
            </div>

            {/* Active Theme Indicator Pill */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="outline" className={cn('text-xs font-mono font-bold py-1 px-2.5', activePreset.accentBadge)}>
                <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ backgroundColor: activePreset.primaryColor }} />
                Active: {activePreset.name}
              </Badge>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 pt-4 flex-wrap">
            <Button
              variant={categoryFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('ALL')}
              className={cn('h-7 text-xs px-2.5 font-semibold', categoryFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'border-border/70 text-muted-foreground')}
            >
              All Themes ({THEME_PRESETS.length})
            </Button>
            <Button
              variant={categoryFilter === 'DARK' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('DARK')}
              className={cn('h-7 text-xs px-2.5 font-semibold gap-1', categoryFilter === 'DARK' ? 'bg-primary text-primary-foreground' : 'border-border/70 text-muted-foreground')}
            >
              <Moon className="w-3 h-3" />
              Dark Glass ({THEME_PRESETS.filter(p => p.category === 'Dark').length})
            </Button>
            <Button
              variant={categoryFilter === 'TERMINAL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('TERMINAL')}
              className={cn('h-7 text-xs px-2.5 font-semibold gap-1', categoryFilter === 'TERMINAL' ? 'bg-amber-600 text-white' : 'border-border/70 text-amber-400')}
            >
              <Terminal className="w-3 h-3" />
              Pro Terminal
            </Button>
            <Button
              variant={categoryFilter === 'LIGHT' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('LIGHT')}
              className={cn('h-7 text-xs px-2.5 font-semibold gap-1', categoryFilter === 'LIGHT' ? 'bg-blue-600 text-white' : 'border-border/70 text-blue-400')}
            >
              <Sun className="w-3 h-3" />
              Daylight Light
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* ================= 1. THEME PRESETS GRID ================= */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                Preset Palettes ({filteredPresets.length})
              </span>
              <span className="text-xs text-muted-foreground">
                Click any preset to apply instantly
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredPresets.map((preset) => {
                const isActive = currentTheme === preset.id;

                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectTheme(preset.id, preset.name)}
                    className={cn(
                      'group relative rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3 text-left overflow-hidden shadow-sm hover:scale-[1.01]',
                      isActive
                        ? 'border-primary/80 bg-accent/40 ring-1 ring-primary/50 shadow-md shadow-primary/10'
                        : 'border-border/60 bg-card/50 hover:bg-card/90 hover:border-border'
                    )}
                  >
                    {/* Top gradient preview bar */}
                    <div
                      className="h-2 rounded-full w-full opacity-90 transition-all group-hover:opacity-100"
                      style={{ background: preset.previewGradient }}
                    />

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          {preset.name}
                        </span>

                        {isActive ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full border border-primary/30">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        ) : preset.popular ? (
                          <span className="text-[9px] font-mono font-semibold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                            Popular
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] font-medium text-primary/90 mt-0.5">
                        {preset.tagline}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    {/* Color Swatches & Live Preview Pill */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: preset.primaryColor }}
                          title="Primary Accent"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: preset.accentColor }}
                          title="Secondary Accent"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: preset.bgColor }}
                          title="Canvas Background"
                        />
                      </div>

                      <span className="text-[10px] text-muted-foreground font-mono">
                        {preset.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= 2. FINE-TUNING CONTROLS ================= */}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Aesthetic Customization & Surface Dynamics</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Glow Intensity */}
              <div className="space-y-1.5 p-3 rounded-lg bg-card/60 border border-border/50">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Glow Intensity
                </label>
                <p className="text-[11px] text-muted-foreground">Ambient neon lighting on cards and hover rings</p>
                <div className="flex items-center gap-1 pt-1.5">
                  {(['vibrant', 'subtle', 'minimal'] as GlowIntensity[]).map((level) => (
                    <Button
                      key={level}
                      variant={glowIntensity === level ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGlowIntensity(level)}
                      className={cn(
                        'h-7 text-xs flex-1 capitalize font-medium',
                        glowIntensity === level ? 'bg-primary text-primary-foreground' : 'border-border/70'
                      )}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Corner Radius */}
              <div className="space-y-1.5 p-3 rounded-lg bg-card/60 border border-border/50">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-primary" /> Corner Radius
                </label>
                <p className="text-[11px] text-muted-foreground">Geometry and curvature across all cards & buttons</p>
                <div className="flex items-center gap-1 pt-1.5">
                  {(['rounded', 'sharp', 'pill'] as RadiusStyle[]).map((rad) => (
                    <Button
                      key={rad}
                      variant={radiusStyle === rad ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRadiusStyle(rad)}
                      className={cn(
                        'h-7 text-xs flex-1 capitalize font-medium',
                        radiusStyle === rad ? 'bg-primary text-primary-foreground' : 'border-border/70'
                      )}
                    >
                      {rad === 'rounded' ? 'Curved' : rad === 'sharp' ? 'Sharp' : 'Pill'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Interface Density */}
              <div className="space-y-1.5 p-3 rounded-lg bg-card/60 border border-border/50">
                <label className="font-semibold text-foreground flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-primary" /> Layout Density
                </label>
                <p className="text-[11px] text-muted-foreground">Information density for multi-monitor pro setups</p>
                <div className="flex items-center gap-1 pt-1.5">
                  {(['comfortable', 'compact'] as DensityStyle[]).map((den) => (
                    <Button
                      key={den}
                      variant={densityStyle === den ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDensityStyle(den)}
                      className={cn(
                        'h-7 text-xs flex-1 capitalize font-medium',
                        densityStyle === den ? 'bg-primary text-primary-foreground' : 'border-border/70'
                      )}
                    >
                      {den}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Preferences are saved automatically in your local browser storage.
          </span>
          <Button onClick={onClose} className="bg-primary text-primary-foreground text-xs font-semibold px-5">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
