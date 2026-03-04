import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import DashboardPage from "./dashboard-content";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function Home() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <DashboardPage />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
