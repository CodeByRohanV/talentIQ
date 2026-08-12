import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Requirement {
    label: string;
    met: boolean;
}

interface PasswordValidatorProps {
    password: string;
}

export default function PasswordValidator({ password }: PasswordValidatorProps) {
    const requirements: Requirement[] = [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
        { label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
        { label: 'At least one number', met: /[0-9]/.test(password) },
        { label: 'At least one special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    return (
        <div className="space-y-2 mt-3 p-3 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Password Requirements</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {requirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div className={cn(
                            "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300",
                            req.met ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            {req.met ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                        </div>
                        <span className={cn(
                            "text-xs transition-colors duration-300",
                            req.met ? "text-success font-medium" : "text-muted-foreground"
                        )}>
                            {req.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
