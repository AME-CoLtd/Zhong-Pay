import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface Admin {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('zp_token'));
  const admin = ref<Admin | null>(JSON.parse(localStorage.getItem('zp_admin') || 'null'));

  const isLoggedIn = computed(() => !!token.value);

  function setAuth(newToken: string, newAdmin: Admin) {
    token.value = newToken;
    admin.value = newAdmin;
    localStorage.setItem('zp_token', newToken);
    localStorage.setItem('zp_admin', JSON.stringify(newAdmin));
  }

  function updateAdmin(data: Partial<Admin>) {
    if (admin.value) {
      admin.value = { ...admin.value, ...data };
      localStorage.setItem('zp_admin', JSON.stringify(admin.value));
    }
  }

  function logout() {
    token.value = null;
    admin.value = null;
    localStorage.removeItem('zp_token');
    localStorage.removeItem('zp_admin');
  }

  return { token, admin, isLoggedIn, setAuth, updateAdmin, logout };
});
