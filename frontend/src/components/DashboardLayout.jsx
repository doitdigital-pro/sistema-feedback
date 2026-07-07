import { Navigate, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, MessageSquare, FolderGit2, Users, Settings, MonitorPlay } from 'lucide-react';
import { useState } from 'react';

const routeTitles = {
  '/': 'Dashboard',
  '/projects': 'Proyectos',
  '/tickets': 'Feedback',
  '/users': 'Usuarios',
  '/settings': 'Ajustes',
  '/admin/demos': 'Demos',
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('imgc_token');
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('imgc_user') || '{}');
    } catch {
      return {};
    }
  })();

  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('imgc_token');
    localStorage.removeItem('imgc_user');
    navigate('/login');
  };

  // Determinar título dinámico
  const currentTitle = Object.entries(routeTitles).find(([path]) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  })?.[1] || 'Dashboard';

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>IMGC Feedback</h2>
        </div>
        
        <nav className="sidebar-nav">
          <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link to="/projects" className={`nav-item ${location.pathname.startsWith('/projects') ? 'active' : ''}`}>
            <FolderGit2 size={18} /> Proyectos
          </Link>
          <Link to="/tickets" className={`nav-item ${location.pathname.startsWith('/tickets') ? 'active' : ''}`}>
            <MessageSquare size={18} /> Feedback
          </Link>
          {user.role === 'ADMIN' && (
            <>
              <Link to="/users" className={`nav-item ${location.pathname.startsWith('/users') ? 'active' : ''}`}>
                <Users size={18} /> Usuarios
              </Link>
              <Link to="/settings" className={`nav-item ${location.pathname.startsWith('/settings') ? 'active' : ''}`}>
                <Settings size={18} /> Ajustes
              </Link>
              <Link to="/admin/demos" className={`nav-item ${location.pathname.startsWith('/admin/demos') ? 'active' : ''}`}>
                <MonitorPlay size={18} /> Demos
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user.name?.charAt(0) || 'U'}</div>
            <span>{user.name}</span>
          </div>
          <button onClick={() => setShowLogoutModal(true)} className="btn-logout">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <h1>{currentTitle}</h1>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Cerrar Sesión</h3>
            <p>¿Estás seguro de que quieres salir del sistema?</p>
            <div className="modal-actions">
              <button onClick={() => setShowLogoutModal(false)} className="btn btn-cancel">
                Cancelar
              </button>
              <button onClick={handleLogout} className="btn btn-danger">
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
