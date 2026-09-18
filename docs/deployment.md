# Codenusa SaaS POS - Zero-Impact VPS Production Deployment Runbook

## 📌 1. Prinsip Utama: Zero-Impact Isolation

Sistem multi-tenant SaaS baru (**Codenusa POS**) harus berjalan secara berdampingan tanpa mengganggu, menimpa, ataupun mengubah sistem legacy single-tenant (**Pos Cafe**) yang sedang melayani pelanggan.

### Matriks Isolasi Komparatif

| Komponen | Sistem Legacy (TIDAK BOLEH DISENTUH ⚠️) | Sistem SaaS Baru (Codenusa SaaS POS 🚀) |
| :--- | :--- | :--- |
| **Direktori Root VPS** | `/var/www/poscafe` | **`/var/www/codepos`** |
| **PM2 Process Name** | `poscafe-backend` | **`codepos-backend`** |
| **Port Internal Node.js**| `5000` (atau port legacy eksisting) | **`5000`** (atau port terkonfigurasi pada `ecosystem.config.js`) |
| **Domain Publik** | `cafe.codenusa.id` | **`codenusa.id` & `*.codenusa.id` (Wildcard)** |
| **Nginx Config** | `/etc/nginx/sites-available/poscafe` | **`/etc/nginx/sites-available/codepos`** |
| **Upload Directory** | `/var/www/poscafe/backend/uploads` | **`/var/www/codepos/backend/uploads/tenants/`** |
| **Database Isolation** | Data legacy terisolasi pada `tenant-default-muki` | **Multi-tenant RLS Isolation (PostgreSQL Kernel Level)** |

---

## 🛠️ 2. Langkah-Langkah Staging & Deployment Awal di VPS

### Langkah 1: Clone Repository ke Folder Khusus `/var/www/codepos`
```bash
# Pastikan berada di direktori /var/www/
cd /var/www

# Clone repository ke folder codepos (JANGAN PERNAH clone ke /var/www/poscafe)
git clone https://github.com/vamospoolid/cafe.git codepos
cd /var/www/codepos
```

### Langkah 2: Konfigurasi Environment Variable Produksi
```bash
# Salin template environment ke folder backend
cp deployment/env/.env.production.example backend/.env

# Buka dan sesuaikan kredensial database & secret keys
nano backend/.env
```

### Langkah 3: Setup SSL Wildcard Let's Encrypt (`*.codenusa.id`)
Untuk mendukung routing subdomain otomatis setiap tenant (`tenant-slug.codenusa.id`), gunakan sertifikat SSL Wildcard via DNS challenge:

```bash
# Install Certbot & DNS plugin (atau gunakan manual challenge)
sudo certbot certonly --manual --preferred-challenges dns \
  -d codenusa.id -d "*.codenusa.id"
```
Tambahkan record `TXT` `_acme-challenge.codenusa.id` pada DNS Management domain Anda (Cloudflare / Niagahoster / IDCloudHost) sesuai instruksi Certbot.

### Langkah 4: Pasang Konfigurasi Nginx Server Block
```bash
# Salin file konfigurasi Nginx
sudo cp deployment/nginx/codepos.conf /etc/nginx/sites-available/codepos

# Buat symbolic link ke sites-enabled
sudo ln -s /etc/nginx/sites-available/codepos /etc/nginx/sites-enabled/

# Uji sintaks Nginx
sudo nginx -t

# Muat ulang konfigurasi Nginx tanpa downtime
sudo systemctl reload nginx
```

### Langkah 5: Jalankan Script Otomatisasi Deployment
```bash
# Berikan izin eksekusi pada script deployment
chmod +x scripts/deploy_saas.sh

# Eksekusi deployment
./scripts/deploy_saas.sh
```

---

## 🔄 3. Prosedur Rolling Update (Continuous Deployment)

Setiap kali ada pembaruan kode di branch `main` GitHub, deployment dapat dilakukan cukup dengan satu baris perintah:

```bash
cd /var/www/codepos && ./scripts/deploy_saas.sh
```

### Apa yang Dilakukan Script `deploy_saas.sh` Secara Otomatis:
1. **Safety Assertions**: Memverifikasi path bukan `/var/www/poscafe` dan nama proses bukan `poscafe-backend`.
2. **Git Sync**: Melakukan `git fetch` dan `git reset --hard origin/main` (mempertahankan `.env`, `uploads/`, dan `backups/`).
3. **Database Migration**: Menjalankan `prisma db push` dan `apply_rls.js` untuk penegakan RLS PostgreSQL.
4. **Build Pipeline**: Kompilasi TypeScript backend (`tsc`) dan bundling Vite frontend (`vite build`).
5. **Zero-Downtime Reload**: Memanggil `pm2 reload codepos-backend` tanpa memutus koneksi transaksi aktif.
6. **Health Assertion**: Melakukan query liveness ke `http://localhost:5000/api/health/ping` (Status HTTP 200).

---

## 🛡️ 4. Prosedur Rollback Cepat (Disaster Mitigation)

Jika terjadi kendala tak terduga setelah deployment versi baru:

```bash
cd /var/www/codepos

# 1. Rollback ke commit Git sebelumnya
git log -n 5 --oneline
git reset --hard <commit-hash-sebelumnya>

# 2. Re-build backend & frontend
cd backend && npm run build
cd ../frontend && npm run build

# 3. Reload PM2
pm2 reload codepos-backend

# 4. Verifikasi kesehatan sistem
curl -s http://localhost:5000/api/health/deep | jq .
```

---

## 📋 5. Checklist Verifikasi Akhir Pasca-Deploy

- [ ] **Layanan Legacy Berjalan Normal**: Akses `https://cafe.codenusa.id` dan pastikan kasir outlet lama tetap bertransaksi normal.
- [ ] **SaaS Root Domain Aktif**: Akses `https://codenusa.id` menampilkan landing page / portal login multi-tenant.
- [ ] **Tenant Subdomain Routing**: Akses `https://muki.codenusa.id` langsung meresolusikan tenant Muki Ramen.
- [ ] **WebSockets & KDS**: Pesanan baru dari kasir muncul real-time di layar KDS dapur.
- [ ] **Observability Endpoint**: `GET https://codenusa.id/api/health/deep` mengembalikan `status: "healthy"` dan `rlsEnforced: true`.
- [ ] **Log Monitoring**: `pm2 logs codepos-backend` bersih dari uncaught exception.
