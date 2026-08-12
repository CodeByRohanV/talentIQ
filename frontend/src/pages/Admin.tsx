import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { adminAPI, domainsAPI } from '@/lib/api';
import {
    UserPlus,
    Users,
    ShieldCheck,
    Mail,
    User,
    Link as LinkIcon,
    Trash2,
    Info,
    ShieldAlert,
    Plus,
    UserCircle,
    Loader2,
    X,
    Settings,
    Shield,
    CheckSquare,
    Square,
    Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export default function Admin() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('onboarding');
    const [users, setUsers] = useState<any[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [domains, setDomains] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalManagers: 0, eligibleTeamMembers: 0, totalAssessments: 0 });

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Assign recruiter dialog state
    const [assignTarget, setAssignTarget] = useState<{ managerId: string; managerName: string } | null>(null);
    const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);

    const [formData, setFormData] = useState({
        fullName: '',
        employeeId: '',
        email: '',
        roleName: 'RECRUITER',
        managerId: '',
        domainId: ''
    });

    // Role management state
    const [roles, setRoles] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<Record<string, any[]>>({});
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<any | null>(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        description: '',
        permissionCodes: [] as string[]
    });
    const [roleLoading, setRoleLoading] = useState(false);
    const [viewingPermsRole, setViewingPermsRole] = useState<any | null>(null);

    // Edit user state
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({
        fullName: '',
        employeeId: '',
        roleName: '',
        managerId: '',
        domainId: ''
    });

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setLoading(true);
        try {
            await adminAPI.updateUser(editTarget.id, editFormData);
            toast({ title: 'User Updated', description: `Details for ${editFormData.fullName} updated successfully.` });
            setIsEditModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to update user', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth');
            return;
        }

        // Access check - must have manage_roles or be Super Admin
        if (user && !user.permissions?.includes('manage_roles') && !user.roles?.includes('SUPER_ADMIN')) {
            toast({
                title: 'Access Denied',
                description: 'You do not have administrative permissions to view this page.',
                variant: 'destructive'
            });
            navigate('/dashboard');
            return;
        }

        if (user) {
            fetchData();
        }
    }, [user, authLoading, navigate]);

    const fetchData = () => {
        fetchUsers();
        fetchStats();
        fetchHierarchy();
        fetchRoles();
        fetchPermissions();
        fetchDomains();
    };

    const fetchDomains = async () => {
        try {
            const response = await domainsAPI.getAll();
            setDomains(response.data || []);
        } catch (error) {
            console.error('Failed to fetch domains:', error);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await adminAPI.listRoles();
            setRoles(response.data?.data || response.data || []);
        } catch (error) {
            console.error('Failed to fetch roles:', error);
        }
    };

    const fetchPermissions = async () => {
        try {
            const response = await adminAPI.listPermissions();
            setPermissions(response.data?.data || response.data || {});
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await adminAPI.listUsers();
            setUsers(response.data?.data || response.data || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await adminAPI.getStats();
            setStats(response.data?.data || response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchHierarchy = async () => {
        try {
            const response = await adminAPI.getHierarchy();
            setHierarchy(response.data?.data || response.data || []);
        } catch (error) {
            console.error('Failed to fetch hierarchy:', error);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await adminAPI.createUser(formData);
            toast({ title: 'User Onboarded', description: `Login credentials sent to ${formData.email}` });
            setFormData({ fullName: '', employeeId: '', email: '', roleName: 'RECRUITER', managerId: '', domainId: '' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to create user', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await adminAPI.deleteUser(deleteTarget.id);
            toast({ title: 'User Deleted', description: `${deleteTarget.name} has been removed.` });
            setDeleteTarget(null);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete user', variant: 'destructive' });
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAssignRecruiter = async () => {
        if (!assignTarget || !selectedRecruiterId) return;
        setAssignLoading(true);
        try {
            await adminAPI.assignRecruiter(assignTarget.managerId, selectedRecruiterId);
            toast({ title: 'Recruiter Assigned', description: `Recruiter successfully assigned to ${assignTarget.managerName}.` });
            setAssignTarget(null);
            setSelectedRecruiterId('');
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to assign recruiter', variant: 'destructive' });
        } finally {
            setAssignLoading(false);
        }
    };

    const handleUnassignRecruiter = async (managerId: string, recruiterId: string, recruiterName: string) => {
        try {
            await adminAPI.unassignRecruiter(managerId, recruiterId);
            toast({ title: 'Recruiter Removed', description: `${recruiterName} has been unassigned.` });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to unassign recruiter', variant: 'destructive' });
        }
    };

    const getAvailableRecruiters = (managerId: string) => {
        const manager = hierarchy.find(m => m.id === managerId);
        const assignedIds = new Set((manager?.recruiters || []).map((r: any) => r.id));
        return users.filter(u => u.role_name === 'RECRUITER' && !assignedIds.has(u.id));
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setRoleLoading(true);
        try {
            if (editingRole) {
                await adminAPI.updateRole(editingRole.id, roleFormData);
                toast({ title: 'Role Updated', description: `Role "${roleFormData.name}" updated successfully.` });
            } else {
                await adminAPI.createRole(roleFormData);
                toast({ title: 'Role Created', description: `Custom role "${roleFormData.name}" is now available.` });
            }
            setIsRoleModalOpen(false);
            setEditingRole(null);
            setRoleFormData({ name: '', description: '', permissionCodes: [] });
            fetchRoles();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save role', variant: 'destructive' });
        } finally {
            setRoleLoading(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        try {
            await adminAPI.deleteRole(roleId);
            toast({ title: 'Role Deleted', description: 'Custom role removed successfully.' });
            fetchRoles();
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete role', variant: 'destructive' });
        }
    };

    const togglePermission = (code: string) => {
        setRoleFormData(prev => {
            const codes = prev.permissionCodes.includes(code)
                ? prev.permissionCodes.filter(c => c !== code)
                : [...prev.permissionCodes, code];
            return { ...prev, permissionCodes: codes };
        });
    };

    return (
        <DashboardLayout>
            {/* ── Delete Confirmation Dialog ── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove <strong>{deleteTarget?.name}</strong> from the system.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Assign Recruiter Dialog ── */}
            <Dialog open={!!assignTarget} onOpenChange={open => !open && setAssignTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Recruiter</DialogTitle>
                        <DialogDescription>
                            Select a recruiter to assign to <strong>{assignTarget?.managerName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Select Recruiter</Label>
                        <Select value={selectedRecruiterId} onValueChange={setSelectedRecruiterId}>
                            <SelectTrigger className="h-11">
                                <SelectValue placeholder="Choose a recruiter..." />
                            </SelectTrigger>
                            <SelectContent>
                                {assignTarget && getAvailableRecruiters(assignTarget.managerId).length === 0 ? (
                                    <div className="p-3 text-sm text-muted-foreground text-center">
                                        No available recruiters to assign.
                                    </div>
                                ) : (
                                    assignTarget && getAvailableRecruiters(assignTarget.managerId).map((r: any) => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.full_name} ({r.employee_id})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={assignLoading}>Cancel</Button>
                        <Button
                            onClick={handleAssignRecruiter}
                            disabled={!selectedRecruiterId || assignLoading}
                            className="btn-gradient"
                        >
                            {assignLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Assign Recruiter
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-8 w-8" />
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Panel</h1>
                    </div>
                    <p className="text-muted-foreground text-sm">Manage users and recruiter-manager assignments</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-auto p-0 mb-8 space-x-8">
                        <TabsTrigger
                            value="onboarding"
                            className="flex items-center gap-2 px-2 py-3 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none shadow-none text-muted-foreground data-[state=active]:text-foreground font-bold"
                        >
                            <UserPlus className="h-4 w-4" />
                            User Onboarding
                        </TabsTrigger>
                        <TabsTrigger
                            value="hierarchy"
                            className="flex items-center gap-2 px-2 py-3 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none shadow-none text-muted-foreground data-[state=active]:text-foreground font-bold"
                        >
                            <Users className="h-4 w-4" />
                            Hierarchy/Assignments
                        </TabsTrigger>
                        <TabsTrigger
                            value="roles"
                            className="flex items-center gap-2 px-2 py-3 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none shadow-none text-muted-foreground data-[state=active]:text-foreground font-bold"
                        >
                            <Shield className="h-4 w-4" />
                            Role Builder
                        </TabsTrigger>
                    </TabsList>

                    {/* ═══════════════ ONBOARDING TAB ═══════════════ */}
                    <TabsContent value="onboarding" className="space-y-8 outline-none">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Info Card */}
                            <div className="lg:col-span-5 space-y-6">
                                <Card className="border-border/50 bg-primary/5 shadow-sm">
                                    <CardHeader className="pb-3 text-primary">
                                        <CardTitle className="text-lg flex items-center gap-2 font-bold">
                                            <Info className="h-5 w-5" />
                                            Automated Onboarding
                                        </CardTitle>
                                        <CardDescription>What happens during the process</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6 text-sm">
                                        <div className="space-y-4">
                                            {[
                                                { title: 'Secure Credentials', desc: 'The system generates a unique random password and hashes it before storage.' },
                                                { title: 'Notification Email', desc: 'The user receives their Employee ID and temporary credentials via their registered email.' },
                                                { title: 'Security Enforcement', desc: 'A mandatory password reset flag is set to ensure the user changes their password on first login.' },
                                            ].map((step, i) => (
                                                <div key={i} className="flex gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">{i + 1}</div>
                                                    <div className="space-y-1">
                                                        <p className="font-bold">{step.title}</p>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 bg-background/50 border border-border/50 rounded-xl space-y-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                <ShieldAlert className="h-3 w-3" />
                                                Security Note
                                            </h4>
                                            <p className="text-xs leading-relaxed italic">
                                                Passwords are never stored in plain text. Corporate access requires{' '}
                                                <strong>direct administrative provisioning</strong> for all users.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Create User Form */}
                            <div className="lg:col-span-7">
                                <Card className="border-border/50 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                                    <div className="h-1.5 w-full bg-primary" />
                                    <CardHeader className="pb-6">
                                        <CardTitle className="text-xl flex items-center gap-2 tracking-tight">
                                            <UserPlus className="h-5 w-5 text-primary" />
                                            Onboard Manager / Recruiter
                                        </CardTitle>
                                        <CardDescription>Enter details to provision a new user in the system</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleCreateUser} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Full Name</Label>
                                                    <Input
                                                        placeholder="e.g., John Doe"
                                                        value={formData.fullName}
                                                        className="h-11 bg-muted/20 border-border/50 focus:bg-background"
                                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Employee ID</Label>
                                                    <Input
                                                        placeholder="e.g., M123 or R456"
                                                        value={formData.employeeId}
                                                        className="h-11 bg-muted/20 border-border/50 focus:bg-background"
                                                        onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Email Address</Label>
                                                    <Input
                                                        type="email"
                                                        placeholder="user@company.com"
                                                        value={formData.email}
                                                        className="h-11 bg-muted/20 border-border/50 focus:bg-background"
                                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">System Role</Label>
                                                    <Select value={formData.roleName} onValueChange={v => {
                                                        if (v === 'CREATE_NEW') {
                                                            setEditingRole(null);
                                                            setRoleFormData({ name: '', description: '', permissionCodes: [] });
                                                            setIsRoleModalOpen(true);
                                                        } else {
                                                            setFormData({ ...formData, roleName: v });
                                                        }
                                                    }}>
                                                        <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                                                            <SelectValue placeholder="Select a role" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {roles.length > 0 ? (
                                                                roles.map(r => (
                                                                    <SelectItem key={r.id} value={r.name}>
                                                                        {r.name} {r.is_system_role ? '' : '(Custom)'}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <>
                                                                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                                                                    <SelectItem value="RECRUITER">RECRUITER</SelectItem>
                                                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                                                </>
                                                            )}
                                                            <SelectItem value="CREATE_NEW" className="text-primary font-bold border-t border-border mt-2 bg-primary/5 focus:bg-primary/10 transition-colors cursor-pointer">
                                                                <div className="flex items-center gap-2">
                                                                    <Plus className="h-4 w-4" />
                                                                    Create Custom Role
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {(formData.roleName === 'RECRUITER' || formData.roleName === 'MANAGER') && (
                                                    <>
                                                        <div className="space-y-2 md:col-span-1">
                                                            <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Assign Manager</Label>
                                                            <Select value={formData.managerId} onValueChange={v => setFormData({ ...formData, managerId: v })}>
                                                                <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                                                                    <SelectValue placeholder="None" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    {users.filter(u => u.role_name === 'MANAGER' || u.role_name === 'ADMIN').map(u => (
                                                                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2 md:col-span-1">
                                                            <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Assign Domain</Label>
                                                            <Select value={formData.domainId} onValueChange={v => setFormData({ ...formData, domainId: v })}>
                                                                <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                                                                    <SelectValue placeholder="None" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    {domains.map(d => (
                                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <Button className="w-full h-12 text-base font-bold btn-gradient rounded-xl shadow-lg shadow-primary/20" disabled={loading}>
                                                {loading ? (
                                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4" />
                                                        Create User & Send Credentials
                                                    </span>
                                                )}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* System Users Table */}
                            <div className="lg:col-span-12">
                                <Card className="border-border/50 shadow-md">
                                    <CardHeader className="border-b border-border/50 py-4">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" />
                                            System Users
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="font-bold py-3 px-6">User Instance</TableHead>
                                                        <TableHead className="font-bold">Email</TableHead>
                                                        <TableHead className="font-bold">System Role</TableHead>
                                                        <TableHead className="font-bold">Manager</TableHead>
                                                        <TableHead className="font-bold">Domain</TableHead>
                                                        <TableHead className="text-right pr-8 font-bold uppercase text-xs">Management</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {users.map(u => (
                                                        <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                                                            <TableCell className="font-bold py-4 px-6">
                                                                <div className="flex flex-col">
                                                                    <span>{u.full_name}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono leading-none mt-1">{u.employee_id}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={cn(
                                                                    'px-3 py-1 text-[10px] font-bold uppercase',
                                                                    u.role_name === 'SUPER_ADMIN' ? 'text-destructive border-destructive/20 bg-destructive/5' :
                                                                        u.role_name === 'ADMIN' ? 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20' :
                                                                            u.role_name === 'MANAGER' ? 'text-primary border-primary/20 bg-primary/5' :
                                                                                'text-success border-success/20 bg-success/5'
                                                                )}>
                                                                    {u.role_name}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground italic font-medium">
                                                                {users.find(mgr => mgr.id === u.manager_id)?.full_name || 'None'}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground font-bold">
                                                                {domains.find(d => d.id === u.domain_id)?.name || 'Global'}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors h-8 w-8"
                                                                        onClick={() => {
                                                                            setEditTarget(u);
                                                                            setEditFormData({
                                                                                fullName: u.full_name,
                                                                                employeeId: u.employee_id,
                                                                                roleName: u.role_name,
                                                                                managerId: u.manager_id || 'none',
                                                                                domainId: u.domain_id || 'none'
                                                                            });
                                                                            setIsEditModalOpen(true);
                                                                        }}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-8 w-8"
                                                                        onClick={() => setDeleteTarget({ id: u.id, name: u.full_name })}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {users.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                                                                No users found. Create one above.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ═══════════════ HIERARCHY TAB ═══════════════ */}
                    <TabsContent value="hierarchy" className="space-y-8 outline-none">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-border/50 shadow-sm text-center py-10 card-hover">
                                <CardContent className="p-0 space-y-3">
                                    <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto">
                                        <User className="h-7 w-7 text-foreground" />
                                    </div>
                                    <div className="text-4xl font-black tracking-tight">{stats.totalManagers}</div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-4">Total Managers</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border/50 shadow-sm text-center py-10 card-hover">
                                <CardContent className="p-0 space-y-3">
                                    <div className="p-3 bg-primary/5 rounded-full w-fit mx-auto">
                                        <Users className="h-7 w-7 text-primary" />
                                    </div>
                                    <div className="text-4xl font-black tracking-tight">{stats.eligibleTeamMembers}</div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary px-4">Eligible Team Members</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border/50 shadow-sm text-center py-10 card-hover">
                                <CardContent className="p-0 space-y-3">
                                    <div className="p-3 bg-primary/5 rounded-full w-fit mx-auto">
                                        <CheckSquare className="h-7 w-7 text-primary" />
                                    </div>
                                    <div className="text-4xl font-black tracking-tight">{stats.totalAssessments}</div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary px-4">Assessments</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Hierarchy List */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Users className="h-5 w-5" />
                                <h2 className="text-lg">Managers & Their Teams</h2>
                            </div>

                            <Card className="border-border shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-card">
                                {hierarchy.length > 0 ? (
                                    <div className="w-full space-y-6">
                                        {hierarchy.map(manager => (
                                            <div key={manager.id} className="border border-border rounded-xl overflow-hidden">
                                                <div className="bg-muted/30 p-4 flex items-center justify-between border-b border-border">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-background rounded-lg border border-border shadow-sm">
                                                            <UserCircle className="h-6 w-6 text-primary" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-bold text-sm">{manager.full_name}</p>
                                                            <p className="text-xs text-muted-foreground">{manager.employee_id} • {manager.email}</p>
                                                        </div>
                                                    </div>
                                                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 font-bold">
                                                        {manager.recruiters?.length || 0} Recruiters
                                                    </Badge>
                                                </div>
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {manager.recruiters?.map((recruiter: any) => (
                                                        <div key={recruiter.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-transparent hover:border-primary/30 transition-all group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-border group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                                    <User className="h-4 w-4" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <p className="text-xs font-bold">{recruiter.full_name}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{recruiter.employee_id}</p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                                                onClick={() => handleUnassignRecruiter(manager.id, recruiter.id, recruiter.full_name)}
                                                                title="Unassign Recruiter"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {/* Assign Recruiter Button */}
                                                    <Button
                                                        variant="ghost"
                                                        className="h-auto py-3 border border-dashed border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary gap-2 rounded-lg"
                                                        onClick={() => setAssignTarget({ managerId: manager.id, managerName: manager.full_name })}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        <span className="text-xs font-bold">Assign Recruiter</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-6 max-w-sm">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
                                            <UserPlus className="h-20 w-20 text-primary mx-auto relative" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black tracking-tight">No Managers Found</h3>
                                            <p className="text-sm text-balance text-muted-foreground font-medium">
                                                You haven't onboarded any directors or team managers yet.
                                                Create managers in the User Onboarding tab first.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => setActiveTab('onboarding')}
                                            className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-11 rounded-xl shadow-lg shadow-primary/20 gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Go to User Onboarding
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ═══════════════ ROLES TAB ═══════════════ */}
                    <TabsContent value="roles" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                    <Shield className="h-6 w-6 text-primary" />
                                    Custom Role Builder
                                </h2>
                                <p className="text-muted-foreground text-sm font-medium">Define granular access levels for your organization</p>
                            </div>
                            <Button className="btn-gradient shadow-lg shadow-primary/20 rounded-xl px-6" onClick={() => {
                                setEditingRole(null);
                                setRoleFormData({ name: '', description: '', permissionCodes: [] });
                                setIsRoleModalOpen(true);
                            }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create New Role
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {roles.map(role => (
                                <Card key={role.id} className={cn(
                                    "border-border/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col h-full",
                                    role.is_system_role ? "bg-muted/5" : "bg-card"
                                )}>
                                    {role.is_system_role && (
                                        <div className="absolute top-0 right-0 p-3">
                                            <Badge variant="secondary" className="text-[9px] uppercase font-black tracking-tighter bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">System</Badge>
                                        </div>
                                    )}
                                    <CardHeader className="pb-3 flex-none">
                                        <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{role.name}</CardTitle>
                                        <CardDescription className="text-xs line-clamp-3 min-h-[48px]">{role.description || 'No description provided.'}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-start gap-1.5 min-h-[3.5rem]">
                                                {role.permission_codes?.slice(0, 5).map((code: string) => (
                                                    <Badge key={code} variant="outline" className="text-[10px] px-2 py-0.5 bg-primary/5 border-primary/20 text-primary/80 font-bold capitalize whitespace-nowrap">
                                                        {code.split('_').join(' ')}
                                                    </Badge>
                                                ))}
                                                {(role.permission_codes?.length || 0) > 5 && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] px-2 py-0.5 bg-primary/10 border-primary/30 text-primary font-black cursor-pointer hover:bg-primary hover:text-white transition-all shadow-sm"
                                                        onClick={() => setViewingPermsRole(role)}
                                                    >
                                                        +{(role.permission_codes?.length || 0) - 5} more
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-4">
                                            <span className="text-[10px] text-muted-foreground font-medium italic">
                                                {role.permission_codes?.length || 0} permissions mapped
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                    onClick={() => setViewingPermsRole(role)}
                                                    title="View All Permissions"
                                                >
                                                    <UserCircle className="h-4 w-4" />
                                                </Button>
                                                {!role.is_system_role && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                            onClick={() => {
                                                                setEditingRole(role);
                                                                setRoleFormData({
                                                                    name: role.name,
                                                                    description: role.description || '',
                                                                    permissionCodes: role.permission_codes || []
                                                                });
                                                                setIsRoleModalOpen(true);
                                                            }}
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteRole(role.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                    {!role.is_system_role && <div className="h-1 w-full bg-primary/0 group-hover:bg-primary transition-all duration-500 absolute bottom-0" />}
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* ── Role Editor Dialog ── */}
            <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/50 shadow-2xl">
                    <DialogHeader className="p-6 pb-2 border-b border-border/50">
                        <DialogTitle className="text-2xl font-black tracking-tight">
                            {editingRole ? 'Update Custom Role' : 'Create Custom Role'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure granular permissions for this role. These will apply organization-wide.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Role Name</Label>
                                <Input
                                    placeholder="e.g., Marketing Analyst"
                                    value={roleFormData.name}
                                    onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                    className="h-11 bg-muted/20 border-border/50 focus:bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</Label>
                                <Input
                                    placeholder="Briefly describe what this role does"
                                    value={roleFormData.description}
                                    onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                    className="h-11 bg-muted/20 border-border/50 focus:bg-background"
                                />
                            </div>
                        </div>

                        {/* Permission Matrix */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <CheckSquare className="h-5 w-5" />
                                <h3 className="font-black uppercase tracking-widest text-xs">Permission Matrix</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                {Object.entries(permissions).map(([category, perms]) => (
                                    <div key={category} className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/30">
                                        <h4 className="text-[11px] font-bold text-foreground border-b border-border/50 pb-2 mb-3 uppercase tracking-wider">{category}</h4>
                                        <div className="space-y-2.5">
                                            {perms.map((p: any) => (
                                                <div key={p.id} className="flex items-start gap-3 group cursor-pointer" onClick={() => togglePermission(p.code)}>
                                                    <div className={cn(
                                                        "h-4 w-4 rounded border mt-0.5 flex items-center justify-center transition-all shrink-0",
                                                        roleFormData.permissionCodes.includes(p.code)
                                                            ? "bg-primary border-primary text-primary-foreground"
                                                            : "border-muted-foreground/30 group-hover:border-primary/50"
                                                    )}>
                                                        {roleFormData.permissionCodes.includes(p.code) && <Plus className="h-3 w-3 rotate-45" />}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <Label className="text-xs font-bold leading-none cursor-pointer group-hover:text-primary transition-colors">
                                                            {p.code.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground leading-tight italic">{p.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-muted/20 border-t border-border/50 gap-4">
                        <Button variant="ghost" onClick={() => setIsRoleModalOpen(false)} disabled={roleLoading} className="font-bold">Cancel</Button>
                        <Button
                            className="btn-gradient px-8 h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                            disabled={!roleFormData.name || roleFormData.permissionCodes.length === 0 || roleLoading}
                            onClick={handleSaveRole}
                        >
                            {roleLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                            {editingRole ? 'Update Capability' : 'Save Custom Role'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View Permissions Modal ── */}
            <Dialog open={!!viewingPermsRole} onOpenChange={open => !open && setViewingPermsRole(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Shield className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-xl font-black">{viewingPermsRole?.name} Permissions</DialogTitle>
                                <DialogDescription className="text-xs font-medium">{viewingPermsRole?.description}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {viewingPermsRole?.permission_codes?.map((code: string) => (
                                <div key={code} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                                    <div className="h-2 w-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                    <span className="text-xs font-bold capitalize text-foreground/80 group-hover:text-primary transition-colors">
                                        {code.split('_').join(' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full font-bold h-11 rounded-xl" onClick={() => setViewingPermsRole(null)}>Close Viewer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* ── Edit User Modal ── */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-2xl bg-card border-border/50 shadow-2xl overflow-hidden p-0">
                    <div className="h-1.5 w-full bg-primary" />
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <UserCircle className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight">Edit User Details</DialogTitle>
                                <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                    Update profile info and access roles for <span className="text-foreground font-bold">{editTarget?.email}</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleUpdateUser}>
                        <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                                    <Input
                                        placeholder="e.g., John Doe"
                                        value={editFormData.fullName}
                                        className="h-11 bg-muted/20 border-border/50 focus:bg-background transition-all font-medium"
                                        onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Employee ID</Label>
                                    <Input
                                        placeholder="e.g., M123"
                                        value={editFormData.employeeId}
                                        className="h-11 bg-muted/20 border-border/50 focus:bg-background transition-all font-medium"
                                        onChange={e => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Role</Label>
                                    <Select value={editFormData.roleName} onValueChange={v => setEditFormData({ ...editFormData, roleName: v })}>
                                        <SelectTrigger className="h-11 bg-muted/20 border-border/50 font-medium">
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map(r => (
                                                <SelectItem key={r.id} value={r.name} className="font-medium">
                                                    {r.name} {r.is_system_role ? '' : '(Custom)'}
                                                </SelectItem>
                                            ))}
                                            {roles.length === 0 && (
                                                <>
                                                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                                                    <SelectItem value="RECRUITER">RECRUITER</SelectItem>
                                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(editFormData.roleName === 'RECRUITER' || editFormData.roleName === 'MANAGER') && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assign Manager</Label>
                                            <Select value={editFormData.managerId} onValueChange={v => setEditFormData({ ...editFormData, managerId: v })}>
                                                <SelectTrigger className="h-11 bg-muted/20 border-border/50 font-medium">
                                                    <SelectValue placeholder="None" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {users.filter(u => (u.role_name === 'MANAGER' || u.role_name === 'ADMIN') && u.id !== editTarget?.id).map(u => (
                                                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assign Domain</Label>
                                            <Select value={editFormData.domainId} onValueChange={v => setEditFormData({ ...editFormData, domainId: v })}>
                                                <SelectTrigger className="h-11 bg-muted/20 border-border/50 font-medium">
                                                    <SelectValue placeholder="None" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {domains.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-muted/20 border-t border-border/50 gap-3">
                            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} disabled={loading} className="font-bold h-11 px-6">
                                Cancel
                            </Button>
                            <Button type="submit" className="btn-gradient font-bold h-11 px-8 rounded-xl shadow-lg shadow-primary/20" disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </DashboardLayout >
    );
}
