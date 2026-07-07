import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { PlusCircle, FolderGit2 } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Projects() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', clientName: '', clientEmail: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Error cargando proyectos', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setSubmitting(true);
    try {
      await api.post('/projects', formData);
      setFormData({ name: '', clientName: '', clientEmail: '' });
      setShowForm(false);
      fetchProjects();
    } catch (err) {
      console.error('Error creando proyecto', err);
      toast.error('Hubo un error al crear el proyecto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el proyecto "${name}"? Se eliminarán de forma permanente todos sus sitios web, comentarios y tickets asociados.`)) {
      return;
    }
    try {
      await api.delete(`/projects/${id}`);
      fetchProjects();
    } catch (err) {
      console.error('Error eliminando proyecto', err);
      toast.error('Hubo un error al intentar eliminar el proyecto.');
    }
  };

  return (
    <div className="projects-page">
      <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><FolderGit2 size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }}/> Gestión de Proyectos</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <PlusCircle size={16} /> {showForm ? 'Cancelar' : 'Nuevo Proyecto'}
        </button>
      </div>

      {showForm && (
        <div className="card mt-4 mb-4" style={{ padding: '20px' }}>
          <h3>Crear Nuevo Proyecto</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Nombre del Proyecto *</label>
              <input 
                type="text" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Ej: Campaña Coca-Cola"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Nombre del Cliente</label>
              <input 
                type="text" 
                value={formData.clientName} 
                onChange={e => setFormData({...formData, clientName: e.target.value})} 
                placeholder="Ej: Agencia XYZ"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Correo del Cliente</label>
              <input 
                type="email" 
                value={formData.clientEmail} 
                onChange={e => setFormData({...formData, clientEmail: e.target.value})} 
                placeholder="Ej: cliente@agencia.com"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando...' : 'Guardar Proyecto'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="mt-4">Cargando proyectos...</p>
      ) : (
        <div className="table-container mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cliente</th>
                <th>Sitios Web</th>
                <th>Fecha de Creación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.clientName || '-'}</td>
                  <td>
                    <span className="badge" style={{ background: '#e2e8f0', color: '#475569' }}>
                      {p._count?.sites || 0} sitios
                    </span>
                  </td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/projects/${p.id}`} className="btn btn-primary btn-sm">
                        Gestionar
                      </Link>
                      <button 
                        onClick={() => handleDeleteProject(p.id, p.name)} 
                        className="btn btn-danger btn-sm"
                        style={{ background: '#ef4444' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                    No hay proyectos registrados. Crea uno nuevo.
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
