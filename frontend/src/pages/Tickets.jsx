import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../components/Toast';

export default function Tickets() {
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce para la búsqueda (espera 500ms antes de llamar a la API)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar proyectos para el dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        setProjects(res.data);
      } catch (err) {
        console.error('Error cargando proyectos', err);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        
        let url = '/tickets?';
        if (statusFilter) url += `status=${statusFilter}&`;
        if (projectFilter) url += `projectId=${projectFilter}&`;
        if (categoryFilter) url += `category=${categoryFilter}&`;
        if (debouncedSearch) url += `search=${encodeURIComponent(debouncedSearch)}&`;

        const res = await api.get(url);
        setTickets(res.data);
      } catch (err) {
        console.error('Error cargando tickets', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [statusFilter, projectFilter, categoryFilter, debouncedSearch]);

  const handleDeleteTicket = async (ticketId, ticketTitle) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el ticket "${ticketTitle}" y su feedback visual asociado? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await api.delete(`/tickets/${ticketId}`);
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    } catch (err) {
      console.error('Error al eliminar el ticket', err);
      toast.error('Hubo un error al intentar eliminar el ticket.');
    }
  };

  return (
    <div className="tickets-page">
      <div className="header-actions">
        <h2>Feedback & Tickets</h2>
      </div>

      <div className="filters-bar card mb-4 mt-4" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Estado</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '150px' }}
          >
            <option value="">Todos los estados</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="RESOLVED">Resuelto</option>
            <option value="CLOSED">Cerrado</option>
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Categoría</label>
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '150px' }}
          >
            <option value="">Todas las categorías</option>
            <option value="UI_DESIGN">UI / Diseño</option>
            <option value="BUG">Bug / Funcionalidad</option>
            <option value="CONTENT">Contenido</option>
            <option value="PERFORMANCE">Rendimiento</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Proyecto</label>
          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '150px' }}
          >
            <option value="">Todos los proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Buscar</label>
          <input 
            type="text" 
            placeholder="Buscar por asunto, contenido o proyecto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '400px' }}
          />
        </div>
      </div>

      {loading ? (
        <p>Cargando tickets...</p>
      ) : (
        <div className="table-container mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Categoría</th>
                <th>Proyecto</th>
                <th>Asunto</th>
                <th>Página</th>
                <th>Fecha</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id}>
                  <td>
                    <span className={`badge status-${ticket.status.toLowerCase()}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge priority-${(ticket.priority || 'MEDIUM').toLowerCase()}`}>
                      {ticket.priority || 'MEDIUM'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge category-${(ticket.category || 'OTHER').toLowerCase()}`}>
                      {ticket.category === 'UI_DESIGN' ? 'UI / Diseño' 
                       : ticket.category === 'BUG' ? 'Bug' 
                       : ticket.category === 'CONTENT' ? 'Contenido' 
                       : ticket.category === 'PERFORMANCE' ? 'Rendimiento' 
                       : 'Otro'}
                    </span>
                  </td>
                  <td>{ticket.comment?.site?.project?.name || 'N/A'}</td>
                  <td>
                    <strong>{ticket.title}</strong>
                  </td>
                  <td>
                    <a href={ticket.comment?.pageUrl} target="_blank" rel="noreferrer" className="text-link">
                      {ticket.comment?.pageTitle || 'URL'}
                    </a>
                  </td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/tickets/${ticket.id}`} className="btn btn-primary btn-sm">
                        Ver Detalle
                      </Link>
                      <button 
                        onClick={() => handleDeleteTicket(ticket.id, ticket.title)} 
                        className="btn btn-danger btn-sm"
                        style={{ background: '#ef4444' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    Aún no hay feedback registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
