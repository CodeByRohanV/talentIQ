import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If the user is already authenticated, take them to the dashboard.
    if (user) {
      navigate('/dashboard');
      return;
    }

    // Force light theme
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'light');

    // If auth is still loading or we already have a token, stay on this page until auth resolves.
    const token = sessionStorage.getItem('auth_token');
    if (loading || token) {
      return;
    }

    // Get current host and redirect back to Scaloz Workspace
    const hostname = window.location.hostname;
    let targetUrl = '';
    const tenantUrl = import.meta.env.VITE_TENANT_URL;
    const isLocal = import.meta.env.DEV || hostname === 'localhost' || !!hostname.match(/^\d+\.\d+\.\d+\.\d+$/);
    if (!isLocal) {
      const protocol = window.location.protocol;
      const targetHost = hostname.replace(/skillztest/gi, 'workspacetest').replace(/skillz|talentiq/gi, 'workspace');
      targetUrl = `${protocol}//${targetHost}/Home`;
    } else {
      targetUrl = tenantUrl ? `${tenantUrl}/Home` : (import.meta.env.VITE_MAIN_TENANT_URL || 'http://localhost:3001/Home');
    }

    window.location.href = targetUrl;
  }, [user, loading, navigate]);

  /* 
   * The original login, forgot password, and reset password forms have been commented out
   * to enforce SSO and bypass manual credential entry:
   *
   * const handleSignIn = async (e: React.FormEvent) => { ... }
   * const handleForgotPassword = async (e: React.FormEvent) => { ... }
   * 
   * <Card className="w-full max-w-md ...">
   *   ... Email / Employee ID ...
   *   ... Password ...
   *   ... Forgot Your Password? Link ...
   *   ... Sign in to Dashboard Button ...
   * </Card>
   */

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 text-center selection:bg-[#2563EB]/10">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
        <div className="bg-[#2563EB] h-1.5 w-full top-0 left-0 absolute rounded-t-2xl" />
        <img src="/logo.png" alt="TalentiQ" className="w-16 h-16 mx-auto mb-6 rounded-xl shadow-md border border-slate-100" />
        
        <h2 className="text-2xl font-black text-[#0F172A] mb-3">Manual Login Disabled</h2>
        <p className="text-slate-500 font-semibold mb-6 leading-relaxed">
          TalentiQ is integrated with the Scaloz Workspace. Manual login, forgot password, and reset password pages are disabled.
        </p>
        
        <div className="inline-flex items-center gap-2 text-sm font-black text-[#2563EB] bg-[#2563EB]/5 px-4 py-2 rounded-lg animate-pulse">
          Redirecting to Scaloz Workspace...
        </div>
      </div>
    </div>
  );
}
