/* =============================================
   FIREBASE CONFIGURATION
   =============================================
   Hướng dẫn:
   1. Truy cập https://console.firebase.google.com
   2. Tạo project mới (hoặc dùng project có sẵn)
   3. Vào Project Settings > General > Your apps > Add web app
   4. Copy các giá trị config vào bên dưới
   5. Bật Firestore Database (Cloud Firestore) trong Build menu
   6. Bật Storage trong Build menu
   ============================================= */

// ── Firebase Config ──
// Thay thế các giá trị "" bằng config thật từ Firebase Console
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ── Database Abstraction Layer ──
// Tự động chọn Firebase hoặc localStorage fallback
class DatabaseService {
  constructor() {
    this.useFirebase = false;
    this.listeners = new Map();
    this._initFirebase();
  }

  _initFirebase() {
    // Check if Firebase config is filled in
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "") {
      console.info(
        '%c📦 Firebase chưa được cấu hình — Đang dùng localStorage làm database tạm.',
        'color: #F59E0B; font-weight: bold;'
      );
      console.info(
        '%cĐể sử dụng Firebase, hãy điền config vào file js/firebase-config.js',
        'color: #9CA3AF;'
      );
      this.useFirebase = false;
      return;
    }

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK chưa được load. Đang dùng localStorage.');
      this.useFirebase = false;
      return;
    }

    try {
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      this.db = firebase.firestore();
      this.storage = firebase.storage();
      this.useFirebase = true;
      console.info(
        '%c🔥 Firebase đã kết nối thành công!',
        'color: #22C55E; font-weight: bold;'
      );
    } catch (error) {
      console.error('Lỗi khởi tạo Firebase:', error);
      this.useFirebase = false;
    }
  }

  // ── Firestore Operations ──

  // Get all documents from a collection
  async getAll(collection) {
    if (this.useFirebase) {
      try {
        const snapshot = await this.db.collection(collection)
          .orderBy('createdAt', 'desc')
          .get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error(`Lỗi đọc ${collection}:`, error);
        return this._localGetAll(collection);
      }
    }
    return this._localGetAll(collection);
  }

  // Add a document to a collection
  async add(collection, data) {
    const docData = {
      ...data,
      createdAt: this.useFirebase
        ? firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString()
    };

    if (this.useFirebase) {
      try {
        const ref = await this.db.collection(collection).add(docData);
        return { id: ref.id, ...docData };
      } catch (error) {
        console.error(`Lỗi thêm vào ${collection}:`, error);
        return this._localAdd(collection, docData);
      }
    }
    return this._localAdd(collection, docData);
  }

  // Listen to realtime changes (Firestore onSnapshot)
  onChanges(collection, callback) {
    if (this.useFirebase) {
      try {
        const unsubscribe = this.db.collection(collection)
          .orderBy('createdAt', 'desc')
          .onSnapshot(snapshot => {
            const docs = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            callback(docs);
          }, error => {
            console.error(`Lỗi listener ${collection}:`, error);
          });
        this.listeners.set(collection, unsubscribe);
        return unsubscribe;
      } catch (error) {
        console.error(`Lỗi tạo listener ${collection}:`, error);
      }
    }

    // Fallback: return current data immediately
    callback(this._localGetAll(collection));
    return () => {};
  }

  // Get document count
  async getCount(collection) {
    if (this.useFirebase) {
      try {
        const snapshot = await this.db.collection(collection).get();
        return snapshot.size;
      } catch (error) {
        return this._localGetAll(collection).length;
      }
    }
    return this._localGetAll(collection).length;
  }

  // ── Storage Operations ──

  // Upload a file
  async uploadFile(file, path) {
    if (this.useFirebase && this.storage) {
      try {
        const storageRef = this.storage.ref(path);
        const uploadTask = storageRef.put(file);

        return new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              if (this._uploadProgressCallback) {
                this._uploadProgressCallback(progress);
              }
            },
            (error) => reject(error),
            async () => {
              const url = await uploadTask.snapshot.ref.getDownloadURL();
              resolve(url);
            }
          );
        });
      } catch (error) {
        console.error('Lỗi upload file:', error);
        return this._localUploadFile(file);
      }
    }
    return this._localUploadFile(file);
  }

  // Set upload progress callback
  onUploadProgress(callback) {
    this._uploadProgressCallback = callback;
  }

  // ── LocalStorage Fallback Methods ──

  _localGetAll(collection) {
    try {
      const data = localStorage.getItem(`giadinh_${collection}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _localAdd(collection, data) {
    const items = this._localGetAll(collection);
    const newItem = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data
    };
    items.unshift(newItem);
    localStorage.setItem(`giadinh_${collection}`, JSON.stringify(items));

    // Notify any listeners
    this._notifyLocalListeners(collection);

    return newItem;
  }

  _localUploadFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 15;
          if (progress > 100) progress = 100;
          if (this._uploadProgressCallback) {
            this._uploadProgressCallback(progress);
          }
          if (progress >= 100) {
            clearInterval(interval);
            resolve(e.target.result);
          }
        }, 100);
      };
      reader.readAsDataURL(file);
    });
  }

  _notifyLocalListeners(collection) {
    // Re-trigger any onChanges callbacks for localStorage mode
    // Using a custom event system
    window.dispatchEvent(new CustomEvent('localdb-change', {
      detail: { collection }
    }));
  }
}

// ── Singleton Export ──
const db = new DatabaseService();
