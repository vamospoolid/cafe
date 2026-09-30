/**
 * Pustaka Starter Pack Bahan Baku & Consumables Standar Industri
 * Untuk Onboarding Cepat & Setup Bahan Baku di CodePOS SaaS
 * 
 * Aturan Mutlak:
 * - stock: 0 (seluruh stok awal fisik disetel ke 0, tenant yang sesuaikan lewat opname/kulakan)
 * - warehouseStock: 0
 * - buyPrice: 0 (default nol, tenant yang tentukan harga modal beli riil mereka)
 */

export interface PresetIngredientItem {
  name: string;
  category: 'FOOD' | 'DRINK' | 'PACKAGING' | string;
  subCategory: string;
  unit: string; // 'gram' | 'ml' | 'butir' | 'pcs' | 'buah'
  stock: number; // ALWAYS 0
  warehouseStock: number; // ALWAYS 0
  minStock: number;
  buyPrice: number; // 0
  purchaseUnit: string;
  conversionRatio: number;
}

export interface IndustryStarterPack {
  id: 'CAFE' | 'BAKERY' | 'LAUNDRY';
  name: string;
  tagline: string;
  icon: string;
  badgeColor: string;
  items: PresetIngredientItem[];
}

export const STARTER_PACKS_BY_VERTICAL: Record<'CAFE' | 'BAKERY' | 'LAUNDRY', IndustryStarterPack> = {
  CAFE: {
    id: 'CAFE',
    name: 'Coffee Shop & Kafe',
    tagline: 'Preset bahan baku espresso based, latte, sirup artisan, powder, dan packaging cup',
    icon: '☕',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    items: [
      {
        name: 'Biji Kopi Espresso Blend',
        category: 'DRINK',
        subCategory: 'Biji Kopi (Beans)',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 2000,
        buyPrice: 0,
        purchaseUnit: 'Pack 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Susu UHT Fresh Milk',
        category: 'DRINK',
        subCategory: 'Susu & Dairy',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 5000,
        buyPrice: 0,
        purchaseUnit: 'Dus 12 Liter',
        conversionRatio: 12000
      },
      {
        name: 'Gula Aren Cair Organik',
        category: 'DRINK',
        subCategory: 'Sirup & Puree',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 1500,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Susu Evaporasi',
        category: 'DRINK',
        subCategory: 'Susu & Dairy',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 760,
        buyPrice: 0,
        purchaseUnit: 'Kaleng 380 ml',
        conversionRatio: 380
      },
      {
        name: 'Susu Kental Manis (SKM)',
        category: 'DRINK',
        subCategory: 'Susu & Dairy',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 1000,
        buyPrice: 0,
        purchaseUnit: 'Kaleng 370 gr',
        conversionRatio: 370
      },
      {
        name: 'Sirup Vanilla',
        category: 'DRINK',
        subCategory: 'Sirup & Puree',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 250,
        buyPrice: 0,
        purchaseUnit: 'Botol 750 ml',
        conversionRatio: 750
      },
      {
        name: 'Sirup Caramel',
        category: 'DRINK',
        subCategory: 'Sirup & Puree',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 250,
        buyPrice: 0,
        purchaseUnit: 'Botol 750 ml',
        conversionRatio: 750
      },
      {
        name: 'Sirup Hazelnut',
        category: 'DRINK',
        subCategory: 'Sirup & Puree',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 250,
        buyPrice: 0,
        purchaseUnit: 'Botol 750 ml',
        conversionRatio: 750
      },
      {
        name: 'Bubuk Matcha Premium',
        category: 'DRINK',
        subCategory: 'Teh & Powder',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 300,
        buyPrice: 0,
        purchaseUnit: 'Pack 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Bubuk Cokelat Murni (Dark Cocoa)',
        category: 'DRINK',
        subCategory: 'Teh & Powder',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 500,
        buyPrice: 0,
        purchaseUnit: 'Pack 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Teh Hitam / Earl Grey Tea Bag',
        category: 'DRINK',
        subCategory: 'Teh & Powder',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 20,
        buyPrice: 0,
        purchaseUnit: 'Box 50 Kantong',
        conversionRatio: 50
      },
      {
        name: 'Lemon Concentrate / Sari Lemon',
        category: 'DRINK',
        subCategory: 'Sirup & Puree',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 300,
        buyPrice: 0,
        purchaseUnit: 'Botol 1 Liter',
        conversionRatio: 1000
      },
      {
        name: 'Es Batu Kristal (Tube Ice)',
        category: 'DRINK',
        subCategory: 'Bahan Tambahan',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 5000,
        buyPrice: 0,
        purchaseUnit: 'Karung 10 Kg',
        conversionRatio: 10000
      },
      {
        name: 'Air Mineral Galon',
        category: 'DRINK',
        subCategory: 'Bahan Tambahan',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 19000,
        buyPrice: 0,
        purchaseUnit: 'Galon 19 Liter',
        conversionRatio: 19000
      },
      {
        name: 'Cup Plastik Injection 16oz',
        category: 'PACKAGING',
        subCategory: 'Cup & Tutup',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 150,
        buyPrice: 0,
        purchaseUnit: 'Dus 1.000 Pcs',
        conversionRatio: 1000
      },
      {
        name: 'Lid / Tutup Datar Cup 16oz',
        category: 'PACKAGING',
        subCategory: 'Cup & Tutup',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 150,
        buyPrice: 0,
        purchaseUnit: 'Dus 1.000 Pcs',
        conversionRatio: 1000
      },
      {
        name: 'Sedotan Higienis (Straw)',
        category: 'PACKAGING',
        subCategory: 'Sedotan & Sendok',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 100,
        buyPrice: 0,
        purchaseUnit: 'Pack 500 Pcs',
        conversionRatio: 500
      },
      {
        name: 'Kantong Plastik / Paperbag Takeaway',
        category: 'PACKAGING',
        subCategory: 'Paper Box & Kantong',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 50,
        buyPrice: 0,
        purchaseUnit: 'Pack 100 Pcs',
        conversionRatio: 100
      }
    ]
  },

  BAKERY: {
    id: 'BAKERY',
    name: 'Toko Kue, Roti & Pastry',
    tagline: 'Preset bahan baku tepung, butter, telur, ragi, cokelat, cream cheese, dan packaging kue',
    icon: '🎂',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    items: [
      {
        name: 'Tepung Terigu Protein Tinggi (Cakra Kembar)',
        category: 'FOOD',
        subCategory: 'Tepung & Mie',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 5000,
        buyPrice: 0,
        purchaseUnit: 'Karung 25 Kg',
        conversionRatio: 25000
      },
      {
        name: 'Tepung Terigu Protein Sedang (Segitiga Biru)',
        category: 'FOOD',
        subCategory: 'Tepung & Mie',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 5000,
        buyPrice: 0,
        purchaseUnit: 'Karung 25 Kg',
        conversionRatio: 25000
      },
      {
        name: 'Tepung Terigu Protein Rendah (Kunci Biru)',
        category: 'FOOD',
        subCategory: 'Tepung & Mie',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 3000,
        buyPrice: 0,
        purchaseUnit: 'Karung 25 Kg',
        conversionRatio: 25000
      },
      {
        name: 'Mentega / Pure Butter (Anchor / Wijsman)',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 1000,
        buyPrice: 0,
        purchaseUnit: 'Karton 5 Kg',
        conversionRatio: 5000
      },
      {
        name: 'Margarin Serbaguna (Blue Band / Palmia)',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 2000,
        buyPrice: 0,
        purchaseUnit: 'Dus 15 Kg',
        conversionRatio: 15000
      },
      {
        name: 'Telur Ayam Ras Segar',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 60,
        buyPrice: 0,
        purchaseUnit: 'Tray 30 Butir',
        conversionRatio: 30
      },
      {
        name: 'Gula Pasir Halus (Castor Sugar)',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 5000,
        buyPrice: 0,
        purchaseUnit: 'Karung 50 Kg',
        conversionRatio: 50000
      },
      {
        name: 'Gula Halus / Icing Sugar',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 2000,
        buyPrice: 0,
        purchaseUnit: 'Dus 10 Kg',
        conversionRatio: 10000
      },
      {
        name: 'Ragi Instan (Fermipan / Saf-Instant)',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 150,
        buyPrice: 0,
        purchaseUnit: 'Box 500 gr',
        conversionRatio: 500
      },
      {
        name: 'Baking Powder Double Acting',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 200,
        buyPrice: 0,
        purchaseUnit: 'Kaleng 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Susu Bubuk Full Cream (NZMP / Dancow)',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 500,
        buyPrice: 0,
        purchaseUnit: 'Pack 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Cokelat Batang Dark Compound (DCC)',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 1000,
        buyPrice: 0,
        purchaseUnit: 'Dus 4 x 1 Kg',
        conversionRatio: 4000
      },
      {
        name: 'Choco Chips Bake-Stable',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 500,
        buyPrice: 0,
        purchaseUnit: 'Pack 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Cream Cheese (Anchor / Philadelphia)',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 500,
        buyPrice: 0,
        purchaseUnit: 'Pack 1 Kg',
        conversionRatio: 1000
      },
      {
        name: 'Keju Cheddar Blok (Kraft / Prochiz)',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'gram',
        stock: 0,
        warehouseStock: 0,
        minStock: 500,
        buyPrice: 0,
        purchaseUnit: 'Blok 2 Kg',
        conversionRatio: 2000
      },
      {
        name: 'Whipping Cream Cair',
        category: 'FOOD',
        subCategory: 'Dairy & Telur',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 500,
        buyPrice: 0,
        purchaseUnit: 'Kotak 1 Liter',
        conversionRatio: 1000
      },
      {
        name: 'Ekstrak Vanila Murni',
        category: 'FOOD',
        subCategory: 'Bahan Kering & Rempah',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 100,
        buyPrice: 0,
        purchaseUnit: 'Botol 500 ml',
        conversionRatio: 500
      },
      {
        name: 'Alas & Kotak Kardus Cake 20x20 cm',
        category: 'PACKAGING',
        subCategory: 'Paper Box & Kantong',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 20,
        buyPrice: 0,
        purchaseUnit: 'Ikat 50 Pcs',
        conversionRatio: 50
      },
      {
        name: 'Mika Segitiga Kue Slice (Triangle Box)',
        category: 'PACKAGING',
        subCategory: 'Plastik & Seal',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 30,
        buyPrice: 0,
        purchaseUnit: 'Pack 100 Pcs',
        conversionRatio: 100
      }
    ]
  },

  LAUNDRY: {
    id: 'LAUNDRY',
    name: 'Jasa Laundry Kiloan & Satuan',
    tagline: 'Preset bahan kimia cuci, pelembut, parfum, penghilang noda, dan kemasan packing laundry',
    icon: '🧺',
    badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
    items: [
      {
        name: 'Deterjen Cair Rendah Busa (Front Load)',
        category: 'FOOD',
        subCategory: 'Kimia Cuci Utama',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 2000,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Pelembut Pakaian (Fabric Softener)',
        category: 'FOOD',
        subCategory: 'Kimia Bilas',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 2000,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Parfum Laundry Finishing Grade A (Akasia)',
        category: 'FOOD',
        subCategory: 'Parfum & Finishing',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 1500,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Parfum Laundry Finishing Grade A (Snappy)',
        category: 'FOOD',
        subCategory: 'Parfum & Finishing',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 1500,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Pencerah Warna & Antinoda (Oxygen Bleach)',
        category: 'FOOD',
        subCategory: 'Pengangkat Noda',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 1000,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Pemutih Pakaian Klorin (Chlorine Bleach)',
        category: 'FOOD',
        subCategory: 'Khusus Putih',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 1000,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Pembersih Noda Kerah & Minyak (Degreaser)',
        category: 'FOOD',
        subCategory: 'Spotting Agent',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 300,
        buyPrice: 0,
        purchaseUnit: 'Botol 1 Liter',
        conversionRatio: 1000
      },
      {
        name: 'Pembersih Noda Darah & Karat (Rust Remover)',
        category: 'FOOD',
        subCategory: 'Spotting Agent',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 150,
        buyPrice: 0,
        purchaseUnit: 'Botol 500 ml',
        conversionRatio: 500
      },
      {
        name: 'Pelicin & Pelindung Serat Pakaian Setrika',
        category: 'FOOD',
        subCategory: 'Pelicin Setrika',
        unit: 'ml',
        stock: 0,
        warehouseStock: 0,
        minStock: 1500,
        buyPrice: 0,
        purchaseUnit: 'Jerigen 5 Liter',
        conversionRatio: 5000
      },
      {
        name: 'Plastik Jinjing Laundry Kiloan Uk. 35x60',
        category: 'PACKAGING',
        subCategory: 'Plastik Packing',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 50,
        buyPrice: 0,
        purchaseUnit: 'Pack 100 Pcs',
        conversionRatio: 100
      },
      {
        name: 'Plastik Jinjing Laundry Kiloan Uk. 40x70',
        category: 'PACKAGING',
        subCategory: 'Plastik Packing',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 50,
        buyPrice: 0,
        purchaseUnit: 'Pack 100 Pcs',
        conversionRatio: 100
      },
      {
        name: 'Plastik Roll Mika Pembungkus Bed Cover',
        category: 'PACKAGING',
        subCategory: 'Kemasan Khusus',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 15,
        buyPrice: 0,
        purchaseUnit: 'Roll 50 Pcs',
        conversionRatio: 50
      },
      {
        name: 'Hanger Kawat Putih Lapis Plastik',
        category: 'PACKAGING',
        subCategory: 'Perlengkapan',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 50,
        buyPrice: 0,
        purchaseUnit: 'Ikat 100 Pcs',
        conversionRatio: 100
      },
      {
        name: 'Plastik Cover Pelindung Jas / Gaun (Dustbag)',
        category: 'PACKAGING',
        subCategory: 'Kemasan Khusus',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 20,
        buyPrice: 0,
        purchaseUnit: 'Pack 50 Pcs',
        conversionRatio: 50
      },
      {
        name: 'Pita Label Anti-Air & Tag Pin Nomor Nota',
        category: 'PACKAGING',
        subCategory: 'Perlengkapan',
        unit: 'buah',
        stock: 0,
        warehouseStock: 0,
        minStock: 200,
        buyPrice: 0,
        purchaseUnit: 'Box 1.000 Pcs',
        conversionRatio: 1000
      }
    ]
  }
};
