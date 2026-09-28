import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chunk loading error caught by boundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.name === 'ChunkLoadError' ||
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk');

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[400px] text-center bg-slate-50">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            {isChunkError ? 'Pembaruan Sistem / Jaringan Terputus' : 'Terjadi Kendala Memuat Halaman'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-5 leading-relaxed">
            {isChunkError
              ? 'Aplikasi telah diperbarui atau koneksi internet terputus saat memuat modul ini. Silakan muat ulang halaman untuk mendapatkan versi terbaru.'
              : 'Gagal merender modul halaman ini. Silakan coba segarkan kembali.'}
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
