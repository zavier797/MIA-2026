# API Documentation - AksiWarga

Base URL: `http://127.0.0.1:3001`

---

## 🔐 Authentication

### 1. Register
**POST** `/api/auth/register`

**Request:**
```json
{
  "name": "Nama Lengkap",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "ok": true,
  "user": {
    "name": "Nama Lengkap",
    "email": "user@example.com"
  }
}
```

**Validasi:**
- Nama minimal 3 karakter
- Email format valid
- Password minimal 8 karakter

---

### 2. Login
**POST** `/api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "remember": true
}
```

**Response (200):**
```json
{
  "ok": true,
  "user": {
    "name": "Nama Lengkap",
    "email": "user@example.com"
  }
}
```

**Cookie:** `aksiwarga_session` (HttpOnly, 30 hari atau 24 jam)

---

### 3. Logout
**POST** `/api/auth/logout`

**Response (200):**
```json
{
  "ok": true
}
```

---

### 4. Get Current User
**GET** `/api/auth/me`

**Response (200):**
```json
{
  "user": {
    "name": "Nama Lengkap",
    "email": "user@example.com"
  }
}
```

atau jika tidak login:
```json
{
  "user": null
}
```

---

### 5. Forgot Password - Request OTP
**POST** `/api/auth/forgot-password`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Kode OTP telah dikirim ke email Anda.",
  "email": "user@example.com",
  "_dev_otp": "123456"
}
```

**Fitur:**
- OTP 6 digit angka
- Expired dalam 10 menit
- Maksimal 3x salah input
- OTP tampil di console server (untuk development)

---

### 6. Verify OTP
**POST** `/api/auth/verify-otp`

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "message": "OTP valid.",
  "resetToken": "a1b2c3d4..."
}
```

**Error (400):**
```json
{
  "error": "Kode OTP salah.",
  "remaining": 2
}
```

---

### 7. Reset Password
**POST** `/api/auth/reset-password`

**Request:**
```json
{
  "email": "user@example.com",
  "resetToken": "a1b2c3d4...",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "message": "Password berhasil direset. Silakan login."
}
```

**Validasi:**
- Password minimal 8 karakter
- Reset token valid 30 menit setelah OTP diverifikasi

---

## 📋 Reports (Laporan Pengaduan)

### 8. Submit Laporan
**POST** `/api/reports`

**Request:**
```json
{
  "title": "Jalan Berlubang Parah",
  "category": "Infrastruktur Jalan",
  "description": "Kondisi jalan rusak parah, berbahaya untuk kendaraan",
  "location": "Jl. Sudirman No. 45, Jakarta",
  "province": "DKI Jakarta",
  "reporterName": "Ahmad Rizki",
  "reporterEmail": "ahmad@example.com",
  "reporterPhone": "081234567890"
}
```

**Response (201):**
```json
{
  "report": {
    "id": "TW-2026-0895",
    "title": "Jalan Berlubang Parah",
    "status": "pending",
    "priority": "normal",
    "createdAt": "2026-11-10T12:15:48.396Z",
    "slaDeadline": "2026-11-17T12:15:48.396Z",
    ...
  },
  "message": "Laporan berhasil dibuat dengan ID TW-2026-0895"
}
```

**Validasi:**
- Title minimal 10 karakter
- Description minimal 20 karakter
- Category wajib diisi
- Location wajib diisi
- ReporterName wajib diisi

**Auto-Generated:**
- ID tiket (TW-2026-XXXX)
- Mapping kategori → dinas
- SLA deadline (7 hari / 12 jam untuk urgent)
- Timestamp

---

### 9. List Laporan
**GET** `/api/reports`

**Query Params:**
- `status` (optional): `pending`, `in_progress`, `completed`
- `category` (optional): `Infrastruktur Jalan`, `Kebersihan & Sanitasi`, dll

**Example:**
```
GET /api/reports?status=pending
GET /api/reports?category=Infrastruktur Jalan
GET /api/reports?status=in_progress&category=Penerangan Jalan
```

**Response (200):**
```json
{
  "reports": [
    {
      "id": "TW-2026-0892",
      "title": "...",
      "status": "pending",
      ...
    }
  ],
  "total": 5
}
```

---

### 10. Get Laporan by ID
**GET** `/api/reports/:id`

**Example:**
```
GET /api/reports/TW-2026-0892
GET /api/reports/0892
```

**Response (200):**
```json
{
  "report": {
    "id": "TW-2026-0892",
    "title": "Perbaikan Jalan Berlubang Parah",
    "category": "Infrastruktur Jalan",
    "status": "in_progress",
    "priority": "high",
    "assignedAgency": "Dinas Bina Marga",
    "reporter": {
      "name": "Ahmad Rizki",
      "email": "ahmad@example.com",
      "phone": "081234567890"
    },
    "logs": [
      {
        "timestamp": "2026-11-05T10:30:00Z",
        "action": "Laporan diterima",
        "actor": "Sistem"
      }
    ],
    ...
  }
}
```

**Response (404):**
```json
{
  "error": "Laporan tidak ditemukan."
}
```

---

## 💰 Budget Transparency

### 11. Get Budget APBD
**GET** `/api/budget`

**Query Params:**
- `province` (optional): `DKI_JAKARTA`, `JAWA_BARAT`, dll

**Example:**
```
GET /api/budget
GET /api/budget?province=DKI_JAKARTA
```

**Response (200):**
```json
{
  "provinces": [
    {
      "name": "DKI Jakarta",
      "code": "DKI_JAKARTA",
      "totalBudget": 82500000000000,
      "year": 2026,
      "categories": [
        {
          "name": "Infrastruktur",
          "allocated": 18500000000000,
          "spent": 16200000000000,
          "percentage": 22.4,
          "projects": 145
        }
      ],
      "major_projects": [...]
    }
  ]
}
```

---

## ⚠️ Error Responses

**400 Bad Request:**
```json
{
  "error": "Validation error message"
}
```

**401 Unauthorized:**
```json
{
  "error": "Email atau kata sandi salah."
}
```

**404 Not Found:**
```json
{
  "error": "Resource tidak ditemukan."
}
```

**409 Conflict:**
```json
{
  "error": "Email sudah terdaftar."
}
```

**413 Payload Too Large:**
```json
{
  "error": "Permintaan terlalu besar."
}
```

**429 Too Many Requests:**
```json
{
  "error": "Terlalu banyak percobaan."
}
```

---

## 🔧 Development Notes

### OTP Flow
1. User request OTP → `POST /api/auth/forgot-password`
2. Server generate 6-digit OTP, print ke console
3. User input OTP → `POST /api/auth/verify-otp`
4. Server return resetToken (valid 30 menit)
5. User submit password baru → `POST /api/auth/reset-password`

### Security
- Password hashing: PBKDF2 SHA-256 (120,000 iterations)
- Session: HttpOnly cookies
- OTP: 10 menit expiry, max 3 attempts
- Reset token: 30 menit expiry

### Data Storage
- `data/accounts.json` - User accounts
- `data/reports.json` - Complaint reports
- `data/budget.json` - APBD data
- `sessions` - In-memory Map
- `otpStore` - In-memory Map

---

**Last Updated:** 10 November 2026
