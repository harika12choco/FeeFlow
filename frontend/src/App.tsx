import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import { AccountsLayout } from "./components/AccountsLayout";
import { ParentLayout } from "./components/ParentLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/accounts/Dashboard";
import Students from "./pages/accounts/Students";
import StudentLedger from "./pages/accounts/StudentLedger";
import Reminders from "./pages/accounts/Reminders";
import Refunds from "./pages/accounts/Refunds";
import RiskReview from "./pages/accounts/RiskReview";
import Portal from "./pages/parent/Portal";
import Payment from "./pages/parent/Payment";
import Receipt from "./pages/Receipt";
import type { Role } from "./lib/types";
import type { ReactNode } from "react";

function Protected({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "accounts" ? "/" : "/portal"} replace />;
  }
  return <>{children}</>;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label="Loading FeeFlow…" />
    </div>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "accounts" ? "/" : "/portal"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Accounts executive */}
      <Route
        element={
          <Protected role="accounts">
            <AccountsLayout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:id" element={<StudentLedger />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/risk" element={<RiskReview />} />
      </Route>

      {/* Parent */}
      <Route
        element={
          <Protected role="parent">
            <ParentLayout />
          </Protected>
        }
      >
        <Route path="/portal" element={<Portal />} />
        <Route path="/pay/:instalmentId" element={<Payment />} />
      </Route>

      {/* Shared (either role, access enforced by backend) */}
      <Route
        path="/receipt/:paymentId"
        element={
          <Protected>
            <Receipt />
          </Protected>
        }
      />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
