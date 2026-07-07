import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import {
  LayoutDashboard, Globe, Ticket, CheckCircle2,
  Clock, MessageSquare,
} from 'lucide-react';
import api from '../api/axios';

const STATUS_COLORS = {
  OPEN: '#ef4444',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
};

const STATUS_LABELS = {
  OPEN: 'Abiertos',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resueltos',
  CLOSED: 'Cerrados',
};

const PRIORITY_COLORS = {
  LOW: '#94a3b8',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  URGENT: '#7c3aed',
};

const PRIORITY_LABELS = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#f97316'];

export default function Home() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, projectsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/projects'),
        ]);
        setStats(statsRes.data);
        setProjects(projectsRes.data);
      } catch (err) {
        console.error('Error cargando dashboard', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="home-page loading">
        <p>Cargando información del panel...</p>
      </div>
    );
  }

  const { summary, statusChart, priorityChart, projectChart, trendData, assigneeData, recentTickets } = stats || {};

  const totalTickets = (statusChart || []).reduce((acc, curr) => acc + curr.value, 0);
  const isAllEmpty = totalTickets === 0;

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>Visión General</h1>
        <p>Resumen del estado de todos los proyectos y tickets.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <LayoutDashboard size={24} />
          </div>
          <div className="stat-content">
            <h3>Proyectos Activos</h3>
            <p className="stat-number">{summary?.projects || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#6366f1', backgroundColor: '#e0e7ff' }}>
            <Globe size={24} />
          </div>
          <div className="stat-content">
            <h3>Sitios Web</h3>
            <p className="stat-number">{summary?.sites || 0}</p>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon">
            <Ticket size={24} />
          </div>
          <div className="stat-content">
            <h3>Tickets Abiertos</h3>
            <p className="stat-number">{summary?.openTickets || 0}</p>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-content">
            <h3>Tickets Resueltos</h3>
            <p className="stat-number">{summary?.resolvedTickets || 0}</p>
          </div>
        </div>
        {summary?.orphanComments !== undefined && (
          <div className="stat-card">
            <div className="stat-icon" style={{ color: '#f59e0b', backgroundColor: '#fef3c7' }}>
              <MessageSquare size={24} />
            </div>
            <div className="stat-content">
              <h3>Feedback sin Revisar</h3>
              <p className="stat-number">{summary.orphanComments}</p>
            </div>
          </div>
        )}
        {summary?.avgResolutionHours != null && (
          <div className="stat-card">
            <div className="stat-icon" style={{ color: '#7c3aed', backgroundColor: '#f3e8ff' }}>
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3>Resolución Promedio</h3>
              <p className="stat-number">{summary.avgResolutionHours}h</p>
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Status + Priority + Trend */}
      <div className="dashboard-content">
        <div className="dashboard-section chart-section card">
          <h2>Estado de los Tickets</h2>
          <div className="chart-container">
            {!isAllEmpty ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, STATUS_LABELS[name]]} />
                  <Legend formatter={(value) => STATUS_LABELS[value]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>No hay tickets registrados aún.</p>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-section chart-section card">
          <h2>Tickets por Prioridad</h2>
          <div className="chart-container">
            {!isAllEmpty ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={priorityChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, PRIORITY_LABELS[name]]} />
                  <Legend formatter={(value) => PRIORITY_LABELS[value]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>No hay tickets registrados aún.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Trend + Project bars */}
      <div className="dashboard-content">
        <div className="dashboard-section chart-section card">
          <h2>Tendencia (Últimos 30 Días)</h2>
          <div className="chart-container">
            {trendData && trendData.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => {
                      const d = new Date(v + 'T00:00:00');
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                    interval={4}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString()}
                    formatter={(value) => [value, 'Tickets creados']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>No hay actividad en los últimos 30 días.</p>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-section chart-section card">
          <h2>Tickets por Proyecto</h2>
          <div className="chart-container">
            {projectChart && projectChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={projectChart}
                  layout="vertical"
                  margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip formatter={(value) => [value, 'Tickets']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {projectChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>No hay tickets en ningún proyecto.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Recent activity + Assignee workload */}
      <div className="dashboard-content">
        <div className="dashboard-section recent-activity card">
          <h2>Actividad Reciente</h2>
          {recentTickets && recentTickets.length > 0 ? (
            <ul className="recent-list">
              {recentTickets.map(ticket => (
                <li key={ticket.id} className="recent-item">
                  <div className="recent-header">
                    <span className="recent-title">{ticket.title}</span>
                    <span className={`status-badge status-${ticket.status.toLowerCase()}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </div>
                  <div className="recent-meta">
                    <small>
                      Proyecto: {ticket.comment?.site?.project?.name} | Sitio: {ticket.comment?.site?.name}
                    </small>
                    <small className="date">{new Date(ticket.createdAt).toLocaleDateString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No hay actividad reciente.</p>
          )}
        </div>

        <div className="dashboard-section card">
          <h2>Carga de Trabajo por Usuario</h2>
          {assigneeData && assigneeData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assigneeData.map((user, idx) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: idx % 2 === 0 ? '#f8fafc' : 'transparent',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: user.avatar ? `url(${user.avatar}) center/cover` : '#e0e7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4f46e5',
                      fontWeight: 600,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {!user.avatar && user.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{user.name}</div>
                    <div
                      style={{
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        marginTop: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min((user.openCount / Math.max(...assigneeData.map(a => a.openCount))) * 100, 100)}%`,
                          background: '#6366f1',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#6366f1', flexShrink: 0 }}>
                    {user.openCount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Sin tickets asignados.</p>
          )}
        </div>
      </div>

      {/* Projects list */}
      <div className="projects-list mt-4">
        <h2>Tus Proyectos</h2>
        {projects.length === 0 ? (
          <p>No hay proyectos aún.</p>
        ) : (
          <div className="grid">
            {projects.map(project => (
              <div key={project.id} className="card project-card">
                <div className="card-header" style={{ borderLeft: `4px solid ${project.color}` }}>
                  <h3>{project.name}</h3>
                  <span className="badge">{project.sites?.length || 0} sitios</span>
                </div>
                <div className="card-body">
                  <p>{project.description || 'Sin descripción'}</p>
                  <small>Cliente: {project.clientName || 'N/A'}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}