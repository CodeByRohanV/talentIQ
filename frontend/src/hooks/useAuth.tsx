import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { authAPI } from '@/lib/api';
import { resolveApiUrl } from '@/lib/api';

interface User {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  roles: string[];
  permissions: string[];
  tenantId: string | null;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, companyName?: string) => Promise<{ error: any | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null; forcePasswordReset?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Log the resolved API URL once on mount — open DevTools Console to confirm the correct backend
    console.debug('[SSO] Resolved API URL:', resolveApiUrl(import.meta.env.VITE_API_URL));

    // Intercept SSO token from Scaloz launch URL
    const currentUrl = new URL(window.location.href);
    const params = currentUrl.searchParams;
    let scalozToken = params.get('scaloz_token');
    let tokenFoundInHash = false;

    // Also support tokens passed in the hash fragment, e.g. #scaloz_token=...
    if (!scalozToken && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hashToken = hashParams.get('scaloz_token');
      if (hashToken) {
        scalozToken = hashToken;
        tokenFoundInHash = true;
      }
    }

    if (scalozToken) {
      console.debug('[SSO] scaloz_token found in URL, storing to sessionStorage...');
      sessionStorage.setItem('auth_token', scalozToken);

      // Verify the write actually succeeded (Safari in private mode & some WebViews can silently fail)
      const stored = sessionStorage.getItem('auth_token');
      if (!stored) {
        console.error('[SSO] sessionStorage write FAILED — browser may be blocking storage (private mode / WebView restriction)');
      } else {
        console.debug('[SSO] auth_token stored successfully');
      }

      // Clean the token out of the URL so it doesn't appear in history or on refresh
      params.delete('scaloz_token');
      const cleanPath = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      // replaceState removes both query and hash fragment — clears token from the address bar entirely
      window.history.replaceState({}, document.title, cleanPath);
    }

    // Check for existing token and fetch user
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      console.debug('[SSO] auth_token present, fetching user profile...');
      fetchUser();
    } else {
      console.debug('[SSO] No auth_token — user is not authenticated');
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser({
        id: response.data.id,
        email: response.data.email,
        fullName: response.data.fullName,
        companyName: response.data.companyName,
        roles: response.data.roles || [],
        permissions: response.data.permissions || [],
        tenantId: response.data.tenantId,
        mustChangePassword: response.data.mustChangePassword
      });
    } catch (error: any) {
      console.error('[SSO] fetchUser failed:', error);
      sessionStorage.removeItem('auth_token');
      setUser(null);

      // Only redirect back to Scaloz Workspace on a hard 401 (token rejected by the server).
      // Network errors, 5xx server errors, or CORS failures should NOT loop-redirect the user —
      // they're infrastructure issues, not auth failures.
      const status = error?.response?.status;
      const isAuthRejection = status === 401 || status === 403;

      if (isAuthRejection) {
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
        if (isLocal) {
          window.location.href = 'http://localhost:3001/Home';
        } else {
          const protocol = window.location.protocol;
          const targetHost = hostname.replace(/skillztest/gi, 'workspacetest').replace(/\bskillz\b/gi, 'workspace');
          window.location.href = `${protocol}//${targetHost}/Home`;
        }
      } else {
        console.warn('[SSO] fetchUser failed with non-auth error (status:', status, ') — not redirecting to workspace');
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, companyName?: string) => {
    try {
      await authAPI.register(email, password, fullName, companyName);
      return { error: null };
    } catch (error) {
      return { error: error as any };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);

      // Store token
      sessionStorage.setItem('auth_token', response.data.token);

      // Set user
      setUser({
        id: response.data.user.id,
        email: response.data.user.email,
        fullName: response.data.user.fullName,
        companyName: response.data.user.companyName,
        roles: response.data.user.roles || [],
        permissions: response.data.user.permissions || [],
        tenantId: response.data.user.tenantId,
        mustChangePassword: response.data.user.mustChangePassword
      });

      return { error: null, forcePasswordReset: response.data.forcePasswordReset };
    } catch (error) {
      return { error: error as any };
    }
  };


  const signOut = async () => {
    sessionStorage.removeItem('auth_token');
    setUser(null);
    
    // Redirect back to Scaloz Workspace
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Check if we are running locally (localhost, *.localhost, or local IP)
    const isLocal = hostname === 'localhost' || hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    
    if (isLocal) {
      window.location.href = `http://${hostname}:3001/Home`;
    } else {
      const targetHost = hostname.replace(/skillztest/gi, 'workspacetest').replace(/\bskillz\b/gi, 'workspace');
      window.location.href = `${protocol}//${targetHost}/Home`;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
