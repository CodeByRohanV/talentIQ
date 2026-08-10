import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If the user is somehow already authenticated, take them to the dashboard
    if (user) {
      navigate('/dashboard');
      return;
    }

    // Force light theme
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'light');

    // Get current host and redirect back to Scaloz Workspace
    const hostname = window.location.hostname;
    let targetUrl = '';
    if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const protocol = window.location.protocol;
      const tenantUrl = import.meta.env.VITE_TENANT_URL;
      const targetHost = hostname.replace(/skillztest|skillz|talentiq/gi, 'apps');
      targetUrl = tenantUrl ? `${tenantUrl}/Home` : `${protocol}//${targetHost}/Home`;
    } else {
      targetUrl = 'http://localhost:3001/Home';
    }
    
    // Redirect after a 2-second delay to show the message
    const timer = setTimeout(() => {
      window.location.href = targetUrl;
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, navigate]);

  /* 
   * The original reset password form has been commented out to enforce SSO
   * and bypass manual credential modification on TalentiQ:
   *
   * const handleReset = async (e: React.FormEvent) => { ... }
   * 
   * <Card className="border-border/50 shadow-xl overflow-hidden">
   *   ... New Password ...
   *   ... Confirm Password ...
   *   ... Reset Password Button ...
   * </Card>
   */

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 text-center selection:bg-[#2563EB]/10">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
        <div className="bg-[#2563EB] h-1.5 w-full top-0 left-0 absolute rounded-t-2xl" />
        <img src="/logo.png" alt="TalentiQ" className="w-16 h-16 mx-auto mb-6 rounded-xl shadow-md border border-slate-100" />
        
        <h2 className="text-2xl font-black text-[#0F172A] mb-3">Reset Password Disabled</h2>
        <p className="text-slate-500 font-semibold mb-6 leading-relaxed">
          TalentiQ is integrated with the Scaloz Workspace. Manual password changes and resets are disabled.
        </p>
        
        <div className="inline-flex items-center gap-2 text-sm font-black text-[#2563EB] bg-[#2563EB]/5 px-4 py-2 rounded-lg animate-pulse">
          Redirecting to Scaloz Workspace...
        </div>
      </div>
    </div>
  );
}
