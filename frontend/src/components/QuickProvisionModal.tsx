import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  MapPin,
  Camera,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Building2,
  User,
  Key,
  Phone,
  Store,
  Compass,
  Check,
  Zap,
  Image as ImageIcon,
  Coffee,
  Utensils,
  Share2,
  Package,
  Wrench
} from 'lucide-react';
import { toast } from '../utils/alert';

export interface QuickProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface MenuItem {
  name: string;
  price: number;
  buyPrice?: number;
  imageUrl?: string;
  isGeneratingImg?: boolean;
}

interface MenuCategoryGroup {
  category: string;
  printerTarget?: 'BAR' | 'KITCHEN' | 'PASTRY' | 'NONE' | string;
  items: MenuItem[];
}

interface UploadedMenuImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  tag: string;
}

export const QuickProvisionModal: React.FC<QuickProvisionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // ── Step 1: Store & GMaps Data ──────────────────────────────────────────
  const [businessType, setBusinessType] = useState<'CAFE' | 'BENGKEL' | 'RETAIL'>('CAFE');
  const [gmapsUrl, setGmapsUrl] = useState<string>('');
  const [isResolvingGmaps, setIsResolvingGmaps] = useState<boolean>(false);
  const [tenantName, setTenantName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<number>(-6.200000);
  const [longitude, setLongitude] = useState<number>(106.816666);
  const [logoUrl, setLogoUrl] = useState<string>('');

  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
    suggestions?: string[];
  }>({ checking: false });

  // Realtime Slug Checker for Quick Provisioning
  useEffect(() => {
    if (!slug.trim()) {
      setSlugStatus({ checking: false });
      return;
    }
    const timer = setTimeout(async () => {
      setSlugStatus({ checking: true });
      try {
        const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(slug.trim())}`);
        const data = await res.json();
        if (data.available) {
          setSlugStatus({ checking: false, available: true, message: data.message });
        } else {
          setSlugStatus({
            checking: false,
            available: false,
            message: data.error || 'Subdomain sudah digunakan.',
            suggestions: data.suggestions
          });
        }
      } catch (err) {
        setSlugStatus({ checking: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [slug]);


  // ── Step 2 & 3: Menu & AI Vision ─────────────────────────────────────────
  const [menuSourceType, setMenuSourceType] = useState<'preset' | 'upload' | 'text'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<string>('coffee_shop');
  const [menuImages, setMenuImages] = useState<UploadedMenuImage[]>([]);
  const [rawTextMenu, setRawTextMenu] = useState<string>('');
  const [isExtractingMenu, setIsExtractingMenu] = useState<boolean>(false);
  const [menuCategories, setMenuCategories] = useState<MenuCategoryGroup[]>([]);
  const [autoGenerateAiImages, setAutoGenerateAiImages] = useState<boolean>(true);

  // ── Step 4: Plan & Owner Credentials ─────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState<string>('GROWTH');
  const [ownerName, setOwnerName] = useState<string>('');
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('Aman2026!');

  // ── Step 5: Provision Result ──────────────────────────────────────────────
  const [provisionResult, setProvisionResult] = useState<{
    tenantId: string;
    tenantName: string;
    slug: string;
    username: string;
    totalProductsCreated: number;
    loginLink: string;
    whatsappMessage: string;
    whatsappUrl: string | null;
  } | null>(null);
  const [copiedWA, setCopiedWA] = useState<boolean>(false);

  if (!isOpen) return null;

  // ─── Step 1 Actions: Resolve Google Maps Link ────────────────────────────
  const handleResolveGmaps = async () => {
    if (!gmapsUrl.trim()) {
      toast('Silakan tempelkan link Google Maps terlebih dahulu', 'warning');
      return;
    }

    setIsResolvingGmaps(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const res = await fetch('/api/platform-admin/quick-provision/resolve-gmaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: gmapsUrl.trim() })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengurai link Google Maps');

      const data = json.data;
      if (data.name) setTenantName(data.name);
      if (data.suggestedSlug) {
        setSlug(data.suggestedSlug);
        setUsername(`owner_${data.suggestedSlug}`);
      }
      if (data.address) setAddress(data.address);
      if (typeof data.latitude === 'number') setLatitude(data.latitude);
      if (typeof data.longitude === 'number') setLongitude(data.longitude);
      if (data.logoUrl) setLogoUrl(data.logoUrl);

      toast('✨ Data kafe & koordinat GPS berhasil ditarik dari Google Maps!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mengurai link', 'error');
    } finally {
      setIsResolvingGmaps(false);
    }
  };

  // ─── Step 2 Actions: AI Vision & Menu Parsing ────────────────────────────
  const handleExtractMenu = async () => {
    setIsExtractingMenu(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      let payload: any = {};

      if (menuSourceType === 'preset') {
        payload.presetTemplate = selectedPreset;
      } else if (menuSourceType === 'upload') {
        if (menuImages.length === 0) {
          toast(businessType === 'BENGKEL' ? 'Silakan upload minimal 1 foto lembar jasa/sparepart' : 'Silakan upload minimal 1 foto lembar menu', 'warning');
          setIsExtractingMenu(false);
          return;
        }
        payload.images = menuImages.map(img => ({
          base64: img.preview,
          mimeType: img.file.type || 'image/jpeg',
          name: img.tag || img.name
        }));
      } else if (menuSourceType === 'text') {
        payload.rawText = rawTextMenu;
      }
      payload.businessType = businessType;

      const res = await fetch('/api/platform-admin/quick-provision/ai-extract-menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengekstrak data');

      if (Array.isArray(json.data) && json.data.length > 0) {
        setMenuCategories(json.data);
        const totalItems = json.data.reduce((acc: number, c: any) => acc + (c.items?.length || 0), 0);
        toast(`✨ Berhasil mengekstrak ${totalItems} item katalog dari template/foto!`, 'success');
        setStep(3); // Go to review step
      } else {
        toast('Tidak ada item yang terdeteksi, silakan periksa format atau pilih template', 'warning');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal mengekstrak data', 'error');
    } finally {
      setIsExtractingMenu(false);
    }
  };

  const handleMultiImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    fileList.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const preview = reader.result as string;
        setMenuImages((prev) => {
          const currentCount = prev.length;
          const defaultTag = businessType === 'BENGKEL'
            ? (currentCount === 0 ? 'Daftar Jasa Servis' : currentCount === 1 ? 'Daftar Sparepart & Oli' : `Lembar Brosur ${currentCount + 1}`)
            : (currentCount === 0 ? 'Menu Minuman & Bar' : currentCount === 1 ? 'Makanan Berat & Snack' : `Lembar Menu ${currentCount + 1}`);
          return [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}-${idx}`,
              file,
              preview,
              name: file.name,
              tag: defaultTag
            }
          ];
        });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveMenuImage = (index: number) => {
    setMenuImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateImageTag = (index: number, newTag: string) => {
    setMenuImages(prev => prev.map((img, i) => i === index ? { ...img, tag: newTag } : img));
  };

  // ─── Step 3 Actions: Category & Item Management ─────────────────────────
  const handleUpdateCategoryName = (catIndex: number, newName: string) => {
    const next = [...menuCategories];
    next[catIndex].category = newName;
    setMenuCategories(next);
  };

  const handleUpdateCategoryPrinterTarget = (catIndex: number, target: 'BAR' | 'KITCHEN' | 'PASTRY' | 'NONE') => {
    const next = [...menuCategories];
    next[catIndex].printerTarget = target;
    setMenuCategories(next);
  };

  const handleDeleteCategory = (catIndex: number) => {
    const next = [...menuCategories];
    const catName = next[catIndex]?.category;
    next.splice(catIndex, 1);
    setMenuCategories(next);
    toast(`Kategori '${catName}' berhasil dihapus`, 'info');
  };

  const handleAddCategory = () => {
    setMenuCategories(prev => [
      ...prev,
      {
        category: businessType === 'BENGKEL' ? 'Kategori Jasa / Part Baru' : 'Kategori Baru',
        printerTarget: businessType === 'BENGKEL' ? 'NONE' : 'KITCHEN',
        items: []
      }
    ]);
  };

  // ─── Step 3 Actions: Regenerate AI Image per Item ────────────────────────
  const handleRegenerateItemImage = async (catIndex: number, itemIndex: number) => {
    const targetItem = menuCategories[catIndex]?.items[itemIndex];
    if (!targetItem) return;

    // Set item loading
    const updated = [...menuCategories];
    updated[catIndex].items[itemIndex].isGeneratingImg = true;
    setMenuCategories(updated);

    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const res = await fetch('/api/platform-admin/quick-provision/generate-product-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: targetItem.name,
          categoryName: menuCategories[catIndex].category,
          businessType
        })
      });

      const json = await res.json();
      if (res.ok && json.imageUrl) {
        const next = [...menuCategories];
        // Add cachebuster to force reload image
        next[catIndex].items[itemIndex].imageUrl = `${json.imageUrl}&seed=${Date.now()}`;
        next[catIndex].items[itemIndex].isGeneratingImg = false;
        setMenuCategories(next);
        toast(`Foto AI untuk '${targetItem.name}' diperbarui!`, 'success');
      }
    } catch (err) {
      const next = [...menuCategories];
      next[catIndex].items[itemIndex].isGeneratingImg = false;
      setMenuCategories(next);
    }
  };

  const handleUpdateItemPrice = (catIndex: number, itemIndex: number, newPrice: number) => {
    const next = [...menuCategories];
    next[catIndex].items[itemIndex].price = newPrice;
    setMenuCategories(next);
  };

  const handleUpdateItemName = (catIndex: number, itemIndex: number, newName: string) => {
    const next = [...menuCategories];
    next[catIndex].items[itemIndex].name = newName;
    setMenuCategories(next);
  };

  const handleDeleteItem = (catIndex: number, itemIndex: number) => {
    const next = [...menuCategories];
    next[catIndex].items.splice(itemIndex, 1);
    if (next[catIndex].items.length === 0) {
      next.splice(catIndex, 1);
    }
    setMenuCategories(next);
  };

  const handleAddItemToCategory = (catIndex: number) => {
    const next = [...menuCategories];
    const catName = next[catIndex].category;
    const catLower = catName.toLowerCase();
    const isDrink = catLower.includes('drink') || catLower.includes('kopi') || catLower.includes('coffee') || catLower.includes('tea') || catLower.includes('jus');

    let defaultItemName = '';
    let defaultPrice = 25000;
    let defaultBuyPrice = 9000;
    let promptText = '';

    if (businessType === 'BENGKEL') {
      defaultItemName = 'Jasa Servis / Part Baru';
      defaultPrice = 45000;
      defaultBuyPrice = 15000;
      promptText = `professional commercial automotive workshop photography of ${defaultItemName}, category ${catName}, automotive spare parts and tools, mechanical aesthetic, modern garage workbench background with tools, 4k ultra realistic, strictly no text, no watermark`;
    } else if (businessType === 'RETAIL') {
      defaultItemName = 'Produk Barang Dagang Baru';
      defaultPrice = 35000;
      defaultBuyPrice = 28000;
      promptText = `commercial retail studio product photography of ${defaultItemName}, consumer packaged goods, category ${catName}, neatly displayed on an illuminated supermarket shelf, clean packaging colors, ultra photorealistic 4k, strictly no text`;
    } else {
      defaultItemName = isDrink ? 'Minuman Baru' : 'Menu Spesial Baru';
      defaultPrice = isDrink ? 18000 : 25000;
      defaultBuyPrice = isDrink ? 6000 : 9000;
      promptText = isDrink 
        ? `commercial aesthetic cafe beverage photography of refreshing New Beverage, served in an elegant clear artisan glass tumbler with ice cubes and condensation water droplets, garnished with fresh mint sprig and citrus slice, small ceramic coaster on a light blonde oak wooden table with subtle vertical wood grain, a neatly folded beige textured linen napkin beside the glass, soft warm morning window daylight from 45-degree angle, 50mm f/1.8 macro lens, photorealistic 8k, strictly no text, no watermark, no logos, clean image`
        : `commercial gourmet culinary photography of delicious New Specialty, beautifully presented in an off-white artisanal matte ceramic plate with raised rim, elegant artistic sauce swirl drizzle on the plate, microgreens garnish, sitting on a light blonde oak wooden table with subtle vertical wood grain, a neatly folded beige textured linen napkin near the corner, soft directional natural morning window daylight from 45-degree angle, 50mm f/1.8 macro food photography, ultra photorealistic 8k, strictly no text, no watermark, no logos, clean image`;
    }

    next[catIndex].items.push({
      name: defaultItemName,
      price: defaultPrice,
      buyPrice: defaultBuyPrice,
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=512&height=512&nologo=true&enhance=true`
    });
    setMenuCategories(next);
  };

  // ─── Step 4 Actions: Execute Atomic Provisioning ─────────────────────────
  const handleExecuteProvisioning = async () => {
    if (!tenantName.trim() || !slug.trim() || !username.trim() || !password.trim()) {
      toast('Harap lengkapi Nama Bisnis, Slug, Username, dan Password', 'warning');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const res = await fetch('/api/platform-admin/quick-provision/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantName: tenantName.trim(),
          slug: slug.trim().toLowerCase(),
          businessType,
          ownerName: ownerName.trim() || tenantName.trim() + ' Owner',
          username: username.trim().toLowerCase(),
          password: password.trim(),
          whatsappPhone: whatsappPhone.trim(),
          planCode: selectedPlan,
          address: address.trim(),
          latitude,
          longitude,
          logoUrl: logoUrl.trim(),
          menuData: menuCategories
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal melakukan provisioning');

      setProvisionResult(json.data);
      toast(businessType === 'BENGKEL'
        ? '🎉 Bengkel Klien Berhasil Didaftarkan dan Siap Digunakan!'
        : (businessType === 'RETAIL'
          ? '🎉 Toko Grosir Klien Berhasil Didaftarkan dan Siap Digunakan!'
          : '🎉 Kafe Klien Berhasil Didaftarkan dan Siap Digunakan!'), 'success');
      setStep(5);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast(err.message || 'Gagal memproses akun', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWhatsAppMessage = () => {
    if (!provisionResult?.whatsappMessage) return;
    navigator.clipboard.writeText(provisionResult.whatsappMessage);
    setCopiedWA(true);
    toast('📋 Teks sambutan WhatsApp berhasil disalin!', 'success');
    setTimeout(() => setCopiedWA(false), 3000);
  };

  const handleGenerateRandomPass = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const prefix = businessType === 'BENGKEL' ? 'Bengkel' : 'Kafe';
    let randomSuffix = '';
    for (let i = 0; i < 4; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(`${prefix}${randomSuffix}!`);
  };

  const totalItemCount = menuCategories.reduce((acc, c) => acc + (c.items?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ─── MODAL HEADER & PROGRESS BAR (SOFT CLEAN SOLID HEADER) ─────────── */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  Fast Onboarding {businessType === 'BENGKEL' ? 'Bengkel' : 'Kafe'} Klien Baru
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-900/80 text-indigo-300 border border-indigo-700">
                    AI Auto-Provisioning
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Setup nama toko, logo, lokasi GPS absensi, dan puluhan {businessType === 'BENGKEL' ? 'jasa & suku cadang' : 'menu berfoto AI'} dalam 2 menit.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="grid grid-cols-5 gap-2 mt-5">
            {[
              { num: 1, label: 'Lokasi & Profil' },
              { num: 2, label: businessType === 'BENGKEL' ? 'Jasa & Part' : 'Sumber Menu' },
              { num: 3, label: businessType === 'BENGKEL' ? 'Review Katalog' : 'Foto AI & Review' },
              { num: 4, label: 'Paket & Akun' },
              { num: 5, label: 'Selesai & WA' }
            ].map((s) => (
              <div key={s.num} className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={step >= s.num ? 'text-indigo-300' : 'text-slate-500'}>
                    {s.num}. {s.label}
                  </span>
                  {step > s.num && <Check size={12} className="text-emerald-400" />}
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      step >= s.num ? 'bg-indigo-500' : 'bg-transparent'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── MODAL BODY VIEWPORT (SCROLLABLE) ────────────────────────────── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          
          {/* ══════════════════════════════════════════════════════════════════
              STEP 1: PILIH VERTIKAL & GOOGLE MAPS LINK & PROFIL TOKO
             ══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              {/* Vertical Selector Toggle (Soft Clean Solid) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Pilih Bidang Bisnis Tenant Klien
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => {
                      setBusinessType('CAFE');
                      setSelectedPreset('coffee_shop');
                      if (password.startsWith('Bengkel') || password.startsWith('Grosir')) {
                        setPassword('Kafe2026!');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                      businessType === 'CAFE'
                        ? 'bg-indigo-50/80 border-2 border-indigo-600 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        businessType === 'CAFE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Coffee size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">F&amp;B / Kafe &amp; Resto</h4>
                      <p className="text-[11px] text-slate-500">Menu Kuliner, Meja Makan, Kitchen Display (KDS)</p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setBusinessType('BENGKEL');
                      setSelectedPreset('bengkel_motor');
                      if (password.startsWith('Kafe') || password.startsWith('Grosir') || password === 'Aman2026!') {
                        setPassword('Bengkel2026!');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                      businessType === 'BENGKEL'
                        ? 'bg-amber-50/80 border-2 border-amber-600 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        businessType === 'BENGKEL' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Wrench size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Bengkel Motor &amp; Mobil</h4>
                      <p className="text-[11px] text-slate-500">Jasa Servis, Sparepart, Work Order &amp; Komisi Mekanik</p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setBusinessType('RETAIL');
                      setSelectedPreset('retail_grosir');
                      if (password.startsWith('Kafe') || password.startsWith('Bengkel') || password === 'Aman2026!') {
                        setPassword('Grosir2026!');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                      businessType === 'RETAIL'
                        ? 'bg-emerald-50/80 border-2 border-emerald-600 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        businessType === 'RETAIL' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Package size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Toko Grosir &amp; Retail</h4>
                      <p className="text-[11px] text-slate-500">Sembako, Dus/Karton, Barcode Laser &amp; Buku Bon</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hero GMaps Input Card (Soft Solid) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200/90 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Tempelkan Link Google Maps {businessType === 'BENGKEL' ? 'Bengkel / Toko' : 'Kafe'}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      Mencegah salah toko karena nama yang sama. Otomatis menarik nama, alamat, koordinat absensi, &amp; foto.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    placeholder="https://maps.app.goo.gl/... atau https://www.google.com/maps/place/..."
                    value={gmapsUrl}
                    onChange={(e) => setGmapsUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleResolveGmaps}
                    disabled={isResolvingGmaps || !gmapsUrl.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs disabled:opacity-50 shrink-0 active:scale-95"
                  >
                    {isResolvingGmaps ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Menganalisis GMaps...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Tarik Data Otomatis</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Form Input Terverifikasi */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                  Hasil Ekstraksi &amp; Konfigurasi Profil
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {businessType === 'BENGKEL' ? 'Nama Bengkel / Toko *' : 'Nama Bisnis / Kafe *'}
                    </label>
                    <input
                      type="text"
                      placeholder={businessType === 'BENGKEL' ? 'Contoh: Bengkel Motor Jaya Mandiri' : 'Contoh: Kopi Kenangan Kemang'}
                      value={tenantName}
                      onChange={(e) => {
                        setTenantName(e.target.value);
                        if (!slug) {
                          const autoSlug = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
                          setSlug(autoSlug);
                          setUsername(`owner_${autoSlug}`);
                        }
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Subdomain Portal (`.codenusa.id`) *
                      </label>
                      {slugStatus.checking && (
                        <span className="text-[10px] text-slate-400 font-medium animate-pulse flex items-center gap-1">
                          <RefreshCw size={10} className="animate-spin" /> Memeriksa...
                        </span>
                      )}
                      {!slugStatus.checking && slugStatus.available === true && (
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Check size={11} /> Tersedia
                        </span>
                      )}
                      {!slugStatus.checking && slugStatus.available === false && (
                        <span className="text-[10px] font-bold text-rose-700 flex items-center gap-0.5 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <X size={11} /> Terpakai
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="kopikenangan"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className={`flex-1 px-3.5 py-2 rounded-l-xl bg-slate-50 border border-r-0 text-xs font-mono font-bold focus:bg-white focus:outline-none ${
                          slugStatus.available === true
                            ? 'border-emerald-300 text-emerald-950 focus:border-emerald-500'
                            : slugStatus.available === false
                            ? 'border-rose-300 text-rose-950 focus:border-rose-500'
                            : 'border-slate-200 text-indigo-700 focus:border-indigo-500'
                        }`}
                      />
                      <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-xs font-bold text-slate-600">
                        .codenusa.id
                      </span>
                    </div>
                    {slugStatus.available === false && slugStatus.suggestions && slugStatus.suggestions.length > 0 && (
                      <div className="mt-1.5 text-[11px] bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <p className="font-bold text-amber-900 text-[10px] mb-1">Subdomain ini sudah ada. Pilih alternatif:</p>
                        <div className="flex flex-wrap gap-1">
                          {slugStatus.suggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => setSlug(sug)}
                              className="font-mono text-[10px] bg-white hover:bg-amber-100 text-indigo-700 font-bold px-2 py-0.5 rounded border border-amber-300 shadow-2xs transition-all cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Lengkap Toko</label>
                    <input
                      type="text"
                      placeholder="Jl. Kemang Raya No. 10, Jakarta Selatan"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Koordinat GPS Presensi (Lat, Lng)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Logo / Banner URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="https://... atau biarkan default"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                      />
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="w-9 h-9 rounded-xl object-cover border border-slate-300 shrink-0"
                          onError={() => setLogoUrl('')}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 2: SUMBER DAFTAR MENU / JASA & SPAREPART
             ══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Pilih Metode Input {businessType === 'BENGKEL' ? 'Katalog Jasa & Suku Cadang' : 'Daftar Menu'}
                </h3>
                <p className="text-xs text-slate-500">
                  {businessType === 'BENGKEL'
                    ? 'Bisa upload foto brosur/daftar tarif bengkel atau gunakan starter template otomotif 1-klik.'
                    : 'Bisa upload foto lembar menu fisik atau gunakan starter template 1-klik.'}
                </p>
              </div>

              {/* 3 Source Options Cards (Soft Solid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'preset',
                    title: 'Template 1-Klik',
                    desc: businessType === 'BENGKEL'
                      ? 'Pilihan jasa servis & suku cadang terpopuler (Bengkel Motor & Mobil)'
                      : 'Pilihan menu siap saji terpopuler (Kopi, Warmindo, Resto)',
                    icon: Zap,
                    badge: 'Paling Cepat'
                  },
                  {
                    id: 'upload',
                    title: businessType === 'BENGKEL' ? 'Foto Brosur / Nota' : 'Foto Buku Menu',
                    desc: businessType === 'BENGKEL'
                      ? 'Upload foto daftar tarif jasa / pricelist sparepart (AI Vision OCR)'
                      : 'Upload foto lembar menu / Canva (AI Vision OCR)',
                    icon: Camera,
                    badge: 'Akurasi Tinggi'
                  },
                  {
                    id: 'text',
                    title: 'Ketik Cepat / Struk',
                    desc: businessType === 'BENGKEL'
                      ? 'Paste daftar jasa & harga sparepart dari WhatsApp / Catatan'
                      : 'Paste daftar menu & harga dari WhatsApp / Catatan',
                    icon: Utensils,
                    badge: 'Fleksibel'
                  }
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = menuSourceType === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setMenuSourceType(opt.id as any)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-50/80 border-2 border-indigo-600 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSelected ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900">{opt.title}</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Sub-Form according to Selection */}
              {menuSourceType === 'preset' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    {businessType === 'BENGKEL' 
                      ? 'Pilih Paket Starter Katalog Bengkel' 
                      : (businessType === 'RETAIL' ? 'Pilih Paket Starter Katalog Toko Grosir' : 'Pilih Paket Preset Menu Kafe')}
                  </h4>
                  <div className={`grid grid-cols-1 ${businessType === 'BENGKEL' ? 'sm:grid-cols-2' : (businessType === 'RETAIL' ? 'sm:grid-cols-1 sm:max-w-md' : 'sm:grid-cols-3')} gap-3`}>
                    {(businessType === 'BENGKEL'
                      ? [
                          {
                            id: 'bengkel_motor',
                            name: 'Bengkel Motor Umum & Injeksi',
                            count: '14 Jasa & Part',
                            sample: 'Tune Up, Servis CVT, Ganti Oli MPX2/Yamalube, Kampas Rem, Roller, V-Belt'
                          },
                          {
                            id: 'bengkel_mobil',
                            name: 'Bengkel Mobil & Servis AC',
                            count: '13 Jasa & Part',
                            sample: 'Tune Up 4 Silinder, Servis Rem, Flushing, Oli Shell/Mobil1, Filter Oli/AC'
                          }
                        ]
                      : (businessType === 'RETAIL'
                        ? [
                            {
                              id: 'retail_grosir',
                              name: 'Toko Grosir Sembako & Minimarket',
                              count: '20 Produk Lengkap',
                              sample: 'Minyak Goreng 2L, Beras 5kg, Indomie Karton, Aqua Dus, Rinso, Sampoerna Slop'
                            }
                          ]
                        : [
                          {
                            id: 'coffee_shop',
                            name: 'Modern Coffee Shop',
                            count: '15 Menu',
                            sample: 'Espresso, Latte, Croissant, Fries, Rice Bowl'
                          },
                          {
                            id: 'warmindo',
                            name: 'Warmindo & Eatery',
                            count: '10 Menu',
                            sample: 'Indomie Kuah/Goreng, Nasi Telur, Es Teh Jumbo'
                          },
                          {
                            id: 'resto_nusantara',
                            name: 'Resto & Masakan Nusantara',
                            count: '10 Menu',
                            sample: 'Ayam Bakar, Sop Buntut, Es Cendol Durian'
                          }
                        ])
                    ).map((tpl) => (
                      <label
                        key={tpl.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                          selectedPreset === tpl.id
                            ? 'bg-indigo-50/70 border-2 border-indigo-600'
                            : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-900">{tpl.name}</span>
                            <input
                              type="radio"
                              name="preset"
                              checked={selectedPreset === tpl.id}
                              onChange={() => setSelectedPreset(tpl.id)}
                              className="text-indigo-600"
                            />
                          </div>
                          <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                            {tpl.count}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-2 italic">Contoh: {tpl.sample}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {menuSourceType === 'upload' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span>Upload Foto Lembar Menu</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                          Multi-Page Supported
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Anda bisa mengunggah lembar minuman &amp; makanan secara terpisah. Gemini Vision akan menyatukan seluruh menu secara komprehensif.
                      </p>
                    </div>

                    {menuImages.length > 0 && (
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                        {menuImages.length} Lembar Terpilih
                      </span>
                    )}
                  </div>

                  {/* Multi-File Upload Dropzone */}
                  <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 text-center bg-indigo-50/20 transition-all">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultiImageUpload}
                      className="hidden"
                      id="menu-photo-upload"
                    />
                    <label htmlFor="menu-photo-upload" className="cursor-pointer block space-y-2">
                      <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
                        <Camera size={24} />
                      </div>
                      <div className="font-bold text-xs text-slate-800">
                        Klik untuk upload foto lembar menu (Bisa pilih 2 atau lebih foto sekaligus)
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Contoh: Foto 1 Lembar Minuman + Foto 2 Lembar Makanan Berat (JPG, PNG, WEBP)
                      </p>
                    </label>
                  </div>

                  {/* Uploaded Menu Sheets Grid */}
                  {menuImages.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Daftar Lembar Menu yang Diunggah ({menuImages.length})</span>
                        <label
                          htmlFor="menu-photo-upload"
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} /> Tambah Lembar Lagi
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {menuImages.map((img, idx) => (
                          <div
                            key={img.id}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 relative group hover:border-indigo-300 transition-all"
                          >
                            <img
                              src={img.preview}
                              alt={`Menu Page ${idx + 1}`}
                              className="w-14 h-14 object-cover rounded-lg border border-slate-300 shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <input
                                type="text"
                                value={img.tag}
                                onChange={(e) => handleUpdateImageTag(idx, e.target.value)}
                                className="w-full px-2 py-0.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                placeholder={`Lembar ${idx + 1}`}
                              />
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span>{(img.file.size / 1024).toFixed(0)} KB</span>
                                <span>•</span>
                                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                  <Check size={10} /> Siap OCR
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMenuImage(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus lembar ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {menuSourceType === 'text' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Ketik atau Paste Daftar Menu &amp; Harga
                  </h4>
                  <textarea
                    rows={6}
                    placeholder={`# Kopi\nKopi Susu Aren - 18k\nAmericano - 16.000\n\n# Makanan\nFrench Fries - 18rb\nNasi Goreng - 25000`}
                    value={rawTextMenu}
                    onChange={(e) => setRawTextMenu(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleExtractMenu}
                disabled={isExtractingMenu || (menuSourceType === 'upload' && menuImages.length === 0)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs disabled:opacity-50 active:scale-95"
              >
                {isExtractingMenu ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Menganalisis data katalog...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Ekstrak &amp; Lanjutkan ke Review</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 3: REVIEW KATALOG & AI IMAGE STUDIO
             ══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200/90 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <ImageIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        {businessType === 'BENGKEL' ? 'Studio Gambar & Review Katalog Bengkel' : 'Studio Foto AI & Review Menu'}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200 text-indigo-900">
                          {totalItemCount} {businessType === 'BENGKEL' ? 'Jasa & Part' : 'Produk'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        {businessType === 'BENGKEL'
                          ? 'Atur nama kategori, harga jasa & sparepart, dan gambar AI sebelum aktivasi.'
                          : 'Atur nama kategori, stasiun dapur (KDS), harga, dan foto produk sebelum aktivasi.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Tambah Kategori
                    </button>

                    <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 bg-white px-3.5 py-1.5 rounded-xl border border-indigo-200 shadow-2xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGenerateAiImages}
                        onChange={(e) => setAutoGenerateAiImages(e.target.checked)}
                        className="text-indigo-600 rounded"
                      />
                      <span>Sematkan Foto AI</span>
                    </label>
                  </div>
                </div>

                {/* Aesthetic Signature Notice */}
                <div className="bg-white/80 rounded-xl p-2.5 border border-indigo-200/60 flex items-center gap-2 text-[11px] text-slate-700">
                  <Sparkles size={14} className="text-amber-500 shrink-0" />
                  <span>
                    {businessType === 'BENGKEL' ? (
                      <>
                        <strong className="font-bold text-amber-900">Automotive Workshop Aesthetic:</strong> Seluruh foto item suku cadang digenerate dengan nuansa studio mekanik profesional, bersih, pencahayaan presisi, dan bebas watermark.
                      </>
                    ) : (
                      <>
                        <strong className="font-bold text-indigo-900">Kayu Sutera Signature Aesthetic:</strong> Seluruh foto produk digenerate dengan latar meja kayu blonde oak alami, piring keramik matte raised-rim, garnish segar, dan bebas dari teks/watermark.
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Categories & Product List Editor */}
              <div className="space-y-4">
                {menuCategories.map((catGroup, cIdx) => {
                  const currentStation = (catGroup.printerTarget || 'KITCHEN').toUpperCase();

                  return (
                    <div
                      key={cIdx}
                      className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5"
                    >
                      {/* Category Header with Station Target Selector */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5 flex-1">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${businessType === 'BENGKEL' ? 'bg-amber-600' : 'bg-indigo-600'}`} />
                          <input
                            type="text"
                            value={catGroup.category}
                            onChange={(e) => handleUpdateCategoryName(cIdx, e.target.value)}
                            className="font-bold text-xs text-slate-900 uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                            placeholder="Nama Kategori"
                          />
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {catGroup.items.length} Item
                          </span>
                        </div>

                        {/* Station Target Badges + Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {/* Station Target KDS Selector (Hanya Kafe) */}
                          {businessType === 'BENGKEL' ? (
                            <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-xl border border-amber-200 text-[10px] font-bold">
                              <span className="text-amber-800 px-1 text-[9px] uppercase">Rute Tiket:</span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-600 text-white shadow-2xs">
                                🔧 STALL BENGKEL
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                              <span className="text-slate-400 px-1 text-[9px] uppercase">KDS / Printer:</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCategoryPrinterTarget(cIdx, 'BAR')}
                                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                  currentStation === 'BAR'
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                ☕ BAR
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateCategoryPrinterTarget(cIdx, 'KITCHEN')}
                                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                  currentStation === 'KITCHEN'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                🍳 KITCHEN
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateCategoryPrinterTarget(cIdx, 'PASTRY')}
                                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                  currentStation === 'PASTRY'
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                🥐 PASTRY
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAddItemToCategory(cIdx)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus size={12} /> Tambah Item
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cIdx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Kategori"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Products Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catGroup.items.map((item, iIdx) => (
                          <div
                            key={iIdx}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 group hover:border-indigo-300 hover:bg-white transition-all"
                          >
                            {/* Image Thumbnail with Regenerate Button */}
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  {businessType === 'BENGKEL' ? <Wrench size={18} /> : <Coffee size={18} />}
                                </div>
                              )}

                              {item.isGeneratingImg && (
                                <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center text-white">
                                  <RefreshCw size={14} className="animate-spin" />
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRegenerateItemImage(cIdx, iIdx)}
                                title="Regenerate Foto AI"
                                className="absolute bottom-0 right-0 p-1 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-tl-lg text-[9px] transition-colors cursor-pointer"
                              >
                                <RefreshCw size={10} />
                              </button>
                            </div>

                            {/* Editable Name & Price */}
                            <div className="flex-1 space-y-1">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItemName(cIdx, iIdx, e.target.value)}
                                className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                                placeholder={businessType === 'BENGKEL' ? 'Nama Jasa / Sparepart' : 'Nama Produk'}
                              />
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-400">Rp</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => handleUpdateItemPrice(cIdx, iIdx, parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(cIdx, iIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Produk"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 4: PAKET SAAS & KREDENSIAL OWNER
             ══════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              {/* Plan Cards (Soft Solid) */}
              <div className="space-y-2.5">
                <h3 className="font-bold text-sm text-slate-900">Pilih Paket Langganan SaaS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    {
                      code: 'STARTER',
                      name: 'Starter',
                      price: 'Rp 79.000',
                      features: '1 Outlet • Kasir • KDS • Meja'
                    },
                    {
                      code: 'GROWTH',
                      name: 'Growth (Hero)',
                      price: 'Rp 165.000',
                      featured: true,
                      features: '2 Outlet • Resep HPP • Absensi GPS'
                    },
                    {
                      code: 'BUSINESS',
                      name: 'Business',
                      price: 'Rp 299.000',
                      features: '5 Outlet • Gudang Pusat • Payroll'
                    },
                    {
                      code: 'ENTERPRISE',
                      name: 'Enterprise',
                      price: 'Custom',
                      features: 'Unlimited • Custom APK Brand'
                    }
                  ].map((p) => {
                    const isSelected = selectedPlan === p.code;
                    return (
                      <div
                        key={p.code}
                        onClick={() => setSelectedPlan(p.code)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/70 border-2 border-indigo-600 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-900">{p.name}</span>
                            {p.featured && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-indigo-600 text-white">
                                POPULER
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-black text-indigo-700 font-mono my-1.5">{p.price}</div>
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{p.features}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owner Credentials Form */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <User size={15} className="text-indigo-600" /> Kredensial Akun Pemilik (Owner)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pemilik Kafe</label>
                    <input
                      type="text"
                      placeholder="Contoh: Budi Santoso"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WhatsApp Pemilik *
                    </label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs font-bold text-slate-500">
                        +62
                      </span>
                      <input
                        type="tel"
                        placeholder="81234567890"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        className="flex-1 px-3.5 py-2 rounded-r-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Username Login Owner *</label>
                    <input
                      type="text"
                      placeholder={businessType === 'BENGKEL' ? 'owner_bengkel' : 'owner_kafe'}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-indigo-700 focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Password Login *</label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPass}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Acak Password
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 5: HASIL SUKSES & WHATSAPP WELCOME KIT
             ══════════════════════════════════════════════════════════════════ */}
          {step === 5 && provisionResult && (
            <div className="space-y-5 animate-fade-in text-center py-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">
                  🎉 {businessType === 'BENGKEL' ? 'Bengkel' : 'Kafe'} &apos;{provisionResult.tenantName}&apos; Berhasil Didaftarkan!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tenant aktif dengan {provisionResult.totalProductsCreated} {businessType === 'BENGKEL' ? 'Jasa Servis & Suku Cadang Siap Digunakan.' : 'Menu Produk & Foto Kuliner AI Siap Pakai.'}
                </p>
              </div>

              {/* WhatsApp Message Preview Box */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl text-left border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Share2 size={14} /> Format Pesan WhatsApp Sambutan
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppMessage}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                  >
                    {copiedWA ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedWA ? 'Tersalin!' : 'Salin Pesan'}</span>
                  </button>
                </div>

                <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed overflow-x-auto">
                  {provisionResult.whatsappMessage}
                </pre>

                {provisionResult.whatsappUrl && (
                  <a
                    href={provisionResult.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-2xs"
                  >
                    Kirim Langsung via WhatsApp Web 📱
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ─── MODAL FOOTER & NAVIGATION ACTIONS (SOFT SOLID) ──────────────── */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between">
          {step > 1 && step < 5 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <ChevronLeft size={16} />
              <span>Kembali</span>
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              type="button"
              onClick={() => {
                if (!tenantName.trim() || !slug.trim()) {
                  toast('Harap isi Nama Kafe dan Subdomain terlebih dahulu', 'warning');
                  return;
                }
                setStep(2);
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-95"
            >
              <span>Lanjut ke Sumber Menu</span>
              <ChevronRight size={16} />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={handleExtractMenu}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-95"
            >
              <span>Review Menu &amp; Foto AI</span>
              <ChevronRight size={16} />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-95"
            >
              <span>Lanjut ke Pilih Paket</span>
              <ChevronRight size={16} />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={handleExecuteProvisioning}
              disabled={loading}
              className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-2xs disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Sedang Membuat Akun Kafe...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Aktifkan Akun &amp; Buat Tenant Sekarang!</span>
                </>
              )}
            </button>
          )}

          {step === 5 && (
            <div className="flex items-center gap-3 w-full justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
              >
                Tutup Selesai
              </button>
              {provisionResult?.loginLink && (
                <a
                  href={provisionResult.loginLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                >
                  <span>Buka POS Tenant</span>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default QuickProvisionModal;

