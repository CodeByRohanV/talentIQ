import * as Domain from '../models/Domain.js';
import * as User from '../models/User.js';

export const getDomains = async (req, res, next) => {
    try {
        const { userId: actorId, tenantId, roles, managerId } = req.auth;

        const domains = await Domain.findDomainsRoleAware(actorId, tenantId, roles, managerId);

        res.json({
            success: true,
            data: domains
        });
    } catch (error) {
        next(error);
    }
};

export const createDomain = async (req, res, next) => {
    try {
        const { name } = req.body;
        const { userId, tenantId, roles } = req.auth;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Domain name is required' });
        }

        // Always resolve fresh managerId from DB to prevent session/JWT mismatch issues
        let scopedManagerId = null;
        if (roles.includes('RECRUITER') || roles.includes('MANAGER')) {
            const freshUser = await User.findUserById(userId);
            scopedManagerId = freshUser?.manager_id || userId;
        }

        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

        const domain = await Domain.createDomain(name, slug, userId, tenantId, scopedManagerId);
        res.status(201).json({
            success: true,
            data: domain
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Domain already exists' });
        }
        next(error);
    }
};

export const deleteDomain = async (req, res, next) => {
    try {
        const { id } = req.params;
        await Domain.deleteDomain(id);
        res.json({
            success: true,
            message: 'Domain deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const updateDomain = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;
        const domain = await Domain.updateDomain(id, { name, is_active: isActive });
        res.json({
            success: true,
            data: domain
        });
    } catch (error) {
        next(error);
    }
};
