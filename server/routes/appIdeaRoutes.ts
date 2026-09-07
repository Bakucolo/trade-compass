import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export function generateAntigravityTaskSpec(idea: {
  id: string;
  title: string;
  description?: string | null;
  topic: string;
  category: string;
  isFulfilled: boolean;
  createdAt: Date | string;
  telegramMsgId?: number | null;
}) {
  const dateStr = new Date(idea.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const rawReq = idea.description?.trim() ? `${idea.title}\n\n${idea.description.trim()}` : idea.title;

  const specContent = `# Antigravity Feature Specification: ${idea.title}

> **Source**: Telegram "App" Topic (Message ID: ${idea.telegramMsgId || 'Manual/Mobile'})  
> **Received At**: ${dateStr}  
> **Topic**: \`${idea.topic}\`  
> **Category**: \`${idea.category}\`  
> **Status**: ${idea.isFulfilled ? 'FULFILLED' : 'ACTIVE / PENDING'}

---

## 1. Feature Goal & User Request
${rawReq}

---

## 2. Technical Stack & Environment Context
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, Radix UI, TanStack React Query.
- **Backend**: Node.js, Express, TypeScript (\`tsx watch server/index.ts\`).
- **Database**: SQLite with Prisma ORM (\`prisma/schema.prisma\`).
- **Target Components**: 
  - If UI: \`src/components/\`
  - If Service / API: \`src/services/\` and \`server/routes/\`
  - If Data Model: \`prisma/schema.prisma\`

---

## 3. Implementation Directives for Antigravity
1. **Analyze Requirements**: Understand the exact feature requested in the Telegram message above.
2. **Code Implementation**:
   - Write clean, type-safe code adhering to existing project architecture.
   - Maintain dark-mode aesthetics, responsive UI, and robust error handling.
3. **Automated Verification**:
   - Verify TypeScript compilation (\`npm run build\` or vitest).
   - Ensure no regressions across adjacent modules.
4. **Mark Status**:
   - Once implemented and verified, mark the feature as fulfilled in \`AppIdeasChecklist\` and notify the user.

---

*Spec generated autonomously by Trade Compass for Antigravity AI Coding Agent.*
`;

  const antigravityPrompt = `Hey Antigravity, please implement this feature requested from Telegram:

**Feature**: ${idea.title}
**Topic / Category**: ${idea.topic} (${idea.category})
**Original Request**:
${rawReq}

**Implementation Directives**:
- Implement the function in the Trade Compass finance app according to project standards (React, TypeScript, Tailwind, Express, Prisma).
- Inspect the relevant files in \`src/\` and \`server/\`.
- Run tests and build checks to ensure zero errors.
- Please start coding the implementation now.`;

  return { specContent, antigravityPrompt };
}

export function createAppIdeaRouter(prisma: PrismaClient) {
  const router = Router();

  // GET /api/app-ideas - List ideas with filtering
  router.get('/', async (req, res) => {
    try {
      const { filter = 'all', topic, search } = req.query as {
        filter?: 'all' | 'pending' | 'fulfilled';
        topic?: string;
        search?: string;
      };

      const where: any = {};

      if (filter === 'pending') {
        where.isFulfilled = false;
      } else if (filter === 'fulfilled') {
        where.isFulfilled = true;
      }

      if (topic && topic !== 'ALL') {
        where.topic = { equals: topic };
      }

      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { title: { contains: q } },
          { description: { contains: q } },
          { topic: { contains: q } },
          { tags: { contains: q } },
        ];
      }

      const ideas = await (prisma as any).appIdea.findMany({
        where,
        orderBy: [
          { isFulfilled: 'asc' },
          { createdAt: 'desc' },
        ],
      });

      // Also compute quick stats
      const totalCount = await (prisma as any).appIdea.count();
      const pendingCount = await (prisma as any).appIdea.count({ where: { isFulfilled: false } });
      const fulfilledCount = await (prisma as any).appIdea.count({ where: { isFulfilled: true } });

      // Get distinct topics with count
      const allIdeas = await (prisma as any).appIdea.findMany({
        select: { topic: true, isFulfilled: true },
      });

      const topicCounts: Record<string, { total: number; pending: number }> = {};
      allIdeas.forEach((item: { topic: string; isFulfilled: boolean }) => {
        const t = item.topic || 'App';
        if (!topicCounts[t]) topicCounts[t] = { total: 0, pending: 0 };
        topicCounts[t].total += 1;
        if (!item.isFulfilled) topicCounts[t].pending += 1;
      });

      res.json({
        ideas,
        stats: {
          total: totalCount,
          pending: pendingCount,
          fulfilled: fulfilledCount,
          completionPercentage: totalCount > 0 ? Math.round((fulfilledCount / totalCount) * 100) : 0,
        },
        topics: topicCounts,
      });
    } catch (error: any) {
      console.error('Error fetching app ideas:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/app-ideas - Create new app idea manually
  router.post('/', async (req, res) => {
    try {
      const { title, description, topic = 'App', category = 'Feature', tags } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required for an app idea.' });
      }

      const cleanTitle = title.trim();
      const cleanDesc = description?.trim() || null;
      const cleanTopic = topic?.trim() || 'App';
      const cleanCategory = category?.trim() || 'Feature';

      // 1. Create ThoughtLog in 'App' folder so it appears in notes too
      const thoughtLog = await (prisma as any).thoughtLog.create({
        data: {
          title: `💡 ${cleanTitle}`,
          content: cleanDesc ? `${cleanTitle}\n\n${cleanDesc}` : cleanTitle,
          folder: 'App',
          tags: tags || `App, ${cleanTopic}, ${cleanCategory}, Manual`,
          sentiment: 'NEUTRAL',
          isPinned: false,
          isFulfilled: false,
          createdAt: new Date(),
        },
      });

      // 2. Create AppIdea record linked to thoughtLog
      const idea = await (prisma as any).appIdea.create({
        data: {
          title: cleanTitle,
          description: cleanDesc,
          topic: cleanTopic,
          category: cleanCategory,
          isFulfilled: false,
          source: 'MANUAL',
          thoughtLogId: thoughtLog.id,
          tags: tags || `App, ${cleanTopic}`,
          createdAt: new Date(),
        },
      });

      res.status(201).json(idea);
    } catch (error: any) {
      console.error('Error creating app idea:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/app-ideas/:id/toggle - Toggle fulfillment status
  router.patch('/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      const current = await (prisma as any).appIdea.findUnique({
        where: { id },
      });

      if (!current) {
        return res.status(404).json({ error: 'App idea not found' });
      }

      const newFulfilled = !current.isFulfilled;
      const fulfilledAt = newFulfilled ? new Date() : null;

      const updated = await (prisma as any).appIdea.update({
        where: { id },
        data: {
          isFulfilled: newFulfilled,
          fulfilledAt,
        },
      });

      // If linked to thoughtLog, keep it in sync
      if (current.thoughtLogId) {
        try {
          await (prisma as any).thoughtLog.update({
            where: { id: current.thoughtLogId },
            data: {
              isFulfilled: newFulfilled,
              fulfilledAt,
            },
          });
        } catch (syncErr: any) {
          console.warn('Failed to sync thoughtLog fulfillment:', syncErr.message);
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error toggling app idea fulfillment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/app-ideas/:id - Update idea fields
  router.patch('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, topic, category, isFulfilled } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (topic !== undefined) updateData.topic = topic.trim() || 'App';
      if (category !== undefined) updateData.category = category.trim() || 'Feature';
      if (isFulfilled !== undefined) {
        updateData.isFulfilled = Boolean(isFulfilled);
        updateData.fulfilledAt = isFulfilled ? new Date() : null;
      }

      const updated = await (prisma as any).appIdea.update({
        where: { id },
        data: updateData,
      });

      // Sync linked thoughtLog title/fulfillment if exists
      if (updated.thoughtLogId) {
        try {
          const logUpdate: any = {};
          if (title !== undefined) logUpdate.title = `💡 ${title.trim()}`;
          if (isFulfilled !== undefined) {
            logUpdate.isFulfilled = Boolean(isFulfilled);
            logUpdate.fulfilledAt = isFulfilled ? new Date() : null;
          }
          await (prisma as any).thoughtLog.update({
            where: { id: updated.thoughtLogId },
            data: logUpdate,
          });
        } catch {}
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating app idea:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/app-ideas/:id - Delete idea
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await (prisma as any).appIdea.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'App idea not found' });
      }

      await (prisma as any).appIdea.delete({
        where: { id },
      });

      // Optionally delete linked thoughtLog if exists
      if (existing.thoughtLogId) {
        try {
          await (prisma as any).thoughtLog.delete({
            where: { id: existing.thoughtLogId },
          });
        } catch {}
      }

      res.json({ success: true, message: 'App idea deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting app idea:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/app-ideas/:id/antigravity-spec - Save workspace spec and return prompt
  router.post('/:id/antigravity-spec', async (req, res) => {
    try {
      const { id } = req.params;
      const idea = await (prisma as any).appIdea.findUnique({
        where: { id },
      });

      if (!idea) {
        return res.status(404).json({ error: 'App idea not found' });
      }

      const { specContent, antigravityPrompt } = generateAntigravityTaskSpec(idea);

      // Save spec file to .agents/specs/
      const workspaceRoot = process.cwd();
      const specsDir = path.join(workspaceRoot, '.agents', 'specs');
      if (!fs.existsSync(specsDir)) {
        fs.mkdirSync(specsDir, { recursive: true });
      }

      const cleanSlug = idea.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'feature';

      const filename = `task-${idea.id.slice(0, 8)}-${cleanSlug}.md`;
      const filePath = path.join(specsDir, filename);
      const activeFilePath = path.join(specsDir, 'ACTIVE_TASK.md');

      fs.writeFileSync(filePath, specContent, 'utf-8');
      fs.writeFileSync(activeFilePath, specContent, 'utf-8');

      res.json({
        success: true,
        idea,
        filePath,
        activeFilePath,
        filename,
        prompt: antigravityPrompt,
        spec: specContent,
      });
    } catch (error: any) {
      console.error('Error generating Antigravity task spec:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/app-ideas/spec-from-log/:logId - Generate spec directly from a ThoughtLog
  router.post('/spec-from-log/:logId', async (req, res) => {
    try {
      const { logId } = req.params;
      const log = await (prisma as any).thoughtLog.findUnique({
        where: { id: logId },
      });

      if (!log) {
        return res.status(404).json({ error: 'Thought log not found' });
      }

      // Check if AppIdea already exists for this thoughtLog
      let idea = await (prisma as any).appIdea.findFirst({
        where: { thoughtLogId: logId },
      });

      if (!idea) {
        // Create an AppIdea from the log
        const cleanTitle = log.title.replace(/^💡\s*/, '').trim();
        idea = await (prisma as any).appIdea.create({
          data: {
            title: cleanTitle,
            description: log.content !== cleanTitle ? log.content : null,
            topic: 'App',
            category: 'Feature',
            isFulfilled: Boolean(log.isFulfilled),
            source: 'TELEGRAM',
            thoughtLogId: log.id,
            tags: log.tags || 'App',
            createdAt: log.createdAt,
          },
        });
      }

      const { specContent, antigravityPrompt } = generateAntigravityTaskSpec(idea);

      const workspaceRoot = process.cwd();
      const specsDir = path.join(workspaceRoot, '.agents', 'specs');
      if (!fs.existsSync(specsDir)) {
        fs.mkdirSync(specsDir, { recursive: true });
      }

      const cleanSlug = idea.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'feature';

      const filename = `task-${idea.id.slice(0, 8)}-${cleanSlug}.md`;
      const filePath = path.join(specsDir, filename);
      const activeFilePath = path.join(specsDir, 'ACTIVE_TASK.md');

      fs.writeFileSync(filePath, specContent, 'utf-8');
      fs.writeFileSync(activeFilePath, specContent, 'utf-8');

      res.json({
        success: true,
        idea,
        filePath,
        activeFilePath,
        filename,
        prompt: antigravityPrompt,
        spec: specContent,
      });
    } catch (error: any) {
      console.error('Error generating Antigravity spec from log:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
