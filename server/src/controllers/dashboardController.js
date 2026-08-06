import { query } from '../config/database.js';
import * as Assessment from '../models/Assessment.js';

export const getStats = async (req, res, next) => {
    try {
        const { userId: actorId, tenantId, roles, managerId, domainId: userDomainId } = req.auth;

        // 1. Total Questions (Scoped filtering)
        let questionsRes;
        if (roles.includes('SUPER_ADMIN')) {
            questionsRes = await query('SELECT COUNT(*) FROM questions');
        } else if (roles.includes('ADMIN')) {
            questionsRes = await query(
                'SELECT COUNT(*) FROM questions WHERE (tenant_id = $1 OR tenant_id IS NULL)',
                [tenantId]
            );
        } else {
            // MANAGER or RECRUITER
            questionsRes = await query(
                `SELECT COUNT(*) FROM questions 
                 WHERE (tenant_id = $1 OR tenant_id IS NULL)
                 AND (created_by_manager_id = $2 OR domain_id = $3 OR tenant_id IS NULL)`,
                [tenantId, managerId || actorId, userDomainId]
            );
        }
        const totalQuestions = parseInt(questionsRes.rows[0].count);

        // 2. Assessments (Role-aware filtering)
        const assessments = await Assessment.findAssessmentsRoleAware(actorId, tenantId, roles, managerId);
        const totalAssessments = assessments.length;
        const assessmentIds = assessments.map(a => a.id);

        // 3. Candidates and Pass Rate
        let totalCandidates = 0;
        let passRate = 0;

        if (assessmentIds.length > 0) {
            // Count candidates for these assessments
            const candidatesRes = await query(
                'SELECT COUNT(*) FROM candidates WHERE assessment_id = ANY($1)',
                [assessmentIds]
            );
            totalCandidates = parseInt(candidatesRes.rows[0].count);

            // Calculate Pass Rate
            const resultsRes = await query(
                `SELECT 
                    COUNT(*) as total_results,
                    COUNT(*) FILTER (WHERE passed = true) as passed_count
                 FROM results r
                 JOIN candidates c ON r.candidate_id = c.id
                 WHERE c.assessment_id = ANY($1)`,
                [assessmentIds]
            );

            const totalResults = parseInt(resultsRes.rows[0].total_results);
            const passedCount = parseInt(resultsRes.rows[0].passed_count);

            passRate = totalResults > 0 ? Math.round((passedCount / totalResults) * 100) : 0;
        }

        res.json({
            success: true,
            data: {
                totalQuestions,
                totalAssessments,
                totalCandidates,
                passRate
            }
        });
    } catch (error) {
        next(error);
    }
};
