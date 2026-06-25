const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDb, query } = require('./db');
const { sendSMS } = require('./sms');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'giadinh_secret_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads folder if it doesn't exist (fail-safe for serverless)
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('Không thể khởi tạo thư mục uploads cục bộ (dự kiến trong môi trường Serverless):', err.message);
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện tác vụ này.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    req.user = user;
    next();
  });
}

// Multer Config for Photo Uploads (Dynamic switch: Cloudinary or Local Disk)
let storage;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  console.log('Thông tin Cloudinary hợp lệ. Sử dụng Cloudinary cho việc lưu trữ ảnh tải lên.');
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'family-album',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif']
    }
  });
} else {
  console.log('Không tìm thấy cấu hình Cloudinary. Sử dụng bộ nhớ đĩa cục bộ cho ảnh tải lên.');
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    }
  });
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép tải lên tệp ảnh!'), false);
    }
  }
});

// Middleware wrapper to validate Cloudinary environment variables on Vercel and handle Multer errors safely
const uploadMiddleware = (req, res, next) => {
  const isCloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (process.env.VERCEL && !isCloudinaryConfigured) {
    return res.status(400).json({
      error: 'Cấu hình lưu trữ chưa hoàn tất. Vui lòng thiết lập các biến môi trường Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) trên Vercel Dashboard để cho phép tải lên hình ảnh.'
    });
  }
  
  upload.single('photo')(req, res, (err) => {
    if (err) {
      console.error('Lỗi tải ảnh (Multer wrapper):', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Kích thước tệp quá lớn. Tối đa cho phép là 5MB.' });
        }
        return res.status(400).json({ error: `Lỗi tải tệp: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Lỗi xử lý tệp tải lên.' });
    }
    next();
  });
};


// ── API ROUTES ──

// --- 1. AUTH ---

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, relation, phoneNumber } = req.body;
    
    if (!username || !password || !fullName || !relation || !phoneNumber) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanPhone = phoneNumber.trim();

    // Check username
    const existingUser = await query('SELECT * FROM users WHERE username = $1', [cleanUsername]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    // Check phone
    const existingPhone = await query('SELECT * FROM users WHERE phoneNumber = $1', [cleanPhone]);
    if (existingPhone.rowCount > 0) {
      return res.status(400).json({ error: 'Số điện thoại này đã được sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, password, fullName, relation, phoneNumber) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [cleanUsername, hashedPassword, fullName.trim(), relation, cleanPhone]
    );

    const newUser = { 
      id: result.rows[0].id, 
      username: cleanUsername, 
      fullName: fullName.trim(), 
      relation, 
      phoneNumber: cleanPhone 
    };
    
    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng điền tên đăng nhập và mật khẩu.' });
    }

    const userRes = await query('SELECT * FROM users WHERE username = $1', [username.toLowerCase().trim()]);

    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    const user = userRes.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    const tokenUser = { 
      id: user.id, 
      username: user.username, 
      fullName: user.fullname, 
      relation: user.relation, 
      phoneNumber: user.phonenumber 
    };
    const token = jwt.sign(tokenUser, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user: tokenUser, token });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống.' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Vui lòng nhập số điện thoại.' });
    }

    const cleanPhone = phoneNumber.trim();

    // Check user by phone
    const userRes = await query('SELECT * FROM users WHERE phoneNumber = $1', [cleanPhone]);
    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Số điện thoại chưa được đăng ký.' });
    }

    const user = userRes.rows[0];

    // Generate random 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    // Expire in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Disable all previous OTPs for this user
    await query('UPDATE otps SET used = true WHERE userId = $1 AND used = false', [user.id]);

    // Insert new OTP
    await query(
      'INSERT INTO otps (userId, code, expiresAt) VALUES ($1, $2, $3)',
      [user.id, code, expiresAt]
    );

    // Send SMS via the helper
    const smsMessage = `Ma OTP dat lai mat khau Album Gia Dinh cua ban la: ${code}. Han dung 5 phut.`;
    await sendSMS(cleanPhone, smsMessage);

    // Log the OTP on backend console for local testing
    console.log("\n==========================================");
    console.log(`[OTP VERIFICATION] Người dùng: ${user.fullname} (${cleanPhone})`);
    console.log(`MÃ OTP ĐẶT LẠI MẬT KHẨU LÀ: ${code}`);
    console.log(`Hạn sử dụng đến: ${expiresAt.toLocaleTimeString('vi-VN')}`);
    console.log("==========================================\n");

    res.json({ 
      success: true, 
      message: 'Mã OTP đã được gửi về số điện thoại của bạn.' 
    });
  } catch (error) {
    console.error('Lỗi gửi OTP:', error);
    res.status(500).json({ error: error.message || 'Không thể gửi mã OTP. Đã xảy ra lỗi hệ thống.' });
  }
});

// Reset password with OTP
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phoneNumber, code, newPassword } = req.body;

    if (!phoneNumber || !code || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
    }

    const cleanPhone = phoneNumber.trim();
    const cleanCode = code.trim();

    // Get user by phone
    const userRes = await query('SELECT * FROM users WHERE phoneNumber = $1', [cleanPhone]);
    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Không tìm thấy người dùng với số điện thoại này.' });
    }

    const user = userRes.rows[0];

    // Find valid OTP
    const otpRes = await query(
      'SELECT * FROM otps WHERE userId = $1 AND code = $2 AND expiresAt > NOW() AND used = false',
      [user.id, cleanCode]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ error: 'Mã OTP không chính xác, đã hết hạn hoặc đã sử dụng.' });
    }

    const otpId = otpRes.rows[0].id;

    // Delete the OTP immediately so it is completely gone (one-time use)
    await query('DELETE FROM otps WHERE id = $1', [otpId]);

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

    res.json({ success: true, message: 'Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Lỗi reset password:', error);
    res.status(500).json({ error: 'Lỗi khi đặt lại mật khẩu.' });
  }
});

// Get profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Update profile details
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, relation, phoneNumber } = req.body;
    const userId = req.user.id;

    if (!fullName || !relation || !phoneNumber) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    const cleanPhone = phoneNumber.trim();

    // Check if phone number is already taken by another user
    const checkPhone = await query(
      'SELECT id FROM users WHERE phoneNumber = $1 AND id != $2',
      [cleanPhone, userId]
    );

    if (checkPhone.rowCount > 0) {
      return res.status(400).json({ error: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác.' });
    }

    // Update in database
    const updateRes = await query(
      `UPDATE users 
       SET fullName = $1, relation = $2, phoneNumber = $3 
       WHERE id = $4 
       RETURNING id, username, fullName as "fullName", relation, phoneNumber as "phoneNumber"`,
      [fullName.trim(), relation, cleanPhone, userId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
    }

    const updatedUser = updateRes.rows[0];

    // Re-sign token with updated info
    const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      success: true, 
      message: 'Cập nhật thông tin thành công!', 
      user: updatedUser,
      token 
    });
  } catch (error) {
    console.error('Lỗi cập nhật hồ sơ:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống khi cập nhật thông tin.' });
  }
});

// Delete user account
app.delete('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete user from DB. Due to ON DELETE CASCADE, all their photos, wishes, reactions, otps will also be deleted.
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ 
      success: true, 
      message: 'Tài khoản của bạn đã được xóa thành công.' 
    });
  } catch (error) {
    console.error('Lỗi xóa tài khoản:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống khi xóa tài khoản.' });
  }
});

// Get user profile by ID (including their photos and wishes)
app.get('/api/users/:id/profile', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Fetch user basic info (excluding password)
    const userRes = await query(
      'SELECT id, username, fullName as "fullName", relation, phoneNumber as "phoneNumber", createdAt as "createdAt" FROM users WHERE id = $1',
      [userId]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    const user = userRes.rows[0];

    // Fetch photos posted by this user
    const photosRes = await query(`
      SELECT p.id, p.url, p.title, p.description, p.category, p.createdAt as "createdAt",
             u.fullName as uploader, u.relation as "uploaderRelation", u.id as "uploaderId"
      FROM photos p
      JOIN users u ON p.userId = u.id
      WHERE p.userId = $1
      ORDER BY p.createdAt DESC
    `, [userId]);

    // Fetch reactions for these photos
    const reactionsRes = await query(`
      SELECT r.photoId as "photoId", r.userId as "userId", r.type, u.fullName as "fullName", u.relation as "relation"
      FROM reactions r
      JOIN photos p ON r.photoId = p.id
      JOIN users u ON r.userId = u.id
      WHERE p.userId = $1
    `, [userId]);

    const reactionsByPhoto = {};
    reactionsRes.rows.forEach(r => {
      if (!reactionsByPhoto[r.photoId]) {
        reactionsByPhoto[r.photoId] = [];
      }
      reactionsByPhoto[r.photoId].push({ userId: r.userId, type: r.type, fullName: r.fullName, relation: r.relation });
    });

    const photos = photosRes.rows.map(photo => {
      const photoReactions = reactionsByPhoto[photo.id] || [];
      return {
        ...photo,
        likes: photoReactions.length,
        likedBy: photoReactions.map(r => r.userId),
        likedByUsers: photoReactions.map(r => ({ userId: r.userId, fullName: r.fullName, relation: r.relation }))
      };
    });

    // Fetch wishes written by this user
    const wishesRes = await query(`
      SELECT w.id, w.message, w.emoji, w.createdAt as "createdAt",
             u.fullName as name, u.relation, u.id as "userId"
      FROM wishes w
      JOIN users u ON w.userId = u.id
      WHERE w.userId = $1
      ORDER BY w.createdAt DESC
    `, [userId]);

    res.json({
      user,
      photos,
      wishes: wishesRes.rows
    });
  } catch (error) {
    console.error('Lỗi lấy hồ sơ người dùng:', error);
    res.status(500).json({ error: 'Lỗi tải thông tin hồ sơ.' });
  }
});

// --- 2. PHOTOS ---

// Get all photos
app.get('/api/photos', async (req, res) => {
  try {
    // Fetch photos with uploader info
    const photosRes = await query(`
      SELECT p.id, p.url, p.title, p.description, p.category, p.createdAt as "createdAt",
             u.fullName as uploader, u.relation as "uploaderRelation", u.id as "uploaderId"
      FROM photos p
      JOIN users u ON p.userId = u.id
      ORDER BY p.createdAt DESC
    `);

    // Fetch reactions for each photo
    const reactionsRes = await query(`
      SELECT r.photoId as "photoId", r.userId as "userId", r.type, u.fullName as "fullName", u.relation as "relation"
      FROM reactions r
      JOIN users u ON r.userId = u.id
    `);
    
    // Group reactions by photoId
    const reactionsByPhoto = {};
    reactionsRes.rows.forEach(r => {
      if (!reactionsByPhoto[r.photoId]) {
        reactionsByPhoto[r.photoId] = [];
      }
      reactionsByPhoto[r.photoId].push({ userId: r.userId, type: r.type, fullName: r.fullName, relation: r.relation });
    });

    // Attach likes count and list of userIds who liked it
    const processedPhotos = photosRes.rows.map(photo => {
      const photoReactions = reactionsByPhoto[photo.id] || [];
      return {
        ...photo,
        likes: photoReactions.length,
        likedBy: photoReactions.map(r => r.userId),
        likedByUsers: photoReactions.map(r => ({ userId: r.userId, fullName: r.fullName, relation: r.relation }))
      };
    });

    res.json(processedPhotos);
  } catch (error) {
    console.error('Lỗi lấy ảnh:', error);
    res.status(500).json({ error: 'Lỗi tải danh sách ảnh.' });
  }
});

// Add photo
app.post('/api/photos', authenticateToken, uploadMiddleware, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn ảnh để tải lên.' });
    }

    // Determine target URL dynamically (Cloudinary gives full URL in path, Multer disk gives filename)
    let imageUrl;
    if (req.file.path && req.file.path.startsWith('http')) {
      imageUrl = req.file.path;
    } else {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const result = await query(
      `INSERT INTO photos (url, title, description, category, userId) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        imageUrl, 
        title ? title.trim() : req.file.originalname, 
        description ? description.trim() : '', 
        category || 'family', 
        req.user.id
      ]
    );

    const newPhoto = {
      id: result.rows[0].id,
      url: imageUrl,
      title: title ? title.trim() : req.file.originalname,
      description: description ? description.trim() : '',
      category: category || 'family',
      uploader: req.user.fullName,
      uploaderRelation: req.user.relation,
      uploaderId: req.user.id,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    };

    res.status(201).json(newPhoto);
  } catch (error) {
    console.error('Lỗi thêm ảnh:', error);
    res.status(500).json({ error: 'Lỗi tải ảnh lên.' });
  }
});

// Toggle reaction
app.post('/api/photos/:id/react', authenticateToken, async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const userId = req.user.id;

    // Verify photo exists
    const photoRes = await query('SELECT * FROM photos WHERE id = $1', [photoId]);
    if (photoRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh.' });
    }

    const photoOwnerId = photoRes.rows[0].userid;

    // Check if user already reacted
    const existingRes = await query(
      'SELECT * FROM reactions WHERE photoId = $1 AND userId = $2',
      [photoId, userId]
    );

    let liked = false;
    if (existingRes.rowCount > 0) {
      // Toggle off
      await query('DELETE FROM reactions WHERE photoId = $1 AND userId = $2', [photoId, userId]);
      
      // Remove corresponding like notification
      await query(
        'DELETE FROM notifications WHERE userId = $1 AND senderId = $2 AND photoId = $3 AND type = $4',
        [photoOwnerId, userId, photoId, 'like']
      );
    } else {
      // Toggle on
      await query(
        'INSERT INTO reactions (photoId, userId, type) VALUES ($1, $2, $3)',
        [photoId, userId, 'heart']
      );
      liked = true;

      // Add notification (if sender is not uploader)
      if (photoOwnerId !== userId) {
        // First check if it already exists to prevent duplicate entries
        const dupCheck = await query(
          'SELECT id FROM notifications WHERE userId = $1 AND senderId = $2 AND photoId = $3 AND type = $4',
          [photoOwnerId, userId, photoId, 'like']
        );
        if (dupCheck.rowCount === 0) {
          await query(
            'INSERT INTO notifications (userId, senderId, photoId, type, content) VALUES ($1, $2, $3, $4, $5)',
            [photoOwnerId, userId, photoId, 'like', null]
          );
        }
      }
    }

    // Get new count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM reactions WHERE photoId = $1',
      [photoId]
    );

    res.json({ liked, likes: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Lỗi react ảnh:', error);
    res.status(500).json({ error: 'Lỗi xử lý yêu thích.' });
  }
});

// Delete photo
app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const userId = req.user.id;
    const username = req.user.username;

    // Verify photo exists and find who uploaded it
    const photoRes = await query('SELECT * FROM photos WHERE id = $1', [photoId]);
    if (photoRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh.' });
    }

    const photo = photoRes.rows[0];

    // Check permission: must be owner or admin
    if (photo.userid !== userId && username !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bức ảnh này.' });
    }

    // Get local file path and try to delete it
    const filename = path.basename(photo.url);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Lỗi xóa file trên ổ đĩa:', err);
      }
    }

    // Delete from database
    await query('DELETE FROM photos WHERE id = $1', [photoId]);

    res.json({ success: true, message: 'Đã xóa ảnh thành công.' });
  } catch (error) {
    console.error('Lỗi xóa ảnh:', error);
    res.status(500).json({ error: 'Không thể xóa ảnh. Đã xảy ra lỗi hệ thống.' });
  }
});

// --- COMMENTS API ---

// Get comments for a photo
app.get('/api/photos/:id/comments', async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const commentsRes = await query(`
      SELECT c.id, c.photoId as "photoId", c.userId as "userId", c.message, c.createdAt as "createdAt",
             u.fullName as "author", u.relation as "authorRelation"
      FROM comments c
      JOIN users u ON c.userId = u.id
      WHERE c.photoId = $1
      ORDER BY c.createdAt ASC
    `, [photoId]);

    res.json(commentsRes.rows);
  } catch (error) {
    console.error('Lỗi lấy bình luận:', error);
    res.status(500).json({ error: 'Lỗi tải bình luận.' });
  }
});

// Add comment to a photo
app.post('/api/photos/:id/comments', authenticateToken, async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung bình luận không được để trống.' });
    }

    // Verify photo exists
    const photoRes = await query('SELECT * FROM photos WHERE id = $1', [photoId]);
    if (photoRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh.' });
    }

    const photoOwnerId = photoRes.rows[0].userid;

    // Insert comment
    const result = await query(
      'INSERT INTO comments (photoId, userId, message) VALUES ($1, $2, $3) RETURNING id, createdAt as "createdAt"',
      [photoId, userId, message.trim()]
    );

    const commentId = result.rows[0].id;
    const createdAt = result.rows[0].createdAt;

    // Send notification if owner is not the commenter
    if (photoOwnerId !== userId) {
      await query(
        'INSERT INTO notifications (userId, senderId, photoId, type, content) VALUES ($1, $2, $3, $4, $5)',
        [photoOwnerId, userId, photoId, 'comment', message.trim()]
      );
    }

    res.status(201).json({
      id: commentId,
      photoId,
      userId,
      message: message.trim(),
      createdAt,
      author: req.user.fullName,
      authorRelation: req.user.relation
    });
  } catch (error) {
    console.error('Lỗi thêm bình luận:', error);
    res.status(500).json({ error: 'Lỗi gửi bình luận.' });
  }
});

// --- NOTIFICATIONS API ---

// Get current notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifsRes = await query(`
      SELECT n.id, n.userId as "userId", n.senderId as "senderId", n.photoId as "photoId", n.type, n.content, n.isRead as "isRead", n.createdAt as "createdAt",
             u.fullName as "senderName", u.relation as "senderRelation",
             p.title as "photoTitle", p.url as "photoUrl"
      FROM notifications n
      JOIN users u ON n.senderId = u.id
      JOIN photos p ON n.photoId = p.id
      WHERE n.userId = $1
      ORDER BY n.createdAt DESC
    `, [userId]);

    res.json(notifsRes.rows);
  } catch (error) {
    console.error('Lỗi lấy thông báo:', error);
    res.status(500).json({ error: 'Lỗi tải thông báo.' });
  }
});

// Mark notifications as read
app.put('/api/notifications/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user.id;

    if (id) {
      await query('UPDATE notifications SET isRead = true WHERE id = $1 AND userId = $2', [id, userId]);
    } else {
      await query('UPDATE notifications SET isRead = true WHERE userId = $1', [userId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi đọc thông báo:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật thông báo.' });
  }
});

// --- 3. WISHES ---

// Get all wishes
app.get('/api/wishes', async (req, res) => {
  try {
    const wishesRes = await query(`
      SELECT w.id, w.message, w.emoji, w.createdAt as "createdAt",
             u.fullName as name, u.relation, u.id as "userId"
      FROM wishes w
      JOIN users u ON w.userId = u.id
      ORDER BY w.createdAt DESC
    `);
    res.json(wishesRes.rows);
  } catch (error) {
    console.error('Lỗi lấy lời chúc:', error);
    res.status(500).json({ error: 'Lỗi tải lời chúc.' });
  }
});

// Add wish
app.post('/api/wishes', authenticateToken, async (req, res) => {
  try {
    const { message, emoji } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung lời chúc.' });
    }

    const result = await query(
      `INSERT INTO wishes (userId, message, emoji) VALUES ($1, $2, $3) RETURNING id`,
      [req.user.id, message.trim(), emoji || '❤️']
    );

    const newWish = {
      id: result.rows[0].id,
      message: message.trim(),
      emoji: emoji || '❤️',
      name: req.user.fullName,
      relation: req.user.relation,
      userId: req.user.id,
      createdAt: new Date().toISOString()
    };

    res.status(201).json(newWish);
  } catch (error) {
    console.error('Lỗi gửi lời chúc:', error);
    res.status(500).json({ error: 'Lỗi gửi lời chúc.' });
  }
});

// Delete wish
app.delete('/api/wishes/:id', authenticateToken, async (req, res) => {
  try {
    const wishId = parseInt(req.params.id);
    const userId = req.user.id;
    const username = req.user.username;

    // Verify wish exists and find who wrote it
    const wishRes = await query('SELECT * FROM wishes WHERE id = $1', [wishId]);
    if (wishRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lời chúc.' });
    }

    const wish = wishRes.rows[0];

    // Check permission: owner or admin
    if (wish.userid !== userId && username !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa lời chúc này.' });
    }

    // Delete from database
    await query('DELETE FROM wishes WHERE id = $1', [wishId]);

    res.json({ success: true, message: 'Đã xóa lời chúc thành công.' });
  } catch (error) {
    console.error('Lỗi xóa lời chúc:', error);
    res.status(500).json({ error: 'Không thể xóa lời chúc. Đã xảy ra lỗi hệ thống.' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const photoCountRes = await query('SELECT COUNT(*) as count FROM photos');
    const wishCountRes = await query('SELECT COUNT(*) as count FROM wishes');
    const userCountRes = await query('SELECT COUNT(*) as count FROM users');

    res.json({
      photos: parseInt(photoCountRes.rows[0].count),
      wishes: parseInt(wishCountRes.rows[0].count),
      users: parseInt(userCountRes.rows[0].count)
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê:', error);
    res.status(500).json({ error: 'Lỗi tải dữ liệu thống kê.' });
  }
});

// Diagnostics endpoint
app.get('/api/diagnostics', async (req, res) => {
  const diagnostics = {
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      VERCEL: !!process.env.VERCEL,
      PORT: PORT,
      timestamp: new Date().toISOString()
    },
    database: {
      connected: false,
      error: null,
      usingUrl: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL)
    },
    cloudinary: {
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing',
      apiKey: process.env.CLOUDINARY_API_KEY ? 'Configured' : 'Missing',
      apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Configured' : 'Missing'
    }
  };

  try {
    await query('SELECT 1');
    diagnostics.database.connected = true;
  } catch (err) {
    diagnostics.database.error = err.message;
  }

  res.json(diagnostics);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Đã xảy ra lỗi hệ thống.',
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Catch-all route to serve index.html for frontend SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Init DB and export/start server (Dynamic Vercel Serverless check)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('Không thể khởi tạo cơ sở dữ liệu khi chạy cục bộ:', err);
    });
} else {
  // Trực tiếp khởi chạy kết nối DB bất đồng bộ trong nền dưới môi trường Serverless của Vercel
  initDb().catch(err => {
    console.error('Không thể tự động cập nhật cơ sở dữ liệu trên Vercel:', err);
  });
}

module.exports = app;
