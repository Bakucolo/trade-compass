import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  LineChart, 
  CandlestickChart,
  Globe,
  ListTodo, 
  Lightbulb, 
  History, 
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  Wallet,
  Bot,
  Sparkles,
  Briefcase,
  ShieldCheck,
  NotebookPen,
  Radar,
  Smartphone,
  Calendar,
  Send,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAlerts } from '@/services/alertService';
import { useAgentActivities } from '@/services/agentActivityService';
import { useThoughtLogs, useTelegramBufferStatus } from '@/services/thoughtLogService';
import { useEarningsData } from '@/services/earningsService';
import { AgentActivityDrawer } from './AgentActivityDrawer';
import { ThemeSwitcherButton } from './ThemeSwitcherButton';
import { TelegramTopicsModal } from './TelegramTopicsModal';
import { UserMenu } from './auth/UserMenu';

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  id: string;
  badge?: number;
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Wallet, label: 'Portfolio', id: 'portfolio' },
  { icon: Bot, label: 'AI Trading', id: 'ai-trading' },
  { icon: ShieldCheck, label: 'Scorecards', id: 'scorecards' },
  { icon: Briefcase, label: 'Management', id: 'management' },
  { icon: Globe, label: 'Macro', id: 'macro' },
  { icon: CandlestickChart, label: 'Graphs', id: 'graphs' },
  { icon: Calendar, label: 'Earnings', id: 'earnings' },
  { icon: Radar, label: 'Scanner', id: 'scanner' },
  { icon: LineChart, label: 'Watchlist', id: 'watchlist' },
  { icon: NotebookPen, label: 'Log', id: 'log' },
  { icon: Bell, label: 'Alerts', id: 'alerts' },
  { icon: History, label: 'Trades', id: 'trades' },
  { icon: Lightbulb, label: 'Ideas', id: 'ideas' },
  { icon: TrendingUp, label: 'Research', id: 'research' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export const SIDEBAR_ORDER_STORAGE_KEY = 'tradeflow_sidebar_order';

export function reorderNavItems(
  currentItems: NavItem[],
  fromIndex: number,
  toIndex: number,
  position: 'above' | 'below'
): NavItem[] {
  if (fromIndex === toIndex) return currentItems;
  if (fromIndex < 0 || fromIndex >= currentItems.length) return currentItems;
  if (toIndex < 0 || toIndex >= currentItems.length) return currentItems;

  const result = [...currentItems];
  const [removed] = result.splice(fromIndex, 1);

  let insertIndex = toIndex;
  if (fromIndex < toIndex) {
    insertIndex = position === 'above' ? toIndex - 1 : toIndex;
  } else {
    insertIndex = position === 'above' ? toIndex : toIndex + 1;
  }

  insertIndex = Math.max(0, Math.min(insertIndex, result.length));
  result.splice(insertIndex, 0, removed);
  return result;
}

export function getInitialNavItems(): NavItem[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY) : null;
    if (!raw) return DEFAULT_NAV_ITEMS;
    const storedIds: unknown = JSON.parse(raw);
    if (!Array.isArray(storedIds)) return DEFAULT_NAV_ITEMS;

    const itemMap = new Map<string, NavItem>(DEFAULT_NAV_ITEMS.map((item) => [item.id, item]));
    const ordered: NavItem[] = [];

    storedIds.forEach((id) => {
      if (typeof id === 'string' && itemMap.has(id)) {
        ordered.push(itemMap.get(id)!);
        itemMap.delete(id);
      }
    });

    // Append any items from DEFAULT_NAV_ITEMS that were not in storedIds
    itemMap.forEach((item) => {
      ordered.push(item);
    });

    return ordered.length > 0 ? ordered : DEFAULT_NAV_ITEMS;
  } catch {
    return DEFAULT_NAV_ITEMS;
  }
}

export function saveNavOrder(items: NavItem[]): void {
  try {
    if (typeof window !== 'undefined') {
      const ids = items.map((i) => i.id);
      localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(ids));
    }
  } catch (err) {
    console.error('Failed to save sidebar order:', err);
  }
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCopilot?: () => void;
}

export function Sidebar({ activeTab, onTabChange, onOpenCopilot }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [items, setItems] = useState<NavItem[]>(getInitialNavItems);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const lastDragEndTime = useRef(0);

  const isCustomOrder = items.some((item, idx) => item.id !== DEFAULT_NAV_ITEMS[idx]?.id);

  const handleResetOrder = () => {
    setItems(DEFAULT_NAV_ITEMS);
    try {
      localStorage.removeItem(SIDEBAR_ORDER_STORAGE_KEY);
    } catch {}
    toast.success('Sidebar menu order reset to default');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', items[index].id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null) return;
    if (draggedIndex === index) {
      if (dropTarget !== null) setDropTarget(null);
      return;
    }

    const targetElement = e.currentTarget as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position: 'above' | 'below' = offsetY < rect.height / 2 ? 'above' : 'below';

    if (dropTarget?.index !== index || dropTarget?.position !== position) {
      setDropTarget({ index, position });
    }
  };

  const handleDragLeave = (e: React.DragEvent, index: number) => {
    const targetElement = e.currentTarget as HTMLElement;
    if (!targetElement.contains(e.relatedTarget as Node)) {
      if (dropTarget?.index === index) {
        setDropTarget(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const targetElement = e.currentTarget as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position: 'above' | 'below' = offsetY < rect.height / 2 ? 'above' : 'below';

    if (draggedIndex !== index) {
      const updated = reorderNavItems(items, draggedIndex, index, position);
      setItems(updated);
      saveNavOrder(updated);
      const movedLabel = items[draggedIndex].label;
      toast.info(`Moved "${movedLabel}" in sidebar`, { duration: 1500 });
    }

    setDraggedIndex(null);
    setDropTarget(null);
    lastDragEndTime.current = Date.now();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
    lastDragEndTime.current = Date.now();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const direction = e.key === 'ArrowUp' ? -1 : 1;
      const targetIdx = index + direction;
      if (targetIdx >= 0 && targetIdx < items.length) {
        const updated = [...items];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIdx, 0, moved);
        setItems(updated);
        saveNavOrder(updated);
        toast.info(`Moved "${items[index].label}" ${direction < 0 ? 'up' : 'down'}`, { duration: 1500 });
      }
    }
  };

  useEffect(() => {
    const handleOpenTelegram = () => setIsTelegramModalOpen(true);
    window.addEventListener('open-telegram-topics', handleOpenTelegram);
    return () => window.removeEventListener('open-telegram-topics', handleOpenTelegram);
  }, []);

  const { data: alerts = [] } = useAlerts();
  const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;
  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  const { data: agentActivities = [] } = useAgentActivities(10);
  const hasRunningAgent = agentActivities.some((a) => a.status === 'RUNNING');

  const { data: thoughtLogs = [] } = useThoughtLogs();
  const { data: telegramStatus } = useTelegramBufferStatus();
  const telegramNotesCount = thoughtLogs.filter(
    (l) => l.tags?.toLowerCase().includes('telegram') || l.title.includes('📱')
  ).length;

  const { data: earningsData } = useEarningsData();
  const earningsThisWeek = earningsData?.summary?.reportingThisWeek || 0;

  return (
    <>
      <aside 
        className={cn(
          "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">TradeFlow</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!collapsed && isCustomOrder && (
              <button
                onClick={handleResetOrder}
                className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                title="Reset sidebar menu order to default"
                aria-label="Reset sidebar menu order"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-none hover:scrollbar-thin">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDragging = draggedIndex === index;
            const isTargetAbove = dropTarget?.index === index && dropTarget.position === 'above';
            const isTargetBelow = dropTarget?.index === index && dropTarget.position === 'below';
            
            return (
              <div
                key={item.id}
                className="relative group/navitem"
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={(e) => handleDragLeave(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Drop indicator above */}
                {isTargetAbove && (
                  <div
                    data-testid={`drop-indicator-above-${item.id}`}
                    className="absolute -top-1 left-1.5 right-1.5 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.9)] z-30 pointer-events-none animate-pulse"
                  />
                )}

                {/* Drop indicator below */}
                {isTargetBelow && (
                  <div
                    data-testid={`drop-indicator-below-${item.id}`}
                    className="absolute -bottom-1 left-1.5 right-1.5 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.9)] z-30 pointer-events-none animate-pulse"
                  />
                )}

                <button
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (Date.now() - lastDragEndTime.current < 250) return;
                    onTabChange(item.id);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  title={collapsed ? `${item.label} (Drag to reorder)` : undefined}
                  aria-label={item.label}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative cursor-grab active:cursor-grabbing select-none group",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_15px_hsl(var(--sidebar-primary)/0.3)]" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                    isDragging && "opacity-30 scale-[0.97] border border-dashed border-cyan-400/60 bg-sidebar-accent/50 shadow-inner"
                  )}
                >
                  <Icon className={cn("w-5 h-5 flex-shrink-0", collapsed && "mx-auto")} />
                  {!collapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left truncate">{item.label}</span>
                      
                      {/* Alerts Badge */}
                      {item.id === 'alerts' && (triggeredCount > 0 || activeCount > 0) && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0",
                            triggeredCount > 0
                              ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse"
                              : "bg-primary/20 text-primary"
                          )}
                        >
                          {triggeredCount > 0 ? `${triggeredCount}!` : activeCount}
                        </span>
                      )}

                      {/* Earnings Badge (Reporting this week) */}
                      {item.id === 'earnings' && earningsThisWeek > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs shrink-0"
                          title={`${earningsThisWeek} companies reporting this week`}
                        >
                          {earningsThisWeek}
                        </span>
                      )}

                      {/* Log / Telegram Mobile Notes Badge */}
                      {item.id === 'log' && telegramNotesCount > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.25)] flex items-center gap-1 shrink-0"
                          title={`${telegramNotesCount} mobile notes from Telegram`}
                        >
                          <Smartphone className="w-2.5 h-2.5 text-sky-400" />
                          <span>{telegramNotesCount}</span>
                        </span>
                      )}

                      {/* Drag handle icon */}
                      <span
                        className="opacity-0 group-hover/navitem:opacity-40 hover:opacity-100 transition-opacity text-sidebar-foreground/70 ml-0.5 shrink-0"
                        title="Drag to reorder (or press Alt+Up/Down)"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                    </>
                  )}

                  {/* Collapsed notification indicator pips */}
                  {collapsed && item.id === 'alerts' && triggeredCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                  )}
                  {collapsed && item.id === 'earnings' && earningsThisWeek > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                  )}
                  {collapsed && item.id === 'log' && telegramNotesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* AI Copilot Quick Launcher Button */}
        <div className="px-2 pb-1.5">
          <button
            onClick={() => {
              if (onOpenCopilot) {
                onOpenCopilot();
              } else {
                window.dispatchEvent(new CustomEvent('open-hybrid-copilot'));
              }
            }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer group",
              "bg-gradient-to-r from-indigo-950/60 via-purple-950/50 to-pink-950/30 border-indigo-500/40 text-indigo-200 hover:border-indigo-400 hover:text-white shadow-[0_0_12px_rgba(99,102,241,0.2)] hover:shadow-[0_0_18px_rgba(99,102,241,0.35)]"
            )}
            title="Open TradeFlow Hybrid AI Copilot"
          >
            <div className="relative shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            {!collapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate font-bold tracking-wide">AI Copilot</span>
                <span className="text-[9px] bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 px-1.5 py-0.5 rounded-md font-mono font-semibold">
                  HYBRID
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Agent Activity Telemetry Pill */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setIsActivityDrawerOpen(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border",
              hasRunningAgent
                ? "bg-purple-950/40 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)] animate-pulse"
                : "bg-card/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/80"
            )}
            title="AI Agent Execution Telemetry"
          >
            <div className="relative shrink-0">
              <Bot className={cn("w-4 h-4", hasRunningAgent ? "text-purple-400" : "text-primary")} />
              {hasRunningAgent && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              )}
            </div>
            {!collapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Agent Activity</span>
                {hasRunningAgent ? (
                  <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-mono font-bold">
                    LIVE
                  </span>
                ) : agentActivities.length > 0 ? (
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.2 rounded-md">
                    {agentActivities.length}
                  </span>
                ) : null}
              </div>
            )}
          </button>
        </div>

        {/* Telegram Topics Operations Hub Launcher */}
        <div className="px-2 pb-1.5">
          <button
            onClick={() => setIsTelegramModalOpen(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border",
              "bg-gradient-to-r from-sky-950/40 to-blue-950/40 border-sky-500/30 text-sky-300 hover:border-sky-500/60 hover:text-white shadow-[0_0_10px_rgba(14,165,233,0.12)]"
            )}
            title="Open Telegram Topics Operations Hub"
          >
            <div className="relative shrink-0">
              <Send className="w-4 h-4 text-sky-400" />
            </div>
            {!collapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Telegram Topics</span>
                <span className="text-[9px] bg-sky-500/20 text-sky-200 border border-sky-500/30 px-1.5 py-0.2 rounded-md font-mono">
                  8 TOPICS
                </span>
              </div>
            )}
          </button>
        </div>

        {/* User Identity & Logout Menu */}
        <div className="px-2 pb-1.5">
          <UserMenu collapsed={collapsed} />
        </div>

        {/* Stylings & Theme Switcher Button */}
        <div className="px-2 pb-4">
          <ThemeSwitcherButton collapsed={collapsed} />
        </div>
      </aside>

      {/* Agent Activity Drawer Dialog */}
      {isActivityDrawerOpen && (
        <AgentActivityDrawer
          isOpen={isActivityDrawerOpen}
          onClose={() => setIsActivityDrawerOpen(false)}
        />
      )}

      {/* Telegram Topics Operations Hub Dialog */}
      {isTelegramModalOpen && (
        <TelegramTopicsModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
        />
      )}
    </>
  );
}

