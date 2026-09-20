import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PositionFolderService } from '../services/positionFolderService';

export function createPositionFolderRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/position-folders - List all folders with assignments
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const folders = await PositionFolderService.listFoldersWithAssignments(prisma);
      res.json({ success: true, folders });
    } catch (error: any) {
      console.error('[PositionFolderRoutes] Failed to list folders:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list position folders' });
    }
  });

  // POST /api/position-folders - Create a new folder
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, color, icon, description, sortOrder } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Folder name is required' });
      }

      const folder = await PositionFolderService.createFolder(prisma, {
        name,
        color,
        icon,
        description,
        sortOrder,
      });

      res.status(201).json({ success: true, folder });
    } catch (error: any) {
      console.error('[PositionFolderRoutes] Failed to create folder:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create position folder' });
    }
  });

  // PUT /api/position-folders/:id - Update an existing folder
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, color, icon, description, sortOrder } = req.body;

      const updated = await PositionFolderService.updateFolder(prisma, id, {
        name,
        color,
        icon,
        description,
        sortOrder,
      });

      res.json({ success: true, folder: updated });
    } catch (error: any) {
      console.error(`[PositionFolderRoutes] Failed to update folder ${req.params.id}:`, error);
      const statusCode = error.message?.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ success: false, error: error.message || 'Failed to update folder' });
    }
  });

  // DELETE /api/position-folders/:id - Delete a folder
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await PositionFolderService.deleteFolder(prisma, id);
      res.json({ success: true, message: 'Folder deleted successfully' });
    } catch (error: any) {
      console.error(`[PositionFolderRoutes] Failed to delete folder ${req.params.id}:`, error);
      const statusCode = error.message?.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ success: false, error: error.message || 'Failed to delete folder' });
    }
  });

  // POST /api/position-folders/assign - Assign position to folder
  router.post('/assign', async (req: Request, res: Response) => {
    try {
      const { folderId, positionKey, symbol } = req.body;
      if (!folderId || !positionKey || !symbol) {
        return res.status(400).json({
          success: false,
          error: 'folderId, positionKey, and symbol are required fields',
        });
      }

      const assignment = await PositionFolderService.assignPosition(prisma, {
        folderId,
        positionKey,
        symbol,
      });

      res.json({ success: true, assignment });
    } catch (error: any) {
      console.error('[PositionFolderRoutes] Failed to assign position:', error);
      const statusCode = error.message?.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ success: false, error: error.message || 'Failed to assign position' });
    }
  });

  // DELETE /api/position-folders/assign/:positionKey - Unassign position
  router.delete('/assign/:positionKey', async (req: Request, res: Response) => {
    try {
      const { positionKey } = req.params;
      await PositionFolderService.unassignPosition(prisma, decodeURIComponent(positionKey));
      res.json({ success: true, message: 'Position unassigned successfully' });
    } catch (error: any) {
      console.error(`[PositionFolderRoutes] Failed to unassign position ${req.params.positionKey}:`, error);
      res.status(500).json({ success: false, error: error.message || 'Failed to unassign position' });
    }
  });

  // POST /api/position-folders/bulk-assign - Bulk assign multiple positions
  router.post('/bulk-assign', async (req: Request, res: Response) => {
    try {
      const { folderId, items } = req.body;
      if (!folderId || !Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          error: 'folderId and items array are required',
        });
      }

      const results = await PositionFolderService.bulkAssignPositions(prisma, {
        folderId,
        items,
      });

      res.json({ success: true, count: results.length, assignments: results });
    } catch (error: any) {
      console.error('[PositionFolderRoutes] Failed to bulk assign positions:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to bulk assign positions' });
    }
  });

  return router;
}
