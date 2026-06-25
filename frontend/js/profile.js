/* =============================================
   USER PROFILE VIEW MODULE
   =============================================
   Handles user profile modal display: uploader stats,
   posted photos, written wishes, and tab swapping.
   ============================================= */

const UserProfile = (() => {
  // ── State ──
  let currentProfileUser = null;
  let currentProfilePhotos = [];
  let currentProfileWishes = [];
  let activeTab = 'photos';

  // ── DOM Elements ──
  let modalEl, closeBtn, avatarEl, fullNameEl, relationEl, usernameEl, phoneEl;
  let photoCountEl, wishCountEl, editSelfContainerEl, editSelfBtnEl;
  let tabPhotosBtn, tabWishesBtn, contentPhotosEl, contentWishesEl;
  let photosGridEl, wishesListEl, photosEmptyEl, wishesEmptyEl;

  // ── Initialize & Cache ──
  function _cacheDOM() {
    modalEl = document.getElementById('userProfileViewModal');
    closeBtn = document.getElementById('userProfileViewClose');
    
    avatarEl = document.getElementById('upvAvatar');
    fullNameEl = document.getElementById('upvFullName');
    relationEl = document.getElementById('upvRelation');
    usernameEl = document.getElementById('upvUsername');
    phoneEl = document.getElementById('upvPhone');

    photoCountEl = document.getElementById('upvPhotoCount');
    wishCountEl = document.getElementById('upvWishCount');
    editSelfContainerEl = document.getElementById('upvEditSelfContainer');
    editSelfBtnEl = document.getElementById('upvEditSelfBtn');

    tabPhotosBtn = document.getElementById('upvTabPhotos');
    tabWishesBtn = document.getElementById('upvTabWishes');
    contentPhotosEl = document.getElementById('upvContentPhotos');
    contentWishesEl = document.getElementById('upvContentWishes');

    photosGridEl = document.getElementById('upvPhotosGrid');
    wishesListEl = document.getElementById('upvWishesList');
    photosEmptyEl = document.getElementById('upvPhotosEmpty');
    wishesEmptyEl = document.getElementById('upvWishesEmpty');

    _setupListeners();
  }

  // ── Setup Listeners ──
  function _setupListeners() {
    if (!closeBtn) return;

    // Close button
    closeBtn.addEventListener('click', close);

    // Click outside
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) close();
    });

    // Tabs switching
    if (tabPhotosBtn && tabWishesBtn) {
      tabPhotosBtn.addEventListener('click', () => _switchTab('photos'));
      tabWishesBtn.addEventListener('click', () => _switchTab('wishes'));
    }

    // Edit self button click
    if (editSelfBtnEl) {
      editSelfBtnEl.addEventListener('click', () => {
        close();
        if (typeof Auth !== 'undefined' && typeof Auth.openSettingsModal === 'function') {
          Auth.openSettingsModal();
        }
      });
    }
  }

  // ── Switch Tabs ──
  function _switchTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;

    if (tab === 'photos') {
      tabPhotosBtn.classList.add('active');
      tabPhotosBtn.style.color = 'var(--text-primary)';
      tabPhotosBtn.style.borderBottomColor = 'var(--primary-500)';

      tabWishesBtn.classList.remove('active');
      tabWishesBtn.style.color = 'var(--text-tertiary)';
      tabWishesBtn.style.borderBottomColor = 'transparent';

      contentPhotosEl.style.display = 'block';
      contentWishesEl.style.display = 'none';
    } else {
      tabWishesBtn.classList.add('active');
      tabWishesBtn.style.color = 'var(--text-primary)';
      tabWishesBtn.style.borderBottomColor = 'var(--primary-500)';

      tabPhotosBtn.classList.remove('active');
      tabPhotosBtn.style.color = 'var(--text-tertiary)';
      tabPhotosBtn.style.borderBottomColor = 'transparent';

      contentPhotosEl.style.display = 'none';
      contentWishesEl.style.display = 'block';
    }
  }

  // ── Open Profile View Modal ──
  async function open(userId) {
    if (!modalEl) {
      _cacheDOM();
    }

    if (!userId) return;

    try {
      // Fetch details from backend API
      const data = await API.getUserProfile(userId);
      currentProfileUser = data.user;
      currentProfilePhotos = data.photos || [];
      currentProfileWishes = data.wishes || [];

      _populateDetails();
      _renderPhotos();
      _renderWishes();

      // Reset to photos tab initially
      _switchTab('photos');

      // Add active class and block scroll
      modalEl.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Re-init lucide icons for inside the modal
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    } catch (error) {
      console.error('Lỗi khi tải thông tin cá nhân:', error);
      App.showToast('Không thể tải hồ sơ người dùng này.', 'error');
    }
  }

  // ── Populate HTML Elements ──
  function _populateDetails() {
    if (!currentProfileUser) return;

    const u = currentProfileUser;
    
    // Set text contents
    fullNameEl.textContent = u.fullName || 'Thành viên';
    relationEl.textContent = u.relation || 'Khác';
    usernameEl.textContent = `@${u.username}`;
    
    if (phoneEl) {
      phoneEl.querySelector('span').textContent = u.phoneNumber || 'Không có';
    }

    // Avatar initials
    avatarEl.textContent = u.fullName ? u.fullName.charAt(0).toUpperCase() : '?';

    // Stats
    photoCountEl.textContent = currentProfilePhotos.length;
    wishCountEl.textContent = currentProfileWishes.length;

    // Check if viewing self
    const currentUser = API.getCurrentUser();
    if (currentUser && currentUser.id === u.id) {
      editSelfContainerEl.style.display = 'block';
    } else {
      editSelfContainerEl.style.display = 'none';
    }
  }

  // ── Render Photos Grid ──
  function _renderPhotos() {
    if (!photosGridEl) return;

    if (currentProfilePhotos.length === 0) {
      photosGridEl.innerHTML = '';
      photosEmptyEl.style.display = 'block';
      return;
    }

    photosEmptyEl.style.display = 'none';
    photosGridEl.innerHTML = currentProfilePhotos.map((photo, index) => {
      return `
        <div class="profile-photo-item" 
             style="position: relative; aspect-ratio: 1; border-radius: var(--border-radius-md); overflow: hidden; cursor: pointer; border: 1px solid var(--border-light); background: var(--bg-tertiary);"
             onclick="UserProfile.viewPhoto(${index})">
          <img src="${photo.url}" 
               alt="${photo.title}" 
               style="width: 100%; height: 100%; object-fit: cover; transition: transform var(--transition-base);" 
               onerror="this.src='https://picsum.photos/seed/profilephoto${index}/300/300'">
        </div>
      `;
    }).join('');
  }

  // ── Render Wishes List ──
  function _renderWishes() {
    if (!wishesListEl) return;

    if (currentProfileWishes.length === 0) {
      wishesListEl.innerHTML = '';
      wishesEmptyEl.style.display = 'block';
      return;
    }

    wishesEmptyEl.style.display = 'none';
    wishesListEl.innerHTML = currentProfileWishes.map((wish, index) => {
      const timeAgo = _getTimeAgo(wish.createdAt);
      return `
        <div class="profile-wish-item" style="background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--border-radius-md); padding: var(--space-md); position: relative; border-left: 3px solid var(--accent-400);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
            <span style="font-size: 1.25rem;">${wish.emoji || '❤️'}</span>
            <span style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${timeAgo}</span>
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--text-secondary); line-height: 1.6; font-style: italic; white-space: pre-wrap; margin: 0;">"${_escapeHtml(wish.message)}"</p>
        </div>
      `;
    }).join('');
  }

  // ── View Photo in Lightbox ──
  function viewPhoto(index) {
    if (typeof Gallery !== 'undefined' && currentProfilePhotos.length > 0) {
      // Open using modified Gallery lightbox with our list of photos
      Gallery.openLightbox(index, currentProfilePhotos);
    }
  }

  // ── Close Modal ──
  function close() {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    
    // Check if other blocking modals are active to restore body scroll
    const authCover = document.getElementById('authCover');
    const profileModal = document.getElementById('profileModal');
    const lightbox = document.getElementById('lightbox');

    const isAuthCoverVisible = authCover && authCover.style.display !== 'none';
    const isProfileActive = profileModal && profileModal.classList.contains('active');
    const isLightboxActive = lightbox && lightbox.classList.contains('active');

    if (!isAuthCoverVisible && !isProfileActive && !isLightboxActive) {
      document.body.style.overflow = '';
    }
  }

  // ── Helper TimeAgo ──
  function _getTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
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
      if (diffDay < 7) return `${diffDay} ngày trước`;

      return date.toLocaleDateString('vi-VN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  function _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Public API ──
  return {
    open,
    close,
    viewPhoto
  };
})();
