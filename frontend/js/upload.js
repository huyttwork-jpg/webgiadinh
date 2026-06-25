/* =============================================
   UPLOAD MODULE
   =============================================
   Handles photo upload with drag & drop, preview,
   upload progress, and sending to backend REST API
   ============================================= */

const Upload = (() => {
  // ── Config ──
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_FILES = 10;

  // ── State ──
  let selectedFiles = [];

  // ── DOM Elements ──
  let formEl, dropZone, fileInput, previewsContainer, previewGrid,
      previewCount, uploadInfo, progressContainer, progressFill,
      progressText, submitBtn, authPromptEl, uploaderNameInput;

  // ── Initialize ──
  function init() {
    formEl = document.getElementById('uploadForm');
    dropZone = document.getElementById('dropZone');
    fileInput = document.getElementById('fileInput');
    previewsContainer = document.getElementById('uploadPreviews');
    previewGrid = document.getElementById('previewGrid');
    previewCount = document.getElementById('previewCount');
    uploadInfo = document.getElementById('uploadInfo');
    progressContainer = document.getElementById('uploadProgress');
    progressFill = document.getElementById('progressFill');
    progressText = document.getElementById('progressText');
    submitBtn = document.getElementById('uploadSubmitBtn');
    authPromptEl = document.getElementById('uploadAuthPrompt');
    uploaderNameInput = document.getElementById('uploaderName');

    _setupDropZone();
    _setupFileInput();
    _setupForm();
    _checkAuthOverlay();

    // Listen for auth changes
    window.addEventListener('auth-change', () => {
      _checkAuthOverlay();
    });
  }

  // ── Toggle Auth Overlay ──
  function _checkAuthOverlay() {
    if (!authPromptEl) return;

    if (Auth.isLoggedIn()) {
      authPromptEl.style.display = 'none';
      // Prefill uploader name
      const user = API.getCurrentUser();
      if (uploaderNameInput && user) {
        uploaderNameInput.value = user.fullName;
        uploaderNameInput.disabled = true;
      }
    } else {
      authPromptEl.style.display = 'flex';
      if (uploaderNameInput) {
        uploaderNameInput.value = '';
        uploaderNameInput.disabled = false;
      }
    }
  }

  // ── Setup Drop Zone ──
  function _setupDropZone() {
    if (!dropZone) return;

    dropZone.addEventListener('click', (e) => {
      if (e.target.closest('.btn-browse') || e.target.closest('input')) return;
      fileInput?.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        _handleFiles(Array.from(files));
      }
    });
  }

  // ── Setup File Input ──
  function _setupFileInput() {
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        _handleFiles(Array.from(e.target.files));
      }
    });
  }

  // ── Handle Files selection ──
  function _handleFiles(files) {
    const validFiles = [];

    for (const file of files) {
      if (selectedFiles.length + validFiles.length >= MAX_FILES) {
        App.showToast(`Chỉ được chọn tối đa ${MAX_FILES} ảnh!`, 'warning');
        break;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        App.showToast(`"${file.name}" không phải định dạng ảnh hợp lệ.`, 'error');
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        App.showToast(`"${file.name}" quá lớn (tối đa 5MB).`, 'error');
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      selectedFiles = [...selectedFiles, ...validFiles];
      _renderPreviews();
      _showUploadInfo();
    }
  }

  // ── Render Previews ──
  function _renderPreviews() {
    if (!previewGrid || !previewsContainer) return;

    previewsContainer.style.display = 'block';
    if (previewCount) previewCount.textContent = selectedFiles.length;

    previewGrid.innerHTML = selectedFiles.map((file, index) => `
      <div class="preview-item" data-index="${index}">
        <img src="${URL.createObjectURL(file)}" alt="${file.name}">
        <button class="preview-remove" 
                data-index="${index}" 
                aria-label="Xóa ảnh"
                type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    `).join('');

    previewGrid.querySelectorAll('.preview-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        _removeFile(index);
      });
    });
  }

  // ── Remove Selected File ──
  function _removeFile(index) {
    const previewItem = previewGrid?.querySelector(`[data-index="${index}"] img`);
    if (previewItem) {
      URL.revokeObjectURL(previewItem.src);
    }

    selectedFiles.splice(index, 1);

    if (selectedFiles.length === 0) {
      _hideUploadInfo();
    } else {
      _renderPreviews();
    }
  }

  function _showUploadInfo() {
    if (uploadInfo) uploadInfo.style.display = 'block';
  }

  function _hideUploadInfo() {
    if (previewsContainer) previewsContainer.style.display = 'none';
    if (uploadInfo) uploadInfo.style.display = 'none';
    if (previewGrid) previewGrid.innerHTML = '';
    selectedFiles = [];

    if (fileInput) fileInput.value = '';
  }

  // ── Setup Form Submission ──
  function _setupForm() {
    if (!formEl) return;

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!Auth.isLoggedIn()) {
        App.showToast('Vui lòng đăng nhập để đóng góp ảnh!', 'warning');
        Auth.openModal('login');
        return;
      }

      if (selectedFiles.length === 0) {
        App.showToast('Vui lòng chọn ít nhất 1 ảnh!', 'warning');
        return;
      }

      const confirmed = await App.showConfirm(`Bạn có chắc chắn muốn tải lên ${selectedFiles.length} bức ảnh này không?`, 'Tải ảnh lên');
      if (!confirmed) return;

      const category = document.getElementById('photoCategory')?.value || 'family';
      const description = document.getElementById('photoDesc')?.value.trim() || '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'Đang tải lên...';
      }

      if (progressContainer) progressContainer.style.display = 'block';

      try {
        const totalFiles = selectedFiles.length;
        let uploadedCount = 0;

        for (const file of selectedFiles) {
          const baseProgress = (uploadedCount / totalFiles) * 100;

          const formData = new FormData();
          formData.append('photo', file);
          formData.append('title', description || file.name.replace(/\.[^.]+$/, ''));
          formData.append('description', description);
          formData.append('category', category);

          // Upload with XMLHttp inside API
          const newPhoto = await API.uploadPhoto(formData, (fileProgress) => {
            const totalProgress = baseProgress + (fileProgress / totalFiles);
            _updateProgress(Math.min(totalProgress, 99));
          });

          // Add to Gallery
          Gallery.addPhoto(newPhoto);
          uploadedCount++;
        }

        _updateProgress(100);

        setTimeout(() => {
          App.showToast(`Đã tải lên ${totalFiles} ảnh thành công! 🎉`, 'success');
          _resetForm();
        }, 500);

      } catch (error) {
        console.error('Lỗi tải ảnh:', error);
        App.showToast(error.message || 'Lỗi tải ảnh lên. Vui lòng thử lại!', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = 'Tải ảnh lên';
        }
      }
    });
  }

  function _updateProgress(percent) {
    const rounded = Math.round(percent);
    if (progressFill) progressFill.style.width = `${rounded}%`;
    if (progressText) progressText.textContent = `${rounded}%`;
  }

  function _resetForm() {
    _hideUploadInfo();
    if (formEl) formEl.reset();
    if (progressContainer) progressContainer.style.display = 'none';
    _updateProgress(0);
    _checkAuthOverlay(); // Restores user fullName prefill
  }

  return {
    init
  };
})();
