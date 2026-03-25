import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import IDORDefensePage from "./pages/IDORDefensePage";
import JWTDefensePage from "./pages/JWTDefensePage";
import MassAssignDefensePage from "./pages/MassAssignDefensePage";
import AdminDefensePage from "./pages/AdminDefensePage";
import DefenseLogPage from "./pages/DefenseLogPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="idor-defense" element={<IDORDefensePage />} />
            <Route path="jwt-defense" element={<JWTDefensePage />} />
            <Route path="mass-assign-defense" element={<MassAssignDefensePage />} />
            <Route path="admin-defense" element={<AdminDefensePage />} />
            <Route path="defense-log" element={<DefenseLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
