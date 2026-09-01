import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlerts } from '@/services/alertService';
import { useAgentActivities } from '@/services/agentActivityService';
import { useThoughtLogs, useTelegramBufferStatus } from '@/services/thoughtLogService';
import { useEarningsData } from '@/services/earningsService';
import { AgentActivityDrawer } from './AgentActivityDrawer';
import { ThemeSwitcherButton } from './ThemeSwitcherButton';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  id: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Wallet, label: 'Portfolio', id: 'portfolio' },
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

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);

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
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_15px_hsl(var(--sidebar-primary)/0.3)]" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium flex-1 text-left">{item.label}</span>}
                
                {/* Alerts Badge */}
                {!collapsed && item.id === 'alerts' && (triggeredCount > 0 || activeCount > 0) && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
                      triggeredCount > 0
                        ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse"
                        : "bg-primary/20 text-primary"
                    )}
                  >
                    {triggeredCount > 0 ? `${triggeredCount}!` : activeCount}
                  </span>
                )}

                {/* Earnings Badge (Reporting this week) */}
                {!collapsed && item.id === 'earnings' && earningsThisWeek > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    title={`${earningsThisWeek} companies reporting this week`}
                  >
                    {earningsThisWeek}
                  </span>
                )}

                {/* Log / Telegram Mobile Notes Badge */}
                {!collapsed && item.id === 'log' && telegramNotesCount > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.25)] flex items-center gap-1"
                    title={`${telegramNotesCount} mobile notes from Telegram`}
                  >
                    <Smartphone className="w-2.5 h-2.5 text-sky-400" />
                    <span>{telegramNotesCount}</span>
                  </span>
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
            );
          })}
        </nav>

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
    </>
  );
}

