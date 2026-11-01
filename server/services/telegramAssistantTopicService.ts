import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { extractSymbolsFromText } from './thoughtLogAgentService';

const logToFile = (msg: string) => console.log(msg);

export interface AssistantTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type AssistantTopicAction =
  | 'CREATE_REMINDER'
  | 'CREATE_TASK'
  | 'LIST'
  | 'TODAY'
  | 'COMPLETE'
  | 'DELETE'
  | 'CLEAR_DONE'
  | 'SNOOZE'
  | 'SUMMARY'
  | 'HELP';

export interface ParsedAssistantItem {
  action: AssistantTopicAction;
  taskTitle?: string;
  remindAt?: Date | null;
  rawTimeStr?: string;
  targetIdOrQuery?: string;
  snoozeDurationMs?: number;
}

/**
 * Natural language parser for assistant commands, tasks, and scheduling
 */
export function parseAssistantMessage(
  rawText: string,
  baseDate: Date = new Date()
): ParsedAssistantItem {
  const clean = rawText
    .replace(/#(?:topic:)?(?:assitant|assistant|tasks?|todos?|reminders?)\b/gi, '')
    .replace(/^(?:🤖|⏰|📌|✅|📋|📝)\s*/, '')
    .trim();

  // Strip leading slashes (e.g. /help -> help, /tasks -> tasks) for slash command compatibility
  const lower = clean.replace(/^\/+/, '').toLowerCase();

  // 1. HELP COMMAND
  if (/^(?:help|\?|commands?|usage|tools?|how\s+to\s+use)[\s?!.]*$/i.test(lower)) {
    return { action: 'HELP' };
  }

  // 2. SUMMARY / BRIEFING COMMAND
  if (/^(?:summary|briefing|status|overview|agenda\s+summary)$/i.test(lower)) {
    return { action: 'SUMMARY' };
  }

  // 3. TODAY'S AGENDA COMMAND
  if (/^(?:today|daily|agenda|schedule|what(?:'s|\s+is)\s+today)$/i.test(lower)) {
    return { action: 'TODAY' };
  }

  // 4. CLEAR COMPLETED COMMAND
  if (/^(?:clear\s+done|clear\s+finished|clean\s+done|clean|purge\s+done)$/i.test(lower)) {
    return { action: 'CLEAR_DONE' };
  }

  // 5. LIST COMMAND
  if (/^(?:list|tasks?|todos?|all|reminders?|show\s+tasks?|my\s+tasks?|open\s+tasks?|view\s+tasks?)$/i.test(lower)) {
    return { action: 'LIST' };
  }

  // 6. COMPLETE COMMAND (e.g. "done 1", "complete 1", "check 2", "done groceries", "done #1")
  const doneMatch = lower.match(/^(?:done|complete|check)\s+(?:#)?([a-z0-9_\-\s]+)$/i);
  if (doneMatch) {
    return {
      action: 'COMPLETE',
      targetIdOrQuery: doneMatch[1].trim(),
    };
  }

  // 7. DELETE COMMAND (e.g. "delete 1", "del 1", "remove 2", "cancel 1", "delete groceries")
  const delMatch = lower.match(/^(?:delete|del|remove|cancel)\s+(?:#)?([a-z0-9_\-\s]+)$/i);
  if (delMatch) {
    return {
      action: 'DELETE',
      targetIdOrQuery: delMatch[1].trim(),
    };
  }

  // 8. SNOOZE COMMAND (e.g. "snooze 1 30m", "snooze 1 1h", "snooze 1 tomorrow 9am", "postpone 1 2h")
  const snoozeMatch = lower.match(/^(?:snooze|postpone|delay)\s+(?:#)?([a-z0-9_\-]+)\s+([a-z0-9_\-\s:]+)$/i);
  if (snoozeMatch) {
    const target = snoozeMatch[1].trim();
    const durationStr = snoozeMatch[2].trim();
    const offsetMs = parseRelativeOffset(durationStr);
    return {
      action: 'SNOOZE',
      targetIdOrQuery: target,
      snoozeDurationMs: offsetMs > 0 ? offsetMs : 30 * 60 * 1000, // default 30 min
      rawTimeStr: durationStr,
    };
  }

  // 9. TASK / REMINDER CREATION
  // Parse date/time component if present
  const parsedDateTime = extractDateTimeFromTask(clean, baseDate);

  let cleanTask = clean;
  if (parsedDateTime?.matchedText) {
    cleanTask = clean.replace(parsedDateTime.matchedText, '').trim();
  }

  // Strip leading prefixes like "remind me to", "remind me", "reminder:", "todo:", "task:", "please", "to"
  cleanTask = cleanTask
    .replace(/^(?:remind\s+me(?:\s+to)?|reminder(?:\s*:)?|todo(?:\s*:)?|task(?:\s*:)?|schedule(?:\s*:)?|please(?:\s+remind\s+me(?:\s+to)?)?)\s*/i, '')
    .replace(/^(?:to\s+)/i, '')
    .replace(/\s+(?:on|at|by|in)\s*$/i, '')
    .trim();

  // Capitalize first letter
  if (cleanTask.length > 0) {
    cleanTask = cleanTask.charAt(0).toUpperCase() + cleanTask.slice(1);
  } else {
    cleanTask = clean;
  }

  if (parsedDateTime && parsedDateTime.date) {
    return {
      action: 'CREATE_REMINDER',
      taskTitle: cleanTask,
      remindAt: parsedDateTime.date,
      rawTimeStr: parsedDateTime.rawTimeStr,
    };
  }

  return {
    action: 'CREATE_TASK',
    taskTitle: cleanTask,
    remindAt: null,
  };
}

/**
 * Helper to parse a simple duration like "30m", "1h", "2 hours", "1 day" into milliseconds
 */
export function parseRelativeOffset(offsetStr: string): number {
  const match = offsetStr.match(/(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\b/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('s')) return num * 1000;
  if (unit.startsWith('m')) return num * 60 * 1000;
  if (unit.startsWith('h')) return num * 60 * 60 * 1000;
  if (unit.startsWith('d')) return num * 24 * 60 * 60 * 1000;
  if (unit.startsWith('w')) return num * 7 * 24 * 60 * 60 * 1000;
  return 0;
}

export interface ExtractedDateTime {
  date: Date;
  rawTimeStr: string;
  matchedText: string;
}

/**
 * Robust natural language date/time extractor supporting:
 * - "in 15m", "in 2 hours", "in 3 days"
 * - "tomorrow at 5pm", "tomorrow 10:30am", "tomorrow morning"
 * - "tonight at 8pm", "tonight"
 * - "Friday at 10am", "next Monday 9am"
 * - "Nov 15 at 3pm", "12/25 10am"
 * - "at 4:30pm", "at 16:00"
 */
export function extractDateTimeFromTask(
  text: string,
  baseDate: Date = new Date()
): ExtractedDateTime | null {
  const clean = text.trim();

  // 1. Relative offset: "in 10 mins", "in 2 hours", "in 1 day", "in an hour"
  const relRegex = /\b(?:in\s+)?(\d+|an?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\b/i;
  const relMatch = clean.match(relRegex);
  if (relMatch) {
    const rawVal = relMatch[1].toLowerCase();
    const num = rawVal === 'a' || rawVal === 'an' ? 1 : parseInt(rawVal, 10);
    const unit = relMatch[2].toLowerCase();

    let offsetMs = 0;
    if (unit.startsWith('s')) offsetMs = num * 1000;
    else if (unit.startsWith('m')) offsetMs = num * 60 * 1000;
    else if (unit.startsWith('h')) offsetMs = num * 60 * 60 * 1000;
    else if (unit.startsWith('d')) offsetMs = num * 24 * 60 * 60 * 1000;
    else if (unit.startsWith('w')) offsetMs = num * 7 * 24 * 60 * 60 * 1000;

    if (offsetMs > 0) {
      return {
        date: new Date(baseDate.getTime() + offsetMs),
        rawTimeStr: relMatch[0],
        matchedText: relMatch[0],
      };
    }
  }

  // 2. Tomorrow / Tonight / Today with time
  // e.g. "tomorrow at 5pm", "tomorrow 14:00", "tomorrow morning", "tonight at 8pm", "today at 4pm"
  const dayKeywordRegex = /\b(today|tomorrow|tmrw|tonight)\b(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?(?:\s+(morning|afternoon|evening|night))?/i;
  const dayMatch = clean.match(dayKeywordRegex);
  if (dayMatch) {
    const keyword = dayMatch[1].toLowerCase();
    const target = new Date(baseDate.getTime());

    if (keyword === 'tomorrow' || keyword === 'tmrw') {
      target.setDate(target.getDate() + 1);
    }

    let hour = 9; // default 9am
    let minute = 0;

    if (keyword === 'tonight') {
      hour = 20; // default 8pm
    }

    if (dayMatch[2]) {
      hour = parseInt(dayMatch[2], 10);
      minute = dayMatch[3] ? parseInt(dayMatch[3], 10) : 0;
      const meridiem = (dayMatch[4] || '').toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    } else if (dayMatch[5]) {
      const tod = dayMatch[5].toLowerCase();
      if (tod === 'morning') hour = 9;
      else if (tod === 'afternoon') hour = 14;
      else if (tod === 'evening' || tod === 'night') hour = 19;
    }

    target.setHours(hour, minute, 0, 0);

    // If today and time has already passed, advance to tomorrow
    if (keyword === 'today' && target.getTime() <= baseDate.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return {
      date: target,
      rawTimeStr: dayMatch[0],
      matchedText: dayMatch[0],
    };
  }

  // 3. Days of the week: e.g. "Friday at 10am", "next Monday 9am", "on Wednesday 15:30"
  const dayOfWeekRegex = /\b(?:on\s+)?(this\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i;
  const dowMatch = clean.match(dayOfWeekRegex);
  if (dowMatch) {
    const dowName = dowMatch[2].toLowerCase();
    const target = new Date(baseDate.getTime());
    const dayMap: Record<string, number> = {
      sun: 0, sunday: 0,
      mon: 1, monday: 1,
      tue: 2, tuesday: 2,
      wed: 3, wednesday: 3,
      thu: 4, thursday: 4,
      fri: 5, friday: 5,
      sat: 6, saturday: 6,
    };
    const targetDay = dayMap[dowName];
    if (targetDay !== undefined) {
      let daysToAdd = (targetDay - target.getDay() + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7; // schedule for next occurrence

      target.setDate(target.getDate() + daysToAdd);

      let hour = 9;
      let minute = 0;
      if (dowMatch[3]) {
        hour = parseInt(dowMatch[3], 10);
        minute = dowMatch[4] ? parseInt(dowMatch[4], 10) : 0;
        const meridiem = (dowMatch[5] || '').toLowerCase();
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
      }

      target.setHours(hour, minute, 0, 0);

      return {
        date: target,
        rawTimeStr: dowMatch[0],
        matchedText: dowMatch[0],
      };
    }
  }

  // 4. Explicit Month Date: e.g. "Nov 15 at 3pm", "December 20 10:00am", "on 11/20 at 4pm"
  const monthRegex = /\b(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i;
  const monthMatch = clean.match(monthRegex);
  if (monthMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIdx = monthNames.indexOf(monthMatch[1].toLowerCase());
    const day = parseInt(monthMatch[2], 10);

    const target = new Date(baseDate.getTime());
    target.setMonth(monthIdx);
    target.setDate(day);

    let hour = 9;
    let minute = 0;
    if (monthMatch[3]) {
      hour = parseInt(monthMatch[3], 10);
      minute = monthMatch[4] ? parseInt(monthMatch[4], 10) : 0;
      const meridiem = (monthMatch[5] || '').toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    }
    target.setHours(hour, minute, 0, 0);

    // If month/day already passed this year, roll over to next year
    if (target.getTime() < baseDate.getTime()) {
      target.setFullYear(target.getFullYear() + 1);
    }

    return {
      date: target,
      rawTimeStr: monthMatch[0],
      matchedText: monthMatch[0],
    };
  }

  // 5. Time only: "at 4pm", "at 16:30", "at 10:00am"
  const timeOnlyRegex = /\b(?:at\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const timeMatch = clean.match(timeOnlyRegex);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = (timeMatch[3] || '').toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    const target = new Date(baseDate.getTime());
    target.setHours(hour, minute, 0, 0);

    // If time already passed today, schedule for tomorrow
    if (target.getTime() <= baseDate.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return {
      date: target,
      rawTimeStr: timeMatch[0],
      matchedText: timeMatch[0],
    };
  }

  return null;
}

/**
 * Format timestamp into friendly date/time string with countdown
 */
export function formatFriendlyDateTime(targetDate: Date, now: Date = new Date()): string {
  const diffMs = targetDate.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  const mins = Math.floor((absDiff / (1000 * 60)) % 60);
  const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  let countdownStr = '';
  if (days > 0) {
    countdownStr = `${days}d ${hours}h`;
  } else if (hours > 0) {
    countdownStr = `${hours}h ${mins}m`;
  } else {
    countdownStr = `${mins}m`;
  }

  const timeStr = targetDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const isToday = targetDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const isTomorrow = targetDate.toDateString() === tomorrow.toDateString();

  let datePrefix = '';
  if (isToday) datePrefix = 'Today';
  else if (isTomorrow) datePrefix = 'Tomorrow';
  else {
    datePrefix = targetDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  const relativeLabel = isPast ? `overdue by ${countdownStr}` : `in ${countdownStr}`;
  return `${datePrefix} at ${timeStr} _(${relativeLabel})_`;
}

/**
 * Core handler for Assistant topic messages
 */
export async function handleAssistantTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: AssistantTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: AssistantTopicAction;
  taskTitle?: string;
  symbol?: string;
}> {
  const parsed = parseAssistantMessage(text, new Date(timestamp));
  const now = new Date(timestamp);

  // 1. HELP ACTION
  if (parsed.action === 'HELP') {
    const replyText = `🤖 *Personal Assistant & Reminders — Tools & Commands*

Your personal executive assistant for managing to-dos, tasks, and scheduling timely reminders via Telegram (Text & Voice Notes!):

📌 *1. Creating Tasks & Reminders*
Send what you need to do naturally, with or without a date/time:
• \`Buy groceries tomorrow at 5pm\`
• \`Call accountant on Friday at 10am\`
• \`Remind me to check crypto in 2 hours\`
• \`Review NVDA earnings tonight at 8pm\`
• \`Prepare quarterly tax forms by Nov 15\`
• \`Clean the office desk\` _(creates an open to-do item)_
• \`todo review contract terms\`
• 🎙️ *Voice Notes:* Speak your reminder into Telegram and it transcribes and schedules automatically!

📋 *2. Listing & Inspecting Tasks*
• \`tasks\` or \`list\` or \`todos\` — View your numbered checklist with due dates and countdowns.
• \`today\` or \`agenda\` — Everything due or scheduled for today.
• \`summary\` or \`briefing\` — High-level status overview of pending & completed items.

✅ *3. Completing Tasks*
• \`done 1\` or \`complete 1\` — Marks item #1 as finished!
• \`done groceries\` — Marks matching task by name.
• \`clear done\` — Sweeps and cleans all finished tasks.

🗑️ *4. Managing & Snoozing*
• \`del 1\` or \`delete 1\` (or \`remove 1\`) — Deletes the task.
• \`snooze 1 30m\` or \`snooze 1 1h\` — Postpones a reminder.
• \`snooze 1 tomorrow 9am\` — Reschedules to tomorrow morning.

⏰ *5. Automatic Alarm & Notification*
When a reminder's time arrives, your Assistant will immediately send an alarm message right here in this topic!`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[AssistantTopic] Help send error: ${e.message}`));
    }

    return { handled: true, replyText, actionTaken: 'HELP' };
  }

  // 2. LIST ACTION
  if (parsed.action === 'LIST') {
    const reminders = await (prisma as any).executionReminder.findMany({
      where: {
        symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
        status: { in: ['PENDING', 'TRIGGERED'] },
      },
      orderBy: { remindAt: 'asc' },
      take: 50,
    });

    if (reminders.length === 0) {
      const replyText = `🤖 *Personal Assistant — Task Checklist* 📋\n\n✨ *No pending tasks or reminders!*\n\n_Your checklist is completely clear. Send any task (e.g. \`Buy milk tomorrow 5pm\` or \`todo review deck\`) to add it._`;
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
      }
      return { handled: true, replyText, actionTaken: 'LIST' };
    }

    const timedItems: any[] = [];
    const todoItems: any[] = [];

    reminders.forEach((r: any) => {
      let isTodo = false;
      try {
        if (r.notes) {
          const parsedNotes = JSON.parse(r.notes);
          if (parsedNotes.isReminder === false) isTodo = true;
        }
      } catch {}

      if (isTodo) {
        todoItems.push(r);
      } else {
        timedItems.push(r);
      }
    });

    let lines: string[] = [`🤖 *PERSONAL ASSISTANT — TASKS & REMINDERS* 📋\n`];
    let counter = 1;

    if (timedItems.length > 0) {
      lines.push(`⏰ *Scheduled Reminders (${timedItems.length}):*`);
      timedItems.forEach((item) => {
        const timeFormatted = formatFriendlyDateTime(new Date(item.remindAt), now);
        lines.push(`${counter}️⃣ ⏰ **${item.task}**`);
        lines.push(`   🗓️ ${timeFormatted}`);
        lines.push(`   🆔 \`${item.id.slice(0, 8)}\`\n`);
        counter++;
      });
    }

    if (todoItems.length > 0) {
      lines.push(`📌 *Open To-Do Items (${todoItems.length}):*`);
      todoItems.forEach((item) => {
        lines.push(`${counter}️⃣ 📌 **${item.task}**`);
        lines.push(`   🆔 \`${item.id.slice(0, 8)}\`\n`);
        counter++;
      });
    }

    lines.push(`────────────────────────`);
    lines.push(`💡 *Quick Assistant Tools:*`);
    lines.push(`• Reply \`done 1\` or \`done <name>\` to complete`);
    lines.push(`• Reply \`del 1\` to delete`);
    lines.push(`• Reply \`snooze 1 30m\` to postpone`);
    lines.push(`• Reply \`today\` for today's agenda`);

    const replyText = lines.join('\n');
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'LIST' };
  }

  // 3. TODAY'S AGENDA ACTION
  if (parsed.action === 'TODAY') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayReminders = await (prisma as any).executionReminder.findMany({
      where: {
        symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
        status: { in: ['PENDING', 'TRIGGERED'] },
        remindAt: { lte: endOfToday },
      },
      orderBy: { remindAt: 'asc' },
    });

    if (todayReminders.length === 0) {
      const replyText = `📅 *Today's Agenda (${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })})*

🎉 *No tasks or reminders due today!*

_You're all caught up. Send \`tasks\` to check future items._`;
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
      }
      return { handled: true, replyText, actionTaken: 'TODAY' };
    }

    let lines: string[] = [
      `📅 *TODAY'S ASSISTANT AGENDA* 🗓️`,
      `_${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}_\n`,
    ];

    todayReminders.forEach((item: any, idx: number) => {
      const isPast = new Date(item.remindAt).getTime() < now.getTime();
      const statusIcon = isPast ? '🚨' : '⏰';
      const timeStr = new Date(item.remindAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      lines.push(`${idx + 1}️⃣ ${statusIcon} **${item.task}**`);
      lines.push(`   🕐 Time: ${timeStr} ${isPast ? '*(Overdue)*' : ''}`);
      lines.push(`   🆔 \`${item.id.slice(0, 8)}\`\n`);
    });

    lines.push(`💡 _Reply \`done 1\` to mark an item complete!_`);

    const replyText = lines.join('\n');
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'TODAY' };
  }

  // 4. COMPLETE / DONE ACTION
  if (parsed.action === 'COMPLETE') {
    const query = parsed.targetIdOrQuery || '';
    const reminders = await (prisma as any).executionReminder.findMany({
      where: {
        symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
        status: { in: ['PENDING', 'TRIGGERED'] },
      },
      orderBy: { remindAt: 'asc' },
    });

    let targetItem: any = null;

    // Check if query is a number corresponding to list index
    const num = parseInt(query, 10);
    if (!isNaN(num) && num >= 1 && num <= reminders.length) {
      targetItem = reminders[num - 1];
    } else {
      // Find by ID prefix or substring match
      targetItem = reminders.find(
        (r: any) =>
          r.id.toLowerCase().startsWith(query.toLowerCase()) ||
          r.task.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (!targetItem) {
      const replyText = `⚠️ *Task Not Found*\n\nCould not find an active task matching \`"${query}"\`.\nSend \`tasks\` to view your active checklist.`;
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
      }
      return { handled: true, replyText, actionTaken: 'COMPLETE' };
    }

    // Mark as DONE
    await (prisma as any).executionReminder.update({
      where: { id: targetItem.id },
      data: {
        status: 'DONE',
        triggeredAt: new Date(timestamp),
      },
    });

    const replyText = `✅ *Task Completed!* 🎉\n\n📌 **${targetItem.task}**\n\n_Marked as completed. Keep up the great momentum!_`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'COMPLETE', taskTitle: targetItem.task };
  }

  // 5. DELETE ACTION
  if (parsed.action === 'DELETE') {
    const query = parsed.targetIdOrQuery || '';
    const reminders = await (prisma as any).executionReminder.findMany({
      where: {
        symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
        status: { in: ['PENDING', 'TRIGGERED', 'DONE'] },
      },
      orderBy: { remindAt: 'asc' },
    });

    let targetItem: any = null;

    const num = parseInt(query, 10);
    if (!isNaN(num) && num >= 1 && num <= reminders.length) {
      targetItem = reminders[num - 1];
    } else {
      targetItem = reminders.find(
        (r: any) =>
          r.id.toLowerCase().startsWith(query.toLowerCase()) ||
          r.task.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (!targetItem) {
      const replyText = `⚠️ *Task Not Found*\n\nCould not find a task matching \`"${query}"\`.\nSend \`tasks\` to view your checklist.`;
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
      }
      return { handled: true, replyText, actionTaken: 'DELETE' };
    }

    await (prisma as any).executionReminder.update({
      where: { id: targetItem.id },
      data: { status: 'CANCELLED' },
    });

    const replyText = `🗑️ *Task Removed*\n\n📌 **${targetItem.task}** has been deleted from your task list.`;
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'DELETE', taskTitle: targetItem.task };
  }

  // 6. CLEAR DONE ACTION
  if (parsed.action === 'CLEAR_DONE') {
    const result = await (prisma as any).executionReminder.updateMany({
      where: {
        symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
        status: { in: ['DONE', 'CANCELLED'] },
      },
      data: { status: 'ARCHIVED' },
    });

    const count = result.count || 0;
    const replyText = `🧹 *Checklist Cleaned Up!*\n\nArchived **${count}** completed task(s).\nSend \`tasks\` to view your active items.`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'CLEAR_DONE' };
  }

  // 7. SNOOZE ACTION
  if (parsed.action === 'SNOOZE') {
    const query = parsed.targetIdOrQuery || '';
    const reminders = await (prisma as any).executionReminder.findMany({
      where: {
        symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
        status: { in: ['PENDING', 'TRIGGERED'] },
      },
      orderBy: { remindAt: 'asc' },
    });

    let targetItem: any = null;
    const num = parseInt(query, 10);
    if (!isNaN(num) && num >= 1 && num <= reminders.length) {
      targetItem = reminders[num - 1];
    } else {
      targetItem = reminders.find(
        (r: any) =>
          r.id.toLowerCase().startsWith(query.toLowerCase()) ||
          r.task.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (!targetItem) {
      const replyText = `⚠️ *Task Not Found*\n\nCould not find a task matching \`"${query}"\`.\nSend \`tasks\` to check your active items.`;
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
      }
      return { handled: true, replyText, actionTaken: 'SNOOZE' };
    }

    const duration = parsed.snoozeDurationMs || 30 * 60 * 1000;
    const newRemindAt = new Date(now.getTime() + duration);

    await (prisma as any).executionReminder.update({
      where: { id: targetItem.id },
      data: {
        remindAt: newRemindAt,
        status: 'PENDING',
      },
    });

    const formattedTime = formatFriendlyDateTime(newRemindAt, now);
    const replyText = `⏱️ *Reminder Postponed*\n\n📌 **${targetItem.task}**\n⏰ New scheduled time: ${formattedTime}\n\n_Your assistant will notify you then!_`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'SNOOZE', taskTitle: targetItem.task };
  }

  // 8. SUMMARY ACTION
  if (parsed.action === 'SUMMARY') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [allPending, dueToday, completed] = await Promise.all([
      (prisma as any).executionReminder.count({
        where: {
          symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
          status: { in: ['PENDING', 'TRIGGERED'] },
        },
      }),
      (prisma as any).executionReminder.count({
        where: {
          symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
          status: { in: ['PENDING', 'TRIGGERED'] },
          remindAt: { lte: endOfToday },
        },
      }),
      (prisma as any).executionReminder.count({
        where: {
          symbol: { in: ['ASSISTANT', 'TASK', 'TODO', 'REMINDER'] },
          status: 'DONE',
          triggeredAt: { gte: startOfToday },
        },
      }),
    ]);

    const replyText = `📊 *EXECUTIVE ASSISTANT BRIEFING* 🤖

🗓️ *Date:* ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
👤 *User:* ${senderLabel}

📋 *Task Status:*
• 📌 *Total Open Tasks:* **${allPending}**
• ⏰ *Due Today / Overdue:* **${dueToday}**
• ✅ *Completed Today:* **${completed}**

💡 _Send \`today\` to inspect today's agenda or \`tasks\` for the complete list._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      sendTelegramMessage({ text: replyText, chatId, messageThreadId, parseMode: 'Markdown' }).catch(() => {});
    }
    return { handled: true, replyText, actionTaken: 'SUMMARY' };
  }

  // 9. CREATE REMINDER / CREATE TASK
  const isReminder = Boolean(parsed.remindAt);
  const taskTitle = parsed.taskTitle || text;
  const detectedSymbols = extractSymbolsFromText(text);
  const primarySymbol = detectedSymbols[0] || 'ASSISTANT';

  const created = await (prisma as any).executionReminder.create({
    data: {
      symbol: primarySymbol,
      task: taskTitle,
      remindAt: parsed.remindAt || new Date(now.getTime() + 365 * 24 * 3600 * 1000), // 1 year for pure to-dos
      status: 'PENDING',
      chatId: String(chatId),
      messageThreadId: messageThreadId ? Number(messageThreadId) : undefined,
      senderLabel,
      sourceMessage: text,
      notes: JSON.stringify({
        isReminder,
        rawTimeStr: parsed.rawTimeStr || '',
        category: 'ASSISTANT',
      }),
      createdAt: now,
    },
  });

  let replyText = '';
  if (isReminder && parsed.remindAt) {
    const formattedTime = formatFriendlyDateTime(parsed.remindAt, now);
    replyText = `⏰ *Assistant Reminder Armed!* 🔔

📌 *Task:* **${taskTitle}**
🗓️ *Scheduled for:* ${formattedTime}
🆔 *Task ID:* \`${created.id.slice(0, 8)}\`

_Your assistant will automatically alert you right here when it's time!_
💡 _Send \`tasks\` to view all items or \`done ${created.id.slice(0, 8)}\` when finished._`;
  } else {
    replyText = `📌 *To-Do Added to Assistant Checklist* 📋

• **${taskTitle}**
🆔 *Task ID:* \`${created.id.slice(0, 8)}\`

_Added to your open to-do list._
💡 _Send \`tasks\` to view your checklist or \`done ${created.id.slice(0, 8)}\` when finished._`;
  }

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[AssistantTopic] Reply error: ${e.message}`));
  }

  return {
    handled: true,
    replyText,
    actionTaken: isReminder ? 'CREATE_REMINDER' : 'CREATE_TASK',
    taskTitle,
    symbol: primarySymbol !== 'ASSISTANT' ? primarySymbol : undefined,
  };
}

