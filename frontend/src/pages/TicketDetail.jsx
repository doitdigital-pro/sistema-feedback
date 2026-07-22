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
  const [users, setUsers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTicketDetail();
    fetchUsers();
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Error cargando usuarios', err);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await api.get('/tags');
      setAvailableTags(res.data);
    } catch (err) {
      console.error('Error cargando etiquetas', err);
    }
  };

  const fetchTicketDetail = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      const t = res.data;
      setTicket(t);
      setStatus(t.status);
      setPriority(t.priority);
      setAssigneeId(t.assigneeId || '');
      setCategory(t.category || 'OTHER');
      setNotes(t.notes || '');
    } catch (err) {
      console.error('Error cargando ticket', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await api.put(`/tickets/${id}`, {
        status,
        priority,
        category,
        assigneeId: assigneeId || null,
        notes,
      });
      setTicket(res.data);
      toast.success('Ticket actualizado correctamente');
    } catch (err) {
      console.error('Error actualizando ticket', err);
      toast.error('Hubo un error al actualizar el ticket.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await api.post(`/tickets/${id}/messages`, {
        content: chatMessage
      });
      setTicket(prev => ({
        ...prev,
        messages: [...(prev.messages || []), res.data]
      }));
      setChatMessage('');
    } catch (err) {
      console.error('Error enviando mensaje', err);
      toast.error('Hubo un error al enviar el mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToggleTag = async (tagId) => {
    try {
      const isAssigned = ticket.tags && ticket.tags.some(t => t.id === tagId);
      if (isAssigned) {
        await api.delete(`/tickets/${id}/tags/${tagId}`);
        setTicket(prev => ({
          ...prev,
          tags: prev.tags.filter(t => t.id !== tagId)
        }));
      } else {
        await api.post(`/tickets/${id}/tags`, { tagId });
        const addedTag = availableTags.find(t => t.id === tagId);
        setTicket(prev => ({
          ...prev,
          tags: [...(prev.tags || []), addedTag]
        }));
      }
    } catch (err) {
      console.error('Error modificando etiqueta', err);
      toast.error('Error al actualizar las etiquetas del ticket');
    }
  };

  if (loading) return <p className="mt-4">Cargando detalle del ticket...</p>;
  if (!ticket) return <p className="mt-4">Ticket no encontrado.</p>;

  const c = ticket.comment || {};
  const s = c.site || {};
  const p = s.project || {};

  return (
    <div className="ticket-detail-page">
      <div className="header-actions">
        <button onClick={() => navigate(-1)} className="btn btn-cancel">
          <ArrowLeft size={16} /> Volver
        </button>
        <h2>Detalle del Ticket #{ticket.id.slice(0, 8)}</h2>
      </div>

      <div className="detail-grid mt-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Columna Izquierda: Información de la captura y el comentario */}
        <div className="left-column">
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Comentario del Cliente</h3>
              <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                {p.name} / {s.name}
              </span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '16px', fontWeight: 500, color: '#1e293b', marginBottom: '16px' }}>
                "{c.content}"
              </p>
              
              <div className="meta-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                <div><strong>Cliente:</strong> {c.guestName || 'Anónimo'}</div>
                <div><strong>Fecha:</strong> {new Date(c.createdAt).toLocaleString()}</div>
                <div><strong>Página:</strong> <a href={c.pageUrl} target="_blank" rel="noreferrer" className="text-link">{c.pageUrl}</a></div>
                <div><strong>Dispositivo:</strong> {c.viewportWidth && c.viewportWidth < 768 ? '📱 Móvil' : '🖥️ Escritorio'} ({c.viewportWidth || '?'}x{c.viewportHeight || '?'})</div>
                <div><strong>Navegador / S.O:</strong> {c.browserName || 'N/A'} {c.browserVersion || ''} ({c.osName || 'N/A'})</div>
                <div><strong>Pantalla:</strong> {c.screenWidth || '?'}x{c.screenHeight || '?'}</div>
              </div>
            </div>
          </div>

          {/* Captura de Pantalla con Pin */}
          <div className="card mt-4">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Captura de Pantalla del Contexto</h3>
            </div>
            <div className="card-body img-wrapper">
              {c.screenshotUrl ? (
                <div className="relative-img-box">
                  <img 
                    src={c.screenshotUrl.startsWith('http') || c.screenshotUrl.startsWith('data:') ? c.screenshotUrl : `${import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '')}${c.screenshotUrl}`} 
                    alt="Captura del feedback" 
                    className="screenshot-img" 
                  />
                  <div 
                    className="pin-marker-fixed" 
                    style={{ left: `${c.xPercent}%`, top: `${c.yPercent}%` }}
                  >
                    📍
                  </div>
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
                  Sin captura de pantalla disponible.
                </p>
              )}
            </div>
          </div>

          {/* Chat / Historial de Mensajes entre Administrador y Cliente */}
          <div className="card mt-4">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Conversación con el Cliente</h3>
            </div>
            <div className="card-body">
              <div className="chat-messages-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', marginBottom: '16px', paddingRight: '8px' }}>
                {(!ticket.messages || ticket.messages.length === 0) && (
                  <p style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', margin: '1rem 0' }}>
                    No hay mensajes en esta conversación aún. Envía una respuesta para notificar al cliente.
                  </p>
                )}
                {ticket.messages && ticket.messages.map(m => (
                  <div 
                    key={m.id}
                    style={{
                      alignSelf: m.author ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: m.author ? '#4f46e5' : '#f1f5f9',
                      color: m.author ? '#ffffff' : '#1e293b',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      borderBottomRightRadius: m.author ? '2px' : '12px',
                      borderBottomLeftRadius: m.author ? '12px' : '2px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', opacity: 0.8 }}>
                      {m.author ? `🛠️ ${m.author.name} (Equipo)` : `👤 ${m.guestName || 'Cliente'}`}
                    </div>
                    <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'right', opacity: 0.7 }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={chatMessage} 
                  onChange={e => setChatMessage(e.target.value)}
                  placeholder="Escribe una respuesta para el cliente..."
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <button type="submit" className="btn btn-primary" disabled={sendingMessage}>
                  {sendingMessage ? 'Enviando...' : 'Enviar Respuesta'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Gestión de Estado, Prioridad y Asignación */}
        <div className="right-column">
          <div className="card">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Gestión del Ticket</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Estado */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Estado</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px' }}
                  >
                    <option value="OPEN">🔴 Abierto (Pendiente)</option>
                    <option value="IN_PROGRESS">🟡 En Progreso</option>
                    <option value="RESOLVED">🟢 Resuelto</option>
                    <option value="CLOSED">⚫ Cerrado</option>
                  </select>
                </div>

                {/* Prioridad */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Prioridad</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px' }}
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">🔥 Urgente</option>
                  </select>
                </div>

                {/* Categoría */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Categoría (IA)</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px' }}
                  >
                    <option value="BUG">🐛 Bug / Error Visual</option>
                    <option value="DESIGN">🎨 Cambio de Diseño / Estilo</option>
                    <option value="CONTENT">📝 Texto / Contenido</option>
                    <option value="PERFORMANCE">⚡ Rendimiento / Carga</option>
                    <option value="FEATURE_REQUEST">💡 Nueva Funcionalidad</option>
                    <option value="OTHER">📁 Otro</option>
                  </select>
                </div>

                {/* Asignado a */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Asignado a</label>
                  <select 
                    value={assigneeId} 
                    onChange={e => setAssigneeId(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px' }}
                  >
                    <option value="">-- Sin Asignar --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                {/* Notas Internas */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Notas Internas del Equipo</label>
                  <textarea 
                    rows="4" 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Escribe notas privadas para tu equipo..."
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px', resize: 'vertical' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </form>
            </div>
          </div>

          {/* Gestión de Etiquetas / Tags */}
          <div className="card mt-4">
            <div className="card-header">
              <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={16} /> Etiquetas del Ticket
              </h3>
            </div>
            <div className="card-body">
              {availableTags.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No hay etiquetas creadas. Puedes agregarlas desde la pestaña Ajustes.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {availableTags.map(tag => {
                    const isSelected = ticket.tags && ticket.tags.some(t => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag.id)}
                        style={{
                          background: isSelected ? tag.color : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#334155',
                          border: isSelected ? `1px solid ${tag.color}` : '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Archivos Adjuntos del Comentario */}
          {c.attachments && c.attachments.length > 0 && (
            <div className="card mt-4">
              <div className="card-header">
                <h3 style={{ margin: 0 }}>Archivos Adjuntos ({c.attachments.length})</h3>
              </div>
              <div className="card-body">
                <ul className="attachments-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {c.attachments.map(att => (
                    <li key={att.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Paperclip size={16} className="meta-icon" />
                      <a 
                        href={att.path.startsWith('http') ? att.path : `${import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/uploads/attachments/${att.path}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {att.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
