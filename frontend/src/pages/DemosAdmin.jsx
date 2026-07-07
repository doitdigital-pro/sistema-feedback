import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { Check, X, Clock, Settings2 } from 'lucide-react';

export default function DemosAdmin() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demosEnabled, setDemosEnabled] = useState(false);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [demosRes, settingsRes] = await Promise.all([
        api.get('/demos'),
        api.get('/settings')
      ]);
      setRequests(demosRes.data);
      setDemosEnabled(settingsRes.data.DEMOS_ENABLED === 'true');
    } catch (err) {
      console.error('Error fetching data', err);
      toast.error('Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDemos = async () => {
    try {
      const newVal = !demosEnabled;
      await api.put('/settings', { DEMOS_ENABLED: newVal ? 'true' : 'false' });
      setDemosEnabled(newVal);
      toast.success(`Demos ${newVal ? 'habilitados' : 'deshabilitados'} correctamente.`);
    } catch (err) {
      console.error('Error toggling demos', err);
      toast.error('Error al actualizar configuración.');
    }
  };

  const handleApprove = async (id) => {
    setProcessing(id);
    try {
      await api.post(`/demos/${id}/approve`);
      toast.success('Solicitud aprobada y credenciales enviadas.');
      fetchData();
    } catch (err) {
      console.error('Error approving demo', err);
      toast.error(err.response?.data?.error || 'Error al aprobar solicitud.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('¿Seguro que deseas rechazar esta solicitud?')) return;
    setProcessing(id);
    try {
      await api.post(`/demos/${id}/reject`);
      toast.success('Solicitud rechazada.');
      fetchData();
    } catch (err) {
      console.error('Error rejecting demo', err);
      toast.error('Error al rechazar solicitud.');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Pendiente</span>;
      case 'APPROVED': return <span className="badge badge-success" style={{ background: '#d1fae5', color: '#047857', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Aprobado</span>;
      case 'REJECTED': return <span className="badge badge-danger" style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Rechazado</span>;
      case 'EXPIRED': return <span className="badge badge-secondary" style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Expirado</span>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', color: '#fff', border: 'none', padding: '24px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Gestión de Demos</h2>
          <p style={{ color: '#94a3b8', marginTop: '6px', marginBottom: 0, fontSize: '14px' }}>
            Aprueba o rechaza solicitudes de demo (Duración: 1 Hora).
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '8px' }}>
          <Settings2 size={20} style={{ color: '#cbd5e1' }} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>Permitir Demos:</span>
          <button 
            onClick={handleToggleDemos}
            style={{ 
              background: demosEnabled ? '#10b981' : '#64748b',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'background 0.3s'
            }}
          >
            {demosEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '16px', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>Usuario</th>
              <th style={{ padding: '16px', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>Fecha</th>
              <th style={{ padding: '16px', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '16px', color: '#475569', fontSize: '13px', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No hay solicitudes de demo registradas.
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{req.name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{req.email}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>IP: {req.ipAddress}</div>
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                    {new Date(req.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {getStatusBadge(req.status)}
                    {req.expiresAt && req.status === 'APPROVED' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#b91c1c', marginTop: '4px', fontWeight: 'bold' }}>
                        <Clock size={12} /> Expira: {new Date(req.expiresAt).toLocaleTimeString()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    {req.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleApprove(req.id)}
                          disabled={processing === req.id}
                          className="btn btn-sm" 
                          style={{ background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> Aprobar
                        </button>
                        <button 
                          onClick={() => handleReject(req.id)}
                          disabled={processing === req.id}
                          className="btn btn-sm" 
                          style={{ background: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={14} /> Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
