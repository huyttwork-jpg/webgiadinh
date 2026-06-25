/* =============================================
   WISHES MODULE
   =============================================
   Handles wish/message submission and rendering
   using the SQLite backend endpoints
   ============================================= */

const Wishes = (() => {
  // ── State ──
  let wishes = [];
  let selectedEmoji = '❤️';
  let wishesPollInterval = null;

  // ── DOM Elements ──
  let formEl, gridEl, messageInput, authPromptEl;

  // ── Initialize ──
  function init() {
    formEl = document.getElementById('wishForm');
    gridEl = document.getElementById('wishesGrid');
    messageInput = document.getElementById('wishMessage');
    authPromptEl = document.getElementById('wishAuthPrompt');

    _setupForm();
    _setupEmojiPicker();
    _loadWishes();
    _checkAuthOverlay();
    _startWishesPolling();

    // Listen for login/logout to hide/show overlay
    window.addEventListener('auth-change', () => {
      _checkAuthOverlay();
      _loadWishes();
      _startWishesPolling();
    });
  }

  // ── Toggle Auth Overlay ──
  function _checkAuthOverlay() {
    if (!authPromptEl) return;
    
    if (Auth.isLoggedIn()) {
      authPromptEl.style.display = 'none';
    } else {
      authPromptEl.style.display = 'flex';
    }
  }

  // ── Load Wishes from Backend ──
  async function _loadWishes() {
    try {
      const dbWishes = await API.getWishes();
      wishes = dbWishes || [];
      _renderWishes();
      _updateWishCount();
    } catch (error) {
      console.error('Lỗi tải lời chúc từ API:', error);
      App.showToast('Không thể kết nối đến máy chủ để tải lời chúc.', 'error');
    }
  }

  // ── Setup Form Submission ──
  function _setupForm() {
    if (!formEl) return;

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!Auth.isLoggedIn()) {
        App.showToast('Vui lòng đăng nhập để gửi lời chúc!', 'warning');
        Auth.openModal('login');
        return;
      }

      const message = messageInput?.value.trim();

      if (!message) {
        App.showToast('Vui lòng điền nội dung lời chúc!', 'warning');
        return;
      }

      const confirmed = await App.showConfirm('Bạn có chắc chắn muốn gửi lời chúc này không?', 'Gửi lời chúc');
      if (!confirmed) return;

      const submitBtn = document.getElementById('wishSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'Đang gửi...';
      }

      try {
        await API.addWish(message, selectedEmoji);
        
        // Reset form
        formEl.reset();
        selectedEmoji = '❤️';
        _resetEmojiPicker();

        // Reload wishes
        await _loadWishes();

        App.showToast('Gửi lời chúc thành công! 💕', 'success');
      } catch (error) {
        console.error('Lỗi gửi lời chúc:', error);
        App.showToast(error.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = 'Gửi lời chúc';
        }
      }
    });
  }

  // ── Setup Emoji Picker ──
  function _setupEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;

    // Set default selected
    const defaultBtn = picker.querySelector(`[data-emoji="${selectedEmoji}"]`);
    if (defaultBtn) defaultBtn.classList.add('selected');

    picker.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-btn');
      if (!btn) return;

      picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmoji = btn.dataset.emoji;
    });
  }

  function _resetEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;

    picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    const defaultBtn = picker.querySelector('[data-emoji="❤️"]');
    if (defaultBtn) defaultBtn.classList.add('selected');
  }

  // ── Render Wishes Grid ──
  function _renderWishes() {
    if (!gridEl) return;

    if (wishes.length === 0) {
      gridEl.innerHTML = `
        <div class="wishes-empty">
          <p>💌 Chưa có lời chúc nào. Hãy là người đầu tiên gửi lời yêu thương!</p>
        </div>
      `;
      return;
    }

    const currentUser = API.getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;

    gridEl.innerHTML = wishes.map((wish, index) => {
      const initial = wish.name ? wish.name.charAt(0).toUpperCase() : '?';
      const timeAgo = _getTimeAgo(wish.createdAt);

      const canDelete = currentUser && (wish.userId === currentUserId || currentUser.username === 'admin');
      const deleteButtonHtml = canDelete ? `
        <button class="btn-delete-wish" 
                aria-label="Xóa lời chúc"
                onclick="Wishes.deleteWish('${wish.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-9 5h10M9 11v6m4-6v6"/>
          </svg>
        </button>
      ` : '';

      return `
        <div class="wish-card" style="animation-delay: ${index * 0.1}s">
          <div class="wish-card-header">
            <div class="wish-avatar" onclick="UserProfile.open(${wish.userId})" style="cursor: pointer;" title="Xem hồ sơ">${initial}</div>
            <div class="wish-author" onclick="UserProfile.open(${wish.userId})" style="cursor: pointer;" title="Xem hồ sơ">
              <h4 class="wish-author-name">${_escapeHtml(wish.name)}</h4>
              <span>${_escapeHtml(wish.relation || '')}</span>
            </div>
            <div class="wish-emoji">${wish.emoji || '❤️'}</div>
          </div>
          ${deleteButtonHtml}
          <p class="wish-message">${_escapeHtml(wish.message)}</p>
          <span class="wish-time">${timeAgo}</span>
        </div>
      `;
    }).join('');
  }

  // ── Relative Timestamp Helper ──
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

  function _startWishesPolling() {
    _stopWishesPolling();
    // Poll every 4 seconds to fetch new wishes
    wishesPollInterval = setInterval(async () => {
      try {
        const dbWishes = await API.getWishes();
        const newWishes = dbWishes || [];
        
        // Only re-render if the wish list has actually changed
        const isChanged = newWishes.length !== wishes.length || 
                          JSON.stringify(newWishes.map(w => w.id)) !== JSON.stringify(wishes.map(w => w.id));
        if (isChanged) {
          wishes = newWishes;
          _renderWishes();
          _updateWishCount();
        }
      } catch (err) {
        console.error('Lỗi tự động cập nhật lời chúc:', err);
      }
    }, 4000);
  }

  function _stopWishesPolling() {
    if (wishesPollInterval) {
      clearInterval(wishesPollInterval);
      wishesPollInterval = null;
    }
  }

  function _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function _updateWishCount() {
    const el = document.getElementById('wishCount');
    if (el) {
      el.textContent = wishes.length;
      el.setAttribute('data-target', wishes.length);
    }
  }

  function getWishCount() {
    return wishes.length;
  }

  // ── Delete Wish ──
  async function deleteWish(wishId) {
    if (!Auth.isLoggedIn()) {
      App.showToast('Vui lòng đăng nhập để thực hiện tác vụ này.', 'warning');
      return;
    }

    const confirmed = await App.showConfirm('Bạn có chắc chắn muốn xóa lời chúc này không? Hành động này không thể hoàn tác.', 'Xóa lời chúc', true);
    if (!confirmed) return;

    try {
      const parsedId = parseInt(wishId);
      await API.deleteWish(parsedId);
      
      // Update local state by removing the deleted wish
      wishes = wishes.filter(w => w.id !== parsedId);
      
      // Update count & re-render
      _updateWishCount();
      _renderWishes();
      
      App.showToast('Đã xóa lời chúc thành công! 💌', 'success');
    } catch (error) {
      console.error('Lỗi khi xóa lời chúc:', error);
      App.showToast(error.message || 'Không thể xóa lời chúc.', 'error');
    }
  }

  return {
    init,
    getWishCount,
    deleteWish
  };
})();
