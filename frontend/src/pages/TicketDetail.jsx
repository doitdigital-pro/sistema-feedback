import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Monitor, Layout, Globe, CheckCircle, Paperclip, User, RotateCcw, AlertTriangle, Tag } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function TicketDetail() {
  const toast = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messageContent, setMessageContent] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [users, setUsers] = useState([]);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await api.get(`/tickets/${id}`);
        setTicket(res.data);
      } catch (err) {
        if (err.response?.status === 403) {
          toast.error('No tienes acceso a este ticket.');
          navigate('/tickets');
        }
        console.error('Error cargando detalle del ticket', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await api.get('/tickets/users');
        setUsers(res.data);
      } catch (err) {
        console.error('Error cargando usuarios', err);
      }
    };

    fetchTicket();
    fetchUsers();
  }, [id]);

  const handleResolve = async () => {
    try {
      await api.put(`/tickets/${id}`, { status: 'RESOLVED' });
      setTicket({ ...ticket, status: 'RESOLVED' });
      toast.success('Ticket marcado como resuelto.');
    } catch (err) {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleReopen = async () => {
    try {
      await api.put(`/tickets/${id}`, { status: 'OPEN', resolvedAt: null });
      setTicket({ ...ticket, status: 'OPEN' });
      toast.success('Ticket reabierto.');
    } catch (err) {
      toast.error('Error al reabrir el ticket');
    }
  };

  const handleAssigneeChange = async (assigneeId) => {
    setSavingAssignee(true);
    try {
      const res = await api.put(`/tickets/${id}`, { assigneeId: assigneeId || null });
      setTicket({ ...ticket, assignee: res.data.assignee });
      toast.success(assigneeId ? 'Ticket asignado correctamente.' : 'Asignación removida.');
    } catch (err) {
      toast.error('Error al asignar el ticket');
    } finally {
      setSavingAssignee(false);
    }
  };

  const handlePriorityChange = async (priority) => {
    setSavingPriority(true);
    try {
      await api.put(`/tickets/${id}`, { priority });
      setTicket({ ...ticket, priority });
      toast.success(`Prioridad cambiada a ${priority}.`);
    } catch (err) {
      toast.error('Error al cambiar la prioridad');
    } finally {
      setSavingPriority(false);
    }
  };

  const handleCategoryChange = async (category) => {
    setSavingCategory(true);
    try {
      await api.put(`/tickets/${id}`, { category });
      setTicket({ ...ticket, category });
      toast.success(`Categoría cambiada a ${category}.`);
    } catch (err) {
      toast.error('Error al cambiar la categoría');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/tickets/${id}/messages`, { content: messageContent });
      setTicket({
        ...ticket,
        messages: [...(ticket.messages || []), res.data]
      });
      setMessageContent('');
    } catch (err) {
      toast.error('Error al enviar mensaje');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar permanentemente este ticket y su feedback visual asociado? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await api.delete(`/tickets/${id}`);
      toast.success('Ticket eliminado correctamente.');
      navigate('/tickets');
    } catch (err) {
      toast.error('Hubo un error al intentar eliminar el ticket.');
    }
  };

  if (loading) return <p>Cargando detalle...</p>;
  if (!ticket) return <p>Ticket no encontrado.</p>;

  const c = ticket.comment;
  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const statusColors = {
    OPEN: '#ef4444',
    IN_PROGRESS: '#f59e0b',
    RESOLVED: '#10b981',
    CLOSED: '#64748b',
  };

  return (
    <div className="ticket-detail-page">
      <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/tickets" className="btn btn-cancel">
          <ArrowLeft size={16} /> Volver a la lista
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Estado actual */}
          <span className={`badge status-${ticket.status.toLowerCase()}`} style={{ fontSize: '13px', padding: '6px 12px' }}>
            {ticket.status === 'OPEN' ? 'Abierto' : ticket.status === 'IN_PROGRESS' ? 'En Progreso' : ticket.status === 'RESOLVED' ? 'Resuelto' : 'Cerrado'}
          </span>

          {!isResolved && (
            <button onClick={handleResolve} className="btn btn-primary btn-sm">
              <CheckCircle size={16} /> Resolver
            </button>
          )}
          {isResolved && (
            <button onClick={handleReopen} className="btn btn-sm" style={{ background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={16} /> Reabrir
            </button>
          )}
          <button onClick={handleDeleteTicket} className="btn btn-danger btn-sm" style={{ background: '#ef4444' }}>
            Eliminar
          </button>
        </div>
      </div>

      <div className="ticket-grid mt-4">
        {/* Lado Izquierdo: Visualizador de Imagen */}
        <div className="screenshot-container card">
          <div className="card-header">
            <h3>Captura Visual</h3>
          </div>
          <div className="card-body img-wrapper">
            {c.screenshotUrl ? (
              <div className="relative-img-box">
                <img 
                  src={c.screenshotUrl.startsWith('http') || c.screenshotUrl.startsWith('data:') ? c.screenshotUrl : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}${c.screenshotUrl}`} 
                  alt="Captura del feedback" 
                  className="screenshot-img" 
                />
                <div 
                  className="pin-marker-fixed" 
                  style={{ left: `${c.xPercent}%`, top: `${c.yPercent}%` }}
                  title="Punto de feedback"
                ></div>
              </div>
            ) : (
              <div className="no-image">No se adjuntó captura de pantalla.</div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Info */}
        <div className="ticket-info">
          <div className="card mb-4">
            <div className="card-header">
              <h3>Comentario del Cliente</h3>
            </div>
            <div className="card-body">
              <p className="comment-text">"{c.content}"</p>
            </div>
          </div>

          {/* Asignación y Prioridad */}
          <div className="card mb-4">
            <div className="card-header">
              <h3>Gestión</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={18} className="meta-icon" />
                <div style={{ flex: 1 }}>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>Asignado a</small>
                  <select
                    value={ticket.assignee?.id || ''}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    disabled={savingAssignee}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  >
                    <option value="">Sin asignar</option>
                    {users.filter(u => u.isActive !== false).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={18} className="meta-icon" />
                <div style={{ flex: 1 }}>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>Prioridad</small>
                  <select
                    value={ticket.priority || 'MEDIUM'}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    disabled={savingPriority}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Tag size={18} className="meta-icon" />
                <div style={{ flex: 1 }}>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>Categoría</small>
                  <select
                    value={ticket.category || 'OTHER'}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    disabled={savingCategory}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  >
                    <option value="UI_DESIGN">UI / Diseño</option>
                    <option value="BUG">Bug / Funcionalidad</option>
                    <option value="CONTENT">Contenido</option>
                    <option value="PERFORMANCE">Rendimiento</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h3>Metadatos Técnicos</h3>
            </div>
            <div className="card-body metadata-list">
              <div className="meta-item">
                <Globe size={18} className="meta-icon" />
                <div>
                  <small>URL Reportada</small>
                  <p><a href={c.pageUrl} target="_blank" rel="noreferrer">{c.pageTitle || c.pageUrl}</a></p>
                </div>
              </div>
              <div className="meta-item">
                <Layout size={18} className="meta-icon" />
                <div>
                  <small>Resolución (Viewport)</small>
                  <p>{c.viewportWidth} x {c.viewportHeight} px</p>
                </div>
              </div>
              <div className="meta-item">
                <Monitor size={18} className="meta-icon" />
                <div>
                  <small>Navegador / OS</small>
                  <p>{c.browserName} ({c.browserVersion}) / {c.osName}</p>
                </div>
              </div>
            </div>
          </div>

          {c.attachments && c.attachments.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h3>Archivos Adjuntos</h3>
              </div>
              <div className="card-body">
                <ul className="attachments-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {c.attachments.map(att => (
                    <li key={att.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Paperclip size={16} className="meta-icon" />
                      <a 
                        href={att.path.startsWith('http') ? att.path : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/uploads/attachments/${att.path}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {att.filename}
                      </a>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                        ({(att.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3>Hilo de Respuestas (Interno)</h3>
            </div>
            <div className="card-body">
              <div className="messages-list" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
                {(!ticket.messages || ticket.messages.length === 0) ? (
                  <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', margin: '20px 0' }}>No hay mensajes internos.</p>
                ) : (
                  ticket.messages.map(msg => (
                    <div key={msg.id} style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '13px' }}>{msg.author?.name || 'Equipo'}</strong>
                        <small style={{ color: '#64748b', fontSize: '11px' }}>{new Date(msg.createdAt).toLocaleString()}</small>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px' }}>{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Escribe un mensaje interno..." 
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                />
                <button type="submit" className="btn btn-primary" disabled={sendingMsg || !messageContent.trim()}>
                  {sendingMsg ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
