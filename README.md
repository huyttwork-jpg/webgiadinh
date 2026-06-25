# 🏠 Album Ảnh Gia Đình

Trang web album ảnh gia đình tương tác — Nơi lưu giữ khoảnh khắc và tình yêu thương.

## ✨ Tính năng

- 📸 **Gallery ảnh** với filter theo danh mục (Gia đình, Du lịch, Sinh nhật, Hàng ngày)
- 🔍 **Lightbox** xem ảnh full-screen với điều hướng bàn phím & touch swipe
- 💌 **Lời chúc** — Gửi và xem lời chúc từ người thân (realtime với Firebase)
- 📤 **Upload ảnh** với kéo-thả (drag & drop) và preview
- 🌙 **Dark/Light mode** tự động theo hệ thống hoặc toggle thủ công
- ❤️ **Like/yêu thích** ảnh
- 📱 **Responsive** — Đẹp trên mọi thiết bị

## 🚀 Bắt đầu nhanh

### Cách 1: Mở trực tiếp (không cần Firebase)

1. Mở file `index.html` bằng trình duyệt (hoặc dùng VS Code Live Server)
2. Trang web sẽ chạy với **dữ liệu mẫu** và **localStorage** làm database tạm
3. Bạn có thể thử gửi lời chúc, upload ảnh — dữ liệu lưu trên trình duyệt

### Cách 2: Kết nối Firebase (khuyến khích)

#### Bước 1: Tạo Firebase Project

1. Truy cập [console.firebase.google.com](https://console.firebase.google.com)
2. Nhấn **"Add project"** (Thêm dự án)
3. Đặt tên (VD: `album-gia-dinh`)
4. Tắt Google Analytics nếu không cần → **Create project**

#### Bước 2: Tạo Web App

1. Trong Firebase Console, nhấn biểu tượng **</>** (Web) để thêm web app
2. Đặt tên (VD: `album-web`)
3. **KHÔNG** tick "Firebase Hosting" 
4. Nhấn **Register app**
5. Copy các giá trị `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "album-gia-dinh.firebaseapp.com",
     projectId: "album-gia-dinh",
     storageBucket: "album-gia-dinh.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

#### Bước 3: Điền config

1. Mở file `js/firebase-config.js`
2. Dán các giá trị vào `FIREBASE_CONFIG`:
   ```javascript
   const FIREBASE_CONFIG = {
     apiKey: "AIza...",          // ← Dán giá trị của bạn
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

#### Bước 4: Bật Firebase SDK trong HTML

1. Mở file `index.html`
2. Tìm 3 dòng script Firebase bị comment (dòng ~31-33)
3. **Bỏ comment** (xóa `<!--` và `-->`)

#### Bước 5: Bật Firestore Database

1. Trong Firebase Console → **Build** → **Firestore Database**
2. Nhấn **Create database**
3. Chọn location (Asia) → **Start in test mode** → **Enable**
4. Sau khi test xong, vào **Rules** và sửa thành:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read: if true;
         allow write: if true;
       }
     }
   }
   ```
   > ⚠️ Rule này cho phép ai cũng đọc/ghi. Phù hợp cho trang gia đình private.
   > Nếu muốn bảo mật hơn, hãy thêm Authentication.

#### Bước 6: Bật Storage

1. Firebase Console → **Build** → **Storage**
2. Nhấn **Get started** → **Start in test mode** → **Done**

**Xong!** Reload trang web và Firebase sẽ tự kết nối. 🎉

---

## 🌐 Deploy (Triển khai)

### Deploy lên Vercel (Đề xuất — Miễn phí)

1. Push code lên GitHub
2. Truy cập [vercel.com](https://vercel.com) → Đăng nhập bằng GitHub
3. Nhấn **"New Project"** → Chọn repo
4. Framework Preset: **Other** 
5. Nhấn **Deploy** → Xong! Bạn sẽ có URL dạng `album-gia-dinh.vercel.app`

### Deploy lên Netlify

1. Push code lên GitHub
2. Truy cập [netlify.com](https://netlify.com) → Đăng nhập
3. Nhấn **"Add new site"** → **Import from Git** → Chọn repo
4. Build command: _(để trống)_
5. Publish directory: `.`
6. Nhấn **Deploy**

### Deploy lên GitHub Pages

1. Push code lên GitHub
2. Vào repo → **Settings** → **Pages**
3. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
4. Nhấn **Save** → Chờ 1-2 phút
5. URL: `https://username.github.io/repo-name`

---

## 📁 Cấu trúc thư mục

```
├── index.html              ← Trang chính
├── css/
│   └── style.css           ← Toàn bộ CSS
├── js/
│   ├── firebase-config.js  ← Cấu hình Firebase + Database abstraction
│   ├── gallery.js          ← Gallery, lightbox, filter, like
│   ├── wishes.js           ← Lời chúc (form, render, emoji)
│   ├── upload.js           ← Upload ảnh (drag & drop, preview)
│   └── app.js              ← Khởi tạo chung, navbar, dark mode, animations
└── README.md               ← File này
```

## 💡 Tùy chỉnh

- **Đổi tên gia đình**: Tìm "Gia Đình" trong `index.html` và thay thế
- **Đổi màu chủ đạo**: Sửa `--primary-*` trong `css/style.css`
- **Thêm ảnh mẫu**: Sửa `SAMPLE_PHOTOS` trong `js/gallery.js`
- **Thêm lời chúc mẫu**: Sửa `SAMPLE_WISHES` trong `js/wishes.js`
- **Thay ảnh mẫu bằng ảnh thật**: Upload ảnh qua giao diện hoặc thêm trực tiếp vào Firebase Storage

---

Được tạo với 💕 cho gia đình yêu thương
