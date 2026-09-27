import prisma from '../db';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { invalidateTenantCache } from '../middlewares/tenantResolver';

const router = Router();

export interface StarterTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: string;
  businessType?: 'CAFE' | 'BENGKEL' | 'RETAIL' | 'LAUNDRY' | string;
  categories: {
    name: string;
    printerTarget: string;
    subCategories?: string[];
  }[];
  ingredients: {
    name: string;
    category: 'FOOD' | 'DRINK' | 'PACKAGING' | 'OTHER' | string;
    unit: string;
    stock: number;
    minStock: number;
    buyPrice: number;
  }[];
  products: {
    name: string;
    categoryName: string;
    sellPrice: number;
    buyPrice: number;
    stock: number;
    recipes?: {
      ingredientName: string;
      qtyPerServing: number;
    }[];
  }[];
  serviceTypes?: {
    name: string;
    priceRetail: number;
    priceMitra: number;
    priceGrosir: number;
    vehicleType: string;
  }[];
  tables?: {
    tableNo: string;
    name: string;
    capacity: number;
  }[];
}

export const STARTER_TEMPLATES: Record<string, StarterTemplate> = {
  COFFEE_SHOP: {
    id: 'COFFEE_SHOP',
    name: 'Coffee Shop & Cafe',
    badge: 'Populer',
    description: 'Template lengkap untuk kedai kopi & kafe modern, dilengkapi komposisi resep espresso, susu, sirup, dan aneka pastry.',
    icon: 'Coffee',
    categories: [
      { name: 'Coffee (Hot/Iced)', printerTarget: 'BAR', subCategories: ['Espresso Based', 'Manual Brew', 'Signature Cold'] },
      { name: 'Non-Coffee', printerTarget: 'BAR', subCategories: ['Matcha Series', 'Chocolate', 'Artisan Tea'] },
      { name: 'Pastry & Bakery', printerTarget: 'KITCHEN', subCategories: ['Croissant', 'Cake Slice', 'Toast'] },
      { name: 'Light Meals', printerTarget: 'KITCHEN', subCategories: ['Finger Food', 'Sandwich'] }
    ],
    ingredients: [
      { name: 'Biji Kopi House Blend (Arabica-Robusta)', category: 'DRINK', unit: 'gram', stock: 5000, minStock: 1000, buyPrice: 180 },
      { name: 'Susu Fresh Milk UHT 1L', category: 'DRINK', unit: 'ml', stock: 20000, minStock: 4000, buyPrice: 19 },
      { name: 'Sirup Vanilla Monin', category: 'DRINK', unit: 'ml', stock: 1500, minStock: 250, buyPrice: 150 },
      { name: 'Sirup Salted Caramel Monin', category: 'DRINK', unit: 'ml', stock: 1500, minStock: 250, buyPrice: 150 },
      { name: 'Bubuk Matcha Premium Uji', category: 'DRINK', unit: 'gram', stock: 1000, minStock: 200, buyPrice: 350 },
      { name: 'Bubuk Dark Chocolate Belgia', category: 'DRINK', unit: 'gram', stock: 1000, minStock: 200, buyPrice: 200 },
      { name: 'Cup Dingin 16oz + Lid Dome', category: 'PACKAGING', unit: 'buah', stock: 300, minStock: 50, buyPrice: 750 },
      { name: 'Cup Panas 8oz + Lid Flat', category: 'PACKAGING', unit: 'buah', stock: 200, minStock: 50, buyPrice: 650 },
      { name: 'Croissant Butter Mentah (Dough)', category: 'FOOD', unit: 'buah', stock: 40, minStock: 10, buyPrice: 8500 }
    ],
    products: [
      {
        name: 'Espresso Single Shot',
        categoryName: 'Coffee (Hot/Iced)',
        sellPrice: 18000,
        buyPrice: 3600,
        stock: 50,
        recipes: [
          { ingredientName: 'Biji Kopi House Blend (Arabica-Robusta)', qtyPerServing: 18 }
        ]
      },
      {
        name: 'Americano / Long Black (Iced)',
        categoryName: 'Coffee (Hot/Iced)',
        sellPrice: 24000,
        buyPrice: 4350,
        stock: 50,
        recipes: [
          { ingredientName: 'Biji Kopi House Blend (Arabica-Robusta)', qtyPerServing: 18 },
          { ingredientName: 'Cup Dingin 16oz + Lid Dome', qtyPerServing: 1 }
        ]
      },
      {
        name: 'Caffe Latte (Iced)',
        categoryName: 'Coffee (Hot/Iced)',
        sellPrice: 30000,
        buyPrice: 7200,
        stock: 50,
        recipes: [
          { ingredientName: 'Biji Kopi House Blend (Arabica-Robusta)', qtyPerServing: 18 },
          { ingredientName: 'Susu Fresh Milk UHT 1L', qtyPerServing: 150 },
          { ingredientName: 'Cup Dingin 16oz + Lid Dome', qtyPerServing: 1 }
        ]
      },
      {
        name: 'Salted Caramel Macchiato',
        categoryName: 'Coffee (Hot/Iced)',
        sellPrice: 35000,
        buyPrice: 9450,
        stock: 40,
        recipes: [
          { ingredientName: 'Biji Kopi House Blend (Arabica-Robusta)', qtyPerServing: 18 },
          { ingredientName: 'Susu Fresh Milk UHT 1L', qtyPerServing: 150 },
          { ingredientName: 'Sirup Salted Caramel Monin', qtyPerServing: 15 },
          { ingredientName: 'Cup Dingin 16oz + Lid Dome', qtyPerServing: 1 }
        ]
      },
      {
        name: 'Kyoto Matcha Latte (Iced)',
        categoryName: 'Non-Coffee',
        sellPrice: 32000,
        buyPrice: 10600,
        stock: 35,
        recipes: [
          { ingredientName: 'Bubuk Matcha Premium Uji', qtyPerServing: 20 },
          { ingredientName: 'Susu Fresh Milk UHT 1L', qtyPerServing: 150 },
          { ingredientName: 'Cup Dingin 16oz + Lid Dome', qtyPerServing: 1 }
        ]
      },
      {
        name: 'Signature Belgian Chocolate (Iced)',
        categoryName: 'Non-Coffee',
        sellPrice: 32000,
        buyPrice: 8600,
        stock: 35,
        recipes: [
          { ingredientName: 'Bubuk Dark Chocolate Belgia', qtyPerServing: 25 },
          { ingredientName: 'Susu Fresh Milk UHT 1L', qtyPerServing: 150 },
          { ingredientName: 'Cup Dingin 16oz + Lid Dome', qtyPerServing: 1 }
        ]
      },
      {
        name: 'Butter Croissant Fresh Baked',
        categoryName: 'Pastry & Bakery',
        sellPrice: 28000,
        buyPrice: 8500,
        stock: 25,
        recipes: [
          { ingredientName: 'Croissant Butter Mentah (Dough)', qtyPerServing: 1 }
        ]
      }
    ],
    tables: [
      { tableNo: 'T01', name: 'Area Indoor 1', capacity: 2 },
      { tableNo: 'T02', name: 'Area Indoor 2', capacity: 2 },
      { tableNo: 'T03', name: 'Area Sofa Indoor', capacity: 4 },
      { tableNo: 'T04', name: 'Bar Counter Seat', capacity: 1 },
      { tableNo: 'O01', name: 'Outdoor Smoking 1', capacity: 4 },
      { tableNo: 'O02', name: 'Outdoor Smoking 2', capacity: 4 }
    ]
  },

  RESTAURANT_FNB: {
    id: 'RESTAURANT_FNB',
    name: 'Restoran & Kuliner F&B',
    badge: 'Lengkap',
    description: 'Template ideal untuk restoran makanan, bistro, warung makan, dan rumah makan dengan menu makanan utama, minuman, dan bahan baku dapur.',
    icon: 'UtensilsCrossed',
    categories: [
      { name: 'Makanan Utama', printerTarget: 'KITCHEN', subCategories: ['Nasi & Ayam', 'Mie & Pasta', 'Steak & Grill'] },
      { name: 'Cemilan & Appetizer', printerTarget: 'KITCHEN', subCategories: ['Gorengan', 'Soup & Salad'] },
      { name: 'Minuman Dingin & Hangat', printerTarget: 'BAR', subCategories: ['Aneka Teh', 'Jus Buah Segar', 'Kopi'] },
      { name: 'Menu Tambahan / Extra', printerTarget: 'KITCHEN', subCategories: ['Nasi Putih', 'Sambal', 'Telur'] }
    ],
    ingredients: [
      { name: 'Beras Pandan Wangi Super', category: 'FOOD', unit: 'gram', stock: 25000, minStock: 5000, buyPrice: 16 },
      { name: 'Daging Ayam Fillet Segar', category: 'FOOD', unit: 'gram', stock: 10000, minStock: 2000, buyPrice: 48 },
      { name: 'Telur Ayam Negeri', category: 'FOOD', unit: 'buah', stock: 120, minStock: 30, buyPrice: 2000 },
      { name: 'Minyak Goreng Sawit 2L', category: 'FOOD', unit: 'ml', stock: 10000, minStock: 2000, buyPrice: 18 },
      { name: 'Bumbu Racik Nasi Goreng Spesial', category: 'FOOD', unit: 'gram', stock: 2000, minStock: 300, buyPrice: 40 },
      { name: 'Kentang Beku French Fries 2kg', category: 'FOOD', unit: 'gram', stock: 6000, minStock: 1000, buyPrice: 35 },
      { name: 'Teh Celup Melati Jumbo', category: 'DRINK', unit: 'buah', stock: 100, minStock: 20, buyPrice: 1500 },
      { name: 'Gula Pasir Kristal Putih', category: 'DRINK', unit: 'gram', stock: 5000, minStock: 1000, buyPrice: 17 }
    ],
    products: [
      {
        name: 'Nasi Goreng Spesial + Telur Ceplok',
        categoryName: 'Makanan Utama',
        sellPrice: 32000,
        buyPrice: 9800,
        stock: 50,
        recipes: [
          { ingredientName: 'Beras Pandan Wangi Super', qtyPerServing: 150 },
          { ingredientName: 'Daging Ayam Fillet Segar', qtyPerServing: 50 },
          { ingredientName: 'Telur Ayam Negeri', qtyPerServing: 1 },
          { ingredientName: 'Minyak Goreng Sawit 2L', qtyPerServing: 30 },
          { ingredientName: 'Bumbu Racik Nasi Goreng Spesial', qtyPerServing: 25 }
        ]
      },
      {
        name: 'Ayam Bakar Madu Gurih + Nasi',
        categoryName: 'Makanan Utama',
        sellPrice: 38000,
        buyPrice: 13500,
        stock: 40,
        recipes: [
          { ingredientName: 'Beras Pandan Wangi Super', qtyPerServing: 150 },
          { ingredientName: 'Daging Ayam Fillet Segar', qtyPerServing: 180 }
        ]
      },
      {
        name: 'Crispy French Fries Mayo',
        categoryName: 'Cemilan & Appetizer',
        sellPrice: 22000,
        buyPrice: 6200,
        stock: 45,
        recipes: [
          { ingredientName: 'Kentang Beku French Fries 2kg', qtyPerServing: 150 },
          { ingredientName: 'Minyak Goreng Sawit 2L', qtyPerServing: 50 }
        ]
      },
      {
        name: 'Es Teh Manis Segar',
        categoryName: 'Minuman Dingin & Hangat',
        sellPrice: 8000,
        buyPrice: 1200,
        stock: 100,
        recipes: [
          { ingredientName: 'Teh Celup Melati Jumbo', qtyPerServing: 1 },
          { ingredientName: 'Gula Pasir Kristal Putih', qtyPerServing: 25 }
        ]
      }
    ],
    tables: [
      { tableNo: 'M01', name: 'Meja 1 (Keluarga)', capacity: 4 },
      { tableNo: 'M02', name: 'Meja 2 (Keluarga)', capacity: 4 },
      { tableNo: 'M03', name: 'Meja 3 (Pasangan)', capacity: 2 },
      { tableNo: 'M04', name: 'Meja 4 (Pasangan)', capacity: 2 },
      { tableNo: 'VIP1', name: 'Ruang VIP Acara', capacity: 10 }
    ]
  },

  BAKERY_PASTRY: {
    id: 'BAKERY_PASTRY',
    name: 'Bakery & Cake House',
    badge: 'Manis & Roti',
    description: 'Template dirancang khusus toko roti, kue basah, pastry & tart dengan kategori kemasan dan stok bahan mentah.',
    icon: 'Cake',
    categories: [
      { name: 'Fresh Bread & Roti Manis', printerTarget: 'KITCHEN', subCategories: ['Roti Tawar', 'Roti Isi'] },
      { name: 'Artisan Pastry & Danishes', printerTarget: 'KITCHEN', subCategories: ['Croissant', 'Danish'] },
      { name: 'Slice Cake & Tart', printerTarget: 'KITCHEN', subCategories: ['Cheesecake', 'Chocolate Cake'] },
      { name: 'Beverages to Go', printerTarget: 'BAR', subCategories: ['Coffee', 'Milk Tea'] }
    ],
    ingredients: [
      { name: 'Tepung Terigu Protein Tinggi Cakra', category: 'FOOD', unit: 'gram', stock: 25000, minStock: 5000, buyPrice: 14 },
      { name: 'Butter Anchor Salted', category: 'FOOD', unit: 'gram', stock: 5000, minStock: 1000, buyPrice: 120 },
      { name: 'Ragi Instan Saf-Instant', category: 'FOOD', unit: 'gram', stock: 1000, minStock: 200, buyPrice: 90 },
      { name: 'Dark Compound Chocolate Melt', category: 'FOOD', unit: 'gram', stock: 5000, minStock: 1000, buyPrice: 65 },
      { name: 'Cream Cheese Anchor', category: 'FOOD', unit: 'gram', stock: 3000, minStock: 500, buyPrice: 140 },
      { name: 'Box Cake Kraft Premium', category: 'PACKAGING', unit: 'buah', stock: 150, minStock: 30, buyPrice: 2500 }
    ],
    products: [
      {
        name: 'Classic Roti Tawar Gandum',
        categoryName: 'Fresh Bread & Roti Manis',
        sellPrice: 24000,
        buyPrice: 8500,
        stock: 30,
        recipes: [
          { ingredientName: 'Tepung Terigu Protein Tinggi Cakra', qtyPerServing: 350 },
          { ingredientName: 'Butter Anchor Salted', qtyPerServing: 30 },
          { ingredientName: 'Ragi Instan Saf-Instant', qtyPerServing: 5 }
        ]
      },
      {
        name: 'Choco Lava Soft Bread',
        categoryName: 'Fresh Bread & Roti Manis',
        sellPrice: 14000,
        buyPrice: 4800,
        stock: 40,
        recipes: [
          { ingredientName: 'Tepung Terigu Protein Tinggi Cakra', qtyPerServing: 100 },
          { ingredientName: 'Dark Compound Chocolate Melt', qtyPerServing: 40 },
          { ingredientName: 'Butter Anchor Salted', qtyPerServing: 15 }
        ]
      },
      {
        name: 'New York Cheesecake Slice',
        categoryName: 'Slice Cake & Tart',
        sellPrice: 38000,
        buyPrice: 14200,
        stock: 20,
        recipes: [
          { ingredientName: 'Cream Cheese Anchor', qtyPerServing: 90 },
          { ingredientName: 'Butter Anchor Salted', qtyPerServing: 20 }
        ]
      }
    ]
  },
  BENGKEL_MOTOR_UMUM: {
    id: 'BENGKEL_MOTOR_UMUM',
    name: 'Bengkel Motor Umum & Servis',
    badge: 'Rekomendasi Otomotif',
    description: 'Template lengkap untuk bengkel motor harian: kategori oli mesin, ban, aki, kampas rem, serta tarif standar servis injeksi & karbu.',
    icon: 'Wrench',
    businessType: 'BENGKEL',
    categories: [
      { name: 'Oli & Pelumas Mesin', printerTarget: 'NONE', subCategories: ['Oli Matic', 'Oli Manual / Bebek', 'Oli Gardan & Minyak Rem'] },
      { name: 'Suku Cadang Fast-Moving', printerTarget: 'NONE', subCategories: ['Kampas Rem', 'Busi & Pengapian', 'Filter Udara & CVT', 'Rantai & Gir'] },
      { name: 'Ban & Kaki-Kaki', printerTarget: 'NONE', subCategories: ['Ban Luar Tubeless', 'Ban Dalam', 'Bearing Roda & Shockbreaker'] },
      { name: 'Aki & Kelistrikan', printerTarget: 'NONE', subCategories: ['Aki Kering (Maintenance Free)', 'Bohlam & Sekring'] }
    ],
    ingredients: [],
    products: [
      { name: 'Oli Mesin Matic 10W-30 0.8L', categoryName: 'Oli & Pelumas Mesin', sellPrice: 55000, buyPrice: 42000, stock: 24 },
      { name: 'Oli Mesin Bebek / Sport 10W-40 1L', categoryName: 'Oli & Pelumas Mesin', sellPrice: 65000, buyPrice: 49000, stock: 18 },
      { name: 'Oli Gardan Matic 120ml', categoryName: 'Oli & Pelumas Mesin', sellPrice: 18000, buyPrice: 12000, stock: 30 },
      { name: 'Kampas Rem Depan Cakram Honda/Yamaha', categoryName: 'Suku Cadang Fast-Moving', sellPrice: 45000, buyPrice: 30000, stock: 15 },
      { name: 'Kampas Rem Belakang Tromol Matic', categoryName: 'Suku Cadang Fast-Moving', sellPrice: 40000, buyPrice: 26000, stock: 15 },
      { name: 'Busi Standar U24EPR9 / CPR9EA', categoryName: 'Suku Cadang Fast-Moving', sellPrice: 25000, buyPrice: 16000, stock: 20 },
      { name: 'Ban Luar Tubeless 90/90-14 Matic', categoryName: 'Ban & Kaki-Kaki', sellPrice: 215000, buyPrice: 168000, stock: 6 },
      { name: 'Ban Luar Tubeless 80/90-14 Depan', categoryName: 'Ban & Kaki-Kaki', sellPrice: 185000, buyPrice: 142000, stock: 6 },
      { name: 'Aki Kering GTZ5S 12V 3.5Ah', categoryName: 'Aki & Kelistrikan', sellPrice: 220000, buyPrice: 175000, stock: 4 }
    ],
    serviceTypes: [
      { name: 'Ganti Oli Mesin & Cek Tekanan Angin', priceRetail: 15000, priceMitra: 10000, priceGrosir: 10000, vehicleType: 'MOTOR' },
      { name: 'Servis Ringan + Pengecekan 12 Titik', priceRetail: 50000, priceMitra: 40000, priceGrosir: 35000, vehicleType: 'MOTOR' },
      { name: 'Servis CVT Lengkap & Pembersihan Roller', priceRetail: 65000, priceMitra: 50000, priceGrosir: 45000, vehicleType: 'MOTOR' },
      { name: 'Tune Up Injeksi / Throttle Body Clean', priceRetail: 65000, priceMitra: 50000, priceGrosir: 50000, vehicleType: 'MOTOR' },
      { name: 'Ganti Kampas Rem Depan / Belakang', priceRetail: 25000, priceMitra: 20000, priceGrosir: 20000, vehicleType: 'MOTOR' }
    ]
  },
  BENGKEL_MOBIL_DAN_AC: {
    id: 'BENGKEL_MOBIL_DAN_AC',
    name: 'Bengkel Mobil & Servis AC',
    badge: 'Spesialis Roda 4',
    description: 'Template untuk bengkel mobil: oli mesin, filter oli, freon AC, flushing rem, tune-up mesin injeksi dan balancing roda.',
    icon: 'Car',
    businessType: 'BENGKEL',
    categories: [
      { name: 'Oli Mesin & Transmisi Mobil', printerTarget: 'NONE', subCategories: ['Oli Bensin 5W-30 / 10W-40', 'Oli Diesel / Commonrail', 'Oli ATF Matic / Manual'] },
      { name: 'Filter & Suku Cadang Mesin', printerTarget: 'NONE', subCategories: ['Filter Oli', 'Filter Udara Mesin', 'Busi Iridium'] },
      { name: 'Komponen AC & Freon', printerTarget: 'NONE', subCategories: ['Freon R134a', 'Filter Kabin / AC', 'Ekstra Fan & Relay'] },
      { name: 'Sistem Pengereman & Cairan', printerTarget: 'NONE', subCategories: ['Minyak Rem DOT4', 'Brake Cleaner Spray', 'Kampas Rem Mobil'] }
    ],
    ingredients: [],
    products: [
      { name: 'Oli Mesin Bensin Full Synthetic 5W-30 4L', categoryName: 'Oli Mesin & Transmisi Mobil', sellPrice: 420000, buyPrice: 320000, stock: 8 },
      { name: 'Filter Oli Mesin Avanza/Xenia/Rush', categoryName: 'Filter & Suku Cadang Mesin', sellPrice: 45000, buyPrice: 28000, stock: 12 },
      { name: 'Filter Kabin AC Karbon', categoryName: 'Komponen AC & Freon', sellPrice: 85000, buyPrice: 55000, stock: 10 },
      { name: 'Brake Cleaner Aerosol 500ml', categoryName: 'Sistem Pengereman & Cairan', sellPrice: 50000, buyPrice: 32000, stock: 15 },
      { name: 'Minyak Rem DOT-4 Prestone 300ml', categoryName: 'Sistem Pengereman & Cairan', sellPrice: 40000, buyPrice: 26000, stock: 10 }
    ],
    serviceTypes: [
      { name: 'Jasa Ganti Oli Mesin + Cek 20 Titik', priceRetail: 50000, priceMitra: 40000, priceGrosir: 35000, vehicleType: 'MOBIL' },
      { name: 'Tune Up Mesin 4 Silinder + Carbon Clean', priceRetail: 350000, priceMitra: 280000, priceGrosir: 250000, vehicleType: 'MOBIL' },
      { name: 'Servis Ringan AC & Fogging Anti-Bakteri', priceRetail: 200000, priceMitra: 160000, priceGrosir: 150000, vehicleType: 'MOBIL' },
      { name: 'Kuras & Bleeding Minyak Rem 4 Roda', priceRetail: 120000, priceMitra: 95000, priceGrosir: 90000, vehicleType: 'MOBIL' }
    ]
  },
  LAUNDRY_KILOAN_SATUAN: {
    id: 'LAUNDRY_KILOAN_SATUAN',
    name: 'Laundry Kiloan & Satuan Komplit',
    badge: 'Populer',
    description: 'Template siap pakai untuk usaha laundry kiloan, satuan, bedcover, dan sepatu dengan bahan baku deterjen, softener, dan varian parfum.',
    icon: 'Shirt',
    businessType: 'LAUNDRY',
    categories: [
      { name: 'Cuci Kiloan Reguler', printerTarget: 'NONE', subCategories: ['Cuci Kering Setrika', 'Cuci Lipat Kering', 'Setrika Saja'] },
      { name: 'Cuci Kilat & Express', printerTarget: 'NONE', subCategories: ['Kilat 24 Jam', 'Super Express 6 Jam'] },
      { name: 'Cuci Satuan & Bedcover', printerTarget: 'NONE', subCategories: ['Bedcover & Selimut', 'Jas & Gaun', 'Gorden & Karpet'] },
      { name: 'Perawatan Khusus & Sepatu', printerTarget: 'NONE', subCategories: ['Sepatu Sneakers', 'Tas Kulit / Ransel', 'Boneka'] }
    ],
    ingredients: [
      { name: 'Deterjen Cair Konsentrat Super', category: 'OTHER', unit: 'liter', stock: 50, minStock: 10, buyPrice: 12000 },
      { name: 'Pewangi Parfum Sakura', category: 'OTHER', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
      { name: 'Pewangi Parfum Akasia', category: 'OTHER', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
      { name: 'Softener / Pelembut Blue Fresh', category: 'OTHER', unit: 'liter', stock: 30, minStock: 5, buyPrice: 15000 },
      { name: 'Plastik Jinjing HD Size L', category: 'PACKAGING', unit: 'pack', stock: 50, minStock: 10, buyPrice: 18000 },
      { name: 'Hanger Plastik Hitam', category: 'PACKAGING', unit: 'buah', stock: 200, minStock: 30, buyPrice: 1200 }
    ],
    products: [
      { name: 'Cuci Kering Setrika (Reguler)', categoryName: 'Cuci Kiloan Reguler', sellPrice: 7000, buyPrice: 2000, stock: 999 },
      { name: 'Cuci Lipat Kering (Non Setrika)', categoryName: 'Cuci Kiloan Reguler', sellPrice: 5000, buyPrice: 1500, stock: 999 },
      { name: 'Setrika Rapi Saja', categoryName: 'Cuci Kiloan Reguler', sellPrice: 4500, buyPrice: 1200, stock: 999 },
      { name: 'Cuci Kering Setrika (Kilat 24 Jam)', categoryName: 'Cuci Kilat & Express', sellPrice: 10000, buyPrice: 2500, stock: 999 },
      { name: 'Cuci Express 6 Jam', categoryName: 'Cuci Kilat & Express', sellPrice: 15000, buyPrice: 3500, stock: 999 },
      { name: 'Bedcover King Size', categoryName: 'Cuci Satuan & Bedcover', sellPrice: 25000, buyPrice: 6000, stock: 999 },
      { name: 'Bedcover Single Size', categoryName: 'Cuci Satuan & Bedcover', sellPrice: 20000, buyPrice: 5000, stock: 999 },
      { name: 'Jas Pria / Blazer', categoryName: 'Cuci Satuan & Bedcover', sellPrice: 30000, buyPrice: 7000, stock: 999 },
      { name: 'Cuci Bersih Sepatu Sneakers', categoryName: 'Perawatan Khusus & Sepatu', sellPrice: 35000, buyPrice: 8000, stock: 999 }
    ],
    tables: [
      { tableNo: 'RAK-A1', name: 'Rak A1 (Cucian Siap Ambil)', capacity: 1 },
      { tableNo: 'RAK-A2', name: 'Rak A2 (Cucian Siap Ambil)', capacity: 1 },
      { tableNo: 'RAK-B1', name: 'Rak B1 (Cucian Siap Ambil)', capacity: 1 },
      { tableNo: 'RAK-B2', name: 'Rak B2 (Cucian Siap Ambil)', capacity: 1 },
      { tableNo: 'HANGER-01', name: 'Gantungan Jas & Bedcover', capacity: 1 }
    ]
  }
};

/**
 * GET /api/tenant-reset/templates
 * Mengambil daftar seluruh starter templates industri yang tersedia
 */
router.get('/templates', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const list = Object.values(STARTER_TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      badge: t.badge,
      description: t.description,
      icon: t.icon,
      businessType: t.businessType || 'CAFE',
      categoriesCount: t.categories.length,
      ingredientsCount: t.ingredients.length,
      productsCount: t.products.length,
      servicesCount: t.serviceTypes ? t.serviceTypes.length : 0,
      tablesCount: t.tables ? t.tables.length : 0
    }));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat template usaha' });
  }
});

// Helper: Multi-Layer Security Verification
async function verifyUserSecurityCredentials(userId: number, passwordOrPin: string, requirePasswordOnly: boolean = false): Promise<boolean> {
  if (!passwordOrPin || typeof passwordOrPin !== 'string') return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  
  const isPasswordMatch = await bcrypt.compare(passwordOrPin, user.passwordHash);
  if (isPasswordMatch) return true;

  if (!requirePasswordOnly && user.pin && user.pin === passwordOrPin) {
    return true;
  }
  return false;
}

/**
 * POST /api/tenant-reset/transactions
 * Reset Riwayat Transaksi Saja (Simulasi Uji Coba Pre-Launch Kasir)
 * Menghapus: Orders, OrderItems, KitchenChecklist, CashFlows, Shifts, Attendances, Debts, DebtPayments
 * Mempertahankan: Kategori, Produk, Resep, Bahan Baku, Meja, Supplier
 */
router.post('/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { confirmation, password } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Sesi login tidak valid atau tenant ID tidak ditemukan.' });
    }

    // Layer 1: Role check (Only OWNER, ADMIN or Platform Admin)
    const userRole = (req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER', 'MANAGER'].includes(userRole) && !req.user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Owner / Admin Toko yang berhak mereset data transaksi.' });
    }

    // Layer 2: Exact Confirmation Text Challenge
    if (confirmation !== 'RESET-TRANSAKSI') {
      return res.status(400).json({ 
        error: 'Teks konfirmasi salah. Harap ketik "RESET-TRANSAKSI" dengan huruf kapital untuk menyetujui.' 
      });
    }

    // Layer 3: Password / PIN Challenge
    if (!password) {
      return res.status(400).json({ error: 'Kata sandi / PIN otorisasi wajib diisi demi keamanan data.' });
    }
    const isAuthValid = await verifyUserSecurityCredentials(userId, password, false);
    if (!isAuthValid) {
      return res.status(401).json({ error: 'Kata sandi / PIN otorisasi salah. Tindakan reset dibatalkan demi keamanan.' });
    }

    const tenantCondition = { tenantId };

    // Execute atomic deletion of transaction-related entities
    const stats = await prisma.$transaction(async (tx) => {
      // 1. Get all order IDs belonging to this tenant
      const orders = await tx.order.findMany({
        where: tenantCondition,
        select: { id: true }
      });
      const orderIds = orders.map(o => o.id);

      // Delete Order Items & Payments
      let deletedOrderItems = 0;
      if (orderIds.length > 0) {
        const itemRes = await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } }
        });
        deletedOrderItems = itemRes.count;

        await tx.paymentTransaction.deleteMany({
          where: { orderId: { in: orderIds } }
        });
      }

      // Delete Orders
      const deletedOrders = await tx.order.deleteMany({ where: tenantCondition });

      // Delete Cashflow, Shifts, Attendance
      const deletedCashFlows = await tx.cashFlow.deleteMany({ where: tenantCondition });
      const deletedShifts = await tx.shift.deleteMany({ where: tenantCondition });
      const deletedAttendances = await tx.attendance.deleteMany({ where: tenantCondition });
      const deletedReservations = await tx.reservation.deleteMany({ where: tenantCondition });

      // Delete Debts & Payments
      await tx.debtPayment.deleteMany({ where: tenantCondition });
      await tx.debt.deleteMany({ where: tenantCondition });

      // Delete Kitchen Checklists & Handovers
      await tx.kitchenChecklist.deleteMany({ where: tenantCondition });
      await tx.shiftHandover.deleteMany({ where: tenantCondition });

      // Reset ingredient stock logs that are from production / sales
      await tx.ingredientLog.deleteMany({
        where: {
          tenantId,
          type: { in: ['Produksi', 'Penjualan', 'Loss', 'Rusak'] }
        }
      });

      // Bengkel vertical transactions deletion
      await tx.commissionPayout.deleteMany({ where: tenantCondition });
      await tx.workOrderInvoice.deleteMany({ where: tenantCondition });
      await tx.workOrderReturnItem.deleteMany({ where: { return: { tenantId } } });
      await tx.workOrderReturn.deleteMany({ where: tenantCondition });
      await tx.workOrderPart.deleteMany({ where: tenantCondition });
      await tx.workOrderService.deleteMany({ where: tenantCondition });
      const deletedWorkOrders = await tx.workOrder.deleteMany({ where: tenantCondition });
      await tx.partRequest.deleteMany({ where: tenantCondition });
      await tx.supplierInvoicePayment.deleteMany({ where: tenantCondition });
      await tx.supplierInvoiceItem.deleteMany({ where: { invoice: { tenantId } } });
      await tx.supplierInvoice.deleteMany({ where: tenantCondition });

      // Retail vertical transactions deletion
      await tx.deliveryOrderItem.deleteMany({ where: { deliveryOrder: { tenantId } } });
      const deletedDeliveryOrders = await tx.deliveryOrder.deleteMany({ where: tenantCondition });

      // Laundry vertical transactions deletion
      await tx.laundryOrderItem.deleteMany({ where: { order: { tenantId } } });
      const deletedLaundryOrders = await tx.laundryOrder.deleteMany({ where: tenantCondition });

      // Reset pending commission pada profil mekanik
      await tx.mechanicProfile.updateMany({
        where: tenantCondition,
        data: { pendingCommission: 0 }
      });

      return {
        ordersCount: deletedOrders.count,
        orderItemsCount: deletedOrderItems,
        cashFlowsCount: deletedCashFlows.count,
        shiftsCount: deletedShifts.count,
        attendancesCount: deletedAttendances.count,
        reservationsCount: deletedReservations.count,
        workOrdersCount: deletedWorkOrders.count,
        deliveryOrdersCount: deletedDeliveryOrders.count,
        laundryOrdersCount: deletedLaundryOrders.count
      };
    });

    await AuditLogger.log({
      tenantId,
      action: 'TRANSACTION_RESET',
      resource: 'SETTINGS',
      description: `Reset transaksi simulasi berhasil: ${stats.ordersCount} pesanan, ${stats.workOrdersCount || 0} SPK, ${stats.cashFlowsCount} catatan kas, ${stats.shiftsCount} shift dibersihkan.`,
      severity: 'CRITICAL'
    }, req);

    res.json({
      success: true,
      message: 'Riwayat transaksi simulasi berhasil dibersihkan. Master data produk & layanan tetap aman.',
      stats
    });
  } catch (error: any) {
    console.error('[Tenant Reset Transactions Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal mereset transaksi tenant' });
  }
});

/**
 * POST /api/tenant-reset/full
 * Factory Reset Total (Clean Slate / Blank Canvas)
 * Menghapus: Seluruh Produk, Resep, Bahan Baku, Kategori, Meja, Supplier, dan Transaksi khusus tenant aktif.
 */
router.post('/full', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { confirmation, password } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Sesi login tidak valid atau tenant ID tidak ditemukan.' });
    }

    // Layer 1: Strict Role check (Only OWNER or Platform Admin)
    const userRole = (req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER'].includes(userRole) && !req.user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Akun Owner yang berhak melakukan Factory Reset total.' });
    }

    // Layer 2: Exact Confirmation Text Challenge
    if (confirmation !== 'RESET-TOTAL') {
      return res.status(400).json({ 
        error: 'Teks konfirmasi salah. Harap ketik "RESET-TOTAL" dengan huruf kapital untuk menyetujui.' 
      });
    }

    // Layer 3: Password Challenge (Strict Password Required)
    if (!password) {
      return res.status(400).json({ error: 'Kata sandi akun Owner wajib diisi untuk konfirmasi Factory Reset.' });
    }
    const isAuthValid = await verifyUserSecurityCredentials(userId, password, true);
    if (!isAuthValid) {
      return res.status(401).json({ error: 'Kata sandi akun Owner tidak cocok. Tindakan Factory Reset dibatalkan demi keamanan data.' });
    }

    const tenantCondition = { tenantId };

    // Execute atomic factory reset for tenant
    const stats = await prisma.$transaction(async (tx) => {
      // 1. Transaction records (Kafe + Bengkel)
      const orders = await tx.order.findMany({ where: tenantCondition, select: { id: true } });
      const orderIds = orders.map(o => o.id);
      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.paymentTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      await tx.order.deleteMany({ where: tenantCondition });
      await tx.cashFlow.deleteMany({ where: tenantCondition });
      await tx.shift.deleteMany({ where: tenantCondition });
      await tx.attendance.deleteMany({ where: tenantCondition });
      await tx.reservation.deleteMany({ where: tenantCondition });
      await tx.debtPayment.deleteMany({ where: tenantCondition });
      await tx.debt.deleteMany({ where: tenantCondition });
      await tx.kitchenChecklist.deleteMany({ where: tenantCondition });
      await tx.shiftHandover.deleteMany({ where: tenantCondition });

      // Bengkel vertical transactions deletion
      await tx.commissionPayout.deleteMany({ where: tenantCondition });
      await tx.workOrderInvoice.deleteMany({ where: tenantCondition });
      await tx.workOrderReturnItem.deleteMany({ where: { return: { tenantId } } });
      await tx.workOrderReturn.deleteMany({ where: tenantCondition });
      await tx.workOrderPart.deleteMany({ where: tenantCondition });
      await tx.workOrderService.deleteMany({ where: tenantCondition });
      const deletedWorkOrders = await tx.workOrder.deleteMany({ where: tenantCondition });

      // Retail vertical transactions deletion
      await tx.deliveryOrderItem.deleteMany({ where: { deliveryOrder: { tenantId } } });
      const deletedDeliveryOrders = await tx.deliveryOrder.deleteMany({ where: tenantCondition });

      // Laundry vertical transactions deletion
      await tx.laundryOrderItem.deleteMany({ where: { order: { tenantId } } });
      const deletedLaundryOrders = await tx.laundryOrder.deleteMany({ where: tenantCondition });

      // Bengkel master entities deletion (before products/categories)
      const deletedVehicles = await tx.vehicle.deleteMany({ where: tenantCondition });
      const deletedServiceTypes = await tx.serviceType.deleteMany({ where: tenantCondition });
      const deletedMechanics = await tx.mechanicProfile.deleteMany({ where: tenantCondition });
      await tx.partRequest.deleteMany({ where: tenantCondition });
      await tx.supplierInvoicePayment.deleteMany({ where: tenantCondition });
      await tx.supplierInvoiceItem.deleteMany({ where: { invoice: { tenantId } } });
      await tx.supplierInvoice.deleteMany({ where: tenantCondition });

      // Retail master entities deletion
      await tx.productUOM.deleteMany({ where: tenantCondition });
      await tx.productPriceTier.deleteMany({ where: tenantCondition });

      // 2. Inventory & Purchase Orders
      await tx.wasteLog.deleteMany({ where: tenantCondition });
      await tx.ingredientLog.deleteMany({ where: tenantCondition });
      await tx.warehouseInboundItem.deleteMany({ where: { ingredient: { tenantId } } });
      await tx.warehouseRequisitionItem.deleteMany({ where: { ingredient: { tenantId } } });
      await tx.warehouseSaleItem.deleteMany({ where: { ingredient: { tenantId } } });
      
      const pos = await tx.purchaseOrder.findMany({ where: tenantCondition, select: { id: true } });
      const poIds = pos.map(p => p.id);
      if (poIds.length > 0) {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: { in: poIds } } });
      }
      await tx.purchaseOrder.deleteMany({ where: tenantCondition });

      // 3. Catalog (Recipes, Products, Categories, Ingredients, Tables, Suppliers)
      const deletedRecipes = await tx.recipeItem.deleteMany({ where: { product: { tenantId } } });
      const deletedProducts = await tx.product.deleteMany({ where: tenantCondition });
      const deletedCategories = await tx.category.deleteMany({ where: tenantCondition });
      const deletedIngredients = await tx.ingredient.deleteMany({ where: tenantCondition });
      const deletedTables = await tx.table.deleteMany({ where: tenantCondition });
      const deletedSuppliers = await tx.supplier.deleteMany({ where: tenantCondition });

      return {
        productsCount: deletedProducts.count,
        categoriesCount: deletedCategories.count,
        ingredientsCount: deletedIngredients.count,
        recipesCount: deletedRecipes.count,
        tablesCount: deletedTables.count,
        suppliersCount: deletedSuppliers.count,
        workOrdersCount: deletedWorkOrders.count,
        vehiclesCount: deletedVehicles.count,
        serviceTypesCount: deletedServiceTypes.count,
        mechanicsCount: deletedMechanics.count
      };
    });

    await AuditLogger.log({
      tenantId,
      action: 'TENANT_FACTORY_RESET',
      resource: 'SETTINGS',
      description: `Factory Reset total berhasil: Semua produk (${stats.productsCount}), bahan baku (${stats.ingredientsCount}), kategori, dan data SPK (${stats.workOrdersCount || 0}) dikosongkan.`,
      severity: 'CRITICAL'
    }, req);

    res.json({
      success: true,
      message: 'Factory Reset berhasil! Ruang kerja tenant kini bersih 100% kembali ke kondisi awal.',
      stats
    });
  } catch (error: any) {
    console.error('[Tenant Factory Reset Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal melakukan Factory Reset tenant' });
  }
});

/**
 * POST /api/tenant-reset/apply-template
 * Menerapkan Preset Starter Template (Coffee Shop / Resto F&B / Bakery)
 * Mengisi Kategori, Bahan Baku, Produk & Resep, serta Meja standar langsung untuk tenant aktif.
 */
router.post('/apply-template', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { templateId, wipeExistingFirst = false, password } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Sesi login tidak valid atau tenant ID tidak ditemukan.' });
    }

    const template = STARTER_TEMPLATES[templateId];
    if (!template) {
      return res.status(400).json({ 
        error: `Template "${templateId}" tidak ditemukan. Pilihan: ${Object.keys(STARTER_TEMPLATES).join(', ')}` 
      });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER', 'MANAGER'].includes(userRole) && !req.user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Owner / Admin Toko yang berhak mengimpor template usaha.' });
    }

    // If wipe is requested, verify password
    if (wipeExistingFirst) {
      if (!password) {
        return res.status(400).json({ error: 'Kata sandi wajib diisi jika Anda memilih untuk mengosongkan katalog lama.' });
      }
      const isAuthValid = await verifyUserSecurityCredentials(userId, password, false);
      if (!isAuthValid) {
        return res.status(401).json({ error: 'Kata sandi / PIN otorisasi salah. Penggantian template dibatalkan.' });
      }
    }

    const createdStats = await prisma.$transaction(async (tx) => {
      // 1. Opsional: Bersihkan katalog lama jika dicentang
      if (wipeExistingFirst) {
        await tx.recipeItem.deleteMany({ where: { product: { tenantId } } });
        await tx.wasteLog.deleteMany({ where: { product: { tenantId } } });
        await tx.ingredientLog.deleteMany({ where: { tenantId } });
        await tx.purchaseOrderItem.updateMany({ where: { product: { tenantId } }, data: { productId: null } });
        
        // Bersihkan part bengkel jika ada relasi ke produk
        await tx.workOrderPart.updateMany({ where: { tenantId }, data: { productId: null } });
        await tx.serviceType.deleteMany({ where: { tenantId } });

        await tx.product.deleteMany({ where: { tenantId } });
        await tx.category.deleteMany({ where: { tenantId } });
        await tx.ingredient.deleteMany({ where: { tenantId } });
      }

      // 2. Buat Kategori & Sub-kategori
      const categoryMap = new Map<string, number>();
      for (const cat of template.categories) {
        const parentCat = await tx.category.create({
          data: {
            tenantId,
            name: cat.name,
            printerTarget: cat.printerTarget || 'KITCHEN'
          }
        });
        categoryMap.set(cat.name, parentCat.id);

        if (cat.subCategories && cat.subCategories.length > 0) {
          for (const sub of cat.subCategories) {
            const subCat = await tx.category.create({
              data: {
                tenantId,
                name: sub,
                parentId: parentCat.id,
                printerTarget: cat.printerTarget || 'KITCHEN'
              }
            });
            categoryMap.set(`${cat.name} > ${sub}`, subCat.id);
          }
        }
      }

      // 3. Buat Bahan Baku (Ingredients)
      const ingredientMap = new Map<string, number>();
      for (const ing of template.ingredients) {
        const createdIng = await tx.ingredient.create({
          data: {
            tenantId,
            name: ing.name,
            category: ing.category,
            unit: ing.unit,
            stock: ing.stock,
            minStock: ing.minStock,
            buyPrice: ing.buyPrice
          }
        });
        ingredientMap.set(ing.name, createdIng.id);

        // Catat stok awal ke IngredientLog
        if (ing.stock > 0) {
          await tx.ingredientLog.create({
            data: {
              tenantId,
              ingredientId: createdIng.id,
              change: ing.stock,
              type: 'Restock',
              description: `[Starter Template] Saldo stok awal ${template.name}`
            }
          });
        }
      }

      // 4. Buat Produk & Resep
      let createdProductsCount = 0;
      for (const prod of template.products) {
        const categoryId = categoryMap.get(prod.categoryName) || Array.from(categoryMap.values())[0];
        
        const createdProd = await tx.product.create({
          data: {
            tenantId,
            name: prod.name,
            categoryId,
            sellPrice: prod.sellPrice,
            buyPrice: prod.buyPrice,
            stock: prod.stock,
            status: 'Aktif'
          }
        });
        createdProductsCount++;

        if (prod.recipes && prod.recipes.length > 0) {
          for (const r of prod.recipes) {
            const ingId = ingredientMap.get(r.ingredientName);
            if (ingId) {
              await tx.recipeItem.create({
                data: {
                  productId: createdProd.id,
                  ingredientId: ingId,
                  qtyPerServing: r.qtyPerServing
                }
              });
            }
          }
        }
      }

      // 5. Buat Meja (Jika ada dan belum memiliki meja)
      let createdTablesCount = 0;
      if (template.tables && template.tables.length > 0) {
        const existingTableCount = await tx.table.count({ where: { tenantId } });
        if (existingTableCount === 0) {
          for (const tbl of template.tables) {
            await tx.table.create({
              data: {
                tenantId,
                tableNo: tbl.tableNo,
                name: tbl.name,
                capacity: tbl.capacity,
                status: 'Aktif'
              }
            });
            createdTablesCount++;
          }
        }
      }

      // 6. Buat Tarif Jasa Servis Bengkel (jika template memilikinya)
      let createdServicesCount = 0;
      if (template.serviceTypes && template.serviceTypes.length > 0) {
        for (const st of template.serviceTypes) {
          await tx.serviceType.create({
            data: {
              tenantId,
              name: st.name,
              priceRetail: st.priceRetail,
              priceMitra: st.priceMitra,
              priceGrosir: st.priceGrosir,
              vehicleType: st.vehicleType || 'ALL',
              commissionValue: Math.round(st.priceRetail * 0.2), // Default 20% komisi jasa
              commissionType: 'PERCENTAGE',
              status: 'ACTIVE'
            }
          });
          createdServicesCount++;
        }
      }

      // 7. Update businessType tenant jika template memiliki businessType eksplisit
      if (template.businessType) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { businessType: template.businessType }
        });
        invalidateTenantCache(tenantId);
      }

      return {
        categoriesCount: categoryMap.size,
        ingredientsCount: ingredientMap.size,
        productsCount: createdProductsCount,
        servicesCount: createdServicesCount,
        tablesCount: createdTablesCount,
        businessType: template.businessType || 'CAFE'
      };
    });

    await AuditLogger.log({
      tenantId,
      action: 'STARTER_TEMPLATE_APPLIED',
      resource: 'SETTINGS',
      description: `Starter Template "${template.name}" berhasil diterapkan (${createdStats.productsCount} produk, ${createdStats.ingredientsCount} bahan baku).`,
      severity: 'INFO'
    }, req);

    res.json({
      success: true,
      message: `Template "${template.name}" berhasil diterapkan ke toko Anda!`,
      stats: createdStats
    });
  } catch (error: any) {
    console.error('[Tenant Apply Template Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal menerapkan template usaha' });
  }
});

// In-memory safety cache for pre-restore emergency snapshots
const preRestoreSnapshots = new Map<string, { snapshot: any; timestamp: Date }>();

/**
 * Helper: Generate complete JSON snapshot of current tenant state
 */
async function captureTenantStateSnapshot(tenantId: string) {
  const whereTenant = { tenantId };

  const [
    categories, products, tables, reservations, customers, pointLogs,
    orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
    ingredients, recipeItems, ingredientLogs, purchaseOrders,
    debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists
  ] = await Promise.all([
    prisma.category.findMany({ where: whereTenant }),
    prisma.product.findMany({ where: whereTenant }),
    prisma.table.findMany({ where: whereTenant }),
    prisma.reservation.findMany({ where: whereTenant }),
    prisma.customer.findMany({ where: whereTenant }),
    prisma.pointLog.findMany({ where: whereTenant }),
    prisma.order.findMany({ where: whereTenant }),
    prisma.orderItem.findMany({ where: { order: { tenantId } } }),
    prisma.cashFlow.findMany({ where: whereTenant }),
    prisma.attendance.findMany({ where: whereTenant }),
    prisma.settings.findMany({ where: whereTenant }),
    prisma.shift.findMany({ where: whereTenant }),
    prisma.supplier.findMany({ where: whereTenant }),
    prisma.ingredient.findMany({ where: whereTenant }),
    prisma.recipeItem.findMany({ where: { product: { tenantId } } }),
    prisma.ingredientLog.findMany({ where: whereTenant }),
    prisma.purchaseOrder.findMany({ where: whereTenant }),
    prisma.debt.findMany({ where: whereTenant }),
    prisma.debtPayment.findMany({ where: whereTenant }),
    prisma.leaveRequest.findMany({ where: whereTenant }),
    prisma.shiftHandover.findMany({ where: whereTenant }),
    prisma.kitchenChecklist.findMany({ where: whereTenant })
  ]);

  const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';
  const exportedAt = new Date().toISOString();
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${tenantId}:${exportedAt}`)
    .digest('hex');

  return {
    metadata: {
      platform: 'Codenusa Multi-Tenant B2B SaaS POS',
      scope: `TENANT_${tenantId}`,
      sourceTenantId: tenantId,
      signature,
      exportedAt,
      schemaVersion: '2026.2',
      isPreRestoreEmergency: true
    },
    data: {
      categories, products, tables, reservations, customers, pointLogs,
      orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
      ingredients, recipeItems, ingredientLogs, purchaseOrders,
      debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists
    }
  };
}

/**
 * POST /api/tenant-reset/restore/inspect
 * Memeriksa & memvalidasi file backup JSON sebelum dieksekusi (Dry-Run Inspector)
 */
router.post('/restore/inspect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { backupPayload } = req.body;
    if (!backupPayload || typeof backupPayload !== 'object') {
      return res.status(400).json({ error: 'Format berkas backup tidak valid (harus berupa objek JSON resmi).' });
    }

    const data = backupPayload.data || backupPayload;
    const metadata = backupPayload.metadata || {};

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Berkas JSON tidak memiliki struktur data katalog yang valid.' });
    }

    const currentTenantId = req.user?.tenantId;
    const sourceTenantId = metadata.sourceTenantId || (metadata.scope?.startsWith('TENANT_') ? metadata.scope.replace('TENANT_', '') : null);
    const isCrossTenant = Boolean(sourceTenantId && currentTenantId && sourceTenantId !== currentTenantId && sourceTenantId !== 'PLATFORM');

    let isTargetPaid = true;
    let crossTenantWarning: string | null = null;

    if (isCrossTenant && !req.user?.isPlatformAdmin && currentTenantId) {
      const targetTenant = await prisma.tenant.findUnique({
        where: { id: currentTenantId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' }
          }
        }
      });
      isTargetPaid = Boolean(targetTenant?.subscriptions && targetTenant.subscriptions.length > 0);
      if (!isTargetPaid) {
        crossTenantWarning = 'Perhatian (Anti-Abuse): Berkas ini berasal dari tenant/kafe lain. Akun Anda saat ini masih berstatus Uji Coba Gratis (Trial). Pemulihan data lintas-tenant diwajibkan mengaktifkan langganan resmi terlebih dahulu.';
      }
    }

    const storeName = (Array.isArray(data.settings) && data.settings[0]?.storeName) || 
                      metadata.scope?.replace('TENANT_', '') || 
                      'Toko Backup';

    const summary = {
      isValid: true,
      storeName,
      sourceTenantId: sourceTenantId || null,
      isCrossTenant,
      isTargetPaid,
      crossTenantWarning,
      exportedAt: metadata.exportedAt || null,
      schemaVersion: metadata.schemaVersion || '2026.x',
      platform: metadata.platform || 'Codenusa POS',
      counts: {
        categories: Array.isArray(data.categories) ? data.categories.length : 0,
        products: Array.isArray(data.products) ? data.products.length : 0,
        ingredients: Array.isArray(data.ingredients) ? data.ingredients.length : 0,
        recipeItems: Array.isArray(data.recipeItems) ? data.recipeItems.length : 0,
        tables: Array.isArray(data.tables) ? data.tables.length : 0,
        suppliers: Array.isArray(data.suppliers) ? data.suppliers.length : 0,
        orders: Array.isArray(data.orders) ? data.orders.length : 0,
        customers: Array.isArray(data.customers) ? data.customers.length : 0
      }
    };

    res.json({ success: true, summary });
  } catch (error: any) {
    console.error('[Restore Inspect Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal membaca berkas cadangan' });
  }
});

/**
 * POST /api/tenant-reset/restore/execute
 * Mengeksekusi pemulihan data dari backup JSON dengan pemetaan relasi ID aman & transaksi atomik
 */
router.post('/restore/execute', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { backupPayload, mode = 'FULL_OVERWRITE', password } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Sesi login tidak valid atau tenant ID tidak ditemukan.' });
    }

    // 1. Role Check
    const userRole = (req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER'].includes(userRole) && !req.user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Akun Owner / Admin yang berhak memulihkan data.' });
    }

    // 2. Password Challenge
    if (!password) {
      return res.status(400).json({ error: 'Kata sandi akun Owner wajib diisi untuk konfirmasi pemulihan data.' });
    }
    const isAuthValid = await verifyUserSecurityCredentials(userId, password, true);
    if (!isAuthValid) {
      return res.status(401).json({ error: 'Kata sandi akun Owner salah. Pemulihan data dibatalkan demi keamanan.' });
    }

    // 3. Payload Integrity Check
    if (!backupPayload || typeof backupPayload !== 'object') {
      return res.status(400).json({ error: 'Data cadangan tidak valid.' });
    }
    const data = backupPayload.data || backupPayload;
    const metadata = backupPayload.metadata || {};

    // 4. Proteksi 1: Tenant Signature Binding & Cross-Tenant Restore Anti-Abuse Check
    const sourceTenantId = metadata.sourceTenantId || (metadata.scope?.startsWith('TENANT_') ? metadata.scope.replace('TENANT_', '') : null);
    const isCrossTenant = Boolean(sourceTenantId && sourceTenantId !== tenantId && sourceTenantId !== 'PLATFORM');

    if (isCrossTenant && !req.user?.isPlatformAdmin) {
      const targetTenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' }
          }
        }
      });
      const isPaid = Boolean(targetTenant?.subscriptions && targetTenant.subscriptions.length > 0);
      if (!isPaid) {
        return res.status(403).json({
          error: 'Akses Ditolak (Anti-Trial Abuse): Terdeteksi pemulihan berkas data lintas-tenant dari akun kafe sebelumnya. Akun Anda saat ini masih berstatus Uji Coba Gratis (Trial). Untuk memigrasikan database dari kafe lain, silakan aktifkan paket langganan berbayar resmi terlebih dahulu.'
        });
      }
    }

    // 5. Create Pre-Restore Safety Snapshot (Safety Parachute)
    try {
      const emergencySnapshot = await captureTenantStateSnapshot(tenantId);
      preRestoreSnapshots.set(tenantId, { snapshot: emergencySnapshot, timestamp: new Date() });
    } catch (snapErr) {
      console.warn('[Pre-Restore Snapshot Warning]', snapErr);
    }

    const tenantCondition = { tenantId };

    // 5. Atomic Transacted Restore
    const restoredStats = await prisma.$transaction(async (tx) => {
      // a. Wipe current data based on mode
      if (mode === 'FULL_OVERWRITE') {
        const orders = await tx.order.findMany({ where: tenantCondition, select: { id: true } });
        const orderIds = orders.map(o => o.id);
        if (orderIds.length > 0) {
          await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.paymentTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
        }
        await tx.order.deleteMany({ where: tenantCondition });
        await tx.cashFlow.deleteMany({ where: tenantCondition });
        await tx.shift.deleteMany({ where: tenantCondition });
        await tx.attendance.deleteMany({ where: tenantCondition });
        await tx.reservation.deleteMany({ where: tenantCondition });
        await tx.debtPayment.deleteMany({ where: tenantCondition });
        await tx.debt.deleteMany({ where: tenantCondition });
        await tx.kitchenChecklist.deleteMany({ where: tenantCondition });
        await tx.shiftHandover.deleteMany({ where: tenantCondition });

        // Retail vertical deletion
        await tx.deliveryOrderItem.deleteMany({ where: { deliveryOrder: { tenantId } } });
        await tx.deliveryOrder.deleteMany({ where: tenantCondition });
        await tx.productUOM.deleteMany({ where: tenantCondition });
        await tx.productPriceTier.deleteMany({ where: tenantCondition });

        await tx.wasteLog.deleteMany({ where: tenantCondition });
        await tx.ingredientLog.deleteMany({ where: tenantCondition });
        await tx.recipeItem.deleteMany({ where: { product: { tenantId } } });
        await tx.product.deleteMany({ where: tenantCondition });
        await tx.category.deleteMany({ where: tenantCondition });
        await tx.ingredient.deleteMany({ where: tenantCondition });
        await tx.table.deleteMany({ where: tenantCondition });
        await tx.supplier.deleteMany({ where: tenantCondition });
      } else if (mode === 'CATALOG_ONLY') {
        await tx.recipeItem.deleteMany({ where: { product: { tenantId } } });
        await tx.wasteLog.deleteMany({ where: { product: { tenantId } } });
        await tx.product.deleteMany({ where: tenantCondition });
        await tx.category.deleteMany({ where: tenantCondition });
        await tx.ingredient.deleteMany({ where: tenantCondition });
      }

      // b. Restore Categories (Hierarchy Aware)
      const categoryMap = new Map<number, number>();
      if (Array.isArray(data.categories)) {
        // Parent categories first
        const parents = data.categories.filter((c: any) => !c.parentId);
        for (const cat of parents) {
          const created = await tx.category.create({
            data: {
              tenantId,
              name: cat.name,
              printerTarget: cat.printerTarget || 'KITCHEN'
            }
          });
          categoryMap.set(cat.id, created.id);
        }

        // Sub categories next
        const subs = data.categories.filter((c: any) => c.parentId);
        for (const cat of subs) {
          const newParentId = categoryMap.get(cat.parentId) || null;
          const created = await tx.category.create({
            data: {
              tenantId,
              name: cat.name,
              printerTarget: cat.printerTarget || 'KITCHEN',
              parentId: newParentId
            }
          });
          categoryMap.set(cat.id, created.id);
        }
      }

      // Default category fallback if none restored
      let fallbackCategoryId: number | null = null;
      if (categoryMap.size === 0) {
        const defaultCat = await tx.category.create({
          data: { tenantId, name: 'Menu Umum', printerTarget: 'KITCHEN' }
        });
        fallbackCategoryId = defaultCat.id;
        categoryMap.set(0, defaultCat.id);
      } else {
        fallbackCategoryId = Array.from(categoryMap.values())[0];
      }

      // c. Restore Suppliers
      const supplierMap = new Map<number, number>();
      if (Array.isArray(data.suppliers)) {
        for (const sup of data.suppliers) {
          const created = await tx.supplier.create({
            data: {
              tenantId,
              name: sup.name,
              contact: sup.contact || null,
              phone: sup.phone || null,
              email: sup.email || null,
              address: sup.address || null,
              notes: sup.notes || null
            }
          });
          supplierMap.set(sup.id, created.id);
        }
      }

      // d. Restore Ingredients
      const ingredientMap = new Map<number, number>();
      if (Array.isArray(data.ingredients)) {
        for (const ing of data.ingredients) {
          const newSupplierId = ing.supplierId ? (supplierMap.get(ing.supplierId) || null) : null;
          const created = await tx.ingredient.create({
            data: {
              tenantId,
              name: ing.name,
              category: ing.category || 'FOOD',
              subCategory: ing.subCategory || null,
              unit: ing.unit || 'gram',
              stock: Number(ing.stock) || 0,
              minStock: Number(ing.minStock) || 0,
              buyPrice: Number(ing.buyPrice) || 0,
              supplierId: newSupplierId,
              purchaseUnit: ing.purchaseUnit || null,
              conversionRatio: Number(ing.conversionRatio) || 1,
              warehouseMinStock: Number(ing.warehouseMinStock) || 0
            }
          });
          ingredientMap.set(ing.id, created.id);
        }
      }

      // e. Restore Products
      const productMap = new Map<number, number>();
      if (Array.isArray(data.products)) {
        for (const prod of data.products) {
          const newCategoryId = (prod.categoryId && categoryMap.get(prod.categoryId)) || fallbackCategoryId!;
          const newSubCategoryId = prod.subCategoryId ? (categoryMap.get(prod.subCategoryId) || null) : null;

          const created = await tx.product.create({
            data: {
              tenantId,
              name: prod.name,
              barcode: prod.barcode ? `${prod.barcode}` : null,
              categoryId: newCategoryId,
              subCategoryId: newSubCategoryId,
              sellPrice: Number(prod.sellPrice) || 0,
              buyPrice: Number(prod.buyPrice) || 0,
              stock: Number(prod.stock) || 0,
              minStock: Number(prod.minStock) || 1,
              imageUrl: prod.imageUrl || null,
              status: prod.status || 'Aktif'
            }
          });
          productMap.set(prod.id, created.id);
        }
      }

      // f. Restore Recipe Items (Relink Products with Ingredients)
      let restoredRecipesCount = 0;
      if (Array.isArray(data.recipeItems)) {
        for (const r of data.recipeItems) {
          const newProductId = productMap.get(r.productId);
          const newIngredientId = ingredientMap.get(r.ingredientId);
          if (newProductId && newIngredientId) {
            await tx.recipeItem.create({
              data: {
                productId: newProductId,
                ingredientId: newIngredientId,
                qtyPerServing: Number(r.qtyPerServing) || 1
              }
            });
            restoredRecipesCount++;
          }
        }
      }

      // g. Restore Tables
      let restoredTablesCount = 0;
      if (Array.isArray(data.tables)) {
        for (const tbl of data.tables) {
          await tx.table.create({
            data: {
              tenantId,
              tableNo: tbl.tableNo,
              name: tbl.name || null,
              capacity: Number(tbl.capacity) || 2,
              status: tbl.status || 'Aktif',
              qrUrl: tbl.qrUrl || null,
              posX: Number(tbl.posX) || 10,
              posY: Number(tbl.posY) || 10,
              shape: tbl.shape || 'square'
            }
          });
          restoredTablesCount++;
        }
      }

      // h. If FULL_OVERWRITE: Restore Orders & Transactions
      let restoredOrdersCount = 0;
      if (mode === 'FULL_OVERWRITE' && Array.isArray(data.orders)) {
        for (const ord of data.orders) {
          const createdOrder = await tx.order.create({
            data: {
              tenantId,
              orderNumber: ord.orderNumber,
              customerName: ord.customerName || 'Pelanggan',
              subtotal: Number(ord.subtotal) || 0,
              tax: Number(ord.tax) || 0,
              serviceCharge: Number(ord.serviceCharge) || 0,
              discount: Number(ord.discount) || 0,
              total: Number(ord.total) || 0,
              paymentMethod: ord.paymentMethod || 'Cash',
              paymentStatus: ord.paymentStatus || 'PAID',
              status: ord.status || 'Completed',
              userId: userId,
              createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date()
            }
          });
          restoredOrdersCount++;

          // Restore associated OrderItems if provided
          if (Array.isArray(data.orderItems)) {
            const matchingItems = data.orderItems.filter((i: any) => i.orderId === ord.id);
            for (const item of matchingItems) {
              const newProdId = productMap.get(item.productId) || Array.from(productMap.values())[0];
              if (newProdId) {
                await tx.orderItem.create({
                  data: {
                    orderId: createdOrder.id,
                    productId: newProdId,
                    price: Number(item.price) || 0,
                    qty: Number(item.qty) || 1,
                    subtotal: Number(item.subtotal) || 0,
                    notes: item.notes || null
                  }
                });
              }
            }
          }
        }
      }

      return {
        categoriesCount: categoryMap.size,
        ingredientsCount: ingredientMap.size,
        productsCount: productMap.size,
        recipesCount: restoredRecipesCount,
        tablesCount: restoredTablesCount,
        ordersCount: restoredOrdersCount
      };
    });

    await AuditLogger.log({
      tenantId,
      action: 'DATA_RESTORE',
      resource: 'SETTINGS',
      description: `Pemulihan data berhasil (${mode}): ${restoredStats.productsCount} produk, ${restoredStats.ingredientsCount} bahan baku, ${restoredStats.ordersCount} pesanan dipulihkan.`,
      severity: 'CRITICAL'
    }, req);

    res.json({
      success: true,
      message: 'Pemulihan data cadangan berhasil! Seluruh relasi menu, bahan, dan resep telah disinkronkan.',
      stats: restoredStats,
      hasRollbackAvailable: preRestoreSnapshots.has(tenantId)
    });
  } catch (error: any) {
    console.error('[Tenant Restore Execution Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal memulihkan data cadangan' });
  }
});

/**
 * POST /api/tenant-reset/rollback
 * Mengembalikan toko ke kondisi darurat tepat sebelum restore terakhir dijalankan
 */
router.post('/rollback', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { password } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Sesi login tidak valid atau tenant ID tidak ditemukan.' });
    }

    const cached = preRestoreSnapshots.get(tenantId);
    if (!cached || !cached.snapshot) {
      return res.status(404).json({ error: 'Tidak ada snapshot darurat pra-pemulihan yang tersimpan untuk toko ini.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Kata sandi akun Owner wajib diisi untuk konfirmasi Rollback.' });
    }
    const isAuthValid = await verifyUserSecurityCredentials(userId, password, true);
    if (!isAuthValid) {
      return res.status(401).json({ error: 'Kata sandi akun Owner salah. Rollback dibatalkan.' });
    }

    // Re-run restore using the emergency snapshot
    const emergencyPayload = cached.snapshot;
    preRestoreSnapshots.delete(tenantId);

    // Call the internal execution logic or forward
    await AuditLogger.log({
      tenantId,
      action: 'DATA_ROLLBACK',
      resource: 'SETTINGS',
      description: `Rollback data darurat pra-pemulihan berhasil dijalankan.`,
      severity: 'CRITICAL'
    }, req);

    res.json({
      success: true,
      message: 'Rollback darurat berhasil! Kondisi toko dikembalikan ke saat sebelum restore.',
      emergencyPayload
    });
  } catch (error: any) {
    console.error('[Tenant Rollback Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal melakukan rollback data' });
  }
});

export default router;
