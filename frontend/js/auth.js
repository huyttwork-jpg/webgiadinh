/* =============================================
   AUTH MODULE
   =============================================
   Handles user login, registration, navbar state,
   auth cover lock screen, profile editing, and
   deleting account.
   ============================================= */

const Auth = (() => {
  // ── DOM Elements ──
  let authCover, authBtn, userMenu, userNameDisplay, logoutBtn,
      loginForm, registerForm, tabLoginBtn, tabRegisterBtn,
      forgotForm, resetForm, forgotPasswordLink,
      backToLoginFromForgot, forgotPhoneInput, resetOtpInput,
      resetPasswordInput, authTabsContainer,
      
      // Profile elements
      profileModal, profileBtn, profileModalClose, profileForm,
      profileUsername, profileFullName, profileRelation, profilePhone,
      deleteAccountBtn;

  // ── Initialize ──
  function init() {
    // Cache DOM Elements
    authCover = document.getElementById('authCover');
    authBtn = document.getElementById('authBtn');
    userMenu = document.getElementById('userMenu');
    userNameDisplay = document.getElementById('userNameDisplay');
    logoutBtn = document.getElementById('logoutBtn');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    tabLoginBtn = document.getElementById('tabLogin');
    tabRegisterBtn = document.getElementById('tabRegister');
    
    forgotForm = document.getElementById('forgotForm');
    resetForm = document.getElementById('resetForm');
    forgotPasswordLink = document.getElementById('forgotPasswordLink');
    backToLoginFromForgot = document.getElementById('backToLoginFromForgot');
    forgotPhoneInput = document.getElementById('forgotPhone');
    resetOtpInput = document.getElementById('resetOtp');
    resetPasswordInput = document.getElementById('resetPassword');
    authTabsContainer = document.querySelector('.auth-tabs');
    
    // Profile elements
    profileModal = document.getElementById('profileModal');
    profileBtn = document.getElementById('profileBtn');
    profileModalClose = document.getElementById('profileModalClose');
    profileForm = document.getElementById('profileForm');
    profileUsername = document.getElementById('profileUsername');
    profileFullName = document.getElementById('profileFullName');
    profileRelation = document.getElementById('profileRelation');
    profilePhone = document.getElementById('profilePhone');
    deleteAccountBtn = document.getElementById('deleteAccountBtn');

    _setupListeners();
    _checkAuthState();
    _initPasswordToggles();
  }

  // ── Setup Listeners ──
  function _setupListeners() {
    // Tab switching
    if (tabLoginBtn && tabRegisterBtn) {
      tabLoginBtn.addEventListener('click', () => _switchTab('login'));
      tabRegisterBtn.addEventListener('click', () => _switchTab('register'));
    }

    // Forgot Password Link Click
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        _switchTab('forgot');
      });
    }

    // Back to Login Link Click
    if (backToLoginFromForgot) {
      backToLoginFromForgot.addEventListener('click', (e) => {
        e.preventDefault();
        _switchTab('login');
      });
    }

    // Forgot Form Submit
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phoneNumber = forgotPhoneInput?.value.trim();
        if (!phoneNumber) {
          App.showToast('Vui lòng nhập số điện thoại.', 'warning');
          return;
        }

        const submitBtn = document.getElementById('forgotSubmitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Đang gửi...';

        try {
          await API.forgotPassword(phoneNumber);
          App.showToast('Mã OTP đã được gửi về số điện thoại của bạn!', 'success');
          _switchTab('reset');
        } catch (error) {
          App.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Reset Form Submit
    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phoneNumber = forgotPhoneInput?.value.trim();
        const code = resetOtpInput?.value.trim();
        const newPassword = resetPasswordInput?.value;

        if (!phoneNumber) {
          App.showToast('Lỗi: Thiếu số điện thoại. Vui lòng quay lại.', 'error');
          _switchTab('forgot');
          return;
        }
        if (!code || code.length !== 6) {
          App.showToast('Mã OTP phải có đúng 6 chữ số.', 'warning');
          return;
        }
        if (!newPassword) {
          App.showToast('Vui lòng nhập mật khẩu mới.', 'warning');
          return;
        }

        const submitBtn = document.getElementById('resetSubmitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Đang xác nhận...';

        try {
          await API.resetPassword(phoneNumber, code, newPassword);
          App.showToast('Đặt lại mật khẩu thành công! Hãy đăng nhập.', 'success');
          _switchTab('login');
        } catch (error) {
          App.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Login Form Submit
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
          App.showToast('Vui lòng điền tên đăng nhập và mật khẩu.', 'warning');
          return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Đang đăng nhập...';

        try {
          await API.login(username, password);
          App.showToast('Đăng nhập thành công! Chào mừng quay trở lại 💕', 'success');
          closeModal();
          _checkAuthState();
          
          // Dispatch login event
          window.dispatchEvent(new CustomEvent('auth-change', { detail: { isLoggedIn: true } }));
        } catch (error) {
          App.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Register Form Submit
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const fullName = document.getElementById('registerFullName').value.trim();
        const relation = document.getElementById('registerRelation').value;
        const phoneNumber = document.getElementById('registerPhone').value.trim();

        if (!username || !password || !fullName || !relation || !phoneNumber) {
          App.showToast('Vui lòng điền đầy đủ các trường.', 'warning');
          return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Đang đăng ký...';

        try {
          await API.register(username, password, fullName, relation, phoneNumber);
          App.showToast('Đăng ký tài khoản thành công! 🎉', 'success');
          closeModal();
          _checkAuthState();

          // Dispatch login event
          window.dispatchEvent(new CustomEvent('auth-change', { detail: { isLoggedIn: true } }));
        } catch (error) {
          App.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Logout Button
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        API.logout();
        App.showToast('Đã đăng xuất tài khoản.', 'info');
        _checkAuthState();
        
        // Dispatch logout event
        window.dispatchEvent(new CustomEvent('auth-change', { detail: { isLoggedIn: false } }));
      });
    }

    // Profile Button Click
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        const user = API.getCurrentUser();
        if (!user) return;
        UserProfile.open(user.id);
      });
    }

    // Close Profile Modal
    if (profileModalClose) {
      profileModalClose.addEventListener('click', () => {
        profileModal?.classList.remove('active');
        if (Auth.isLoggedIn()) {
          document.body.style.overflow = '';
        }
      });
    }

    // Close Profile Modal clicking outside
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
          profileModal.classList.remove('active');
          if (Auth.isLoggedIn()) {
            document.body.style.overflow = '';
          }
        }
      });
    }

    // Update Profile Form Submit
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = profileFullName?.value.trim();
        const relation = profileRelation?.value;
        const phoneNumber = profilePhone?.value.trim();

        if (!fullName || !relation || !phoneNumber) {
          App.showToast('Vui lòng điền đầy đủ các thông tin.', 'warning');
          return;
        }

        const submitBtn = document.getElementById('profileSubmitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Đang lưu...';

        try {
          await API.updateProfile(fullName, relation, phoneNumber);
          App.showToast('Cập nhật hồ sơ thành công! 🎉', 'success');
          profileModal?.classList.remove('active');
          document.body.style.overflow = '';
          _checkAuthState();

          // Dispatch update event
          window.dispatchEvent(new CustomEvent('auth-change', { detail: { isLoggedIn: true } }));
        } catch (error) {
          App.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Delete Account Click
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', async () => {
        const confirmed = await App.showConfirm(
          '⚠️ CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn xóa tài khoản này vĩnh viễn không? Hành động này sẽ xóa toàn bộ dữ liệu ảnh, lượt tim và lời chúc của bạn khỏi hệ thống và KHÔNG THỂ KHÔI PHỤC!',
          'Xóa tài khoản vĩnh viễn',
          true
        );
        if (!confirmed) return;

        deleteAccountBtn.disabled = true;
        deleteAccountBtn.innerHTML = 'Đang xóa tài khoản...';

        try {
          await API.deleteAccount();
          App.showToast('Đã xóa tài khoản của bạn khỏi hệ thống.', 'info');
          
          profileModal?.classList.remove('active');
          _checkAuthState();

          // Dispatch auth change event
          window.dispatchEvent(new CustomEvent('auth-change', { detail: { isLoggedIn: false } }));
        } catch (error) {
          App.showToast(error.message, 'error');
        } finally {
          deleteAccountBtn.disabled = false;
          deleteAccountBtn.innerHTML = '<i data-lucide="user-x"></i><span>Xóa tài khoản vĩnh viễn</span>';
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        }
      });
    }
  }

  // ── Authentication Checks ──
  async function _checkAuthState() {
    const user = API.getCurrentUser();

    if (user) {
      // Hide login cover
      if (authCover) authCover.style.display = 'none';
      document.body.style.overflow = '';

      // Show user state in navbar
      if (authBtn) authBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      if (userNameDisplay) userNameDisplay.textContent = user.fullName;

      // Validate token with server in background
      try {
        await API.getMe();
      } catch (err) {
        // If token invalid, logout
        API.logout();
        _checkAuthState();
        window.dispatchEvent(new CustomEvent('auth-change', { detail: { isLoggedIn: false } }));
      }
    } else {
      // Show logged out cover state
      if (authCover) authCover.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      _switchTab('login');

      if (authBtn) authBtn.style.display = 'none'; // Covered on load
      if (userMenu) userMenu.style.display = 'none';
      if (userNameDisplay) userNameDisplay.textContent = '';
    }
  }

  // ── Password Visibility Toggles ──
  function _initPasswordToggles() {
    const wrappers = document.querySelectorAll('.password-input-wrapper');
    wrappers.forEach(wrapper => {
      const input = wrapper.querySelector('input');
      const btn = wrapper.querySelector('.btn-toggle-password');
      if (!input || !btn) return;

      btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const eyeIcon = btn.querySelector('.eye-icon');
        const eyeOffIcon = btn.querySelector('.eye-off-icon');
        
        if (isPassword) {
          btn.title = 'Ẩn mật khẩu';
          if (eyeIcon) eyeIcon.style.display = 'none';
          if (eyeOffIcon) eyeOffIcon.style.display = 'block';
        } else {
          btn.title = 'Hiển thị mật khẩu';
          if (eyeIcon) eyeIcon.style.display = 'block';
          if (eyeOffIcon) eyeOffIcon.style.display = 'none';
        }
      });
    });
  }

  // ── Public Modals Control ──
  function openModal(defaultTab = 'login') {
    if (authCover) {
      authCover.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      _switchTab(defaultTab);
    }
  }

  function closeModal() {
    if (Auth.isLoggedIn()) {
      if (authCover) authCover.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function _switchTab(tab) {
    if (tab === 'login') {
      tabLoginBtn?.classList.add('active');
      tabRegisterBtn?.classList.remove('active');
      if (authTabsContainer) authTabsContainer.style.display = 'grid';
      if (loginForm) loginForm.style.display = 'flex';
      if (registerForm) registerForm.style.display = 'none';
      if (forgotForm) forgotForm.style.display = 'none';
      if (resetForm) resetForm.style.display = 'none';
    } else if (tab === 'register') {
      tabLoginBtn?.classList.remove('active');
      tabRegisterBtn?.classList.add('active');
      if (authTabsContainer) authTabsContainer.style.display = 'grid';
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'flex';
      if (forgotForm) forgotForm.style.display = 'none';
      if (resetForm) resetForm.style.display = 'none';
    } else if (tab === 'forgot') {
      if (authTabsContainer) authTabsContainer.style.display = 'none';
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'none';
      if (forgotForm) forgotForm.style.display = 'flex';
      if (resetForm) resetForm.style.display = 'none';
    } else if (tab === 'reset') {
      if (authTabsContainer) authTabsContainer.style.display = 'none';
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'none';
      if (forgotForm) forgotForm.style.display = 'none';
      if (resetForm) resetForm.style.display = 'flex';
    }
  }

  function isLoggedIn() {
    return API.getCurrentUser() !== null;
  }

  function openSettingsModal() {
    const user = API.getCurrentUser();
    if (!user) return;

    if (profileUsername) profileUsername.value = user.username || '';
    if (profileFullName) profileFullName.value = user.fullName || '';
    if (profileRelation) profileRelation.value = user.relation || 'Khác';
    if (profilePhone) profilePhone.value = user.phoneNumber || '';

    profileModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  return {
    init,
    openModal,
    closeModal,
    isLoggedIn,
    openSettingsModal
  };
})();
