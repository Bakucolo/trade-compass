import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PositionFolderService, DEFAULT_FOLDERS } from '../../server/services/positionFolderService';

const prisma = new PrismaClient();

describe('PositionFolderService', () => {
  beforeEach(async () => {
    // Clean up any test folders and assignments created in tests
    await prisma.positionFolderAssignment.deleteMany({
      where: {
        positionKey: { startsWith: 'TEST_' },
      },
    });
    await prisma.positionFolder.deleteMany({
      where: {
        name: { startsWith: 'TEST_' },
      },
    });
  });

  afterAll(async () => {
    await prisma.positionFolderAssignment.deleteMany({
      where: {
        positionKey: { startsWith: 'TEST_' },
      },
    });
    await prisma.positionFolder.deleteMany({
      where: {
        name: { startsWith: 'TEST_' },
      },
    });
    await prisma.$disconnect();
  });

  it('should list folders and auto-seed defaults if database is empty', async () => {
    const folders = await PositionFolderService.listFoldersWithAssignments(prisma);
    expect(folders.length).toBeGreaterThanOrEqual(DEFAULT_FOLDERS.length);
    const names = folders.map(f => f.name);
    for (const def of DEFAULT_FOLDERS) {
      expect(names).toContain(def.name);
    }
  });

  it('should create a new custom folder with correct order and fields', async () => {
    const newFolder = await PositionFolderService.createFolder(prisma, {
      name: 'TEST_Tech Momentum',
      color: 'cyan',
      icon: 'Zap',
      description: 'High-momentum semiconductor and AI plays',
    });

    expect(newFolder.id).toBeDefined();
    expect(newFolder.name).toBe('TEST_Tech Momentum');
    expect(newFolder.color).toBe('cyan');
    expect(newFolder.icon).toBe('Zap');
    expect(newFolder.description).toBe('High-momentum semiconductor and AI plays');
    expect(newFolder.sortOrder).toBeGreaterThan(0);
  });

  it('should update folder attributes cleanly', async () => {
    const folder = await PositionFolderService.createFolder(prisma, {
      name: 'TEST_Initial Name',
      color: 'purple',
    });

    const updated = await PositionFolderService.updateFolder(prisma, folder.id, {
      name: 'TEST_Renamed Folder',
      color: 'amber',
      icon: 'Flame',
      description: 'Updated description',
    });

    expect(updated.name).toBe('TEST_Renamed Folder');
    expect(updated.color).toBe('amber');
    expect(updated.icon).toBe('Flame');
    expect(updated.description).toBe('Updated description');
  });

  it('should assign a position to a folder and unassign it', async () => {
    const folder = await PositionFolderService.createFolder(prisma, {
      name: 'TEST_Assign Target',
      color: 'emerald',
    });

    // Assign position
    const assignment = await PositionFolderService.assignPosition(prisma, {
      folderId: folder.id,
      positionKey: 'TEST_POS_123',
      symbol: 'NVDA',
    });

    expect(assignment.folderId).toBe(folder.id);
    expect(assignment.positionKey).toBe('TEST_POS_123');
    expect(assignment.symbol).toBe('NVDA');

    // Verify folder now includes assignment
    const folders = await PositionFolderService.listFoldersWithAssignments(prisma);
    const targetFolder = folders.find(f => f.id === folder.id);
    expect(targetFolder?.positionCount).toBe(1);
    expect(targetFolder?.assignments[0].positionKey).toBe('TEST_POS_123');

    // Unassign position
    await PositionFolderService.unassignPosition(prisma, 'TEST_POS_123');

    const foldersAfter = await PositionFolderService.listFoldersWithAssignments(prisma);
    const targetAfter = foldersAfter.find(f => f.id === folder.id);
    expect(targetAfter?.positionCount).toBe(0);
  });

  it('should bulk assign multiple positions to a folder', async () => {
    const folder = await PositionFolderService.createFolder(prisma, {
      name: 'TEST_Bulk Target',
      color: 'rose',
    });

    const results = await PositionFolderService.bulkAssignPositions(prisma, {
      folderId: folder.id,
      items: [
        { positionKey: 'TEST_BULK_1', symbol: 'AAPL' },
        { positionKey: 'TEST_BULK_2', symbol: 'MSFT' },
        { positionKey: 'TEST_BULK_3', symbol: 'GOOGL' },
      ],
    });

    expect(results.length).toBe(3);

    const folders = await PositionFolderService.listFoldersWithAssignments(prisma);
    const target = folders.find(f => f.id === folder.id);
    expect(target?.positionCount).toBe(3);
  });

  it('should delete a folder and cascade remove its assignments', async () => {
    const folder = await PositionFolderService.createFolder(prisma, {
      name: 'TEST_To Be Deleted',
      color: 'blue',
    });

    await PositionFolderService.assignPosition(prisma, {
      folderId: folder.id,
      positionKey: 'TEST_CASCADE_1',
      symbol: 'TSLA',
    });

    // Delete folder
    await PositionFolderService.deleteFolder(prisma, folder.id);

    // Assignment should be gone
    const assignment = await prisma.positionFolderAssignment.findUnique({
      where: { positionKey: 'TEST_CASCADE_1' },
    });
    expect(assignment).toBeNull();
  });
});
