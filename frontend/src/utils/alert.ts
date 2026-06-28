import Swal from 'sweetalert2';

export const toast = (title: string, icon: 'success' | 'error' | 'info' | 'warning' = 'success') => {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    icon,
    title,
    background: '#ffffff',
    color: '#334155',
    customClass: {
      popup: 'rounded-xl shadow-lg border border-gray-100'
    }
  });
};

export const confirmAlert = (title: string, text?: string) => {
  return Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#7C3AED',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Lanjutkan',
    cancelButtonText: 'Batal',
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-lg font-semibold px-5',
      cancelButton: 'rounded-lg font-semibold px-5'
    }
  });
};

export const errorAlert = (title: string, text?: string) => {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#7C3AED',
    confirmButtonText: 'OK',
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-lg font-semibold px-5'
    }
  });
};
