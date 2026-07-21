import { useState, useEffect } from 'react';
import { Activity, Filter, User, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const ACTION_LABELS = {
  LOGIN: { label: 'Inicio de Sesión', emoji: '🔑', color: '#10b981' },
  LOGOUT: { label: 'Cierre de Sesión', emoji: '🚪', color: '#6b7280' },
  LOGIN_FAILED: { label: 'Login Fallido', emoji: '🚫', color: '#ef4444' },
  PASSWORD_RESET: { label: 'Contraseña Reseteada', emoji: '🔒', color: '#f59e0b' },
  TICKET_CREATED: { label: 'Ticket Creado', emoji: '🎫', color: '#6366f1' },
  TICKET_STATUS_CHANGED: { label: 'Estado Cambiado', emoji: '🔄', color: '#3b82f6' },
  TICKET_ASSIGNED: { label: 'Ticket Asignado', emoji: '👤', color: '#8b5cf6' },
  TICKET_PRIORITY_CHANGED: { label: 'Prioridad Cambiada', emoji: '⚡', color: '#f59e0b' },
  TICKET_DELETED: { label: 'Ticket Eliminado', emoji: '🗑️', color: '#ef4444' },
  TICKET_MESSAGE_ADDED: { label: 'Mensaje Agregado', emoji: '💬', color: '#06b6d4' },
  PROJECT_CREATED: { label: 'Proyecto Creado', emoji: '📁', color: '#10b981' },
  PROJECT_UPDATED: { label: 'Proyecto Actualizado', emoji: '✏️', color: '#3b82f6' },
  PROJECT_DELETED: { label: 'Proyecto Eliminado', emoji: '🗑️', color: '#ef4444' },
  SITE_CREATED: { label: 'Sitio Creado', emoji: '🌐', color: '#10b981' },
  SITE_DELETED: { label: 'Sitio Eliminado', emoji: '🗑️', color: '#ef4444' },
  USER_CREATED: { label: 'Usuario Creado', emoji: '👥', color: '#10b981' },
  USER_UPDATED: { label: 'Usuario Actualizado', emoji: '✏️', color: '#3b82f6' },
  USER_DELETED: { label: 'Usuario Eliminado', emoji: '🗑️', color: '#ef4444' },
  FEEDBACK_RECEIVED: { label: 'Feedback Recibido', emoji: '📩', color: '#6366f1' },
  SETTINGS_UPDATED: { label: 'Ajustes Actualizados', emoji: '⚙️', color: '#6b7280' },
};

function getActionInfo(action) {
  return ACTION_LABELS[action] || { label: action, emoji: '📌', color: '#6b7280' };
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Hace un momento';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [actions, setActions] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (filterAction) params.action = filterAction;

      const [logsRes, summaryRes] = await Promise.all([
        api.get('/activity', { params }),
        api.get('/activity/summary'),
      ]);

      setLogs(logsRes.data.logs);
      setTotalPages(logsRes.data.totalPages);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Error cargando actividad:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/activity/actions').then(res => setActions(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [page, filterAction]);

  return (
    <div className="activity-page">
      {/* Summary Cards */}
      {summary && (
        <div className="activity-summary">
          <div className="stat-card mini">
            <div className="stat-icon" style={{ background: '#6366f120', color: '#6366f1' }}>
              <Activity size={20} />
            </div>
            <div>
              <div className="stat-value">{summary.today}</div>
              <div className="stat-label">Hoy</div>
            </div>
          </div>
          <div className="stat-card mini">
            <div className="stat-icon" style={{ background: '#10b98120', color: '#10b981' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div className="stat-value">{summary.thisWeek}</div>
              <div className="stat-label">Esta Semana</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="activity-filters">
        <div className="filter-group">
          <Filter size={16} />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          >
            <option value="">Todas las acciones</option>
            {actions.map(action => {
              const info = getActionInfo(action);
              return (
                <option key={action} value={action}>
                  {info.emoji} {info.label}
                </option>
              );
            })}
          </select>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Timeline */}
      <div className="activity-timeline">
        {loading ? (
          <div className="loading-state">Cargando actividad...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Activity size={48} style={{ opacity: 0.3 }} />
            <p>No hay actividad registrada aún.</p>
          </div>
        ) : (
          logs.map((log) => {
            const info = getActionInfo(log.action);
            return (
              <div key={log.id} className="activity-item">
                <div className="activity-dot" style={{ background: info.color }}>
                  <span>{info.emoji}</span>
                </div>
                <div className="activity-content">
                  <div className="activity-header">
                    <strong>{info.label}</strong>
                    <span className="activity-time">{timeAgo(log.createdAt)}</span>
                  </div>
                  <div className="activity-meta">
                    {log.user && (
                      <span className="activity-user">
                        <User size={12} /> {log.user.name}
                      </span>
                    )}
                    {log.entity && log.entityId && (
                      <span className="activity-entity">
                        {log.entity}: {log.entityId.substring(0, 8)}...
                      </span>
                    )}
                    {log.ipAddress && (
                      <span className="activity-ip">IP: {log.ipAddress}</span>
                    )}
                  </div>
                  {log.details && (
                    <div className="activity-details">
                      {Object.entries(log.details).map(([key, value]) => (
                        <span key={key} className="detail-badge">
                          {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="activity-pagination">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="page-info">Página {page} de {totalPages}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
