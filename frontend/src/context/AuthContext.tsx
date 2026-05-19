"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'STAFF' | 'ADMIN';
  is_superuser: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAdmin: false,
  login: async () => ({ success: false }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Fetch current user info from /api/me/
  const fetchMe = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch(`${API_URL}/me/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return true;
      } else {
        // Token expired or invalid
        logout();
        return false;
      }
    } catch {
      return false;
    }
  }, [API_URL]);

  // On mount: check for saved token
  useEffect(() => {
    const savedToken = localStorage.getItem('centenaryo_access_token');
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchMe]);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const accessToken = data.access;
        const refreshToken = data.refresh;

        // Save tokens
        localStorage.setItem('centenaryo_access_token', accessToken);
        localStorage.setItem('centenaryo_refresh_token', refreshToken);
        setToken(accessToken);

        // Fetch user info
        await fetchMe(accessToken);

        return { success: true };
      } else {
        const errorData = await res.json();
        return {
          success: false,
          error: errorData.detail || 'Hindi tugma ang username at password.',
        };
      }
    } catch {
      return {
        success: false,
        error: 'Hindi makakonekta sa server. Siguraduhing tumatakbo ang backend.',
      };
    }
  };

  const logout = () => {
    // Awtomatikong abisuhan ang backend para ma-log ang LOGOUT activity sa AuditLog
    const savedToken = localStorage.getItem('centenaryo_access_token');
    if (savedToken) {
      try {
        fetch(`${API_URL}/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${savedToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.error("Logout API error:", err);
      }
    }

    localStorage.removeItem('centenaryo_access_token');
    localStorage.removeItem('centenaryo_refresh_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAdmin: user?.role === 'ADMIN',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
