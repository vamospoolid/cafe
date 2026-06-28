import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Get settings (Singleton - ID 1)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    let settings = await prisma.settings.findFirst();
    
    // If no settings exist yet, create default
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          storeName: 'SOL CAFE',
          phone: '081234567890',
          address: 'Jl. Utama No 1',
          logoUrl: '/logo-sol-cafe.png',
          taxRate: 11,
          serviceCharge: 5,
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil pengaturan toko' });
  }
});

// Update settings
router.put('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = req.body;
    
    // Remove ID if present to avoid updating primary key issues
    const { id, ...updateData } = data;
    
    // Convert string numbers to float for safety
    if (updateData.taxRate !== undefined) updateData.taxRate = Number(updateData.taxRate);
    if (updateData.serviceCharge !== undefined) updateData.serviceCharge = Number(updateData.serviceCharge);
    if (updateData.loyaltyEarnPerAmount !== undefined) updateData.loyaltyEarnPerAmount = Number(updateData.loyaltyEarnPerAmount);
    if (updateData.loyaltyPointValue !== undefined) updateData.loyaltyPointValue = Number(updateData.loyaltyPointValue);
    if (updateData.loyaltySilverThreshold !== undefined) updateData.loyaltySilverThreshold = Number(updateData.loyaltySilverThreshold);
    if (updateData.loyaltyGoldThreshold !== undefined) updateData.loyaltyGoldThreshold = Number(updateData.loyaltyGoldThreshold);
    if (updateData.loyaltySilverMultiplier !== undefined) updateData.loyaltySilverMultiplier = Number(updateData.loyaltySilverMultiplier);
    if (updateData.loyaltyGoldMultiplier !== undefined) updateData.loyaltyGoldMultiplier = Number(updateData.loyaltyGoldMultiplier);

    let settings = await prisma.settings.findFirst();
    
    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      settings = await prisma.settings.create({
        data: updateData
      });
    }

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan toko' });
  }
});

export default router;
