import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  X,
  Star,
  Activity,
  HelpCircle,
  AlertTriangle,
  Zap,
  CheckCircle2,
  PieChart,
  ShoppingBag,
  Info
} from 'lucide-react';
import { toast } from '../utils/alert';

interface ClassifiedProduct {
  id: number;
  name: string;
  categoryName: string;
  price: number;
  costPrice: number;
  foodCostPercentage: number;
  volume30d: number;
  quadrant: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';
  quadrantLabel: string;
  actionAdvice: string;
}

interface AiStrategy {
  strategyName: string;
  tacticCategory: string;
  targetProducts: string[];
  riskLevel: 'ZERO_RISK' | 'LOW_RISK' | 'MEDIUM_RISK';
  riskLabel: string;
  estimatedMonthlyGain: number;
  psychologicalRationale: string;
  actionableStep: string;
}

interface MenuOptimizationResult {
  overallHealthScore: number;
  overallFoodCostPercentage: number;
  totalPotentialProfitMonthly: number;
  executiveSummary: string;
  source: 'GEMINI_AI' | 'MATHEMATICAL_BCG_FALLBACK';
  quadrants: {
    stars: ClassifiedProduct[];
    plowhorses: ClassifiedProduct[];
    puzzles: ClassifiedProduct[];
    dogs: ClassifiedProduct[];
  };
  metrics: {
    totalProductsAnalyzed: number;
    avgFoodCost: number;
    totalMonthlyVolume: number;
  };
  strategies: AiStrategy[];
}

interface AiMenuOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
}

const formatRp = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

export const AiMenuOptimizerModal: React.FC<AiMenuOptimizerModalProps> = ({
  isOpen,
  onClose,
  token
}) => {
  const [data, setData] = useState<MenuOptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'STRATEGIES' | 'STARS' | 'PLOWHORSES' | 'PUZZLES' | 'DOGS'>('STRATEGIES');

  const authToken = token || localStorage.getItem('pos_token') || localStorage.getItem('token') || '';

  const fetchAnalysis = async (refresh: boolean = false) => {
    setLoading(true);
    try {
      const url = `/api/analytics/ai-menu-advisor${refresh ? '?refresh=true' : ''}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        throw new Error('Gagal mengambil analisis menu');
      }
      const json = await res.json();
      setData(json);
      if (refresh) {
        toast('Analisis AI Berhasil Diperbarui', 'info');
      }
    } catch (err: any) {
      console.error('AI Menu Advisor fetch error:', err);
      toast(err.message || 'Gagal memuat rekomendasi AI', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && authToken) {
      fetchAnalysis(false);
    }
  }, [isOpen, authToken]);

  if (!isOpen) return null;

  const starsCount = data?.quadrants?.stars?.length || 0;
  const plowhorsesCount = data?.quadrants?.plowhorses?.length || 0;
  const puzzlesCount = data?.quadrants?.puzzles?.length || 0;
  const dogsCount = data?.quadrants?.dogs?.length || 0;

  const getRiskBadge = (level: string, label: string) => {
    if (level === 'ZERO_RISK') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <ShieldCheck size={14} className="text-emerald-600" />
          {label || 'Risiko Pelanggan: 0%'}
        </span>
      );
    }
    if (level === 'LOW_RISK') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
          <CheckCircle2 size={14} className="text-blue-600" />
          {label || 'Risiko: Sangat Rendah'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <AlertTriangle size={14} className="text-amber-600" />
        {label || 'Risiko: Rendah Terkendali'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">AI Menu & Profit Protection Advisor</h3>
                {data && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-purple-200 border border-white/20">
                    {data.source === 'GEMINI_AI' ? '⚡ Gemini 1.5 Flash' : '📊 BCG Rule Engine'}
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-200/80">
                Optimasi margin dan laba F&B tanpa menaikkan harga sembarangan (0% Risiko Kehilangan Pelanggan)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAnalysis(true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/20 disabled:opacity-50"
              title="Segarkan Analisis AI"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          
          {loading && !data && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <p className="font-bold text-slate-700 text-sm">Sedang Menghitung Matriks Menu & Formula Profit AI...</p>
              <p className="text-xs text-slate-400">Menganalisis HPP resep, kuadran BCG, dan taktik psikologis harga.</p>
            </div>
          )}

          {data && (
            <>
              {/* TOP DASHBOARD METRICS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Metric 1: Health Score */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Health Score Menu</div>
                    <div className="text-2xl font-black text-slate-800 mt-0.5 flex items-baseline gap-1">
                      <span>{data.overallHealthScore}</span>
                      <span className="text-xs font-normal text-slate-400">/100</span>
                    </div>
                    <div className="text-[11px] font-medium text-emerald-600 mt-0.5">
                      {data.overallHealthScore >= 80 ? '🟢 Portofolio Menu Sangat Sehat' : data.overallHealthScore >= 60 ? '🟡 Perlu Optimasi Porsi & Resep' : '🔴 Margin Perlu Diamankan Segera'}
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <PieChart size={22} />
                  </div>
                </div>

                {/* Metric 2: Average Food Cost */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rata-rata Food Cost</div>
                    <div className="text-2xl font-black text-slate-800 mt-0.5">
                      {data.overallFoodCostPercentage}%
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                      Target Ideal F&B: 28% - 35%
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Activity size={22} />
                  </div>
                </div>

                {/* Metric 3: Potential Monthly Gain */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Potensi Tambahan Laba</div>
                    <div className="text-xl sm:text-2xl font-black mt-0.5">
                      +{formatRp(data.totalPotentialProfitMonthly)}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-100/90 mt-0.5">
                      Estimasi per bulan tanpa risiko
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-white/20 text-white flex items-center justify-center">
                    <TrendingUp size={22} />
                  </div>
                </div>
              </div>

              {/* EXECUTIVE SUMMARY BANNER */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 text-xs text-indigo-950 flex items-start gap-2.5">
                <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-indigo-900">Ringkasan Analitik AI: </span>
                  {data.executiveSummary}
                </div>
              </div>

              {/* TABS NAVIGATION */}
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold shrink-0">
                <button
                  onClick={() => setActiveTab('STRATEGIES')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'STRATEGIES'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Sparkles size={14} />
                  Taktik Perlindungan Margin ({data.strategies?.length || 0})
                </button>

                <button
                  onClick={() => setActiveTab('STARS')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'STARS'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Star size={14} className="text-amber-300" />
                  Stars: Menu Bintang ({starsCount})
                </button>

                <button
                  onClick={() => setActiveTab('PLOWHORSES')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'PLOWHORSES'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Zap size={14} />
                  Plowhorses: Target Porsi ({plowhorsesCount})
                </button>

                <button
                  onClick={() => setActiveTab('PUZZLES')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'PUZZLES'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <HelpCircle size={14} />
                  Puzzles: Target Bundling ({puzzlesCount})
                </button>

                <button
                  onClick={() => setActiveTab('DOGS')}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'DOGS'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <AlertCircle size={14} />
                  Dogs: Evaluasi ({dogsCount})
                </button>
              </div>

              {/* TAB 1: STRATEGIES LIST */}
              {activeTab === 'STRATEGIES' && (
                <div className="space-y-3.5">
                  <div className="text-xs text-slate-500 font-medium">
                    Berikut 5 taktik rekomendasi AI yang dirancang untuk menaikkan laba restoran tanpa membebani pelanggan dengan kenaikan harga sepihak:
                  </div>

                  {data.strategies?.map((strat, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h4 className="font-extrabold text-slate-800 text-sm">{strat.strategyName}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRiskBadge(strat.riskLevel, strat.riskLabel)}
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            +{formatRp(strat.estimatedMonthlyGain)}/bln
                          </span>
                        </div>
                      </div>

                      {strat.targetProducts && strat.targetProducts.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-400">Target Menu:</span>
                          {strat.targetProducts.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
                        <div>
                          <span className="font-bold text-slate-700">🧠 Rationale Psikologi Konsumen: </span>
                          <span className="text-slate-600">{strat.psychologicalRationale}</span>
                        </div>
                        <div>
                          <span className="font-bold text-indigo-700">🛠️ Langkah Praktis Operasional: </span>
                          <span className="text-slate-700 font-medium">{strat.actionableStep}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2, 3, 4, 5: QUADRANT PRODUCTS */}
              {activeTab !== 'STRATEGIES' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                    <span>
                      {activeTab === 'STARS' && '🌟 Kuadran Stars: Menu paling menguntungkan & laris. Lindungi konsistensi rasa resepnya!'}
                      {activeTab === 'PLOWHORSES' && '🐴 Kuadran Plowhorses: Volume penjualan tinggi namun Food Cost tebal. Kunci utama penghematan ada di takaran resep bahan baku.'}
                      {activeTab === 'PUZZLES' && '❓ Kuadran Puzzles: Margin laba tebal namun kurang diminati. Cocok untuk paket kombo atau promosi banner kasir.'}
                      {activeTab === 'DOGS' && '🐕 Kuadran Dogs: Penjualan sepi dan margin tipis. Pertimbangkan dijadikan Decoy Menu atau ganti dengan varian baru.'}
                    </span>
                  </div>

                  {(() => {
                    const currentList =
                      activeTab === 'STARS'
                        ? data.quadrants.stars
                        : activeTab === 'PLOWHORSES'
                        ? data.quadrants.plowhorses
                        : activeTab === 'PUZZLES'
                        ? data.quadrants.puzzles
                        : data.quadrants.dogs;

                    if (currentList.length === 0) {
                      return (
                        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                          Belum ada produk di kuadran ini.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentList.map((prod) => (
                          <div
                            key={prod.id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {prod.categoryName}
                                </span>
                                <h5 className="font-extrabold text-slate-800 text-sm leading-tight">{prod.name}</h5>
                              </div>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  prod.foodCostPercentage <= 32
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : prod.foodCostPercentage <= 35
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                Food Cost: {prod.foodCostPercentage}%
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 py-1.5 px-2.5 bg-slate-50 rounded-lg text-xs">
                              <div>
                                <div className="text-[10px] text-slate-400 font-medium">Harga Jual</div>
                                <div className="font-bold text-slate-700">{formatRp(prod.price)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-400 font-medium">HPP Resep</div>
                                <div className="font-bold text-slate-700">{formatRp(prod.costPrice)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-400 font-medium">Penjualan 30 Hari</div>
                                <div className="font-bold text-indigo-600">{prod.volume30d} porsi</div>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-600 bg-purple-50/50 p-2 rounded-md border border-purple-100">
                              <span className="font-bold text-purple-900">Saran AI: </span>
                              {prod.actionAdvice}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ZERO BLIND MUTATION SAFETY NOTICE */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck size={16} className="text-slate-600 shrink-0" />
                <span>
                  <strong>Standar Keamanan Owner:</strong> AI tidak akan mengubah harga jual produk atau komposisi resep secara otomatis. Seluruh rekomendasi bersifat saran strategis untuk keputusan operasional Anda.
                </span>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Total Produk Teranalisis: <strong className="text-slate-700">{data?.metrics?.totalProductsAnalyzed || 0} menu</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

export default AiMenuOptimizerModal;
