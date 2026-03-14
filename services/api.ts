import axios, { AxiosError, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 20000,
});

let unauthorizedHandler: (() => void) | null = null;

api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401 && unauthorizedHandler) {
            unauthorizedHandler();
        }

        return Promise.reject(error);
    },
);

export function setAuthToken(token: string | null) {
    if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common.Authorization;
    }
}

export function onUnauthorized(handler: () => void) {
    unauthorizedHandler = handler;
}

export default api;
