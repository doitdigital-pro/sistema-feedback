import { useState, useEffect } from 'react';
import api from '../api/axios';
import { UserPlus, UserCog, UserMinus, ShieldAlert } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'MEMBER', projectIds: [], allProjects: true });

  useEffect(() => {
    Promise.all([fetchUsers(), fetchProjects()]);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Acceso denegado. Se requieren privilegios de administrador.');
      } else {
        setError('Error al cargar la lista de usuarios.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects/list');
      setAllProjects(res.data);
    } catch (err) {
      console.error('Error loading projects list', err);
    }
  };

  const openNewUserModal = () => {
    setEditingUserId(null);
    setFormData({ name: '', email: '', password: '', role: 'MEMBER', projectIds: [], allProjects: true });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    const assignedProjects = user.projectPermissions?.map(p => p.projectId) || [];
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      projectIds: assignedProjects,
      allProjects: assignedProjects.length === 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        projectIds: formData.allProjects ? [] : formData.projectIds,
      };

      if (editingUserId) {
        if (payload.email !== users.find(u => u.id === editingUserId)?.email) {
          const emailExists = users.some(u => u.id !== editingUserId && u.email === payload.email);
          if (emailExists) {
            toast.error('El email ya está registrado por otro usuario.');
            return;
          }
        }
        if (!formData.password) delete payload.password;
        else payload.password = formData.password;

        await api.put(`/users/${editingUserId}`, payload);
      } else {
        payload.password = formData.password;
        await api.post('/users', payload);
      }

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar el usuario.');
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres desactivar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      toast.error('Error al desactivar el usuario.');
    }
  };

  const toggleProjectId = (projectId) => {
    setFormData(prev => ({
      ...prev,
      allProjects: false,
      projectIds: prev.projectIds.includes(projectId)
        ? prev.projectIds.filter(id => id !== projectId)
        : [...prev.projectIds, projectId]
    }));
  };

  const getProjectNames = (user) => {
    if (!user.projectPermissions || user.projectPermissions.length === 0) return 'Todos';
    return user.projectPermissions.map(p => p.project?.name || p.projectId).join(', ');
  };

  if (loading) return <p>Cargando usuarios...</p>;
  if (error) {
    return (
      <div className="error-box" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <ShieldAlert size={48} style={{ margin: '0 auto' }} />
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Gestión de Usuarios</h2>
        <button onClick={openNewUserModal} className="btn btn-primary">
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <th style={{ padding: '12px' }}>Nombre</th>
              <th style={{ padding: '12px' }}>Email</th>
              <th style={{ padding: '12px' }}>Rol</th>
              <th style={{ padding: '12px' }}>Proyectos</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    {user.name}
                  </div>
                </td>
                <td style={{ padding: '12px' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    background: user.role === 'ADMIN' ? '#fee2e2' : '#e0e7ff',
                    color: user.role === 'ADMIN' ? '#991b1b' : '#3730a3'
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getProjectNames(user)}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ color: user.isActive ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openEditModal(user)} className="btn" style={{ padding: '6px', background: 'transparent', color: '#4b5563' }}>
                      <UserCog size={18} />
                    </button>
                    {user.isActive && (
                      <button onClick={() => handleDeactivate(user.id)} className="btn" style={{ padding: '6px', background: 'transparent', color: '#dc2626' }}>
                        <UserMinus size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '500px', maxWidth: '95%', background: '#fff' }}>
            <div className="card-header">
              <h3>{editingUserId ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Nombre</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Contraseña {editingUserId && <span style={{ fontWeight: 400, color: '#94a3b8' }}>(dejar en blanco para no cambiar)</span>}
                  </label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingUserId} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Rol</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '14px' }}>
                    <option value="MEMBER">Member (Trabajador)</option>
                    <option value="VIEWER">Viewer (Solo Lectura)</option>
                    <option value="ADMIN">Admin (Administrador)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Acceso a Proyectos</label>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={formData.allProjects}
                        onChange={(e) => setFormData(prev => ({ ...prev, allProjects: e.target.checked, projectIds: e.target.checked ? [] : prev.projectIds }))}
                      />
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>Todos los proyectos</span>
                    </label>
                  </div>
                  {!formData.allProjects && (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}>
                      {allProjects.length === 0 && (
                        <p style={{ padding: '8px', color: '#94a3b8', fontSize: '13px' }}>No hay proyectos disponibles.</p>
                      )}
                      {allProjects.map(project => (
                        <label key={project.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', hover: { background: '#f8fafc' } }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={formData.projectIds.includes(project.id)}
                            onChange={() => toggleProjectId(project.id)}
                          />
                          {project.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-cancel">Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
