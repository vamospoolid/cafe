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
          storeName: 'MUKI RAMEN',
          phone: '081298765432',
          address: 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Kabupaten Polewali Mandar, Sulawesi Barat 91352',
          logoUrl: '/logo-muki-ramen.png',
          taxRate: 10,
          serviceCharge: 5,
          receiptHeader: 'MUKI RAMEN\nJl. Kesadaran No. 3, Wonomulyo, Polman',
          receiptFooter: 'Arigatou Gozaimasu!\nTerima Kasih Atas Kunjungan Anda',
          storeLatitude: -3.4026521,
          storeLongitude: 119.2137757,
          gpsRadiusMeters: 200,
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
    
    if (updateData.enableKDS !== undefined) updateData.enableKDS = Boolean(updateData.enableKDS);
    if (updateData.autoCompleteKDSOnPay !== undefined) updateData.autoCompleteKDSOnPay = Boolean(updateData.autoCompleteKDSOnPay);
    if (updateData.autoPrintReceipt !== undefined) updateData.autoPrintReceipt = Boolean(updateData.autoPrintReceipt);
    if (updateData.autoPrintKitchen !== undefined) updateData.autoPrintKitchen = Boolean(updateData.autoPrintKitchen);
    if (updateData.autoPrintBar !== undefined) updateData.autoPrintBar = Boolean(updateData.autoPrintBar);

    if (updateData.storeLatitude !== undefined) updateData.storeLatitude = Number(updateData.storeLatitude);
    if (updateData.storeLongitude !== undefined) updateData.storeLongitude = Number(updateData.storeLongitude);
    if (updateData.gpsRadiusMeters !== undefined) updateData.gpsRadiusMeters = Number(updateData.gpsRadiusMeters);
    if (updateData.enableGpsValidation !== undefined) updateData.enableGpsValidation = Boolean(updateData.enableGpsValidation);
    if (updateData.enableCameraPhoto !== undefined) updateData.enableCameraPhoto = Boolean(updateData.enableCameraPhoto);
    if (updateData.workShifts !== undefined && typeof updateData.workShifts !== 'string') {
      updateData.workShifts = JSON.stringify(updateData.workShifts);
    }

    // Reward & Punishment Karyawan
    if (updateData.enableZeroLateBonus !== undefined) updateData.enableZeroLateBonus = Boolean(updateData.enableZeroLateBonus);
    if (updateData.zeroLateBonusAmount !== undefined) updateData.zeroLateBonusAmount = Number(updateData.zeroLateBonusAmount);
    if (updateData.zeroLateMinAttendance !== undefined) updateData.zeroLateMinAttendance = Number(updateData.zeroLateMinAttendance);
    if (updateData.zeroLateMaxLateAllowed !== undefined) updateData.zeroLateMaxLateAllowed = Number(updateData.zeroLateMaxLateAllowed);
    if (updateData.enableLatePenalty !== undefined) updateData.enableLatePenalty = Boolean(updateData.enableLatePenalty);
    if (updateData.latePenaltyType !== undefined) updateData.latePenaltyType = String(updateData.latePenaltyType);
    if (updateData.latePenaltyAmount !== undefined) updateData.latePenaltyAmount = Number(updateData.latePenaltyAmount);
    if (updateData.enableAlphaPenalty !== undefined) updateData.enableAlphaPenalty = Boolean(updateData.enableAlphaPenalty);
    if (updateData.alphaPenaltyAmount !== undefined) updateData.alphaPenaltyAmount = Number(updateData.alphaPenaltyAmount);

    // Warehouse & Transfer Pricing
    if (updateData.warehouseTransferPricing !== undefined) updateData.warehouseTransferPricing = String(updateData.warehouseTransferPricing);
    if (updateData.warehouseMarkupPercent !== undefined) updateData.warehouseMarkupPercent = Number(updateData.warehouseMarkupPercent);

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
