import axios from 'axios';

const API_URL =  'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getToken = () => localStorage.getItem('token');

export const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};
