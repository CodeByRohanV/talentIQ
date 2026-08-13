import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Settings,
  Mail,
  BarChart3,
  Loader2,
} from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Force light theme
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'light');

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Build the Scaloz workspace URL to redirect unauthenticated users back to.
    // For ALL local dev (localhost OR any .localhost subdomain like scalozflow.localhost),
    // always go back to the Scaloz tenant login.
    // For production, replace "TalentiQ" with "apps" in the hostname.
    const workspaceUrl: string =
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost'))
        ? (import.meta.env.VITE_MAIN_TENANT_URL || 'http://localhost:3001/Home')
        : (import.meta.env.VITE_TENANT_URL ? `${import.meta.env.VITE_TENANT_URL}/Home` : `${protocol}//${hostname.replace(/skillztest/gi, 'workspacetest').replace(/skillz|talentiq/gi, 'workspace')}/Home`);

    if (!loading) {
      if (user) {
        // Authenticated — go to dashboard
        navigate('/dashboard');
      } else {
        // No token at all — redirect to Scaloz Workspace
        window.location.href = workspaceUrl;
      }
    }
  }, [user, loading, navigate]);

  // Show loader during initial load or while redirecting to avoid flickering the landing page
  if (loading || !user || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB]/10 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#2563EB]/5 blur-[120px] rounded-full z-0 pointer-events-none"></div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="TalentiQ" className="h-10 w-10 rounded-lg shadow-sm" />
            <span className="font-extrabold text-2xl tracking-tighter text-[#0F172A]">TalentiQ</span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a href="#product" className="text-sm font-semibold text-slate-600 hover:text-[#2563EB] transition-colors">Product</a>
            <a href="#how-it-works" className="text-sm font-semibold text-slate-600 hover:text-[#2563EB] transition-colors">How it Works</a>
          </div>
          {/* Sign In and Get Started buttons have been commented out to enforce SSO */}
          {/* <div className="flex items-center gap-4">
            <a href={workspaceUrl} className="text-sm font-semibold text-slate-600 hover:text-[#2563EB] transition-colors">Sign In</a>
            <Button asChild className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg px-6 h-11 font-bold transition-all hover:scale-[1.02] shadow-lg shadow-[#2563EB]/20">
              <a href={workspaceUrl}>Get Started</a>
            </Button>
          </div> */}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-32 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-20 items-center">
          <div className="relative z-10 text-center lg:text-left">
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-8 text-[#0F172A]">
              The Assessment Platform Built for <span className="text-[#2563EB]">Serious Hiring.</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-xl mb-12 lg:mx-0 mx-auto leading-relaxed font-medium">
              Create, distribute, and analyze candidate assessments — at any scale. Fully automated and recruiter-focused.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 lg:justify-start justify-center">
              {/* <Button size="lg" asChild className="bg-[#2563EB] hover:bg-[#1D4ED8] h-14 px-8 text-lg font-bold rounded-xl shadow-xl shadow-[#2563EB]/25 transition-all hover:-translate-y-1">
                <a href={workspaceUrl}>Get Started Free &rarr;</a>
              </Button> */}
              <Button size="lg" variant="outline" asChild className="h-14 px-8 text-lg font-bold border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all">
                <a href="#product">See Features</a>
              </Button>
            </div>
          </div>
          <div className="relative group lg:block hidden">
            <div className="absolute inset-0 bg-[#2563EB]/5 blur-[100px] rounded-full opacity-40 transition-all duration-700"></div>
            <img
              src="/images/hero_mockup.png"
              alt="Dashboard Preview"
              className="relative z-10 w-full rounded-2xl border border-slate-200 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] animate-in fade-in slide-in-from-right-12 duration-1000"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 max-w-7xl mx-auto border-t border-slate-200">
        <div className="text-center mb-24">
          <h2 className="text-4xl lg:text-5xl font-black mb-6 tracking-tight text-[#0F172A]">From question to insight in minutes.</h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto font-medium">Standardize your evaluation process with enterprise-grade tools.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Build your question bank', desc: 'Import thousands of questions across tech and aptitude domains.', icon: Globe },
            { step: '02', title: 'Configure and share', desc: 'Secure assessments with custom thresholds and time limits.', icon: ShieldCheck },
            { step: '03', title: 'Analyze and decide', desc: 'Automated scoring with granularity that scales with your growth.', icon: BarChart3 },
          ].map((item) => (
            <div key={item.step} className="group p-8 rounded-2xl bg-white border border-slate-200 hover:border-[#2563EB]/40 hover:shadow-2xl hover:shadow-[#2563EB]/5 transition-all duration-500 shadow-sm">
              <div className="text-5xl font-black text-slate-100 group-hover:text-[#2563EB]/10 transition-colors mb-6">{item.step}</div>
              <h3 className="text-xl font-bold mb-4 text-[#0F172A]">{item.title}</h3>
              <p className="text-slate-600 leading-relaxed font-semibold">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Value Prop with Mockup */}
      <section id="product" className="py-32 px-6 bg-slate-50 border-y border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-24 items-center">
          <div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-8 text-[#0F172A]">Everything your team needs to evaluate talent fairly.</h2>
            <div className="space-y-8">
              {[
                { title: 'Flexible test configuration', desc: 'Security first, with custom limits.' },
                { title: 'Automated scoring & reports', desc: 'Get results instantly after submission.' },
                { title: 'One-click shareable links', desc: 'Scale recruitment with easy access.' },
                { title: 'Enterprise-ready analytics', desc: 'Export and analyze your data.' }
              ].map((benefit) => (
                <div key={benefit.title} className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#2563EB]/10 flex items-center justify-center shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-[#2563EB]"></div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#0F172A] mb-1">{benefit.title}</h4>
                    <p className="text-slate-600 font-semibold">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-10 bg-[#2563EB]/5 blur-[100px] rounded-full opacity-20"></div>
            <img src="/images/stats_mockup.png" alt="Analytics View" className="relative z-10 rounded-2xl border border-slate-200 shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Final CTA section has been commented out to enforce SSO */}
      {/* <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto p-16 lg:p-24 rounded-4xl bg-[#2563EB] relative overflow-hidden text-center shadow-2xl shadow-[#2563EB]/20">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <h2 className="text-4xl lg:text-6xl font-black mb-8 relative z-10 tracking-tight text-white focus-visible:outline-none">Ready to hire smarter?</h2>
          <p className="text-xl lg:text-2xl text-white/90 mb-12 relative z-10 font-bold tracking-tight">Set up your first assessment in under 10 minutes.</p>
          <Button asChild size="lg" className="bg-white text-[#2563EB] hover:bg-slate-50 h-16 px-12 text-xl font-extrabold rounded-2xl relative z-10 shadow-2xl transition-transform hover:scale-105 active:scale-95">
            <a href={workspaceUrl}>Get Started for Free &rarr;</a>
          </Button>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-16 mb-24">
            <div>
              <div className="flex items-center gap-2 mb-8">
                <img src="/logo.png" alt="TalentiQ" className="h-8 w-8 rounded-lg shadow-sm" />
                <span className="font-extrabold text-xl tracking-tighter text-[#0F172A]">TalentiQ</span>
              </div>
              <p className="text-slate-500 max-w-xs font-semibold leading-relaxed">Predictable and fair talent discovery for teams of all sizes.</p>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">Product</h4>
              <ul className="space-y-4 font-bold">
                <li><a href="#how-it-works" className="text-slate-600 hover:text-[#2563EB] transition-colors text-sm">How it Works</a></li>
                <li><a href="#product" className="text-slate-600 hover:text-[#2563EB] transition-colors text-sm">Features</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">Contact</h4>
              <div className="flex items-center gap-4">
                <a href="#" className="text-slate-500 hover:text-[#2563EB] transition-colors p-2 bg-slate-50 rounded-lg"><Mail className="w-5 h-5" /></a>
                <a href="#" className="text-slate-500 hover:text-[#2563EB] transition-colors p-2 bg-slate-50 rounded-lg"><Zap className="w-5 h-5" /></a>
                <a href="#" className="text-slate-500 hover:text-[#2563EB] transition-colors p-2 bg-slate-50 rounded-lg"><Settings className="w-5 h-5" /></a>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-12 border-t border-slate-200 text-slate-400 text-xs font-black uppercase tracking-[0.2em]">
            <p>© {new Date().getFullYear()} TalentiQ Tech. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
