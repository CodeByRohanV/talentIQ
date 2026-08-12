import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExpiryStatusProps {
  expiryDate: string | Date;
  className?: string;
}

const ExpiryStatus: React.FC<ExpiryStatusProps> = ({ expiryDate, className }) => {
  const status = useMemo(() => {
    if (!expiryDate) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    const fullDateStr = expiry.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const shortDateStr = expiry.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });

    expiry.setHours(0, 0, 0, 0);

    const diff = expiry.getTime() - now.getTime();
    
    if (diff < 0) {
      return {
        label: `Expired on ${shortDateStr}`,
        tooltip: `This test expired on ${fullDateStr}`,
        variant: 'expired'
      };
    } else if (diff === 0) {
      return {
        label: 'Expires Today',
        tooltip: `This test expires today, ${fullDateStr}`,
        variant: 'today'
      };
    } else {
      return {
        label: `Expires ${shortDateStr}`,
        tooltip: `This test will expire on ${fullDateStr}`,
        variant: 'upcoming'
      };
    }
  }, [expiryDate]);

  if (!status) return null;

  const variants = {
    expired: "bg-red-50 text-red-700 border-red-100",
    today: "bg-amber-50 text-amber-700 border-amber-100",
    upcoming: "bg-orange-50/50 text-orange-700/80 border-orange-100/50"
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all duration-200 cursor-default select-none",
            variants[status.variant],
            className
          )}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{status.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs font-medium">
          {status.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ExpiryStatus;
