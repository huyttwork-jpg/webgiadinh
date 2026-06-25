/* =============================================
   GALLERY MODULE
   =============================================
   Handles photo gallery rendering, filtering,
   lightbox, and real API-based like functionality
   ============================================= */

const Gallery = (() => {
  // ── State ──
  let photos = [];
  let filteredPhotos = [];
  let currentFilter = 'all';
  let currentLightboxIndex = -1;
  let customPhotosSource = null;

  // ── DOM Elements ──
  let gridEl, emptyEl, lightboxEl, lightboxImage, lightboxTitle, lightboxDesc, lightboxDate, lightboxCategory, lightboxReactBtn, lightboxLikesSummary, lightboxCommentsList, lightboxCommentForm, lightboxCommentInput;

  // Category labels
  const CATEGORY_LABELS = {
    family: 'Gia đình',
    travel: 'Du lịch',
    birthday: 'Sinh nhật',
    daily: 'Hàng ngày'
  };

  // ── Initialize ──
  function init() {
    // Cache DOM elements
    gridEl = document.getElementById('galleryGrid');
    emptyEl = document.getElementById('galleryEmpty');
    lightboxEl = document.getElementById('lightbox');
    lightboxImage = document.getElementById('lightboxImage');
    lightboxTitle = document.getElementById('lightboxTitle');
    lightboxDesc = document.getElementById('lightboxDesc');
    lightboxDate = document.getElementById('lightboxDate');
    lightboxCategory = document.getElementById('lightboxCategory');
    lightboxReactBtn = document.getElementById('lightboxReactBtn');
    lightboxLikesSummary = document.getElementById('lightboxLikesSummary');
    lightboxCommentsList = document.getElementById('lightboxCommentsList');
    lightboxCommentForm = document.getElementById('lightboxCommentForm');
    lightboxCommentInput = document.getElementById('lightboxCommentInput');

    // Setup event listeners
    _setupFilters();
    _setupLightbox();

    // Load photos initially
    _loadPhotos();

    // Listen for new photos added via upload
    window.addEventListener('photo-added', (e) => {
      if (e.detail && e.detail.photo) {
        photos.unshift(e.detail.photo);
        _applyFilter();
      }
    });

    // Reload photos when login state changes to update red hearts
    window.addEventListener('auth-change', () => {
      _loadPhotos();
    });
  }

  // ── Load Photos from Backend ──
  async function _loadPhotos() {
    _renderSkeletons();

    try {
      const dbPhotos = await API.getPhotos();
      photos = dbPhotos || [];
    } catch (error) {
      console.error('Lỗi tải ảnh từ API:', error);
      App.showToast('Không thể kết nối đến cơ sở dữ liệu để tải ảnh.', 'error');
    }

    _updatePhotoCount();
    _applyFilter();
  }

  // ── Render Skeletons ──
  function _renderSkeletons() {
    if (!gridEl) return;
    let html = '';
    for (let i = 0; i < 6; i++) {
      html += `
        <div class="gallery-skeleton">
          <div class="skeleton-image"></div>
        </div>
      `;
    }
    gridEl.innerHTML = html;
  }

  // ── Setup Filters ──
  function _setupFilters() {
    const filtersEl = document.getElementById('galleryFilters');
    if (!filtersEl) return;

    filtersEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      const filter = btn.dataset.filter;
      if (filter === currentFilter) return;

      // Update active button
      filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilter = filter;
      _applyFilter();
    });
  }

  // ── Apply Filter ──
  function _applyFilter() {
    if (currentFilter === 'all') {
      filteredPhotos = [...photos];
    } else {
      filteredPhotos = photos.filter(p => p.category === currentFilter);
    }

    _renderGallery();
  }

  // ── Render Gallery ──
  function _renderGallery() {
    if (!gridEl) return;

    if (filteredPhotos.length === 0) {
      gridEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    const currentUser = API.getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;

    gridEl.innerHTML = filteredPhotos.map((photo, index) => {
      const isLiked = photo.likedBy && photo.likedBy.includes(currentUserId);
      const categoryLabel = CATEGORY_LABELS[photo.category] || photo.category;
      
      const canDelete = currentUser && (photo.uploaderId === currentUserId || currentUser.username === 'admin');
      const deleteButtonHtml = canDelete ? `
        <button class="gallery-card-delete" 
                aria-label="Xóa ảnh"
                onclick="event.stopPropagation(); Gallery.deletePhoto('${photo.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-9 5h10M9 11v6m4-6v6"/>
          </svg>
        </button>
      ` : '';

      return `
        <div class="gallery-card" 
             data-id="${photo.id}" 
             data-category="${photo.category}" 
             style="--card-index: ${index}"
             role="button"
             tabindex="0"
             aria-label="Xem ảnh: ${photo.title}">
          <div class="gallery-card-image">
            <img src="${photo.url}" 
                 alt="${photo.title}" 
                 loading="lazy"
                 onerror="this.src='https://picsum.photos/seed/fallback${index}/600/450'">
          </div>
          ${deleteButtonHtml}
          <button class="gallery-card-heart ${isLiked ? 'liked' : ''}" 
                  data-id="${photo.id}" 
                  aria-label="Yêu thích"
                  onclick="event.stopPropagation(); Gallery.toggleLike('${photo.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                 fill="${isLiked ? 'currentColor' : 'none'}" 
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            <span class="heart-count">${photo.likes || 0}</span>
          </button>
          <span class="gallery-card-badge">${categoryLabel}</span>
          <div class="gallery-card-overlay" onclick="Gallery.openLightbox(${index})">
            <div class="gallery-card-info">
              <h3>${photo.title}</h3>
              <p>${photo.description ? photo.description : `Đăng bởi ${photo.uploader}`}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Re-initialize Lucide icons for new elements
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // ── Toggle Like ──
  async function toggleLike(photoId) {
    if (!Auth.isLoggedIn()) {
      App.showToast('Vui lòng đăng nhập để thả tim ảnh! 💕', 'warning');
      Auth.openModal('login');
      return;
    }

    const confirmed = await App.showConfirm('Bạn có muốn thực hiện thao tác thích/bỏ thích bức ảnh này không?', 'Thích ảnh');
    if (!confirmed) return;

    try {
      const parsedId = parseInt(photoId);
      const result = await API.reactPhoto(parsedId);
      
      // Update local state
      const photo = photos.find(p => p.id === parsedId);
      if (photo) {
        photo.likes = result.likes;
        
        const currentUser = API.getCurrentUser();
        if (!photo.likedBy) photo.likedBy = [];
        
        if (result.liked) {
          if (!photo.likedBy.includes(currentUser.id)) {
            photo.likedBy.push(currentUser.id);
          }
        } else {
          photo.likedBy = photo.likedBy.filter(id => id !== currentUser.id);
        }
        
        // Re-apply filter to update render
        _applyFilter();
      }
    } catch (error) {
      console.error('Lỗi khi thích ảnh:', error);
      App.showToast(error.message, 'error');
    }
  }

  // ── Lightbox ──
  function _setupLightbox() {
    if (!lightboxEl) return;

    // Close button
    const closeBtn = document.getElementById('lightboxClose');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

    // Overlay click
    const overlay = document.getElementById('lightboxOverlay');
    if (overlay) overlay.addEventListener('click', closeLightbox);

    // Navigation
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');
    if (prevBtn) prevBtn.addEventListener('click', () => _navigateLightbox(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => _navigateLightbox(1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!lightboxEl.classList.contains('active')) return;

      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          _navigateLightbox(-1);
          break;
        case 'ArrowRight':
          _navigateLightbox(1);
          break;
      }
    });

    // Touch swipe for mobile
    let touchStartX = 0;
    lightboxEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightboxEl.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        _navigateLightbox(diff > 0 ? 1 : -1);
      }
    }, { passive: true });

    // Lightbox react button
    if (lightboxReactBtn) {
      lightboxReactBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const list = customPhotosSource || filteredPhotos;
        const photo = list[currentLightboxIndex];
        if (!photo) return;

        await toggleLike(photo.id);
        _updateLightboxLikes(photo);
      });
    }

    // Lightbox comment form submission
    if (lightboxCommentForm) {
      lightboxCommentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!Auth.isLoggedIn()) {
          App.showToast('Vui lòng đăng nhập để bình luận! 💬', 'warning');
          Auth.openModal('login');
          return;
        }

        const message = lightboxCommentInput.value.trim();
        if (!message) return;

        const list = customPhotosSource || filteredPhotos;
        const photo = list[currentLightboxIndex];
        if (!photo) return;

        try {
          await API.addComment(photo.id, message);
          lightboxCommentInput.value = '';
          _loadCommentsForCurrentPhoto(photo.id);
        } catch (err) {
          console.error('Lỗi khi gửi bình luận:', err);
          App.showToast(err.message, 'error');
        }
      });
    }
  }

  function openLightbox(index, customPhotos = null) {
    customPhotosSource = customPhotos;
    const list = customPhotosSource || filteredPhotos;
    if (!lightboxEl || index < 0 || index >= list.length) return;

    currentLightboxIndex = index;
    _updateLightboxContent();

    lightboxEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('active');
    document.body.style.overflow = '';
    currentLightboxIndex = -1;
    customPhotosSource = null;
  }

  function _navigateLightbox(direction) {
    const list = customPhotosSource || filteredPhotos;
    if (list.length === 0) return;

    currentLightboxIndex += direction;
    if (currentLightboxIndex < 0) currentLightboxIndex = list.length - 1;
    if (currentLightboxIndex >= list.length) currentLightboxIndex = 0;

    _updateLightboxContent();
  }

  function _updateLightboxContent() {
    const list = customPhotosSource || filteredPhotos;
    const photo = list[currentLightboxIndex];
    if (!photo) return;

    if (lightboxImage) lightboxImage.src = photo.url;
    if (lightboxTitle) lightboxTitle.textContent = photo.title || '';
    if (lightboxDesc) {
      const uploaderHtml = `<span class="lightbox-uploader-link" style="cursor: pointer; font-weight: 600; color: var(--primary-500); text-decoration: underline;" onclick="Gallery.closeLightbox(); UserProfile.open(${photo.uploaderId})">${_escapeHtml(photo.uploader)}</span>`;
      lightboxDesc.innerHTML = photo.description 
        ? `${_escapeHtml(photo.description)} (Đăng bởi: ${uploaderHtml})`
        : `Đăng bởi: ${uploaderHtml} (${_escapeHtml(photo.uploaderRelation)})`;
    }
    if (lightboxDate) lightboxDate.textContent = _formatDate(photo.createdAt);
    if (lightboxCategory) lightboxCategory.textContent = CATEGORY_LABELS[photo.category] || photo.category;

    _updateLightboxLikes(photo);
    _loadCommentsForCurrentPhoto(photo.id);
  }

  function _updateLightboxLikes(photo) {
    if (!lightboxReactBtn || !lightboxLikesSummary) return;

    const currentUser = API.getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;
    const isLiked = photo.likedBy && photo.likedBy.includes(currentUserId);

    if (isLiked) {
      lightboxReactBtn.classList.add('liked');
    } else {
      lightboxReactBtn.classList.remove('liked');
    }

    if (!photo.likedByUsers || photo.likedByUsers.length === 0) {
      lightboxLikesSummary.textContent = 'Chưa có ai thích ảnh này.';
    } else {
      const names = photo.likedByUsers.map(u => u.fullName);
      if (names.length === 1) {
        lightboxLikesSummary.textContent = `${names[0]} thích ảnh này.`;
      } else if (names.length === 2) {
        lightboxLikesSummary.textContent = `${names[0]} và ${names[1]} thích ảnh này.`;
      } else {
        lightboxLikesSummary.textContent = `${names[0]}, ${names[1]} và ${names.length - 2} người khác thích ảnh này.`;
      }
    }
  }

  async function _loadCommentsForCurrentPhoto(photoId) {
    if (!lightboxCommentsList) return;
    lightboxCommentsList.innerHTML = '<div class="comments-loading">Đang tải bình luận...</div>';

    try {
      const comments = await API.getComments(photoId);
      if (comments.length === 0) {
        lightboxCommentsList.innerHTML = '<div class="comments-empty">Chưa có bình luận nào.</div>';
        return;
      }

      lightboxCommentsList.innerHTML = comments.map(comment => {
        const initial = comment.author ? comment.author.charAt(0).toUpperCase() : 'U';
        const formattedTime = _formatRelativeTime(comment.createdAt);
        return `
          <div class="comment-item">
            <div class="comment-avatar" title="${_escapeHtml(comment.authorRelation)}">${initial}</div>
            <div class="comment-bubble">
              <div class="comment-author-row">
                <span class="comment-author-name" onclick="Gallery.closeLightbox(); UserProfile.open(${comment.userId})">${_escapeHtml(comment.author)}</span>
                <span class="comment-author-relation">(${_escapeHtml(comment.authorRelation)})</span>
              </div>
              <p class="comment-text">${_escapeHtml(comment.message)}</p>
              <span class="comment-time">${formattedTime}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Lỗi khi tải bình luận:', err);
      lightboxCommentsList.innerHTML = '<div class="comments-error">Không thể tải bình luận.</div>';
    }
  }

  function _formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    return `${diffDay} ngày trước`;
  }

  function _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Helpers ──
  function _formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function _updatePhotoCount() {
    const el = document.getElementById('photoCount');
    if (el) {
      el.textContent = photos.length;
      el.setAttribute('data-target', photos.length);
    }
  }

  function addPhoto(photo) {
    photos.unshift(photo);
    _updatePhotoCount();
    _applyFilter();
  }

  function getPhotoCount() {
    return photos.length;
  }

  // ── Delete Photo ──
  async function deletePhoto(photoId) {
    if (!Auth.isLoggedIn()) {
      App.showToast('Vui lòng đăng nhập để thực hiện tác vụ này.', 'warning');
      return;
    }

    const confirmed = await App.showConfirm('Bạn có chắc chắn muốn xóa bức ảnh này không? Hành động này không thể hoàn tác.', 'Xóa bức ảnh', true);
    if (!confirmed) return;

    try {
      const parsedId = parseInt(photoId);
      await API.deletePhoto(parsedId);
      
      // Update local state by removing the deleted photo
      photos = photos.filter(p => p.id !== parsedId);
      
      // Update count & re-render
      _updatePhotoCount();
      _applyFilter();
      
      App.showToast('Đã xóa ảnh thành công! 📸', 'success');
    } catch (error) {
      console.error('Lỗi khi xóa ảnh:', error);
      App.showToast(error.message || 'Không thể xóa ảnh.', 'error');
    }
  }

  function openLightboxByPhotoId(photoId) {
    const id = parseInt(photoId);
    const index = photos.findIndex(p => p.id === id);
    if (index !== -1) {
      openLightbox(index, photos);
    } else {
      console.warn('Không tìm thấy ảnh với ID:', photoId);
    }
  }

  // ── Public API ──
  return {
    init,
    openLightbox,
    closeLightbox,
    toggleLike,
    addPhoto,
    getPhotoCount,
    deletePhoto,
    openLightboxByPhotoId
  };
})();
