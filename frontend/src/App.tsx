import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Questions from "./pages/Questions";
import Assessments from "./pages/Assessments";
import CreateAssessment from "./pages/CreateAssessment";
import AssessmentResults from "./pages/AssessmentResults";
import Candidates from "./pages/Candidates";
import Domains from "./pages/Domains";
import TestLanding from "./pages/TestLanding";
import TakeTest from "./pages/TakeTest";
import TestComplete from "./pages/TestComplete";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import ProctoringEvidence from "./pages/ProctoringEvidence";

import { PermissionProvider } from "@/auth/PermissionContext";
import MultiMonitorDetector from "@/components/proctoring/MultiMonitorDetector";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissionProvider>
        <TooltipProvider>
          <Toaster />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/verify" element={<VerifyEmail />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/questions" element={<Questions />} />
              <Route path="/dashboard/assessments" element={<Assessments />} />
              <Route path="/dashboard/assessments/new" element={<CreateAssessment />} />
              <Route path="/dashboard/assessments/:id/results" element={<AssessmentResults />} />
              <Route path="/dashboard/assessments/:id/results/:candidateId/proctoring" element={<ProctoringEvidence />} />
              <Route path="/dashboard/candidates" element={<Candidates />} />
              <Route path="/dashboard/domains" element={<Domains />} />
              <Route path="/dashboard/admin" element={<Admin />} />
              <Route path="/test/:token" element={<TestLanding />} />
              <Route path="/test/:token/take" element={<MultiMonitorDetector><TakeTest /></MultiMonitorDetector>} />
              <Route path="/test/:token/complete" element={<TestComplete />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PermissionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
