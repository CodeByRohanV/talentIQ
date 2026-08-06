import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  usedInAssessments: number;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  count,
  usedInAssessments,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} question{count > 1 ? 's' : ''}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This action cannot be undone. The selected questions will be permanently removed from your question bank.</p>
              {usedInAssessments > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{usedInAssessments}</strong> of {count} selected question{count > 1 ? 's are' : ' is'} used in existing assessments.
                    {' '}Deleting {count > 1 ? 'them' : 'it'} will hide {count > 1 ? 'them' : 'it'} from your question bank, but <strong>all historical assessment reports and candidate scores will remain fully intact</strong>.
                  </span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${count} Question${count > 1 ? 's' : ''}`
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
