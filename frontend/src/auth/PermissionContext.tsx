import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface PermissionContextType {
    permissions: string[];
    roles: string[];
    hasPermission: (permission: string) => boolean;
    hasRole: (role: string) => boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    // Assuming user object from useAuth now contains permissions and roles 
    // after we updated the getMe endpoint and hopefully the useAuth hook.
    const permissions = (user as any)?.permissions || [];
    const roles = (user as any)?.roles || [];

    const hasPermission = (permission: string) => {
        return permissions.includes(permission) || permissions.includes('all');
    };

    const hasRole = (role: string) => {
        return roles.includes(role) || roles.includes('SUPER_ADMIN');
    };

    return (
        <PermissionContext.Provider value={{ permissions, roles, hasPermission, hasRole }}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermission = (permission: string) => {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error('usePermission must be used within a PermissionProvider');
    }
    return context.hasPermission(permission);
};

export const useRole = (role: string) => {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error('useRole must be used within a PermissionProvider');
    }
    return context.hasRole(role);
};

export const Can: React.FC<{ permission?: string; role?: string; children: ReactNode }> = ({
    permission,
    role,
    children
}) => {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        return null;
    }

    let allowed = true;

    if (permission && !context.hasPermission(permission)) {
        allowed = false;
    }

    if (role && !context.hasRole(role)) {
        allowed = false;
    }

    if (!allowed) return null;

    return <>{children}</>;
};
