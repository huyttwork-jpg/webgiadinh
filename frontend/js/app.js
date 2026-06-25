/* =============================================
   APP MAIN MODULE
   =============================================
   Handles app initialization, navbar behavior,
   dark mode, scroll animations, hero particles,
   counter animations, smooth scroll, and toasts
   ============================================= */

const App = (() => {
  // ── State ──
  let isDarkMode = false;

  // ── Initialize ──
  function init() {
    _initTheme();
    _initNavbar();
    _initScrollAnimations();
    _initHeroParticles();
    _initSmoothScroll();
    _initCounterAnimations();

    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Initialize modules
    Auth.init();
    Gallery.init();
    Wishes.init();
    Upload.init();

    // Re-init icons after modules render
    setTimeout(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 500);

    // Hide page loader
    _hideLoader();

    // Set initial stats
    setTimeout(() => {
      _triggerCounters();
    }, 800);

    console.info(
      '%c🏠 Album Ảnh Gia Đình — Đã tải xong!',
      'color: #F59E0B; font-size: 14px; font-weight: bold;'
    );
  }

  // ── Page Loader ──
  function _hideLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      setTimeout(() => {
        loader.classList.add('loaded');
        setTimeout(() => loader.remove(), 600);
      }, 300);
    }
  }

  // ── Theme / Dark Mode ──
  function _initTheme() {
    // Check saved preference
    const saved = localStorage.getItem('giadinh_theme');
    if (saved === 'dark') {
      isDarkMode = true;
    } else if (saved === 'light') {
      isDarkMode = false;
    } else {
      // Check system preference
      isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    _applyTheme();

    // Toggle button
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        _applyTheme();
        localStorage.setItem('giadinh_theme', isDarkMode ? 'dark' : 'light');
      });
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('giadinh_theme')) {
        isDarkMode = e.matches;
        _applyTheme();
      }
    });
  }

  function _applyTheme() {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }

  // ── Navbar ──
  function _initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (!navbar) return;

    // Scroll behavior — sticky with glass effect
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;

      if (currentScroll > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      lastScroll = currentScroll;
    }, { passive: true });

    // Mobile hamburger toggle
    if (navToggle && navLinks) {
      navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('open');
      });

      // Close menu on link click
      navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          navToggle.classList.remove('active');
          navLinks.classList.remove('open');
        });
      });

      // Close menu on outside click
      document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target)) {
          navToggle.classList.remove('active');
          navLinks.classList.remove('open');
        }
      });
    }

    // Active link highlighting on scroll
    _setupActiveNavLinks();
  }

  function _setupActiveNavLinks() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    if (sections.length === 0 || navLinks.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, {
      rootMargin: '-30% 0px -70% 0px'
    });

    sections.forEach(section => observer.observe(section));
  }

  // ── Scroll Animations ──
  function _initScrollAnimations() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-visible');
          observer.unobserve(entry.target); // Only animate once
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => observer.observe(el));
  }

  // ── Hero Particles ──
  function _initHeroParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;

    const emojis = ['💕', '❤️', '✨', '🌸', '⭐', '💖', '🎀', '🌷', '🦋', '🌺'];
    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.className = 'hero-particle';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${6 + Math.random() * 8}s`;
      particle.style.animationDelay = `${Math.random() * 8}s`;
      particle.style.fontSize = `${0.8 + Math.random() * 1}rem`;
      container.appendChild(particle);
    }
  }

  // ── Smooth Scroll ──
  function _initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // ── Counter Animations ──
  function _initCounterAnimations() {
    const counters = document.querySelectorAll('.stat-number');
    if (counters.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          _animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(counter => observer.observe(counter));
  }

  async function _triggerCounters() {
    const photoCountEl = document.getElementById('photoCount');
    const wishCountEl = document.getElementById('wishCount');
    const memberCountEl = document.getElementById('memberCount');

    try {
      const stats = await API.getStats();
      
      if (photoCountEl) {
        photoCountEl.setAttribute('data-target', stats.photos || 0);
        _animateCounter(photoCountEl);
      }
      if (wishCountEl) {
        wishCountEl.setAttribute('data-target', stats.wishes || 0);
        _animateCounter(wishCountEl);
      }
      if (memberCountEl) {
        memberCountEl.setAttribute('data-target', stats.users || 0);
        _animateCounter(memberCountEl);
      }
    } catch (error) {
      console.error('Lỗi khi lấy thông tin thống kê:', error);
      // Fallback
      if (photoCountEl) _animateCounter(photoCountEl);
      if (wishCountEl) _animateCounter(wishCountEl);
      if (memberCountEl) _animateCounter(memberCountEl);
    }
  }

  function _animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target')) || 0;
    const duration = 1500;
    const start = performance.now();
    const startValue = 0;

    function update(currentTime) {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (target - startValue) * eased);

      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  // ── Custom Popup Dialogs (Alert & Confirm) ──
  function _createPopup({ title, message, type, isConfirm = false, isDanger = false }) {
    return new Promise((resolve) => {
      // Create overlay element
      const overlay = document.createElement('div');
      overlay.className = 'custom-popup-overlay';

      // Map types to emojis and titles
      let emojiIcon = 'ℹ️';
      let defaultTitle = 'Thông báo';
      if (type === 'success') {
        emojiIcon = '🎉';
        defaultTitle = 'Thành công';
      } else if (type === 'error') {
        emojiIcon = '❌';
        defaultTitle = 'Có lỗi xảy ra';
      } else if (type === 'warning') {
        emojiIcon = '⚠️';
        defaultTitle = 'Cảnh báo';
      } else if (type === 'confirm') {
        emojiIcon = '❓';
        defaultTitle = 'Xác nhận';
      }

      const displayTitle = title || defaultTitle;

      overlay.innerHTML = `
        <div class="custom-popup-card">
          <div class="custom-popup-icon ${type || 'info'}">
            ${emojiIcon}
          </div>
          <h3 class="custom-popup-title">${displayTitle}</h3>
          <p class="custom-popup-message">${message}</p>
          <div class="custom-popup-buttons">
            <button class="btn-popup-confirm ${isDanger ? 'danger' : ''}" id="popupConfirmBtn">Đồng ý</button>
            ${isConfirm ? `<button class="btn-popup-cancel" id="popupCancelBtn">Hủy bỏ</button>` : ''}
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Save and block body scroll
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const confirmBtn = overlay.querySelector('#popupConfirmBtn');
      const cancelBtn = overlay.querySelector('#popupCancelBtn');

      const cleanup = () => {
        overlay.remove();
        
        // Restore scroll only if there are no other active blocking modals or covers
        const authCover = document.getElementById('authCover');
        const profileModal = document.getElementById('profileModal');
        const lightbox = document.getElementById('lightbox');
        const activePopups = document.querySelectorAll('.custom-popup-overlay');

        const isAuthCoverVisible = authCover && authCover.style.display !== 'none';
        const isProfileActive = profileModal && profileModal.classList.contains('active');
        const isLightboxActive = lightbox && lightbox.classList.contains('active');
        const isAnotherPopupVisible = activePopups.length > 0;

        if (isAuthCoverVisible || isProfileActive || isLightboxActive || isAnotherPopupVisible) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
      };

      confirmBtn.focus();

      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          cleanup();
          resolve(false);
        });
      }

      // Close when clicking background for simple alerts (non-confirm)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !isConfirm) {
          cleanup();
          resolve(true);
        }
      });
    });
  }

  // ── Toast Notifications ──
  function showToast(message, type = 'info') {
    return _createPopup({ message, type });
  }

  function showConfirm(message, title = 'Xác nhận', isDanger = false) {
    return _createPopup({
      title,
      message,
      type: 'confirm',
      isConfirm: true,
      isDanger
    });
  }

  // ── Public API ──
  return {
    init,
    showToast,
    showConfirm
  };
})();

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
