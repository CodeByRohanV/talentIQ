import { query } from '../config/database.js';

export const createDomain = async (name, slug, userId, tenantId, managerId) => {
    const result = await query(
        `INSERT INTO domains (name, slug, recruiter_id, created_by_manager_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, slug, userId, managerId]
    );
    return result.rows[0];
};

export const findDomainsRoleAware = async (actorId, tenantId, roles, managerId) => {
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    const isAdmin = roles.includes('ADMIN');
    const isManager = roles.includes('MANAGER');
    const isRecruiter = roles.includes('RECRUITER');

    let queryText = "";
    let params = [];

    if (isSuperAdmin) {
        queryText = `
            SELECT d.*, 
                (SELECT jsonb_build_object(
                    'total', COUNT(*)::int,
                    'easy', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'easy')::int,
                    'medium', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'medium' OR q.difficulty IS NULL)::int,
                    'hard', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'hard')::int
                ) FROM questions q 
                 WHERE (q.domain_id = d.id OR (q.domain_id IS NULL AND q.domain::text = d.slug))
                 AND q.is_deleted = false) as counts
            FROM domains d
            WHERE d.is_active = true
            ORDER BY d.slug`;
    } else if (isAdmin) {
        params = [tenantId];
        queryText = `
            SELECT d.*, 
                (SELECT jsonb_build_object(
                    'total', COUNT(*)::int,
                    'easy', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'easy')::int,
                    'medium', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'medium' OR q.difficulty IS NULL)::int,
                    'hard', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'hard')::int
                ) FROM questions q 
                 WHERE (q.domain_id = d.id OR (q.domain_id IS NULL AND q.domain::text = d.slug))
                 AND (split_part(q.created_by, '_', 1) = $1 OR q.created_by IS NULL)
                 AND q.is_deleted = false) as counts
            FROM domains d
            WHERE d.is_active = true
            AND (split_part(d.recruiter_id, '_', 1) = $1 OR d.recruiter_id IS NULL)
            ORDER BY d.slug`;
    } else if (isManager) {
        params = [tenantId, managerId || actorId];
        queryText = `
            SELECT d.*, 
                (SELECT jsonb_build_object(
                    'total', COUNT(*)::int,
                    'easy', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'easy')::int,
                    'medium', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'medium' OR q.difficulty IS NULL)::int,
                    'hard', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'hard')::int
                ) FROM questions q 
                 WHERE (q.domain_id = d.id OR (q.domain_id IS NULL AND q.domain::text = d.slug))
                 AND (split_part(q.created_by, '_', 1) = $1 OR q.created_by IS NULL)
                 AND (q.created_by_manager_id = $2 OR q.created_by IS NULL)
                 AND q.is_deleted = false) as counts
            FROM domains d
            WHERE d.is_active = true
            AND (split_part(d.recruiter_id, '_', 1) = $1 OR d.recruiter_id IS NULL)
            AND (d.created_by_manager_id = $2 OR d.recruiter_id = $2 OR d.recruiter_id IS NULL)
            ORDER BY d.slug`;
    } else if (isRecruiter) {
        params = [tenantId, actorId, managerId];
        queryText = `
            SELECT d.*, 
                (SELECT jsonb_build_object(
                    'total', COUNT(*)::int,
                    'easy', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'easy')::int,
                    'medium', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'medium' OR q.difficulty IS NULL)::int,
                    'hard', COUNT(*) FILTER (WHERE LOWER(TRIM(q.difficulty)) = 'hard')::int
                ) FROM questions q 
                 WHERE (q.domain_id = d.id OR (q.domain_id IS NULL AND q.domain::text = d.slug))
                 AND (split_part(q.created_by, '_', 1) = $1 OR q.created_by IS NULL)
                 AND (q.created_by_manager_id = $3 OR q.created_by_manager_id = $2 OR q.created_by IS NULL)
                 AND q.is_deleted = false) as counts
            FROM domains d
            WHERE d.is_active = true
            AND (split_part(d.recruiter_id, '_', 1) = $1 OR d.recruiter_id IS NULL)
            AND (d.recruiter_id = $2 OR d.created_by_manager_id = $3 OR d.recruiter_id = $3 OR d.recruiter_id IS NULL)
            ORDER BY d.slug`;
    } else {
        // Fallback for other roles (only see what they created)
        params = [tenantId, actorId];
        queryText = `
            SELECT d.*, 
                (SELECT jsonb_build_object('total', COUNT(*)::int) FROM questions q 
                 WHERE (q.domain_id = d.id OR (q.domain_id IS NULL AND q.domain::text = d.slug))
                 AND split_part(q.created_by, '_', 1) = $1 AND q.created_by = $2
                 AND q.is_deleted = false) as counts
            FROM domains d
            WHERE d.is_active = true
            AND (split_part(d.recruiter_id, '_', 1) = $1 OR d.recruiter_id IS NULL)
            ORDER BY d.slug`;
    }

    const result = await query(queryText, params);

    // DEBUG LOG
    if (result.rows.length > 0) {
        console.log(`[DomainModel] actorId: ${actorId}, roles: ${roles}, domain[0] count: ${result.rows[0].counts?.total}`);
    }

    return result.rows.map(row => ({
        ...row,
        question_count: row.counts ? row.counts.total : 0
    })).sort((a, b) => a.name.localeCompare(b.name));
};

export const findDomainById = async (id) => {
    const result = await query(
        'SELECT * FROM domains WHERE id = $1',
        [id]
    );
    return result.rows[0];
};

export const deleteDomain = async (id) => {
    // 1. Get domain info to handle legacy slug-linked questions
    const domainRes = await query('SELECT slug FROM domains WHERE id = $1', [id]);
    if (domainRes.rows.length === 0) return null;
    const slug = domainRes.rows[0].slug;

    // 2. Soft-delete questions linked to this domain so historical
    //    assessment reports (response data, scores) remain intact.
    await query(
        `UPDATE questions
         SET is_deleted = true, deleted_at = NOW()
         WHERE (domain_id = $1 OR (domain_id IS NULL AND domain::text = $2))
         AND is_deleted = false`,
        [id, slug]
    );

    // 3. Delete the domain itself
    const result = await query(
        'DELETE FROM domains WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rows[0];
};

export const updateDomain = async (id, updates) => {
    const { name, is_active } = updates;
    const result = await query(
        `UPDATE domains 
         SET name = COALESCE($1, name), 
             is_active = COALESCE($2, is_active)
         WHERE id = $3
         RETURNING *`,
        [name, is_active, id]
    );
    return result.rows[0];
};

export const findOrCreateDomain = async (name, slug, userId, tenantId, managerId) => {
    // Check if exists in this tenant or global
    const existing = await query(
        `SELECT * FROM domains 
         WHERE (slug = $1 OR LOWER(name) = LOWER($2)) 
         AND (split_part(recruiter_id, '_', 1) = $3 OR recruiter_id IS NULL)`,
        [slug, name, tenantId]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    // Create new
    return await createDomain(name, slug, userId, tenantId, managerId);
};
