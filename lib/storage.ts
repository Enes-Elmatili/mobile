// lib/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';

class TokenStorage {
  private static instance: TokenStorage;
  private currentToken: string | null = null;
  private listeners: Set<(token: string | null) => void> = new Set();

  private constructor() {}

  static getInstance(): TokenStorage {
    if (!TokenStorage.instance) {
      TokenStorage.instance = new TokenStorage();
    }
    return TokenStorage.instance;
  }

  async getToken(): Promise<string | null> {
    // Return cached token if available
    if (this.currentToken !== null) {
      return this.currentToken;
    }

    try {
      let token: string | null = null;
      
      if (Platform.OS === 'web') {
        token = localStorage.getItem(TOKEN_KEY);
      } else {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
      }

      this.currentToken = token;
      return token;
    } catch (e) {
      console.error('❌ Storage getToken error:', e);
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    this.currentToken = token;
    
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
      
      // Notify listeners
      this.listeners.forEach(cb => cb(token));
    } catch (e) {
      console.error('❌ Storage setToken error:', e);
    }
  }

  async removeToken(): Promise<void> {
    this.currentToken = null;
    
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      
      // Notify listeners
      this.listeners.forEach(cb => cb(null));
    } catch (e) {
      console.error('❌ Storage removeToken error:', e);
    }
  }

  // Subscribe to token changes
  subscribe(callback: (token: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Get cached token without async (for sync operations)
  getCachedToken(): string | null {
    return this.currentToken;
  }
}

export const tokenStorage = TokenStorage.getInstance();