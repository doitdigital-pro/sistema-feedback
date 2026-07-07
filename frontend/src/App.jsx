import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DashboardLayout from './components/DashboardLayout';
import Home from './pages/Home';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Users from './pages/Users';
import Settings from './pages/Settings';
import ReviewPage from './pages/ReviewPage';
import DemosAdmin from './pages/DemosAdmin';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Review Page — pública, sin login, auth por token */}
        <Route path="/review/:token" element={<ReviewPage />} />
        
        {/* Rutas protegidas del Dashboard */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin/demos" element={<DemosAdmin />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
