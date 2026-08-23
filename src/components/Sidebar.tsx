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
  Link2,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  Wallet,
  Bot,
  Sparkles,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlerts } from '@/services/alertService';
import { useAgentActivities } from '@/services/agentActivityService';
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
  { icon: Briefcase, label: 'Management', id: 'management' },
  { icon: Globe, label: 'Macro', id: 'macro' },
  { icon: CandlestickChart, label: 'Graphs', id: 'graphs' },
  { icon: LineChart, label: 'Watchlist', id: 'watchlist' },
  { icon: Bell, label: 'Alerts', id: 'alerts' },
  { icon: History, label: 'Trades', id: 'trades' },
  { icon: Lightbulb, label: 'Ideas', id: 'ideas' },
  { icon: TrendingUp, label: 'Research', id: 'research' },
  { icon: Link2, label: 'Brokers', id: 'brokers' },
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
        <div className="px-2 pb-2">
          <ThemeSwitcherButton collapsed={collapsed} />
        </div>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-foreground">JD</span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">John Doe</p>
                <p className="text-xs text-muted-foreground truncate">Pro Account</p>
              </div>
            )}
          </div>
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

