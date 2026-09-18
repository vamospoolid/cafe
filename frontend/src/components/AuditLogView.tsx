import React, { useState, useEffect, useContext } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  Activity,
  ArrowRight,
  Database
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface AuditLogItem {
  id: string;
  tenantId: string | null;
  outletId: string | null;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt: string;
  outlet?: { id: string; name: string; code: string } | null;
  user?: { id: number; name: string; username: string; role: string } | null;
}

interface AuditSummary {
  totalLogs: number;
  criticalCount: number;
  warningCount: number;
  activityLast24h: number;
  topActions: { action: string; count: number }[];
}

const AuditLogView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;

  // State
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Fetch summary
  const fetchSummary = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/audit-logs/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit summary:', err);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (search) params.append('search', search);
      if (severityFilter) params.append('severity', severityFilter);
      if (resourceFilter) params.append('resource', resourceFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil data riwayat audit log.');
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [token]);

  useEffect(() => {
    fetchLogs();
  }, [token, page, severityFilter, resourceFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilter = () => {
    setSearch('');
    setSeverityFilter('');
    setResourceFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExportCSV = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (severityFilter) params.append('severity', severityFilter);
      if (resourceFilter) params.append('resource', resourceFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('format', 'csv');

      const res = await fetch(`/api/audit-logs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error('Export CSV error:', err);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm animate-pulse">
            <AlertOctagon size={12} className="text-rose-600" />
            CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
            <AlertTriangle size={12} className="text-amber-600" />
            WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
            <Info size={12} className="text-indigo-500" />
            INFO
          </span>
        );
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('VOID') || action.includes('DELETE') || action.includes('SUSPEND')) {
      return 'bg-rose-50 text-rose-700 border-rose-100';
    }
    if (action.includes('PRICE') || action.includes('UPDATE') || action.includes('SETTINGS')) {
      return 'bg-amber-50 text-amber-700 border-amber-100';
    }
    if (action.includes('LOGIN') || action.includes('AUTH') || action.includes('PIN')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    }
    if (action.includes('CREATE') || action.includes('REGISTER')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const parseJsonSafe = (raw: string | null) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-1">
            <Shield size={13} />
            <span>Immutable Audit Trail & Security Ledger</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Audit Trail & Log Aktivitas
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Pencatatan riwayat transaksional tidak dapat diubah (immutable) mencakup otentikasi, pembatalan pesanan (void), perubahan harga, mutasi inventaris, dan konfigurasi sistem.
          </p>
        </div>

        <div className="flex items-center gap-2.5 z-10">
          <button
            onClick={() => { fetchSummary(); fetchLogs(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all active:scale-95 border border-white/10 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
          >
            <Download size={14} />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Aktivitas</div>
            <div className="text-2xl font-black text-slate-800">{summary?.totalLogs ?? '-'}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Seluruh catatan audit</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertOctagon size={24} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aksi Kritis</div>
            <div className="text-2xl font-black text-rose-600">{summary?.criticalCount ?? '-'}</div>
            <div className="text-[10px] text-rose-500 font-semibold mt-0.5">Void / Hapus Data</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peringatan</div>
            <div className="text-2xl font-black text-amber-600">{summary?.warningCount ?? '-'}</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Ubah Harga / Setting</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aktivitas 24 Jam</div>
            <div className="text-2xl font-black text-emerald-600">{summary?.activityLast24h ?? '-'}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Hari ini</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari deskripsi, username, action, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Semua Severity</option>
              <option value="INFO">INFO (Normal)</option>
              <option value="WARNING">WARNING (Perhatian)</option>
              <option value="CRITICAL">CRITICAL (Sensitif)</option>
            </select>
          </div>

          {/* Resource Filter */}
          <div>
            <select
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Semua Modul (Resource)</option>
              <option value="AUTH">AUTH (Otentikasi)</option>
              <option value="ORDER">ORDER (Pesanan & Void)</option>
              <option value="PRODUCT">PRODUCT (Menu & Harga)</option>
              <option value="USER">USER (Staf & Role)</option>
              <option value="SETTINGS">SETTINGS (Pengaturan Toko)</option>
              <option value="FINANCE">FINANCE (Kas & Keuangan)</option>
              <option value="INVENTORY">INVENTORY (Stok)</option>
              <option value="BILLING">BILLING (SaaS & Payment)</option>
            </select>
          </div>

          {/* Date Picker Range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Dari Tanggal"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Sampai Tanggal"
            />
          </div>
        </form>

        {(search || severityFilter || resourceFilter || startDate || endDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Filter aktif: {search && `"${search}" `} {severityFilter && `[${severityFilter}] `} {resourceFilter && `[${resourceFilter}] `} {startDate && `Dari ${startDate} `} {endDate && `s/d ${endDate}`}
            </span>
            <button
              onClick={handleResetFilter}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw size={28} className="animate-spin text-indigo-600" />
            <span className="text-xs font-bold">Memuat data audit trail...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 text-xs font-bold">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <ShieldCheck size={36} className="text-slate-300" />
            <div className="text-sm font-bold text-slate-600">Tidak ada log aktivitas</div>
            <div className="text-xs">Belum ada catatan aktivitas yang cocok dengan kriteria filter.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-5">Waktu</th>
                  <th className="py-3.5 px-4">Pengguna & Role</th>
                  <th className="py-3.5 px-4">Aksi / Event</th>
                  <th className="py-3.5 px-4">Modul</th>
                  <th className="py-3.5 px-4">Deskripsi Aktivitas</th>
                  <th className="py-3.5 px-4 text-center">Severity</th>
                  <th className="py-3.5 px-5 text-right">Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log) => {
                  const hasDiff = Boolean(log.oldValue || log.newValue);
                  const dateObj = new Date(log.createdAt);
                  const formattedDate = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });
                  const formattedTime = dateObj.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Timestamp */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{formattedDate}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {formattedTime}
                        </div>
                      </td>

                      {/* User & Role */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-[10px] uppercase border border-indigo-100">
                            {log.userName ? log.userName.charAt(0) : <User size={12} />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{log.userName || 'Sistem'}</div>
                            <div className="text-[10px] font-bold text-indigo-600">{log.userRole || 'SYSTEM'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Module / Resource */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold font-mono">
                          {log.resource}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                        <div className="text-slate-700 font-medium line-clamp-2">
                          {log.description || '-'}
                        </div>
                        {log.ipAddress && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            IP: {log.ipAddress}
                          </div>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getSeverityBadge(log.severity)}
                      </td>

                      {/* Diff Viewer Button */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {hasDiff ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 text-[11px] font-bold transition-all active:scale-95 border border-slate-200 hover:border-indigo-200 shadow-sm"
                          >
                            <Eye size={12} />
                            <span>Lihat Diff</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{logs.length}</span> dari <span className="font-bold text-slate-800">{totalRecords}</span> entri log
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-all shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm">
              Halaman {page} dari {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-all shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Snapshot Diff Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    Detail Perubahan Data (Snapshot Diff)
                    {getSeverityBadge(selectedLog.severity)}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {selectedLog.action} &bull; {selectedLog.resource} #{selectedLog.resourceId || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Event Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Pelaku (User)</div>
                  <div className="font-bold text-slate-800">{selectedLog.userName || 'Sistem'}</div>
                  <div className="text-[10px] text-indigo-600">{selectedLog.userRole}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Waktu</div>
                  <div className="font-bold text-slate-800">{new Date(selectedLog.createdAt).toLocaleString('id-ID')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Alamat IP</div>
                  <div className="font-mono text-slate-800">{selectedLog.ipAddress || 'Internal'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Resource ID</div>
                  <div className="font-mono text-slate-800 truncate">{selectedLog.resourceId || '-'}</div>
                </div>
              </div>

              {/* Description */}
              {selectedLog.description && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/70 text-xs text-indigo-950 font-medium">
                  {selectedLog.description}
                </div>
              )}

              {/* Side-by-Side Diff Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Value */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Sebelum Perubahan (Old Value)
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900 text-rose-300 font-mono text-[11px] overflow-x-auto min-h-[160px] border border-slate-800">
                    <pre className="whitespace-pre-wrap break-all">
                      {selectedLog.oldValue 
                        ? JSON.stringify(parseJsonSafe(selectedLog.oldValue), null, 2)
                        : '// Tidak ada data sebelumnya (Entitas Baru)'}
                    </pre>
                  </div>
                </div>

                {/* New Value */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Sesudah Perubahan (New Value)
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto min-h-[160px] border border-slate-800">
                    <pre className="whitespace-pre-wrap break-all">
                      {selectedLog.newValue 
                        ? JSON.stringify(parseJsonSafe(selectedLog.newValue), null, 2)
                        : '// Entitas telah dihapus permanen'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all active:scale-95 shadow-md"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
