export type AgentType =
  | 'PORTFOLIO_AUDIT'
  | 'PORTFOLIO_VALUATION'
  | 'DIP_ANALYZER'
  | 'POSITION_DEFENSE'
  | 'MACRO_DOSSIER'
  | 'RESEARCH_AGENT'
  | 'STOCK_ANALYSIS'
  | 'TRADE_IDEA_GENERATOR'
  | 'MARKET_DATA_SYNC';

export interface AgentActivityEvent {
  id: string;
  agentName: string;
  agentType: AgentType;
  taskDescription: string;
  targetSymbol?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  outcomeSummary?: string;
  metadata?: Record<string, any>;
  error?: string;
}

class AgentActivityTracker {
  private activities: AgentActivityEvent[] = [];
  private maxActivities = 100;

  /**
   * Log the start of an agent task execution
   */
  startTask(params: {
    agentName: string;
    agentType: AgentType;
    taskDescription: string;
    targetSymbol?: string;
    metadata?: Record<string, any>;
  }): AgentActivityEvent {
    const id = `agent-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const activity: AgentActivityEvent = {
      id,
      agentName: params.agentName,
      agentType: params.agentType,
      taskDescription: params.taskDescription,
      targetSymbol: params.targetSymbol,
      status: 'RUNNING',
      startedAt: now.toISOString(),
      metadata: params.metadata
    };

    // Add to in-memory history
    this.activities.unshift(activity);
    if (this.activities.length > this.maxActivities) {
      this.activities.pop();
    }

    // Print formatted banner to terminal
    const timeStr = now.toLocaleTimeString();
    const divider = '─'.repeat(70);
    console.log(`\n\x1b[35m┌${divider}┐\x1b[0m`);
    console.log(`\x1b[35m│ 🤖 [AI AGENT TASK STARTED] \x1b[0m\x1b[36m${params.agentName}\x1b[0m`);
    console.log(`\x1b[35m│\x1b[0m • \x1b[1mTask:\x1b[0m ${params.taskDescription}`);
    if (params.targetSymbol) {
      console.log(`\x1b[35m│\x1b[0m • \x1b[1mTarget:\x1b[0m \x1b[33m${params.targetSymbol}\x1b[0m`);
    }
    console.log(`\x1b[35m│\x1b[0m • \x1b[1mTime:\x1b[0m ${timeStr} | \x1b[2mID: ${id}\x1b[0m`);
    console.log(`\x1b[35m└${divider}┘\x1b[0m\n`);

    return activity;
  }

  /**
   * Log the completion of an agent task execution
   */
  completeTask(
    taskId: string,
    params: {
      status: 'SUCCESS' | 'FAILED';
      outcomeSummary?: string;
      error?: string;
      metadata?: Record<string, any>;
    }
  ): AgentActivityEvent | undefined {
    const activity = this.activities.find(a => a.id === taskId);
    const now = new Date();
    const completedAt = now.toISOString();

    if (activity) {
      const startTime = new Date(activity.startedAt).getTime();
      const durationMs = now.getTime() - startTime;

      activity.status = params.status;
      activity.completedAt = completedAt;
      activity.durationMs = durationMs;
      activity.outcomeSummary = params.outcomeSummary;
      activity.error = params.error;
      if (params.metadata) {
        activity.metadata = { ...activity.metadata, ...params.metadata };
      }

      const durationSec = (durationMs / 1000).toFixed(2);
      const divider = '─'.repeat(70);
      const isSuccess = params.status === 'SUCCESS';

      if (isSuccess) {
        console.log(`\n\x1b[32m┌${divider}┐\x1b[0m`);
        console.log(`\x1b[32m│ ✅ [AI AGENT TASK COMPLETED] \x1b[0m\x1b[36m${activity.agentName}\x1b[0m`);
        console.log(`\x1b[32m│\x1b[0m • \x1b[1mTask:\x1b[0m ${activity.taskDescription}`);
        if (activity.targetSymbol) {
          console.log(`\x1b[32m│\x1b[0m • \x1b[1mTarget:\x1b[0m \x1b[33m${activity.targetSymbol}\x1b[0m`);
        }
        console.log(`\x1b[32m│\x1b[0m • \x1b[1mExecution Duration:\x1b[0m \x1b[32m${durationSec}s\x1b[0m`);
        if (params.outcomeSummary) {
          console.log(`\x1b[32m│\x1b[0m • \x1b[1mOutcome:\x1b[0m ${params.outcomeSummary}`);
        }
        console.log(`\x1b[32m└${divider}┘\x1b[0m\n`);
      } else {
        console.log(`\n\x1b[31m┌${divider}┐\x1b[0m`);
        console.log(`\x1b[31m│ ❌ [AI AGENT TASK FAILED] \x1b[0m\x1b[36m${activity.agentName}\x1b[0m`);
        console.log(`\x1b[31m│\x1b[0m • \x1b[1mTask:\x1b[0m ${activity.taskDescription}`);
        console.log(`\x1b[31m│\x1b[0m • \x1b[1mDuration:\x1b[0m ${durationSec}s`);
        console.log(`\x1b[31m│\x1b[0m • \x1b[1mError:\x1b[0m \x1b[31m${params.error || 'Unknown error'}\x1b[0m`);
        console.log(`\x1b[31m└${divider}┘\x1b[0m\n`);
      }

      return activity;
    }

    return undefined;
  }

  /**
   * Get list of recent agent activity events
   */
  getActivities(limit = 50): AgentActivityEvent[] {
    return this.activities.slice(0, limit);
  }

  /**
   * Clear activities history
   */
  clear(): void {
    this.activities = [];
  }
}

export const agentActivityTracker = new AgentActivityTracker();
