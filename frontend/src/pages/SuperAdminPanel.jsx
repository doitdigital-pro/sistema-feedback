import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import {
  Shield, Users, Building2, Package, Plus, Edit2, UserCheck,
  UserX, RefreshCw, ChevronDown, Check, X, AlertTriangle, Crown,
  Zap, Star
} from 'lucide-react';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'ORG_OWNER', label: 'Org Owner', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'ORG_ADMIN', label: 'Org Admin', color: '#0369a1', bg: '#e0f2fe' },
  { value: 'ADMIN', label: 'Admin', color: '#b45309', bg: '#fef3c7' },
  { value: 'MEMBER', label: 'Member', color: '#16a34a', bg: '#dcfce7' },
  { value: 'CLIENT_VIEWER', label: 'Client Viewer', color: '#64748b', bg: '#f1f5f9' },
];

function RoleBadge({ role }) {
  const r = ROLES.find(x => x.value === role) || { label: role, color: '#64748b', bg: '#f1f5f9' };
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
      background: r.bg, color: r.color, letterSpacing: '0.02em'
    }}>
      {r.label}
    </span>
  );
}

function PlanIcon({ name }) {
  if (name === 'FREE') return <Package size={14} style={{ color: '#64748b' }} />;
  if (name === 'PRO') return <Zap size={14} style={{ color: '#1d4ed8' }} />;
  if (name === 'ENTERPRISE') return <Star size={14} style={{ color: '#7c3aed' }} />;
  return <Package size={14} />;
}

// ============================================================
// TAB: USERS
// ============================================================
function TabUsers({ orgs }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER', organizationId: '' });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'MEMBER', organizationId: '' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, organizationId: u.organizationId || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        organizationId: form.organizationId || null,
      };
      if (form.password) payload.password = form.password;

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success('Usuario actualizado');
      } else {
        if (!form.password) { toast.error('La contraseña es requerida'); setSaving(false); return; }
        await api.post('/users', { ...payload, password: form.password });
        toast.success('Usuario creado');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u) => {
    const action = u.isActive ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que quieres ${action} a ${u.name}?`)) return;
    try {
      if (u.isActive) {
        await api.delete(`/users/${u.id}`);
      } else {
        await api.put(`/users/${u.id}`, { isActive: true });
      }
      fetchUsers();
      toast.success(`Usuario ${action === 'desactivar' ? 'desactivado' : 'reactivado'}`);
    } catch {
      toast.error(`Error al ${action} usuario`);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar usuarios..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '220px', flex: 1 }}
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={fetchUsers} className="btn btn-cancel" style={{ padding: '8px 12px' }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={openNew} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#7c3aed' }}>
            <Plus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando usuarios...</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Usuario', 'Email', 'Rol', 'Organización', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>
                    {u.organizationId ? (orgs.find(o => o.id === u.organizationId)?.name || u.organizationId.slice(0, 8) + '…') : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: u.isActive ? '#16a34a' : '#dc2626' }}>
                      {u.isActive ? <><Check size={12} /> Activo</> : <><X size={12} /> Inactivo</>}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(u)} title="Editar" style={{ padding: '6px', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleToggleActive(u)} title={u.isActive ? 'Desactivar' : 'Reactivar'} style={{ padding: '6px', background: u.isActive ? '#fee2e2' : '#dcfce7', color: u.isActive ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No se encontraron usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear / editar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '480px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editingUser ? `Editar: ${editingUser.name}` : 'Nuevo Usuario'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Nombre completo *</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                    Contraseña {editingUser && <span style={{ fontWeight: 400, color: '#94a3b8' }}>(dejar vacío para no cambiar)</span>}
                  </label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editingUser}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Rol</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#fff' }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Organización</label>
                  <select value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#fff' }}>
                    <option value="">— Sin organización (Super Admin global) —</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-cancel">Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#7c3aed' }}>
                    {saving ? 'Guardando…' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: ORGANIZATIONS
// ============================================================
function TabOrganizations({ plans, onOrgsChange }) {
  const toast = useToast();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', planId: '', maxProjects: '', maxSites: '', maxUsers: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/organizations/all');
      setOrgs(res.data);
      if (onOrgsChange) onOrgsChange(res.data);
    } catch (err) {
      toast.error('Error al cargar organizaciones');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingOrg(null);
    const defaultPlan = plans.find(p => p.name === 'FREE');
    setForm({ name: '', slug: '', planId: defaultPlan?.id || '', maxProjects: '', maxSites: '', maxUsers: '' });
    setShowModal(true);
  };

  const openEdit = (org) => {
    setEditingOrg(org);
    setForm({
      name: org.name,
      slug: org.slug,
      planId: org.planId || '',
      maxProjects: org.maxProjects != null ? String(org.maxProjects) : '',
      maxSites: org.maxSites != null ? String(org.maxSites) : '',
      maxUsers: org.maxUsers != null ? String(org.maxUsers) : '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        planId: form.planId || null,
        maxProjects: form.maxProjects !== '' ? parseInt(form.maxProjects) : null,
        maxSites: form.maxSites !== '' ? parseInt(form.maxSites) : null,
        maxUsers: form.maxUsers !== '' ? parseInt(form.maxUsers) : null,
      };

      if (editingOrg) {
        await api.put(`/organizations/${editingOrg.id}`, payload);
        toast.success('Organización actualizada');
      } else {
        payload.slug = form.slug;
        await api.post('/organizations/admin', payload);
        toast.success('Organización creada');
      }
      setShowModal(false);
      fetchOrgs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const getPlanName = (org) => {
    if (!org.planId) return '—';
    return plans.find(p => p.id === org.planId)?.name || org.planId;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          {orgs.length} organización{orgs.length !== 1 ? 'es' : ''} registrada{orgs.length !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchOrgs} className="btn btn-cancel" style={{ padding: '8px 12px' }}><RefreshCw size={15} /></button>
          <button onClick={openNew} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#7c3aed' }}>
            <Plus size={16} /> Nueva Organización
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando organizaciones...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {orgs.map(org => {
            const planName = getPlanName(org);
            const planColors = { FREE: '#64748b', PRO: '#1d4ed8', ENTERPRISE: '#7c3aed' };
            const planColor = planColors[planName] || '#64748b';
            return (
              <div key={org.id} className="card" style={{ padding: '20px', borderTop: `4px solid ${planColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={16} style={{ color: planColor }} />
                      {org.name}
                    </h4>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>/{org.slug}</span>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: planColor + '20', color: planColor, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <PlanIcon name={planName} /> {planName}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { label: 'Usuarios', value: org._count?.users ?? org.maxUsers ?? '∞' },
                    { label: 'Proyectos', value: org._count?.projects ?? '0' },
                    { label: 'Límite sitios', value: org.maxSites ?? '∞' },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{stat.value}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <button onClick={() => openEdit(org)} className="btn btn-cancel" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Edit2 size={13} /> Editar organización
                </button>
              </div>
            );
          })}
          {orgs.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <Building2 size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              <p>No hay organizaciones creadas.</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '500px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editingOrg ? `Editar: ${editingOrg.name}` : 'Nueva Organización'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Nombre de la organización *</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Empresa XYZ S.A.S."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
                {!editingOrg && (
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Slug (identificador único) *</label>
                    <input type="text" required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      placeholder="empresa-xyz"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'monospace' }} />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '4px' }}>Plan de suscripción</label>
                  <select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#fff' }}>
                    <option value="">— Sin plan asignado —</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.description || `$${p.priceMonthly}/mes`}</option>)}
                  </select>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Límites personalizados <span style={{ fontWeight: 400, color: '#94a3b8' }}>(dejar vacío para usar los del plan)</span>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {[
                      { key: 'maxProjects', label: 'Máx. proyectos' },
                      { key: 'maxSites', label: 'Máx. sitios' },
                      { key: 'maxUsers', label: 'Máx. usuarios' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>{f.label}</label>
                        <input type="number" min="0" value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                          placeholder="∞"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-cancel">Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#7c3aed' }}>
                    {saving ? 'Guardando…' : editingOrg ? 'Guardar Cambios' : 'Crear Organización'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: PLANS
// ============================================================
function TabPlans() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/organizations/plans');
      setPlans(res.data);
    } catch {
      toast.error('Error al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (plan) => {
    setEditingPlan(plan.id);
    setForm({
      description: plan.description || '',
      priceMonthly: plan.priceMonthly ?? 0,
      maxProjects: plan.maxProjects ?? '',
      maxSites: plan.maxSites ?? '',
      maxUsers: plan.maxUsers ?? '',
    });
  };

  const cancelEdit = () => { setEditingPlan(null); setForm({}); };

  const handleSavePlan = async (planId) => {
    setSaving(true);
    try {
      await api.put(`/organizations/plans/${planId}`, {
        description: form.description,
        priceMonthly: parseFloat(form.priceMonthly) || 0,
        maxProjects: form.maxProjects !== '' ? parseInt(form.maxProjects) : null,
        maxSites: form.maxSites !== '' ? parseInt(form.maxSites) : null,
        maxUsers: form.maxUsers !== '' ? parseInt(form.maxUsers) : null,
      });
      toast.success('Plan actualizado');
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar plan');
    } finally {
      setSaving(false);
    }
  };

  const planIcons = { FREE: { icon: Package, color: '#64748b', bg: '#f1f5f9' }, PRO: { icon: Zap, color: '#1d4ed8', bg: '#dbeafe' }, ENTERPRISE: { icon: Star, color: '#7c3aed', bg: '#ede9fe' } };

  if (loading) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando planes...</p>;

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
        Configura los límites y precios de cada plan. Los límites del plan aplican a todas las organizaciones que no tengan límites personalizados.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {plans.map(plan => {
          const meta = planIcons[plan.name] || planIcons.FREE;
          const IconComp = meta.icon;
          const isEditing = editingPlan === plan.id;

          return (
            <div key={plan.id} className="card" style={{ padding: '24px', borderTop: `4px solid ${meta.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconComp size={18} style={{ color: meta.color }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{plan.name}</h4>
                    {!isEditing && <span style={{ fontSize: '13px', color: '#64748b' }}>${plan.priceMonthly}/mes</span>}
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => startEdit(plan)} style={{ padding: '6px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                    <Edit2 size={12} /> Editar
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '3px' }}>Descripción</label>
                    <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '3px' }}>Precio mensual (USD)</label>
                    <input type="number" min="0" step="0.01" value={form.priceMonthly} onChange={e => setForm({ ...form, priceMonthly: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }} />
                  </div>
                  {[{ key: 'maxProjects', label: 'Máx. proyectos' }, { key: 'maxSites', label: 'Máx. sitios' }, { key: 'maxUsers', label: 'Máx. usuarios' }].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '3px' }}>{f.label} <span style={{ fontWeight: 400 }}>(vacío = ilimitado)</span></label>
                      <input type="number" min="0" value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder="∞"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button onClick={cancelEdit} className="btn btn-cancel" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                    <button onClick={() => handleSavePlan(plan.id)} className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center', background: meta.color }}>
                      {saving ? '…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {plan.description && <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{plan.description}</p>}
                  {[
                    ['Proyectos', plan.maxProjects],
                    ['Sitios web', plan.maxSites],
                    ['Usuarios', plan.maxUsers],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>{label}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: val != null ? '#1e293b' : '#94a3b8' }}>
                        {val != null ? val : '∞ Ilimitado'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN: SuperAdminPanel
// ============================================================
export default function SuperAdminPanel() {
  const [tab, setTab] = useState('users');
  const [plans, setPlans] = useState([]);
  const [orgs, setOrgs] = useState([]);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('imgc_user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    api.get('/organizations/plans').then(r => setPlans(r.data)).catch(() => {});
  }, []);

  if (user.role !== 'SUPER_ADMIN') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
        <AlertTriangle size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
        <h2>Acceso restringido</h2>
        <p>Este panel es exclusivo para el Super Administrador.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'orgs', label: 'Organizaciones', icon: Building2 },
    { id: 'plans', label: 'Planes', icon: Package },
  ];

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', borderRadius: '16px', padding: '28px 32px', marginBottom: '28px', color: '#fff', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <Shield size={28} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Panel de Super Administrador</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>
            Gestión global del SaaS — usuarios, organizaciones y planes de suscripción
          </p>
        </div>
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Crown size={14} /> {user.name}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
        {tabs.map(t => {
          const IconComp = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 600, transition: 'all 0.15s',
                background: tab === t.id ? '#fff' : 'transparent',
                color: tab === t.id ? '#7c3aed' : '#64748b',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <IconComp size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'users' && <TabUsers orgs={orgs} />}
      {tab === 'orgs' && <TabOrganizations plans={plans} onOrgsChange={setOrgs} />}
      {tab === 'plans' && <TabPlans />}
    </div>
  );
}
