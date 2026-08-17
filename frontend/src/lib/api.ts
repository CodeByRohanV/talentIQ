import axios from 'axios';

export const resolveApiUrl = (configuredUrl: string): string => {
    if (!configuredUrl) return 'https://skillz.scaloz.com/api';

    if (configuredUrl.includes(',') || configuredUrl.includes('*')) {
        const currentHost = window.location.hostname;
        const currentProtocol = window.location.protocol;
        const urls = configuredUrl.split(',').map(u => u.trim());

        for (const url of urls) {
            if (url.includes('*')) {
                const protocolMatch = url.startsWith('https://') ? 'https:' : 'http:';
                if (protocolMatch !== currentProtocol) continue;

                const pattern = url.replace('https://', '').replace('http://', '').replace(/\/api\/?$/, '');
                const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-zA-Z0-9-]+');
                const regex = new RegExp(`^${escaped}$`, 'i');

                if (regex.test(currentHost)) {
                    // The current host is a branded tenant subdomain (e.g. pysquare.skillz.scaloz.com).
                    // The TalentiQ Node.js API runs on the ROOT domain (skillz.scaloz.com/api), not the subdomain.
                    // Strip the "*." from the wildcard URL to get the root API URL.
                    // e.g. "https://*.skillz.scaloz.com/api" → "https://skillz.scaloz.com/api"
                    const rootUrl = url.replace('*.', '');   // simple string replace — removes *. anywhere in the URL
                    return rootUrl.endsWith('/api') ? rootUrl : `${rootUrl}/api`;
                }
            } else {
                const origin = url.replace(/\/api\/?$/, '');
                if (origin.toLowerCase() === `${currentProtocol}//${currentHost}`.toLowerCase()) {
                    return url;
                }
            }
        }

        const isLocal = import.meta.env.DEV || currentHost === 'localhost' || currentHost.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
        if (isLocal) {
            return `${currentProtocol}//${currentHost}:5000/api`;
        }

        return urls[0].replace('*.', '').replace('http:', currentProtocol);
    }

    const currentHost = window.location.hostname;
    const isLocal = import.meta.env.DEV || currentHost === 'localhost' || currentHost.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
    if (isLocal && configuredUrl.includes('localhost') && currentHost !== 'localhost' && !currentHost.endsWith('.localhost')) {
        return configuredUrl.replace('localhost', currentHost);
    }

    return configuredUrl;
};


const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response) {
            // Server responded with error
            const message = error.response.data?.message || 'An error occurred';

            // Handle 401 Unauthorized
            if (error.response.status === 401) {
                sessionStorage.removeItem('auth_token');
                const isInitialSSOLoad = window.location.pathname === '/' || window.location.pathname === '/Home';
                // Only auto-redirect back if this wasn't during initial SSO authentication attempt
                if (!isInitialSSOLoad) {
                    const hostname = window.location.hostname;
                    const isLocal = import.meta.env.DEV || hostname === 'localhost' || hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
                    if (isLocal) {
                        window.location.href = import.meta.env.VITE_MAIN_TENANT_URL || 'http://localhost:3001/Home';
                    } else {
                        const tenantUrl = import.meta.env.VITE_TENANT_URL;
                        if (tenantUrl) {
                            window.location.href = `${tenantUrl}/Home`;
                        } else {
                            const targetHost = hostname.replace(/skillz|talentiq/gi, 'apps');
                            window.location.href = `${window.location.protocol}//${targetHost}/Home`;
                        }
                    }
                }
            }

            // Return the full error object so components can access error.response.data
            return Promise.reject(error);
        } else if (error.request) {
            // Request made but no response
            return Promise.reject(new Error('No response from server'));
        } else {
            // Something else happened
            return Promise.reject(error);
        }
    }
);

// Auth API
export const authAPI = {
    register: (email: string, password: string, fullName: string, companyName?: string) =>
        api.post('/auth/register', { email, password, fullName, companyName }),

    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    verifyEmail: (token: string) =>
        api.get(`/auth/verify?token=${token}`),

    getMe: () =>
        api.get('/auth/me'),

    updateProfile: (fullName: string, companyName?: string) =>
        api.put('/auth/profile', { fullName, companyName }),

    resendVerification: (email: string) =>
        api.post('/auth/resend-verification', { email }),

    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),

    resetPassword: (token: string, newPassword: string) =>
        api.post('/auth/reset-password', { token, newPassword }),

    changePassword: (newPassword: string) =>
        api.post('/auth/change-password', { newPassword }),
};

// Questions API
export const questionsAPI = {
    getAll: (filters?: { domain?: string; domainId?: string; difficulty?: string; search?: string; page?: number; limit?: number; questionType?: string }) =>
        api.get('/questions', { params: filters }),

    getMyDomain: (filters?: { domainId?: string; difficulty?: string; search?: string; page?: number; limit?: number }) =>
        api.get('/question-banks/my-domain', { params: filters }),

    getAssigned: (filters?: { domainId?: string; difficulty?: string; search?: string; page?: number; limit?: number }) =>
        api.get('/question-banks/assigned', { params: filters }),

    create: (question: any) =>
        api.post('/questions', question),

    bulkCreate: (questions: any[]) =>
        api.post('/questions/bulk', { questions }),

    update: (id: string, question: any) =>
        api.put(`/questions/${id}`, question),

    delete: (id: string) =>
        api.delete(`/questions/${id}`),

    bulkDelete: (ids: string[] | 'all', filters?: { domainId?: string; search?: string }) =>
        api.delete('/questions/bulk', { data: { ids, ...filters } }),

    checkUsage: (ids: string[] | 'all', filters?: { domainId?: string; search?: string }) =>
        api.get('/questions/usage', { params: { ids: Array.isArray(ids) ? ids.join(',') : ids, ...filters } }),
};

// Domains API
export const domainsAPI = {
    getAll: () =>
        api.get('/domains'),

    create: (name: string) =>
        api.post('/domains', { name }),

    delete: (id: string) =>
        api.delete(`/domains/${id}`),
};

// Assessments API
export const assessmentsAPI = {
    getAll: () =>
        api.get('/assessments'),

    getById: (id: string) =>
        api.get(`/assessments/${id}`),

    create: (assessment: any) =>
        api.post('/assessments', assessment),

    update: (id: string, updates: any) =>
        api.put(`/assessments/${id}`, updates),

    delete: (id: string) =>
        api.delete(`/assessments/${id}`),

    getQuestions: (id: string) =>
        api.get(`/assessments/${id}/questions`),

    assignQuestions: (id: string, questionIds: string[]) =>
        api.post(`/assessments/${id}/questions`, { questionIds }),
    sendLink: (id: string, emails: string[]) =>
        api.post(`/assessments/${id}/send-link`, { emails }),
    bulkDelete: (ids: string[]) =>
        api.post('/assessments/bulk-delete', { ids }),
};

// Candidates API
export const candidatesAPI = {
    getAll: () =>
        api.get('/candidates'),

    getByAssessment: (assessmentId: string) =>
        api.get(`/candidates/assessment/${assessmentId}`),

    create: (candidate: { assessmentId: string; name: string; email: string }) =>
        api.post('/candidates', candidate),

    register: (data: { assessmentId: string; name: string; email: string }) =>
        api.post('/candidates/register', data),

    verifyOtp: (data: { tempId: number; otp: string }) =>
        api.post('/candidates/verify-otp', data),

    getByToken: (token: string) =>
        api.get(`/candidates/token/${token}`),

    delete: (id: string) =>
        api.delete(`/candidates/${id}`),
};

// Test API (public)
export const testAPI = {
    getTest: (token: string) =>
        api.get(`/test/${token}`),

    startTest: (token: string) =>
        api.post(`/test/${token}/start`),

    saveResponse: (token: string, questionId: string, selectedAnswer: number | null, isFlagged: boolean, textAnswer?: string) =>
        api.post(`/test/${token}/response`, { questionId, selectedAnswer, isFlagged, textAnswer }),

    logViolation: (token: string, violationType: string, metadata: any) =>
        api.post(`/test/${token}/violation`, { violationType, metadata }),

    submitTest: (token: string, submissionMode: string = 'manual') =>
        api.post(`/test/${token}/submit`, { submissionMode }),

    uploadPhotoId: (token: string, formData: FormData) =>
        api.postForm(`/test/${token}/photo-id`, formData),
};

export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
};

// Results API
export const resultsAPI = {
    getAll: () =>
        api.get('/results'),

    getByCandidate: (candidateId: string) =>
        api.get(`/results/candidate/${candidateId}`),

    getByAssessment: (assessmentId: string) =>
        api.get(`/results/assessment/${assessmentId}`),

    getDetailedByCandidate: (candidateId: string) =>
        api.get(`/results/candidate/${candidateId}/detailed`),

    getDetailedByAssessment: (assessmentId: string) =>
        api.get(`/results/assessment/${assessmentId}/detailed`),

    gradeResponse: (responseId: string | null, manualScore: number, graderFeedback: string, candidateId?: string, questionId?: string) =>
        api.put(`/results/responses/${responseId}/grade`, { manualScore, graderFeedback, candidateId, questionId }),
};

// Admin API
export const adminAPI = {
    createUser: (data: { email: string; fullName: string; roleName: string; employeeId: string; tenantId?: string }) =>
        api.post('/admin/users', data),

    listUsers: (tenantId?: string) =>
        api.get('/admin/users', { params: { tenantId } }),

    getStats: () =>
        api.get('/admin/stats'),

    deleteUser: (id: string) =>
        api.delete(`/admin/users/${id}`),

    updateUser: (id: string, data: { fullName?: string; employeeId?: string; roleName?: string; managerId?: string; domainId?: string }) =>
        api.patch(`/admin/users/${id}`, data),

    // Hierarchy Management
    assignRecruiter: (managerId: string, recruiterId: string) =>
        api.post('/admin/hierarchy/assign', { managerId, recruiterId }),

    unassignRecruiter: (managerId: string, recruiterId: string) =>
        api.post('/admin/hierarchy/unassign', { managerId, recruiterId }),

    getHierarchy: () =>
        api.get('/admin/hierarchy'),

    // Roles & Permissions
    listRoles: () => api.get('/admin/roles'),
    createRole: (data: { name: string; description: string; permissionCodes: string[] }) =>
        api.post('/admin/roles', data),
    updateRole: (id: string, data: any) =>
        api.patch(`/admin/roles/${id}`, data),
    deleteRole: (id: string) =>
        api.delete(`/admin/roles/${id}`),
    listPermissions: () => api.get('/admin/permissions'),
};

// Proctoring API
export const proctoringAPI = {
    startSession: (attemptId: string) =>
        api.post('/proctoring/start', { attemptId }),

    logEvent: (sessionId: string, eventType: string, description: string, screenshotBase64: string | null, riskLevel: string) =>
        api.post('/proctoring/log', { sessionId, eventType, description, screenshotBase64, riskLevel }),

    endSession: (sessionId: string) => {
        return api.post('/proctoring/end', { sessionId });
    },

    getReport: (candidateId: string) =>
        api.get(`/proctoring/report/${candidateId}`),
};

export default api;