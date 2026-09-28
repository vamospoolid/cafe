/**
 * Pustaka Preset Kategori Menu Standar Industri
 * Untuk Tenant Onboarding & Fast Provisioning di CodePOS
 */

export interface PresetSubCategory {
  name: string;
  icon: string;
  color: string;
  stationTarget: string;
}

export interface PresetCategory {
  name: string;
  icon: string;
  color: string;
  stationTarget: string;
  subCategories?: PresetSubCategory[];
}

export interface IndustryCategoryPreset {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  categories: PresetCategory[];
}

export const CATEGORY_PRESETS: Record<string, IndustryCategoryPreset> = {
  CAFE: {
    id: 'CAFE',
    name: 'Coffee Shop & Kafe',
    tagline: 'Fokus pada seduhan kopi, minuman segar, dan camilan pendamping',
    icon: '☕',
    categories: [
      {
        name: 'Coffee (Espresso Based)',
        icon: '☕',
        color: '#854d0e',
        stationTarget: 'BAR',
        subCategories: [
          { name: 'Hot Coffee', icon: '☕', color: '#854d0e', stationTarget: 'BAR' },
          { name: 'Iced Coffee & Latte', icon: '🧊', color: '#854d0e', stationTarget: 'BAR' },
          { name: 'Signature Flavored', icon: '✨', color: '#b45309', stationTarget: 'BAR' }
        ]
      },
      {
        name: 'Manual Brew (Filter)',
        icon: '🫖',
        color: '#713f12',
        stationTarget: 'BAR',
        subCategories: [
          { name: 'V60 Pour Over', icon: '🫖', color: '#713f12', stationTarget: 'BAR' },
          { name: 'Japanese Cold Drip', icon: '🧪', color: '#713f12', stationTarget: 'BAR' }
        ]
      },
      {
        name: 'Non-Coffee & Tea',
        icon: '🍵',
        color: '#065f46',
        stationTarget: 'BAR',
        subCategories: [
          { name: 'Matcha & Chocolate', icon: '🍵', color: '#065f46', stationTarget: 'BAR' },
          { name: 'Artisan Tea & Mocktail', icon: '🧋', color: '#047857', stationTarget: 'BAR' }
        ]
      },
      {
        name: 'Pastry & Bakery',
        icon: '🥐',
        color: '#d97706',
        stationTarget: 'DESSERT',
        subCategories: [
          { name: 'Croissant & Danish', icon: '🥐', color: '#d97706', stationTarget: 'DESSERT' },
          { name: 'Cakes & Tarts', icon: '🍰', color: '#b45309', stationTarget: 'DESSERT' }
        ]
      },
      {
        name: 'Light Meals & Snacks',
        icon: '🍟',
        color: '#e11d48',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'French Fries & Platters', icon: '🍟', color: '#e11d48', stationTarget: 'KITCHEN' },
          { name: 'Toast & Sandwiches', icon: '🥪', color: '#be123c', stationTarget: 'KITCHEN' }
        ]
      }
    ]
  },

  RESTAURANT: {
    id: 'RESTAURANT',
    name: 'Restoran & Rumah Makan',
    tagline: 'Lengkap dari hidangan pembuka, aneka olahan lauk, hingga hidangan penutup',
    icon: '🍽️',
    categories: [
      {
        name: 'Appetizer (Pembuka)',
        icon: '🥗',
        color: '#15803d',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'Salad & Soup', icon: '🥣', color: '#15803d', stationTarget: 'KITCHEN' },
          { name: 'Finger Food & Dimsum', icon: '🥟', color: '#16a34a', stationTarget: 'KITCHEN' }
        ]
      },
      {
        name: 'Main Course (Ayam & Daging)',
        icon: '🍗',
        color: '#b91c1c',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'Olahan Ayam & Bebek', icon: '🍗', color: '#b91c1c', stationTarget: 'KITCHEN' },
          { name: 'Olahan Daging Sapi & Kambing', icon: '🥩', color: '#991b1b', stationTarget: 'KITCHEN' }
        ]
      },
      {
        name: 'Main Course (Seafood & Ikan)',
        icon: '🐟',
        color: '#0284c7',
        stationTarget: 'GRILL',
        subCategories: [
          { name: 'Ikan Bakar / Goreng', icon: '🐟', color: '#0284c7', stationTarget: 'GRILL' },
          { name: 'Udang & Cumi', icon: '🦐', color: '#0369a1', stationTarget: 'GRILL' }
        ]
      },
      {
        name: 'Nasi, Mie & Pasta',
        icon: '🍜',
        color: '#d97706',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'Nasi Goreng & Pilihan Nasi', icon: '🍚', color: '#d97706', stationTarget: 'KITCHEN' },
          { name: 'Mie, Kwetiau & Pasta', icon: '🍜', color: '#b45309', stationTarget: 'KITCHEN' }
        ]
      },
      {
        name: 'Sayuran & Pelengkap',
        icon: '🥦',
        color: '#059669',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'Tumisan Sayur', icon: '🥬', color: '#059669', stationTarget: 'KITCHEN' },
          { name: 'Sambal & Kerupuk', icon: '🌶️', color: '#dc2626', stationTarget: 'KITCHEN' }
        ]
      },
      {
        name: 'Dessert (Penutup)',
        icon: '🍨',
        color: '#be185d',
        stationTarget: 'DESSERT',
        subCategories: [
          { name: 'Es Krim & Pudding', icon: '🍨', color: '#be185d', stationTarget: 'DESSERT' },
          { name: 'Buah Segar & Manisan', icon: '🍉', color: '#9d174d', stationTarget: 'DESSERT' }
        ]
      },
      {
        name: 'Beverages (Minuman)',
        icon: '🥤',
        color: '#0891b2',
        stationTarget: 'BAR',
        subCategories: [
          { name: 'Aneka Jus & Smoothies', icon: '🍹', color: '#0891b2', stationTarget: 'BAR' },
          { name: 'Es Teh & Minuman Dingin', icon: '🧊', color: '#0e7490', stationTarget: 'BAR' },
          { name: 'Minuman Hangat & Tradisional', icon: '🍵', color: '#155e75', stationTarget: 'BAR' }
        ]
      }
    ]
  },

  BAKERY: {
    id: 'BAKERY',
    name: 'Bakery & Toko Roti',
    tagline: 'Struktur khusus roti artisan, kue basah, pastry lembaran, dan hampers',
    icon: '🍞',
    categories: [
      {
        name: 'Roti Manis & Savory',
        icon: '🍞',
        color: '#b45309',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'Roti Manis Satuan', icon: '🍞', color: '#b45309', stationTarget: 'KITCHEN' },
          { name: 'Roti Daging & Sosis', icon: '🌭', color: '#92400e', stationTarget: 'KITCHEN' }
        ]
      },
      {
        name: 'Artisan & Sourdough',
        icon: '🥖',
        color: '#78350f',
        stationTarget: 'KITCHEN',
        subCategories: [
          { name: 'Baguette & Loaf', icon: '🥖', color: '#78350f', stationTarget: 'KITCHEN' },
          { name: 'Country Sourdough', icon: '🌾', color: '#78350f', stationTarget: 'KITCHEN' }
        ]
      },
      {
        name: 'Cakes & Celebration',
        icon: '🎂',
        color: '#db2777',
        stationTarget: 'DESSERT',
        subCategories: [
          { name: 'Whole Birthday Cake', icon: '🎂', color: '#db2777', stationTarget: 'DESSERT' },
          { name: 'Slice Cake', icon: '🍰', color: '#be185d', stationTarget: 'DESSERT' }
        ]
      },
      {
        name: 'Dry Cookies & Hampers',
        icon: '🍪',
        color: '#ea580c',
        stationTarget: 'NONE',
        subCategories: [
          { name: 'Cookies Toples', icon: '🍪', color: '#ea580c', stationTarget: 'NONE' },
          { name: 'Paket Parcel / Gift Set', icon: '🎁', color: '#c2410c', stationTarget: 'NONE' }
        ]
      },
      {
        name: 'Minuman Pendamping',
        icon: '☕',
        color: '#4f46e5',
        stationTarget: 'BAR'
      }
    ]
  }
};

/**
 * Menerapkan Preset Kategori Industri ke Tenant Tertentu
 * Reusable untuk Onboarding Tenant Baru, Reset Kategori, atau Testing
 */
export async function applyPresetToTenant(
  prisma: any,
  tenantId: string,
  presetId: string,
  replaceAll: boolean = false
): Promise<{ success: boolean; createdCategories: number; createdSubCategories: number }> {
  const preset = CATEGORY_PRESETS[presetId];
  if (!preset) {
    throw new Error(`Preset kategori dengan ID '${presetId}' tidak ditemukan.`);
  }

  if (replaceAll) {
    // Soft delete kategori lama tenant ini
    await prisma.category.updateMany({
      where: { tenantId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
  }

  // Ambil sortOrder tertinggi saat ini milik tenant
  const highestSort = await prisma.category.findFirst({
    where: { tenantId, parentId: null, deletedAt: null },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true }
  });
  let currentSortOrder = (highestSort?.sortOrder ?? -1) + 1;

  let createdCategoriesCount = 0;
  let createdSubCategoriesCount = 0;

  for (const catData of preset.categories) {
    const parentCat = await prisma.category.create({
      data: {
        tenantId,
        name: catData.name,
        icon: catData.icon,
        color: catData.color,
        sortOrder: currentSortOrder++,
        stationTarget: catData.stationTarget,
        printerTarget: catData.stationTarget === 'BAR' ? 'BAR' : catData.stationTarget === 'NONE' ? 'NONE' : 'KITCHEN',
        parentId: null
      }
    });
    createdCategoriesCount++;

    if (catData.subCategories && catData.subCategories.length > 0) {
      let subSort = 0;
      for (const sub of catData.subCategories) {
        await prisma.category.create({
          data: {
            tenantId,
            name: sub.name,
            icon: sub.icon,
            color: sub.color,
            sortOrder: subSort++,
            stationTarget: sub.stationTarget,
            printerTarget: sub.stationTarget === 'BAR' ? 'BAR' : sub.stationTarget === 'NONE' ? 'NONE' : 'KITCHEN',
            parentId: parentCat.id
          }
        });
        createdSubCategoriesCount++;
      }
    }
  }

  return {
    success: true,
    createdCategories: createdCategoriesCount,
    createdSubCategories: createdSubCategoriesCount
  };
}

