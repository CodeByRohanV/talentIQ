import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  FileQuestion,
  ClipboardList,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardCheck,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems: { icon: any, label: string, href: string, permission?: string }[] = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: FileQuestion, label: 'Question Bank', href: '/dashboard/questions' },
  { icon: ClipboardList, label: 'Assessments', href: '/dashboard/assessments' },
  { icon: ClipboardCheck, label: 'Domains', href: '/dashboard/domains' },
  { icon: Users, label: 'Candidates', href: '/dashboard/candidates' },
  { icon: ShieldCheck, label: 'Admin Panel', href: '/dashboard/admin', permission: 'manage_roles' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = user?.fullName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || user?.email?.[0].toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="TalentiQ" className="h-8 w-8 rounded-lg" />
            <span className="font-semibold">TalentiQ</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          'hidden lg:block',
          mobileOpen && 'block lg:block'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="TalentiQ" className="h-9 w-9 rounded-lg shadow-sm" />
              <span className="font-bold text-lg">TalentiQ</span>
            </div>
          )}
          {collapsed && (
            <img src="/logo.png" alt="TalentiQ" className="h-9 w-9 rounded-lg" />
          )}
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            // Permission check
            if (item.permission && !user?.permissions?.includes(item.permission)) {
              if (!user?.roles?.includes('SUPER_ADMIN')) {
                return null;
              }
            }

            const isActive = location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', collapsed && 'mx-auto')} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse button - desktop only */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex absolute bottom-4 right-2 h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {/* User section */}
        {!collapsed && (
          <div className="absolute bottom-16 left-0 right-0 p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">
                      {user?.fullName || 'Recruiter'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="flex items-center justify-between">
                  My Account
                  <ThemeToggle />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'transition-all duration-300 pt-16 lg:pt-0',
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
