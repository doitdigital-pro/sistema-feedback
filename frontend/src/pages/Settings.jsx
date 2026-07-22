import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { Save, Mail, MessageSquare, Info, Eye, ShieldCheck, Key, Building, Sparkles } from 'lucide-react';

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    share_email_subject: '',
    share_email_body: '',
    share_whatsapp_template: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: 'false',
    smtp_from: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('organization'); // 'organization' | 'email' | 'whatsapp' | 'smtp' | 'security'
  const [showPassword, setShowPassword] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [plans, setPlans] = useState([]);

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [setupStep, setSetupStep] = useState('idle'); // idle | setup | verifying

  // Muestras para la previsualización interactiva
  const sampleData = {
    projectName: 'E-commerce Premium',
    siteName: 'Tienda Online - Home',
    reviewUrl: 'https://imgc-feedback.net/review/sample-token-xyz123'
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      const [resSettings, resUser] = await Promise.all([
        api.get('/settings'),
        api.get('/auth/me')
      ]);
      setSettings(resSettings.data);
      setTwoFactorEnabled(resUser.data.twoFactorEnabled);
      setUserRole(resUser.data.role);

      try {
        const [resOrg, resPlans] = await Promise.all([
          api.get('/organizations/my'),
          api.get('/organizations/plans')
        ]);
        setOrganization(resOrg.data);
        setPlans(resPlans.data);
      } catch (err) {
        // Ignorar si el usuario aún no tiene organización asignada
      }
    } catch (err) {
      console.error('Error fetching settings or user data', err);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate2FA = async () => {
    try {
      setSetupStep('setup');
      const res = await api.post('/auth/2fa/generate');
      setQrCodeUrl(res.data.qrCodeUrl);
    } catch (err) {
      toast.error('Error al generar el código 2FA');
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/2fa/verify-setup', { code: twoFactorCode });
      setTwoFactorEnabled(true);
      setSetupStep('idle');
      setQrCodeUrl('');
      setTwoFactorCode('');
      toast.success('Autenticación 2FA activada con éxito');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
    }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (!twoFactorCode) {
      toast.error('Ingresa tu código actual para desactivar el 2FA');
      return;
    }
    try {
      await api.post('/auth/2fa/disable', { code: twoFactorCode });
      setTwoFactorEnabled(false);
      setTwoFactorCode('');
      toast.success('Autenticación 2FA desactivada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/settings', settings);
      setSettings(res.data);
      toast.success('Ajustes guardados correctamente');
    } catch (err) {
      console.error('Error saving settings', err);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const replacePlaceholders = (text) => {
    if (!text) return '';
    return text
      .replace(/\{\{projectName\}\}/g, sampleData.projectName)
      .replace(/\{\{siteName\}\}/g, sampleData.siteName)
      .replace(/\{\{reviewUrl\}\}/g, sampleData.reviewUrl);
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner"></div>
        <p style={{ color: '#64748b' }}>Cargando ajustes del sistema...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', color: '#fff', border: 'none', padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>Ajustes del Sistema</h2>
        <p style={{ color: '#94a3b8', marginTop: '6px', marginBottom: 0, fontSize: '14px' }}>
          Personaliza correos, plantillas de WhatsApp, servidor SMTP y tu seguridad personal.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Formulario */}
        <div>
          <form onSubmit={handleSave} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '10px', flexWrap: 'wrap', gap: '5px' }}>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'organization' ? 'active' : ''}`}
                onClick={() => setActiveTab('organization')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'organization' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeTab === 'organization' ? '#4f46e5' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  outline: 'none'
                }}
              >
                <Building size={16} style={{ color: '#6366f1' }} /> Organización / Plan SaaS
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
                onClick={() => setActiveTab('email')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'email' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeTab === 'email' ? '#4f46e5' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  outline: 'none'
                }}
              >
                <Mail size={16} /> Compartir por Correo
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
                onClick={() => setActiveTab('whatsapp')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'whatsapp' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeTab === 'whatsapp' ? '#4f46e5' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  outline: 'none'
                }}
              >
                <MessageSquare size={16} /> Compartir por WhatsApp
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'smtp' ? 'active' : ''}`}
                onClick={() => setActiveTab('smtp')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'smtp' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeTab === 'smtp' ? '#4f46e5' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  outline: 'none'
                }}
              >
                <Mail size={16} style={{ color: '#0284c7' }} /> Servidor SMTP
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'security' ? '2px solid #4f46e5' : '2px solid transparent',
                  color: activeTab === 'security' ? '#4f46e5' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  outline: 'none'
                }}
              >
                <ShieldCheck size={16} style={{ color: '#10b981' }} /> Seguridad (2FA)
              </button>
            </div>

            {activeTab === 'organization' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={20} style={{ color: '#4f46e5' }} /> {organization?.name || 'Mi Organización SaaS'}
                    </h3>
                    <span style={{ padding: '4px 12px', background: '#e0e7ff', color: '#4338ca', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px' }}>
                      Plan Actual: {organization?.plan?.name || 'FREE'}
                    </span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    Identificador (Slug): <code>{organization?.slug || 'default-tenant'}</code>
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={18} style={{ color: '#eab308' }} /> Planes de Suscripción Disponibles
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {plans.map((p) => {
                      const isCurrent = organization?.planId === p.id || (p.name === 'FREE' && !organization?.planId);
                      return (
                        <div key={p.id} style={{
                          padding: '16px',
                          borderRadius: '10px',
                          border: isCurrent ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                          background: isCurrent ? '#f5f3ff' : '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          justify: 'space-between'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{p.name}</h5>
                              {isCurrent && <span style={{ fontSize: '11px', background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>Actual</span>}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#4f46e5', margin: '8px 0' }}>
                              ${p.priceMonthly} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>/mes</span>
                            </div>
                            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>{p.description}</p>
                            <ul style={{ paddingLeft: '18px', fontSize: '12px', color: '#334155', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <li>Hasta <strong>{p.maxProjects === 9999 ? 'Ilimitados' : p.maxProjects}</strong> proyectos</li>
                              <li>Hasta <strong>{p.maxSites === 9999 ? 'Ilimitados' : p.maxSites}</strong> sitios web</li>
                              <li>Hasta <strong>{p.maxMembers === 9999 ? 'Ilimitados' : p.maxMembers}</strong> miembros</li>
                              <li>Clasificación IA: <strong>{p.aiEnabled ? '✅ Incluida' : '❌ No'}</strong></li>
                            </ul>
                          </div>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.put('/organizations/my/plan', { planId: p.id });
                                  toast.success(`Plan cambiado a ${p.name} con éxito`);
                                  fetchSettings();
                                } catch (err) {
                                  toast.error(err.response?.data?.error || 'Error al cambiar plan');
                                }
                              }}
                              style={{
                                marginTop: '16px',
                                padding: '8px 12px',
                                background: '#4f46e5',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '12px'
                              }}
                            >
                              Seleccionar Plan
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#1e293b' }}>
                    <Key size={18} /> Autenticación de Dos Factores (2FA)
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
                    Protege tu cuenta con una capa adicional de seguridad. Cuando inicies sesión, deberás proporcionar un código generado por tu aplicación autenticadora.
                  </p>
                  
                  {twoFactorEnabled ? (
                    <div style={{ marginTop: '20px' }}>
                      <span style={{ display: 'inline-block', padding: '6px 12px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>
                        ✓ 2FA Activado
                      </span>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '13px', color: '#334155', marginBottom: '6px', fontWeight: 'bold' }}>Para desactivar, ingresa tu código actual:</label>
                          <input 
                            type="text" 
                            placeholder="Ej. 123456" 
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', letterSpacing: '2px' }}
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleDisable2FA}
                          style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Desactivar
                        </button>
                      </div>
                    </div>
                  ) : setupStep === 'idle' ? (
                    <button 
                      type="button" 
                      onClick={handleGenerate2FA}
                      style={{ marginTop: '10px', padding: '10px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Configurar 2FA
                    </button>
                  ) : (
                    <div style={{ marginTop: '16px', background: 'white', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <ol style={{ paddingLeft: '20px', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                        <li>Descarga Google Authenticator o Authy en tu celular.</li>
                        <li>Escanea este código QR:</li>
                      </ol>
                      {qrCodeUrl && (
                        <div style={{ textAlign: 'center', margin: '20px 0' }}>
                          <img src={qrCodeUrl} alt="QR Code" style={{ border: '4px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '13px', color: '#334155', marginBottom: '6px', fontWeight: 'bold' }}>3. Ingresa el código generado:</label>
                          <input 
                            type="text" 
                            placeholder="Ej. 123456" 
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', letterSpacing: '4px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleVerify2FA}
                          style={{ padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                        >
                          Verificar y Activar
                        </button>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => { setSetupStep('idle'); setQrCodeUrl(''); setTwoFactorCode(''); }}
                        style={{ marginTop: '16px', background: 'none', border: 'none', color: '#64748b', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
                
                {userRole === 'ADMIN' && (
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#1e293b' }}>
                      <ShieldCheck size={18} /> Forzar 2FA Global
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
                      Obliga a todos los miembros del equipo a configurar la Autenticación de Dos Factores antes de poder acceder al sistema.
                    </p>
                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.FORCE_2FA === 'true'}
                          onChange={(e) => setSettings({ ...settings, FORCE_2FA: e.target.checked ? 'true' : 'false' })}
                        />
                        <span className="slider round"></span>
                      </label>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: settings.FORCE_2FA === 'true' ? '#4f46e5' : '#64748b' }}>
                        {settings.FORCE_2FA === 'true' ? 'Activado (Requerido)' : 'Desactivado (Opcional)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'email' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                    Asunto del Correo
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.share_email_subject}
                    onChange={(e) => setSettings({ ...settings, share_email_subject: e.target.value })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="Asunto para el cliente..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                    Cuerpo del Correo
                  </label>
                  <textarea
                    rows="10"
                    required
                    value={settings.share_email_body}
                    onChange={(e) => setSettings({ ...settings, share_email_body: e.target.value })}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                    placeholder="Escribe el mensaje..."
                  />
                </div>
              </>
            )}

            {activeTab === 'whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  Mensaje de WhatsApp
                </label>
                <textarea
                  rows="10"
                  required
                  value={settings.share_whatsapp_template}
                  onChange={(e) => setSettings({ ...settings, share_whatsapp_template: e.target.value })}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                  placeholder="Escribe el mensaje de WhatsApp..."
                />
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Tip: Puedes usar asteriscos `*texto*` para resaltar en negrita dentro de WhatsApp.
                </span>
              </div>
            )}

            {activeTab === 'smtp' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                      Servidor SMTP (Host)
                    </label>
                    <input
                      type="text"
                      value={settings.smtp_host || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="ej. smtp.gmail.com o mail.servidor.com"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                      Puerto SMTP
                    </label>
                    <input
                      type="text"
                      value={settings.smtp_port || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="ej. 587 o 465"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                      Usuario / Correo
                    </label>
                    <input
                      type="email"
                      value={settings.smtp_user || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="ej. contacto@miempresa.com"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                      Contraseña
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={settings.smtp_pass || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                        placeholder="Contraseña SMTP"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                    Remitente Autorizado (From)
                  </label>
                  <input
                    type="text"
                    value={settings.smtp_from || ''}
                    onChange={(e) => setSettings({ ...settings, smtp_from: e.target.value })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="ej. IMGC Feedback <no-reply@imgc.com>"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                  <input
                    type="checkbox"
                    id="smtp_secure_check"
                    checked={settings.smtp_secure === 'true'}
                    onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked ? 'true' : 'false' })}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <label htmlFor="smtp_secure_check" style={{ fontSize: '14px', fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                    Usar conexión segura (SSL/TLS) - Requerido para puerto 465
                  </label>
                </div>
              </>
            )}

            {activeTab !== 'security' && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}
              >
                <Save size={16} /> {saving ? 'Guardando ajustes...' : 'Guardar Configuración'}
              </button>
            )}
          </form>
        </div>

        {/* Panel lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Variables disponibles */}
          <div className="card" style={{ padding: '20px', background: '#f8fafc' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', margin: '0 0 10px 0', fontSize: '16px' }}>
              <Info size={16} style={{ color: '#4f46e5' }} /> Variables Dinámicas
            </h4>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '12px', lineHeight: '1.4' }}>
              Usa estos marcadores en tus plantillas para que se reemplacen dinámicamente:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <code style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold' }}>{"{{projectName}}"}</code>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Nombre Proyecto</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <code style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold' }}>{"{{siteName}}"}</code>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Nombre Sitio Web</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <code style={{ fontSize: '11px', color: '#e11d48', fontWeight: 'bold' }}>{"{{reviewUrl}}"}</code>
                <span style={{ fontSize: '11px', color: '#64748b' }}>URL de Revisión</span>
              </div>
            </div>
          </div>

          {/* Previsualización en tiempo real */}
          <div className="card" style={{ padding: '20px', border: '1px dashed #cbd5e1' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', margin: '0 0 10px 0', fontSize: '16px' }}>
              <Eye size={16} style={{ color: '#059669' }} /> Previsualización
            </h4>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: 0, marginBottom: '16px', lineHeight: '1.4' }}>
              Mensaje formateado con datos de muestra:
            </p>

            {activeTab === 'email' ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <strong>Asunto:</strong> {replacePlaceholders(settings.share_email_subject) || '(Vacío)'}
                </div>
                <div style={{
                  padding: '12px',
                  background: '#fff',
                  fontSize: '12px',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  fontFamily: 'sans-serif',
                  lineHeight: '1.5'
                }}>
                  {replacePlaceholders(settings.share_email_body) || '(Vacío)'}
                </div>
              </div>
            ) : activeTab === 'whatsapp' ? (
              <div style={{
                background: '#d9fdd3',
                border: '1px solid #a3e635',
                borderRadius: '12px 12px 0 12px',
                padding: '12px',
                fontSize: '12px',
                color: '#111b21',
                whiteSpace: 'pre-wrap',
                fontFamily: 'sans-serif',
                position: 'relative',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                lineHeight: '1.5'
              }}>
                {replacePlaceholders(settings.share_whatsapp_template) || '(Vacío)'}
              </div>
            ) : (
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #0284c7',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '12px',
                color: '#0369a1',
                lineHeight: '1.5'
              }}>
                <strong style={{ color: '#0284c7' }}>Estado SMTP:</strong> {settings.smtp_host ? 'Configurado' : 'Sin configurar (usando .env)'}<br/><br/>
                <strong>Host:</strong> {settings.smtp_host || 'N/A'}<br/>
                <strong>Puerto:</strong> {settings.smtp_port || 'N/A'}<br/>
                <strong>Usuario:</strong> {settings.smtp_user || 'N/A'}<br/>
                <strong>Remitente:</strong> {settings.smtp_from || 'N/A'}<br/>
                <strong>Seguro:</strong> {settings.smtp_secure === 'true' ? 'Sí (SSL/TLS)' : 'No (STARTTLS)'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
