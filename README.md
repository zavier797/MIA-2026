# AksiWarga

Platform Smart City berbasis web untuk transparansi layanan publik, pemantauan SLA (Service Level Agreement), dan sistem pelaporan pengaduan warga yang akuntabel.

**Multimedia In Action 2026 - Web In Action**  
Tema: *From Visionaries to Architects of Change*

---

## 🎯 Deskripsi

AksiWarga adalah solusi digital untuk meningkatkan transparansi dan akuntabilitas pelayanan publik. Warga dapat melaporkan masalah infrastruktur, kebersihan, dan layanan publik dengan sistem tracking real-time berbasis SLA. Setiap laporan memiliki nomor resi unik dan dapat dilacak progresnya hingga selesai, lengkap dengan transparansi anggaran APBD yang dialokasikan.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5, CSS3, JavaScript (ES6+)**
- **React 18** (UMD build, tanpa JSX/build step)
- **Tailwind CSS** (via CDN)
- **Font Awesome 6** untuk icons
- **Leaflet.js** untuk peta interaktif

### Backend
- **Node.js** (native `http`, `crypto`, `fs` module - zero dependencies)
- **JSON file storage** untuk data persistence
- **PBKDF2 SHA-256** untuk password hashing
- **Session-based authentication** dengan HttpOnly cookies

### Architecture
- **RESTful API** untuk komunikasi client-server
- **SPA (Single Page Application)** dengan React Router
- **Responsive Design** (mobile-first approach)

---

## 🚀 Cara Menjalankan Project

### Prerequisites
- Node.js v16+ terinstall
- Browser modern (Chrome, Firefox, Safari, Edge)

### Langkah Instalasi

1. **Clone repository**
   ```bash
   git clone https://github.com/[username]/MIA-2026.git
   cd MIA-2026
   ```

2. **Jalankan server**
   ```bash
   node server.js
   ```
   
   Atau gunakan port custom:
   ```bash
   PORT=3001 node server.js
   ```

3. **Buka di browser**
   ```
   http://127.0.0.1:3000
   ```
   (atau sesuai PORT yang diset)

⚠️ **Catatan:** Jangan gunakan Live Server atau double-click HTML. Server Node.js wajib dijalankan untuk akses API.

---

## ✨ Fitur Utama

### 1. Sistem Pelaporan Pengaduan
- Form pengaduan dengan kategori (Infrastruktur, Kebersihan, Penerangan, dll)
- Upload foto bukti
- Validasi data lengkap
- Generate nomor resi unik otomatis (TW-2026-XXXX)

### 2. Tracking Progress Real-time
- Lacak status laporan by nomor resi
- Timeline SLA dengan countdown deadline
- Log aktivitas dinas terkait
- Status: Pending → In Progress → Completed

### 3. Transparansi Anggaran APBD
- Data budget 38 provinsi Indonesia
- Breakdown per kategori pengeluaran
- Persentase realisasi anggaran
- Jumlah project per dinas

### 4. Before & After Gallery
- Dokumentasi hasil perbaikan
- Foto sebelum-sesudah
- Detail biaya dan tim pelaksana
- Lokasi GPS

### 5. Peta Interaktif
- Visualisasi lokasi laporan
- Filter by kategori dan status
- Heat map area rawan

### 6. Dashboard Statistik
- Total laporan masuk
- Tingkat penyelesaian (%)
- Rata-rata waktu respon
- Laporan melewati SLA

### 7. Sistem Akun
- Registrasi & login warga
- Session management
- Password hashing (PBKDF2)
- Protected routes

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Daftar akun baru
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Cek session
- `POST /api/auth/forgot-password` - Request OTP untuk reset password
- `POST /api/auth/verify-otp` - Verifikasi kode OTP (6 digit)
- `POST /api/auth/reset-password` - Reset password dengan token

### Reports
- `POST /api/reports` - Submit laporan baru
- `GET /api/reports` - List semua laporan (support filter `?status=pending&category=...`)
- `GET /api/reports/:id` - Detail satu laporan by ID

### Budget Transparency
- `GET /api/budget` - Data APBD semua provinsi
- `GET /api/budget?province=DKI_JAKARTA` - Data budget satu provinsi

---

## 📂 Struktur Folder

```
MIA-2026/
├── react/                    # Frontend (HTML, CSS, JS)
│   ├── index.html           # Landing page (React SPA)
│   ├── app.js               # React app logic
│   ├── auth-context.js      # Auth state management
│   ├── form_pengaduan.html  # Form submit laporan
│   ├── lacak_progress.html  # Track tiket
│   ├── transparansi_anggaran_apbd.html
│   ├── before_dan_after_all.html
│   ├── login.html / sign_up.html
│   └── ...
├── map aksiwarga/           # Peta interaktif (Leaflet)
│   ├── index.html
│   ├── core.js
│   └── data.js
├── asset/                   # Images & static files
├── data/                    # JSON data storage
│   ├── accounts.json        # User accounts
│   ├── reports.json         # Laporan pengaduan
│   └── budget.json          # Data APBD
├── presentasi/              # Dokumen lomba
│   ├── Guidebook WIA.pdf
│   └── WIA_FDSMIA2025_kata mama prompter pemula.pdf
├── server.js                # Backend server
└── README.md
```

---

## 📊 Progress Saat Ini

✅ **Selesai:**
- Landing page responsif dengan hero section
- Form pengaduan lengkap dengan validasi + integrasi API
- Halaman tracking progress tiket + render dinamis dari API
- Halaman transparansi anggaran APBD + load 38 provinsi dari API
- Before/After gallery
- Sistem autentikasi (register/login/forgot password)
- Forgot password dengan OTP (6 digit, 10 menit) + integrasi API lengkap
- Backend API RESTful (11 endpoints - semua tested & working)
- Data dummy realistis (10+ laporan, 38 provinsi)
- Session management dengan cookies
- Password hashing PBKDF2 SHA-256
- **Frontend-Backend Integration SELESAI (4/4 halaman)**

🚧 **Dalam Pengembangan:**
- Real-time notification system
- Indeks kepuasan warga (rating feedback)
- Export laporan ke PDF
- Email notification (OTP saat ini console.log dev mode)

---

## 👥 Tim Pengembang

**Nama Tim:** kata mama prompter pemula

**Anggota:**
- [Nama 1] - [Role]
- [Nama 2] - [Role]
- [Nama 3] - [Role]

---

## 📄 Lisensi

Project ini dibuat untuk keperluan kompetisi **Web In Action - Multimedia In Action 2026**.

---

## 🔗 Link Terkait

- Website MIA 2026: [mia2026.com](https://mia2026.com)
- Dokumentasi Presentasi: `/presentasi/`
- Live Demo: [Coming Soon]

---

**Catatan Pengembangan:**  
Server ini ditujukan untuk development lokal. Untuk production deployment, pertimbangkan:
- Database proper (PostgreSQL/MongoDB)
- Environment variables untuk secrets
- HTTPS/SSL certificate
- Rate limiting & CORS policy
- CDN untuk static assets
