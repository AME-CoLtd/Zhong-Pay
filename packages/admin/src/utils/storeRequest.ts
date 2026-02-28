import axios from 'axios';
import { ElMessage } from 'element-plus';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/store`
  : '/api/store';

const storeRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

storeRequest.interceptors.request.use((config) => {
  const token = localStorage.getItem('zp_customer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

storeRequest.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data.code !== 0) {
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }
    return data;
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || '网络错误';
    if (error.response?.status === 401) {
      localStorage.removeItem('zp_customer_token');
      localStorage.removeItem('zp_customer_info');
    }
    ElMessage.error(msg);
    return Promise.reject(error);
  },
);

export default storeRequest;
