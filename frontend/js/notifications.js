/* =============================================
   NOTIFICATIONS MODULE
   =============================================
   Manages the notification bell, unread badge,
   polling from database, dropdown toggle, and
   navigation to the commented/liked photo.
   ============================================= */

const Notifications = (() => {
  let pollingInterval = null;
  let notifications = [];

  // DOM Elements
  let containerEl, btnEl, badgeEl, dropdownEl, listEl, markAllBtn;

  function init() {
    containerEl = document.getElementById('notificationContainer');
    btnEl = document.getElementById('notificationBtn');
    badgeEl = document.getElementById('notificationBadge');
    dropdownEl = document.getElementById('notificationDropdown');
    listEl = document.getElementById('notificationDropdownList');
    markAllBtn = document.getElementById('markAllReadBtn');

    if (!containerEl) return;

    // Toggle dropdown
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdownEl.style.display === 'block';
      if (isVisible) {
        dropdownEl.style.display = 'none';
      } else {
        dropdownEl.style.display = 'block';
        _renderDropdown();
      }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (dropdownEl && dropdownEl.style.display === 'block' && !containerEl.contains(e.target)) {
        dropdownEl.style.display = 'none';
      }
    });

    // Mark all as read
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await API.markNotificationsRead();
          notifications.forEach(n => n.isRead = true);
          _updateBadge();
          _renderDropdown();
          App.showToast('Đã đánh dấu đọc tất cả thông báo.', 'success');
        } catch (err) {
          console.error('Lỗi khi đánh dấu đọc thông báo:', err);
        }
      });
    }

    // Start background operations
    _startPolling();

    // Reset/start polling on login/logout
    window.addEventListener('auth-change', () => {
      _startPolling();
    });
  }

  function _startPolling() {
    _stopPolling();
    
    if (Auth.isLoggedIn()) {
      _fetchNotifications();
      // Poll every 15 seconds
      pollingInterval = setInterval(_fetchNotifications, 15000);
    } else {
      _clearUI();
    }
  }

  function _stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  function _clearUI() {
    notifications = [];
    if (badgeEl) {
      badgeEl.style.display = 'none';
      badgeEl.textContent = '0';
    }
    if (listEl) {
      listEl.innerHTML = '<div class="notification-empty">Không có thông báo nào</div>';
    }
    if (dropdownEl) {
      dropdownEl.style.display = 'none';
    }
  }

  async function _fetchNotifications() {
    if (!Auth.isLoggedIn()) return;
    try {
      const data = await API.getNotifications();
      notifications = data || [];
      _updateBadge();
      
      // If dropdown is currently open, re-render it
      if (dropdownEl && dropdownEl.style.display === 'block') {
        _renderDropdown();
      }
    } catch (err) {
      console.error('Không thể tải thông báo:', err);
    }
  }

  function _updateBadge() {
    if (!badgeEl) return;
    const unreadCount = notifications.filter(n => !n.isRead).length;
    if (unreadCount > 0) {
      badgeEl.textContent = unreadCount;
      badgeEl.style.display = 'flex';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  function _renderDropdown() {
    if (!listEl) return;

    if (notifications.length === 0) {
      listEl.innerHTML = '<div class="notification-empty">Không có thông báo nào</div>';
      return;
    }

    listEl.innerHTML = notifications.map(notif => {
      const timeStr = _formatRelativeTime(notif.createdAt);
      let textHtml = '';

      if (notif.type === 'like') {
        textHtml = `<strong>${_escapeHtml(notif.senderName)}</strong> (${_escapeHtml(notif.senderRelation)}) đã thích ảnh của bạn.`;
      } else if (notif.type === 'comment') {
        textHtml = `<strong>${_escapeHtml(notif.senderName)}</strong> (${_escapeHtml(notif.senderRelation)}) đã bình luận: "${_escapeHtml(notif.content)}"`;
      }

      const senderInitial = notif.senderName ? notif.senderName.charAt(0).toUpperCase() : 'U';

      return `
        <div class="notification-item ${notif.isRead ? '' : 'unread'}" data-id="${notif.id}" data-photo-id="${notif.photoId}">
          <div class="notification-item-avatar">${senderInitial}</div>
          <div class="notification-item-content">
            <p class="notification-item-text">${textHtml}</p>
            <span class="notification-item-time">${timeStr}</span>
          </div>
          <div class="notification-item-preview">
            <img src="${notif.photoUrl}" alt="${notif.photoTitle}" onerror="this.style.display='none'">
          </div>
        </div>
      `;
    }).join('');

    // Add click listeners to items
    const items = listEl.querySelectorAll('.notification-item');
    items.forEach(item => {
      item.addEventListener('click', async (e) => {
        const id = parseInt(item.dataset.id);
        const photoId = parseInt(item.dataset.photoId);

        // Mark as read in state and backend
        const notif = notifications.find(n => n.id === id);
        if (notif && !notif.isRead) {
          notif.isRead = true;
          _updateBadge();
          try {
            await API.markNotificationsRead(id);
          } catch (err) {
            console.error('Lỗi khi đánh dấu đã đọc:', err);
          }
        }

        // Close dropdown
        dropdownEl.style.display = 'none';

        // Open lightbox
        if (typeof Gallery !== 'undefined') {
          Gallery.openLightboxByPhotoId(photoId);
        }
      });
    });
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

  function _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    init,
    fetchNotifications: _fetchNotifications
  };
})();

// Auto initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  Notifications.init();
});
