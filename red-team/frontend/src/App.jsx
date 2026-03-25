import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import IDORPage from "./pages/IDORPage";
import JWTForgePage from "./pages/JWTForgePage";
import MassAssignPage from "./pages/MassAssignPage";
import AdminPanelPage from "./pages/AdminPanelPage";
import AttackLogPage from "./pages/AttackLogPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="idor" element={<IDORPage />} />
            <Route path="jwt-forge" element={<JWTForgePage />} />
            <Route path="mass-assign" element={<MassAssignPage />} />
            <Route path="admin" element={<AdminPanelPage />} />
            <Route path="attack-log" element={<AttackLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
