/* =============================================
   API MODULE
   =============================================
   Handles communications with the Express backend
   including JWT token management in requests
   ============================================= */

const API = (() => {
  const API_BASE = window.location.port && window.location.port !== '3000'
    ? 'http://localhost:3000/api'
    : '/api';

  // Retrieve token from localStorage
  function _getToken() {
    return localStorage.getItem('giadinh_token');
  }

  // Base request wrapper
  async function _request(endpoint, options = {}) {
    const token = _getToken();
    
    // Set headers
    const headers = options.headers || {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Only set Content-Type to JSON if body is not FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Đã có lỗi xảy ra.');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // --- Auth API ---
  async function login(username, password) {
    const data = await _request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    // Save token and user info
    if (data.token) {
      localStorage.setItem('giadinh_token', data.token);
      localStorage.setItem('giadinh_user', JSON.stringify(data.user));
    }
    return data;
  }

  async function register(username, password, fullName, relation, phoneNumber) {
    const data = await _request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, relation, phoneNumber })
    });
    // Save token and user info
    if (data.token) {
      localStorage.setItem('giadinh_token', data.token);
      localStorage.setItem('giadinh_user', JSON.stringify(data.user));
    }
    return data;
  }

  async function forgotPassword(phoneNumber) {
    return await _request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber })
    });
  }

  async function resetPassword(phoneNumber, code, newPassword) {
    return await _request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, code, newPassword })
    });
  }

  async function getMe() {
    return await _request('/auth/me');
  }

  function logout() {
    localStorage.removeItem('giadinh_token');
    localStorage.removeItem('giadinh_user');
  }

  function getCurrentUser() {
    const userStr = localStorage.getItem('giadinh_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }

  // --- Photos API ---
  async function getPhotos() {
    return await _request('/photos');
  }

  async function uploadPhoto(formData, onProgress) {
    const token = _getToken();
    if (token) {
      // For standard fetch we use XMLHttpRequest inside the promise
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/photos`);
      
      const token = _getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = (e.loaded / e.total) * 100;
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) { /* ignore */ }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || 'Lỗi tải ảnh lên.'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Lỗi kết nối mạng.'));
      });

      xhr.send(formData);
    });
  }

  async function reactPhoto(photoId) {
    return await _request(`/photos/${photoId}/react`, {
      method: 'POST'
    });
  }

  async function deletePhoto(photoId) {
    return await _request(`/photos/${photoId}`, {
      method: 'DELETE'
    });
  }

  // --- Wishes API ---
  async function getWishes() {
    return await _request('/wishes');
  }

  async function addWish(message, emoji) {
    return await _request('/wishes', {
      method: 'POST',
      body: JSON.stringify({ message, emoji })
    });
  }

  async function deleteWish(wishId) {
    return await _request(`/wishes/${wishId}`, {
      method: 'DELETE'
    });
  }

  async function getStats() {
    return await _request('/stats');
  }

  async function updateProfile(fullName, relation, phoneNumber) {
    const data = await _request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ fullName, relation, phoneNumber })
    });
    if (data.token) {
      localStorage.setItem('giadinh_token', data.token);
      localStorage.setItem('giadinh_user', JSON.stringify(data.user));
    }
    return data;
  }

  async function deleteAccount() {
    const data = await _request('/auth/profile', {
      method: 'DELETE'
    });
    logout();
    return data;
  }

  async function getUserProfile(userId) {
    return await _request(`/users/${userId}/profile`);
  }

  // --- Comments & Notifications API ---
  async function getComments(photoId) {
    return await _request(`/photos/${photoId}/comments`);
  }

  async function addComment(photoId, message) {
    return await _request(`/photos/${photoId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  async function getNotifications() {
    return await _request('/notifications');
  }

  async function markNotificationsRead(id = null) {
    return await _request('/notifications/read', {
      method: 'PUT',
      body: JSON.stringify({ id })
    });
  }

  return {
    login,
    register,
    forgotPassword,
    resetPassword,
    getMe,
    logout,
    getCurrentUser,
    getPhotos,
    uploadPhoto,
    reactPhoto,
    deletePhoto,
    getWishes,
    addWish,
    deleteWish,
    getStats,
    updateProfile,
    deleteAccount,
    getUserProfile,
    getComments,
    addComment,
    getNotifications,
    markNotificationsRead
  };
})();
