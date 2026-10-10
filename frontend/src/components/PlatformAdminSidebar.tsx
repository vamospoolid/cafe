import React from 'react';
import { 
  TrendingUp, 
  Building2, 
  Sliders, 
  CreditCard, 
  Database, 
  AlertTriangle, 
  ShieldCheck,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Trash2,
  HardDrive
} from 'lucide-react';

export type PlatformAdminTab = 
  | 'overview' 
  | 'tenants' 
  | 'plans' 
  | 'invoices' 
  | 'database' 
  | 'warnings' 
  | 'logs'
  | 'offline_clients';

interface PlatformAdminSidebarProps {
  activeTab: PlatformAdminTab;
  onSelectTab: (tab: PlatformAdminTab) => void;
  tenantCount?: number;
  pendingInvoiceCount?: number;
  activeBroadcastCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenTenantReset?: () => void;
  onOpenRecycleBin?: () => void;
}

export const PlatformAdminSidebar: React.FC<PlatformAdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  tenantCount = 0,
  pendingInvoiceCount = 0,
  activeBroadcastCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  onOpenTenantReset,
  onOpenRecycleBin
}) => {
  const menuItems = [
    {
      id: 'overview' as PlatformAdminTab,
      label: 'Financial & MRR',
      description: 'Omzet, ARR & Proyeksi SaaS',
      icon: TrendingUp,
      shortcut: 'Alt+1',
      activeBg: 'bg-emerald-600 text-white border-2 border-emerald-700 shadow-sm',
      iconActiveBg: 'bg-emerald-700 text-white',
      iconInactiveBg: 'bg-emerald-100 text-emerald-800'
    },
    {
      id: 'tenants' as PlatformAdminTab,
      label: 'Direktori Tenant',
      description: 'Mitra usaha, cabang & staff',
      icon: Building2,
      shortcut: 'Alt+2',
      count: tenantCount > 0 ? tenantCount : undefined,
      activeBg: 'bg-indigo-600 text-white border-2 border-indigo-700 shadow-sm',
      iconActiveBg: 'bg-indigo-700 text-white',
      iconInactiveBg: 'bg-indigo-100 text-indigo-800'
    },
    {
      id: 'plans' as PlatformAdminTab,
      label: 'Paket & Fitur',
      description: 'Katalog tier & feature matrix',
      icon: Sliders,
      shortcut: 'Alt+3',
      activeBg: 'bg-purple-600 text-white border-2 border-purple-700 shadow-sm',
      iconActiveBg: 'bg-purple-700 text-white',
      iconInactiveBg: 'bg-purple-100 text-purple-800'
    },
    {
      id: 'invoices' as PlatformAdminTab,
      label: 'Tagihan & Invoice',
      description: 'Midtrans & transfer manual',
      icon: CreditCard,
      shortcut: 'Alt+4',
      count: pendingInvoiceCount > 0 ? pendingInvoiceCount : undefined,
      badgeColor: 'bg-rose-600 text-white font-black',
      activeBg: 'bg-rose-600 text-white border-2 border-rose-700 shadow-sm',
      iconActiveBg: 'bg-rose-700 text-white',
      iconInactiveBg: 'bg-rose-100 text-rose-800'
    },
    {
      id: 'database' as PlatformAdminTab,
      label: 'Database & Backup',
      description: 'PostgreSQL stats & SQL dump',
      icon: Database,
      shortcut: 'Alt+5',
      activeBg: 'bg-cyan-700 text-white border-2 border-cyan-800 shadow-sm',
      iconActiveBg: 'bg-cyan-800 text-white',
      iconInactiveBg: 'bg-cyan-100 text-cyan-800'
    },
    {
      id: 'warnings' as PlatformAdminTab,
      label: 'Broadcast Siaran',
      description: 'Push banner ke kasir tenant',
      icon: AlertTriangle,
      shortcut: 'Alt+6',
      count: activeBroadcastCount > 0 ? activeBroadcastCount : undefined,
      badgeColor: 'bg-amber-400 text-slate-950 font-black',
      activeBg: 'bg-amber-500 text-slate-950 border-2 border-amber-600 font-black shadow-sm',
      iconActiveBg: 'bg-amber-600 text-slate-950',
      iconInactiveBg: 'bg-amber-100 text-amber-900'
    },
    {
      id: 'logs' as PlatformAdminTab,
      label: 'Audit Security Log',
      description: 'Jejak mutasi data & audit trail',
      icon: ShieldCheck,
      shortcut: 'Alt+7',
      activeBg: 'bg-teal-600 text-white border-2 border-teal-700 shadow-sm',
      iconActiveBg: 'bg-teal-700 text-white',
      iconInactiveBg: 'bg-teal-100 text-teal-800'
    },
    {
      id: 'offline_clients' as PlatformAdminTab,
      label: 'Klien Offline & Beli-Putus',
      description: 'Lisensi HW-ID, heartbeat & backup',
      icon: HardDrive,
      shortcut: 'Alt+8',
      activeBg: 'bg-violet-600 text-white border-2 border-violet-700 shadow-sm',
      iconActiveBg: 'bg-violet-700 text-white',
      iconInactiveBg: 'bg-violet-100 text-violet-800'
    }
  ];

  return (
    <aside className={`w-full shrink-0 flex flex-col gap-3 transition-all duration-300 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto ${
      isCollapsed ? 'lg:w-20' : 'lg:w-72'
    }`}>
      {/* ─── Unified High-Contrast Navigation Card ─── */}
      <nav className="bg-white border-2 border-slate-300 rounded-2xl p-3 shadow-md space-y-1.5 relative">
        
        {/* Header / Collapse Toggle Bar */}
        <div className={`px-2 pt-1 pb-2.5 flex items-center border-b-2 border-slate-200 mb-1.5 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Master Control
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                  v2.4
                </span>
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    title="Kecilkan Sidebar (Mini-mode)"
                    className="hidden lg:flex p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <PanelLeftClose size={16} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  title="Perbesar Sidebar (Full-mode)"
                  className="hidden lg:flex p-1.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <PanelLeftOpen size={17} />
                </button>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Navigation Items */}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={`${item.label} (${item.shortcut}) - ${item.description}`}
              className={`w-full group relative flex items-center rounded-xl transition-all duration-150 cursor-pointer text-left ${
                isCollapsed ? 'justify-center p-2' : 'justify-between p-2.5'
              } ${
                isActive
                  ? item.activeBg
                  : 'bg-white border-2 border-transparent text-slate-800 hover:bg-slate-100 hover:border-slate-200'
              }`}
            >
              <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                <div className="relative">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0 font-black ${
                      isActive 
                        ? item.iconActiveBg 
                        : item.iconInactiveBg
                    }`}
                  >
                    <Icon size={18} />
                  </div>

                  {/* Badge Counter in Collapsed Mode (Top-Right Pill) */}
                  {isCollapsed && item.count !== undefined && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-sm ${
                        item.badgeColor || (isActive ? 'bg-white text-slate-950' : 'bg-slate-950 text-white')
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="min-w-0">
                    <div className={`text-xs font-black leading-tight flex items-center gap-1.5 ${
                      isActive ? 'text-inherit' : 'text-slate-900'
                    }`}>
                      <span>{item.label}</span>
                      <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-black opacity-0 group-hover:opacity-100 transition-opacity ${
                        isActive ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {item.shortcut}
                      </span>
                    </div>
                    <div className={`text-[10px] truncate mt-0.5 font-bold ${
                      isActive ? 'text-white/80' : 'text-slate-500'
                    }`}>
                      {item.description}
                    </div>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  {item.count !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black tracking-tight ${
                        item.badgeColor || (isActive ? 'bg-white text-slate-950' : 'bg-slate-900 text-white')
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                  <ChevronRight
                    size={15}
                    className={`transition-transform duration-150 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-800'
                    }`}
                  />
                </div>
              )}
            </button>
          );
        })}

        {/* ─── Extra Utilities Section: Reset Demo & Recycle Bin ─── */}
        {(onOpenTenantReset || onOpenRecycleBin) && (
          <div className="pt-2 mt-2 border-t-2 border-slate-200 space-y-1.5">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600">
                Peralatan Sistem
              </div>
            )}
            
            {onOpenTenantReset && (
              <button
                onClick={onOpenTenantReset}
                title="Reset & Muat Template Data Demo Tenant"
                className={`w-full group flex items-center rounded-xl p-2 text-xs font-black text-rose-900 bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer border-2 border-rose-300 ${
                  isCollapsed ? 'justify-center' : 'justify-between'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <RotateCcw size={16} />
                  </div>
                  {!isCollapsed && (
                    <div className="text-left">
                      <div className="text-xs font-black">Reset Demo Tenant</div>
                      <div className="text-[10px] text-rose-700 font-bold">Template &amp; bersihkan</div>
                    </div>
                  )}
                </div>
                {!isCollapsed && <ChevronRight size={14} className="text-rose-400 group-hover:text-rose-700" />}
              </button>
            )}

            {onOpenRecycleBin && (
              <button
                onClick={onOpenRecycleBin}
                title="Buka Tempat Sampah & Pulihkan Data Terhapus"
                className={`w-full group flex items-center rounded-xl p-2 text-xs font-black text-amber-950 bg-amber-50 hover:bg-amber-100 transition-all cursor-pointer border-2 border-amber-300 ${
                  isCollapsed ? 'justify-center' : 'justify-between'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                    <Trash2 size={16} />
                  </div>
                  {!isCollapsed && (
                    <div className="text-left">
                      <div className="text-xs font-black">Recycle Bin</div>
                      <div className="text-[10px] text-amber-800 font-bold">Pulihkan soft-delete</div>
                    </div>
                  )}
                </div>
                {!isCollapsed && <ChevronRight size={14} className="text-amber-500 group-hover:text-amber-800" />}
              </button>
            )}
          </div>
        )}
      </nav>

      {/* ─── High-Contrast Security Box (Solid Dark) ─── */}
      <div className={`bg-[#090d16] border-2 border-slate-800 rounded-2xl p-4 text-xs shadow-md space-y-2 relative transition-all ${
        isCollapsed ? 'text-center flex flex-col items-center p-2.5' : ''
      }`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between w-full'}`}>
          <div className="flex items-center gap-2 font-black text-white text-[11px] uppercase tracking-wider">
            <div 
              className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black"
              title="Isolasi data antar mitra terproteksi penuh di level database PostgreSQL Prisma RLS."
            >
              <ShieldCheck size={16} />
            </div>
            {!isCollapsed && <span>RLS Multi-Tenant</span>}
          </div>
          {!isCollapsed && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-slate-950">
              Active Gate
            </span>
          )}
        </div>
        {!isCollapsed && (
          <p className="text-slate-300 text-[11px] leading-relaxed font-semibold">
            Isolasi data antar mitra terproteksi penuh di level database PostgreSQL Prisma RLS.
          </p>
        )}
      </div>
    </aside>
  );
};

export default PlatformAdminSidebar;


