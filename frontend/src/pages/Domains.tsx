import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { domainsAPI } from '@/lib/api';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Domain {
    id: string;
    name: string;
    slug: string;
    recruiter_id: string | null;
    created_at: string;
    is_active: boolean;
}

export default function Domains() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomainName, setNewDomainName] = useState('');
    const [adding, setAdding] = useState(false);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth');
        }
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (user) {
            fetchDomains();
        }
    }, [user]);

    const fetchDomains = async () => {
        try {
            const response = await domainsAPI.getAll();
            setDomains(response.data || []);
        } catch (error) {
            console.error('Error fetching domains:', error);
            toast({
                title: 'Error',
                description: 'Failed to load domains',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDomainName.trim()) return;

        setAdding(true);
        try {
            await domainsAPI.create(newDomainName.trim());
            setNewDomainName('');
            fetchDomains();
            toast({
                title: 'Success',
                description: 'Domain added successfully',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to add domain',
                variant: 'destructive',
            });
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteDomain = async () => {
        if (!deleteTarget) return;

        setDeleting(true);
        try {
            await domainsAPI.delete(deleteTarget.id);
            setDomains(domains.filter(d => d.id !== deleteTarget.id));
            toast({
                title: 'Success',
                description: 'Domain deleted successfully',
            });
            setDeleteOpen(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete domain',
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 space-y-6">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold">Domain Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Add or remove domains for your assessment questions
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Domain Form */}
                    <Card className="lg:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle>Add New Domain</CardTitle>
                            <CardDescription>Create a new category for your questions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddDomain} className="space-y-4">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="e.g. Data Science"
                                        value={newDomainName}
                                        onChange={(e) => setNewDomainName(e.target.value)}
                                        disabled={adding}
                                        maxLength={50}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Slugs are generated automatically (e.g. data_science)
                                    </p>
                                </div>
                                <Button type="submit" className="w-full" disabled={adding || !newDomainName.trim()}>
                                    {adding ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Domain
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Domains List */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Existing Domains</CardTitle>
                            <CardDescription>Managed list of available domains</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : domains.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-muted-foreground">No custom domains added yet</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Domain Name</TableHead>
                                            <TableHead>Slug</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {domains.map((domain) => (
                                            <TableRow key={domain.id}>
                                                <TableCell className="font-medium">{domain.name}</TableCell>
                                                <TableCell className="font-mono text-xs">{domain.slug}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            setDeleteTarget(domain);
                                                            setDeleteOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Delete Domain?
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
                            This action cannot be undone.
                            <br /><br />
                            <span className="text-destructive font-bold">
                                Warning: This will permanently delete all questions associated with this domain.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteDomain} disabled={deleting}>
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Confirm Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
