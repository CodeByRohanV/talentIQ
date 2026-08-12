import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { assessmentsAPI } from '@/lib/api';
import { Loader2, Mail, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SendLinkDialogProps {
  assessmentId: string | null;
  assessmentTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SendLinkDialog({
  assessmentId,
  assessmentTitle,
  open,
  onOpenChange,
}: SendLinkDialogProps) {
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAddEmails = () => {
    // Split by comma, space, or newline
    const newEmails = emailInput
      .split(/[,\s\n]+/)
      .map(e => e.trim())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .filter(e => !emails.includes(e));

    if (newEmails.length > 0) {
      setEmails([...emails, ...newEmails]);
      setEmailInput('');
    } else if (emailInput.trim()) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter valid email addresses',
        variant: 'destructive',
      });
    }
  };

  const removeEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (emails.length === 0) {
      if (emailInput.trim()) {
        // Try to add what's currently in the input first
        const newEmails = emailInput
          .split(/[,\s\n]+/)
          .map(e => e.trim())
          .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        
        if (newEmails.length > 0) {
          await sendBatch([...newEmails]);
          return;
        }
      }
      
      toast({
        title: 'No recipients',
        description: 'Please add at least one valid email address',
        variant: 'destructive',
      });
      return;
    }

    await sendBatch(emails);
  };

  const sendBatch = async (emailList: string[]) => {
    if (!assessmentId) return;
    
    setLoading(true);
    try {
      await assessmentsAPI.sendLink(assessmentId, emailList);
      toast({
        title: 'Invitations Sent',
        description: `Successfully sent test link to ${emailList.length} recipient(s)`,
      });
      setEmails([]);
      setEmailInput('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send invitation emails',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Send Assessment Link
          </DialogTitle>
          <DialogDescription>
            Send the test link for "{assessmentTitle}" to candidates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient Emails</label>
            <Textarea
              placeholder="Enter email addresses (separated by commas, spaces, or new lines)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="min-h-[100px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddEmails();
                }
              }}
            />
            <p className="text-[10px] text-muted-foreground italic">
              Tip: You can paste a list of emails directly here.
            </p>
          </div>

          {emails.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  {emails.length} Valid Recipients
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] font-black uppercase text-destructive hover:text-destructive hover:bg-destructive/5 px-2"
                  onClick={() => setEmails([])}
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border rounded-xl bg-muted/30 border-dashed border-border/60">
                {emails.map((email, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1.5 py-1 pr-1 pl-2.5 rounded-full border border-primary/10 bg-background shadow-sm group transition-all hover:border-primary/30">
                    <span className="text-[11px] font-bold truncate max-w-[150px]">{email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full hover:bg-destructive hover:text-white transition-colors"
                      onClick={() => removeEmail(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddEmails}
              disabled={loading || !emailInput.trim()}
            >
              Add Emails
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={loading || (emails.length === 0 && !emailInput.trim())}
              className="font-bold min-w-[100px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invitations'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
