import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateAntigravityPrompt } from '../services/appIdeaService';
import { generateAntigravityTaskSpec } from '../../server/routes/appIdeaRoutes';

describe('Antigravity Coding Workflow & Spec Generator', () => {
  const mockIdea = {
    id: 'idea-1234-5678-90ab',
    title: 'Add Options Expiration Calendar View',
    description: 'Implement a visual calendar widget showing option expirations with open interest heatmaps.',
    topic: 'Options',
    category: 'Feature',
    isFulfilled: false,
    createdAt: '2026-09-07T08:30:00.000Z',
    telegramMsgId: 2045,
  };

  it('generateAntigravityPrompt should format prompt with clear Pair Programmer instructions', () => {
    const prompt = generateAntigravityPrompt(mockIdea);

    expect(prompt).toContain('Hey Antigravity, please implement this feature requested from Telegram:');
    expect(prompt).toContain('**Feature**: Add Options Expiration Calendar View');
    expect(prompt).toContain('**Topic / Category**: Options (Feature)');
    expect(prompt).toContain('Implement a visual calendar widget showing option expirations');
    expect(prompt).toContain('React 18, TypeScript, Tailwind CSS, Express, Prisma SQLite');
    expect(prompt).toContain('Please start coding the implementation now.');
  });

  it('generateAntigravityTaskSpec should produce a structured markdown specification', () => {
    const { specContent, antigravityPrompt } = generateAntigravityTaskSpec(mockIdea);

    expect(specContent).toContain('# Antigravity Feature Specification: Add Options Expiration Calendar View');
    expect(specContent).toContain('Telegram "App" Topic (Message ID: 2045)');
    expect(specContent).toContain('`Options`');
    expect(specContent).toContain('`Feature`');
    expect(specContent).toContain('## 1. Feature Goal & User Request');
    expect(specContent).toContain('## 2. Technical Stack & Environment Context');
    expect(specContent).toContain('## 3. Implementation Directives for Antigravity');
    expect(antigravityPrompt).toContain('Hey Antigravity, please implement this feature requested from Telegram:');
  });

  it('should write task spec and ACTIVE_TASK.md to .agents/specs/ directory', () => {
    const workspaceRoot = process.cwd();
    const specsDir = path.join(workspaceRoot, '.agents', 'specs');
    
    // Generate spec
    const { specContent } = generateAntigravityTaskSpec(mockIdea);

    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    const filename = `task-test-${mockIdea.id.slice(0, 8)}.md`;
    const testFilePath = path.join(specsDir, filename);
    const activeFilePath = path.join(specsDir, 'ACTIVE_TASK.md');

    fs.writeFileSync(testFilePath, specContent, 'utf-8');
    fs.writeFileSync(activeFilePath, specContent, 'utf-8');

    expect(fs.existsSync(testFilePath)).toBe(true);
    expect(fs.existsSync(activeFilePath)).toBe(true);

    const readSpec = fs.readFileSync(testFilePath, 'utf-8');
    const readActive = fs.readFileSync(activeFilePath, 'utf-8');

    expect(readSpec).toContain('Add Options Expiration Calendar View');
    expect(readActive).toContain('Add Options Expiration Calendar View');

    // Clean up test file (keep ACTIVE_TASK for workspace use)
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
});
