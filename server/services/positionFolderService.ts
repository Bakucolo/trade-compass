import { PrismaClient } from '@prisma/client';

export interface DefaultFolderSeed {
  name: string;
  color: string;
  icon: string;
  description: string;
  sortOrder: number;
}

export const DEFAULT_FOLDERS: DefaultFolderSeed[] = [
  {
    name: 'Core Longs',
    color: 'emerald',
    icon: 'Briefcase',
    description: 'High-conviction foundational compounders and core long holdings',
    sortOrder: 1,
  },
  {
    name: 'Hedges & Defense',
    color: 'rose',
    icon: 'Shield',
    description: 'Capital protection, portfolio insurance, puts, and defensive positions',
    sortOrder: 2,
  },
  {
    name: 'Income & Covered Calls',
    color: 'purple',
    icon: 'DollarSign',
    description: 'Options cashflow, covered calls, cash-secured puts, and dividend anchors',
    sortOrder: 3,
  },
  {
    name: 'Speculative & Growth',
    color: 'cyan',
    icon: 'Zap',
    description: 'High-beta growth, momentum swings, and asymmetric speculative setups',
    sortOrder: 4,
  },
];

export interface CreateFolderInput {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateFolderInput {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
}

export interface AssignPositionInput {
  folderId: string;
  positionKey: string;
  symbol: string;
}

export interface BulkAssignInput {
  folderId: string;
  items: Array<{
    positionKey: string;
    symbol: string;
  }>;
}

export class PositionFolderService {
  /**
   * List all folders with their assignments. If database has no folders, seeds default folders.
   */
  static async listFoldersWithAssignments(prisma: PrismaClient) {
    const count = await prisma.positionFolder.count();
    if (count === 0) {
      for (const def of DEFAULT_FOLDERS) {
        await prisma.positionFolder.create({
          data: def,
        });
      }
    }

    const folders = await prisma.positionFolder.findMany({
      include: {
        assignments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return folders.map((folder) => ({
      ...folder,
      positionCount: folder.assignments.length,
    }));
  }

  /**
   * Create a new custom position folder
   */
  static async createFolder(prisma: PrismaClient, input: CreateFolderInput) {
    let order = input.sortOrder;
    if (order === undefined) {
      const highest = await prisma.positionFolder.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      order = (highest?.sortOrder ?? 0) + 1;
    }

    return prisma.positionFolder.create({
      data: {
        name: input.name.trim(),
        color: input.color || 'blue',
        icon: input.icon || 'Folder',
        description: input.description?.trim() || null,
        sortOrder: order,
      },
      include: {
        assignments: true,
      },
    });
  }

  /**
   * Update an existing position folder
   */
  static async updateFolder(prisma: PrismaClient, id: string, input: UpdateFolderInput) {
    const existing = await prisma.positionFolder.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Position folder with id ${id} not found`);
    }

    return prisma.positionFolder.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      include: {
        assignments: true,
      },
    });
  }

  /**
   * Delete a position folder (assignments are automatically cascade deleted)
   */
  static async deleteFolder(prisma: PrismaClient, id: string) {
    const existing = await prisma.positionFolder.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Position folder with id ${id} not found`);
    }

    return prisma.positionFolder.delete({
      where: { id },
    });
  }

  /**
   * Assign or move a position to a folder
   */
  static async assignPosition(prisma: PrismaClient, input: AssignPositionInput) {
    const cleanKey = input.positionKey.trim();
    const cleanSymbol = input.symbol.trim().toUpperCase();

    // Verify folder exists
    const folder = await prisma.positionFolder.findUnique({
      where: { id: input.folderId },
    });
    if (!folder) {
      throw new Error(`Folder with id ${input.folderId} not found`);
    }

    return prisma.positionFolderAssignment.upsert({
      where: {
        positionKey: cleanKey,
      },
      update: {
        folderId: input.folderId,
        symbol: cleanSymbol,
      },
      create: {
        folderId: input.folderId,
        positionKey: cleanKey,
        symbol: cleanSymbol,
      },
      include: {
        folder: true,
      },
    });
  }

  /**
   * Unassign a position from its current folder
   */
  static async unassignPosition(prisma: PrismaClient, positionKey: string) {
    const cleanKey = positionKey.trim();
    return prisma.positionFolderAssignment.deleteMany({
      where: {
        positionKey: cleanKey,
      },
    });
  }

  /**
   * Bulk assign multiple positions to a folder
   */
  static async bulkAssignPositions(prisma: PrismaClient, input: BulkAssignInput) {
    const folder = await prisma.positionFolder.findUnique({
      where: { id: input.folderId },
    });
    if (!folder) {
      throw new Error(`Folder with id ${input.folderId} not found`);
    }

    const results = [];
    for (const item of input.items) {
      const cleanKey = item.positionKey.trim();
      const cleanSymbol = item.symbol.trim().toUpperCase();
      if (!cleanKey) continue;

      const assignment = await prisma.positionFolderAssignment.upsert({
        where: {
          positionKey: cleanKey,
        },
        update: {
          folderId: input.folderId,
          symbol: cleanSymbol,
        },
        create: {
          folderId: input.folderId,
          positionKey: cleanKey,
          symbol: cleanSymbol,
        },
      });
      results.push(assignment);
    }

    return results;
  }
}
