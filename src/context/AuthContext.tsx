import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bypassMode: boolean;
  googleConfigured: boolean;
  authError: string | null;
  unauthorizedEmail: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bypassMode, setBypassMode] = useState<boolean>(false);
  const [googleConfigured, setGoogleConfigured] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  // Check URL query parameters for OAuth errors on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('auth_error');
    const deniedEmail = params.get('email');

    if (err) {
      if (err === 'unauthorized_email') {
        setAuthError('Unauthorized Account: Your Google account is not on the authorized allowlist.');
      } else if (err === 'token_exchange_failed') {
        setAuthError('Authentication failed: Could not exchange tokens with Google.');
      } else {
        setAuthError(`Sign-in error: ${err}`);
      }
      if (deniedEmail) {
        setUnauthorizedEmail(deniedEmail);
      }

      // Clean the URL query params without reloading
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(Boolean(data.authenticated));
        setBypassMode(Boolean(data.bypassMode));
        setGoogleConfigured(Boolean(data.googleConfigured));
        setUser(data.user || null);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (e) {
      console.error('Failed to verify session status:', e);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const loginWithGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to retrieve Google Sign-In URL');
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      setAuthError(e.message || 'Error initiating Google Sign-In');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      window.location.href = '/';
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
    setUnauthorizedEmail(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        bypassMode,
        googleConfigured,
        authError,
        unauthorizedEmail,
        loginWithGoogle,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
