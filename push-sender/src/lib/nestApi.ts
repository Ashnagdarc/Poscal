import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { logger } from './logger';

interface NestApiOptions {
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
}

export function createNestApi(options: NestApiOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseUrl,
    timeout: options.timeoutMs ?? 30000,
    headers: {
      'X-Service-Token': options.serviceToken,
      'Content-Type': 'application/json',
    },
    httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 50 }),
    httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 50 }),
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      logger.error('Nest API request failed', {
        url: error?.config?.url,
        method: error?.config?.method,
        status: error?.response?.status,
      });
      return Promise.reject(error);
    },
  );

  return instance;
}
