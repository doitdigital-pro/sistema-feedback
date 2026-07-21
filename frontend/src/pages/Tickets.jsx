import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Table as TableIcon, LayoutGrid, Trash2, ExternalLink } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import { useToast } from '../components/Toast';

const STATUS_COLUMNS = [
  { id: 'OPEN', label: 'Abierto', color: '#ef4444' },
  { id: 'IN_PROGRESS', label: 'En Progreso', color: '#f59e0b' },
  { id: 'RESOLVED', label: 'Resuelto', color: '#10b981' },
  { id: 'CLOSED', label: 'Cerrado', color: '#6b7280' },
];

export default function Tickets() {
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'kanban'

  // Filtros
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar proyectos
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
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el ticket "${ticketTitle}"?`)) {
      return;
    }
    try {
      await api.delete(`/tickets/${ticketId}`);
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      toast.success('Ticket eliminado correctamente.');
    } catch (err) {
      console.error('Error al eliminar el ticket', err);
      toast.error('Hubo un error al intentar eliminar el ticket.');
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await api.put(`/tickets/${ticketId}`, { status: newStatus });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      toast.success('Estado actualizado correctamente.');
    } catch (err) {
      console.error('Error al actualizar estado', err);
      toast.error('Error al cambiar el estado del ticket.');
    }
  };

  // Exportar a CSV
  const exportToCSV = () => {
    if (tickets.length === 0) return toast.error('No hay datos para exportar.');
    
    const headers = ['ID', 'Titulo', 'Estado', 'Prioridad', 'Categoria', 'Proyecto', 'Pagina', 'Fecha'];
    const rows = tickets.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority || 'MEDIUM',
      t.category || 'OTHER',
      `"${(t.comment?.site?.project?.name || '').replace(/"/g, '""')}"`,
      `"${(t.comment?.pageUrl || '').replace(/"/g, '""')}"`,
      new Date(t.createdAt).toLocaleDateString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `feedback_tickets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte CSV descargado con éxito.');
  };

  // Exportar a PDF
  const exportToPDF = () => {
    if (tickets.length === 0) return toast.error('No hay datos para exportar.');

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reporte de Feedback & Tickets — IMGC Feedback', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

    const tableData = tickets.map(t => [
      t.title,
      t.status,
      t.priority || 'MEDIUM',
      t.category || 'OTHER',
      t.comment?.site?.project?.name || 'N/A',
      new Date(t.createdAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: 34,
      head: [['Título', 'Estado', 'Prioridad', 'Categoría', 'Proyecto', 'Fecha']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`reporte_tickets_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Reporte PDF generado con éxito.');
  };

  return (
    <div className="tickets-page">
      <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Feedback & Tickets</h2>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Toggle View */}
          <div style={{ background: '#e2e8f0', borderRadius: '8px', padding: '2px', display: 'flex' }}>
            <button 
              onClick={() => setViewMode('table')}
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : ''}`}
              style={{ background: viewMode === 'table' ? '#4f46e5' : 'transparent', color: viewMode === 'table' ? 'white' : '#64748b', border: 'none' }}
            >
              <TableIcon size={14} /> Tabla
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : ''}`}
              style={{ background: viewMode === 'kanban' ? '#4f46e5' : 'transparent', color: viewMode === 'kanban' ? 'white' : '#64748b', border: 'none' }}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
          </div>

          {/* Export Buttons */}
          <button onClick={exportToCSV} className="btn btn-secondary btn-sm" title="Exportar CSV">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportToPDF} className="btn btn-secondary btn-sm" title="Exportar PDF">
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="filters-bar card mb-4 mt-4" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Estado</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '140px' }}
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
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '140px' }}
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
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '140px' }}
          >
            <option value="">Todos los proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Buscar</label>
          <input 
            type="text" 
            placeholder="Buscar por asunto, comentario o proyecto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <p>Cargando tickets...</p>
      ) : viewMode === 'table' ? (
        /* VISTA TABLA */
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
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      <option value="OPEN">🔴 Abierto</option>
                      <option value="IN_PROGRESS">🟠 En progreso</option>
                      <option value="RESOLVED">🟢 Resuelto</option>
                      <option value="CLOSED">⚪ Cerrado</option>
                    </select>
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
                    {ticket.tags && ticket.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {ticket.tags.map(t => (
                          <span key={t.tagId} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: `${t.tag?.color || '#6366f1'}20`, color: t.tag?.color || '#6366f1', border: `1px solid ${t.tag?.color || '#6366f1'}40`, fontWeight: 600 }}>
                            🏷️ {t.tag?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <a href={ticket.comment?.pageUrl} target="_blank" rel="noreferrer" className="text-link">
                      {ticket.comment?.pageTitle || 'URL'} <ExternalLink size={12} />
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
                        <Trash2 size={14} />
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
      ) : (
        /* VISTA KANBAN */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '20px' }}>
          {STATUS_COLUMNS.map(col => {
            const colTickets = tickets.filter(t => t.status === col.id);
            return (
              <div key={col.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: `3px solid ${col.color}` }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>{col.label}</h3>
                  <span style={{ background: '#e2e8f0', borderRadius: '12px', padding: '2px 8px', fontSize: '12px', fontWeight: 'bold' }}>
                    {colTickets.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {colTickets.map(ticket => (
                    <div key={ticket.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className={`badge priority-${(ticket.priority || 'MEDIUM').toLowerCase()}`} style={{ fontSize: '10px' }}>
                          {ticket.priority || 'MEDIUM'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#1e293b' }}>
                        {ticket.title}
                      </h4>

                      {ticket.tags && ticket.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {ticket.tags.map(t => (
                            <span key={t.tagId} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: `${t.tag?.color || '#6366f1'}20`, color: t.tag?.color || '#6366f1', border: `1px solid ${t.tag?.color || '#6366f1'}40`, fontWeight: 600 }}>
                              🏷️ {t.tag?.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                        {ticket.comment?.site?.project?.name}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        >
                          <option value="OPEN">Abierto</option>
                          <option value="IN_PROGRESS">En progreso</option>
                          <option value="RESOLVED">Resuelto</option>
                          <option value="CLOSED">Cerrado</option>
                        </select>

                        <Link to={`/tickets/${ticket.id}`} style={{ fontSize: '12px', fontWeight: '600', color: '#4f46e5', textDecoration: 'none' }}>
                          Ver →
                        </Link>
                      </div>
                    </div>
                  ))}

                  {colTickets.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px 0' }}>
                      Sin tickets
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

