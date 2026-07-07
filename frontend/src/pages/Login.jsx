import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { LogIn, Mail, Phone, User, MessageSquare, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState('login'); // 'login', 'demo-register', 'demo-verify'
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Demo State
  const [demoName, setDemoName] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [demoCodeDev, setDemoCodeDev] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demosEnabled, setDemosEnabled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/demos/status')
      .then(res => setDemosEnabled(res.data.enabled))
      .catch(err => console.error('Error fetching demo status', err));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });
      
      if (response.data.requires2FA) {
        setStep('2fa-verify');
        return;
      }

      if (response.data.requires2FASetup) {
        setTempToken(response.data.tempToken);
        setStep('2fa-force-setup');
        
        // Cargar el QR generado para forzar 2FA
        try {
          const resQr = await api.post('/auth/2fa/generate', {}, {
            headers: { Authorization: `Bearer ${response.data.tempToken}` }
          });
          setQrCodeUrl(resQr.data.qrCodeUrl);
        } catch (err) {
          setError('Error al generar código 2FA obligatorio. Contacte al administrador.');
        }
        return;
      }

      localStorage.setItem('imgc_token', response.data.token);
      localStorage.setItem('imgc_user', JSON.stringify(response.data.user));
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/2fa/verify', {
        email,
        code: twoFactorCode
      });
      
      localStorage.setItem('imgc_token', response.data.token);
      localStorage.setItem('imgc_user', JSON.stringify(response.data.user));
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Código 2FA incorrecto.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAForceVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/2fa/verify-setup', {
        code: twoFactorCode
      }, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      
      localStorage.setItem('imgc_token', response.data.token);
      localStorage.setItem('imgc_user', JSON.stringify(response.data.user));
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoRequest = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/demo-request', {
        name: demoName,
        phone: demoPhone,
        email: demoEmail,
        message: demoMessage
      });
      
      setDemoCodeDev(response.data.codeDev || '');
      setStep('demo-verify');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al solicitar la demo');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/demo-verify', {
        email: demoEmail,
        code: demoCode
      });
      
      localStorage.setItem('imgc_token', response.data.token);
      localStorage.setItem('imgc_user', JSON.stringify(response.data.user));
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {step === 'login' && (
          <>
            <div className="login-header">
              <h2>IMGC Feedback</h2>
              <p>Plataforma de revisión visual</p>
            </div>
            
            {error && <div className="alert error">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary full-width">
                {loading ? 'Iniciando...' : <><LogIn size={18} /> Iniciar Sesión</>}
              </button>
            </form>

            <Link to="/forgot-password" className="forgot-link">
              ¿Olvidaste tu contraseña?
            </Link>

            {demosEnabled && (
              <div style={{
                marginTop: '20px',
                padding: '12px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #e2e8f0',
                textAlign: 'center',
                fontSize: '13px',
                color: '#64748b'
              }}>
                <span>¿Quieres probar la versión demo? </span>
                <button 
                  type="button" 
                  onClick={() => {
                    setError('');
                    setStep('demo-register');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4f46e5',
                    fontWeight: '600',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Solicitar Acceso Demo
                </button>
              </div>
            )}
          </>
        )}

        {step === '2fa-verify' && (
          <>
            <div className="login-header">
              <h2>Autenticación de 2 Pasos</h2>
              <p>Ingresa el código de 6 dígitos de tu aplicación autenticadora (ej. Google Authenticator).</p>
            </div>

            {error && <div className="alert error">{error}</div>}

            <form onSubmit={handle2FAVerify}>
              <div className="form-group">
                <label><ShieldCheck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Código 2FA</label>
                <input 
                  type="text" 
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                  required 
                  autoFocus
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary full-width">
                {loading ? 'Verificando...' : 'Verificar y Acceder'}
              </button>
            </form>

            <button 
              type="button" 
              onClick={() => {
                setError('');
                setStep('login');
                setTwoFactorCode('');
              }}
              className="forgot-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', marginTop: '15px' }}
            >
              Volver al inicio de sesión
            </button>
          </>
        )}

        {step === '2fa-force-setup' && (
          <>
            <div className="login-header">
              <h2>Configuración Obligatoria de 2FA</h2>
              <p>El administrador requiere que habilites la Autenticación de Dos Factores antes de entrar.</p>
            </div>

            {error && <div className="alert error">{error}</div>}

            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '20px' }}>
              <ol style={{ paddingLeft: '20px', color: '#334155', fontSize: '13px', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                <li>Descarga Google Authenticator o Authy.</li>
                <li>Escanea este código QR:</li>
              </ol>
              {qrCodeUrl ? (
                <div style={{ textAlign: 'center', margin: '15px 0' }}>
                  <img src={qrCodeUrl} alt="QR Code" style={{ border: '3px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', maxWidth: '150px' }} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', margin: '15px 0', fontSize: '13px', color: '#94a3b8' }}>
                  Cargando QR...
                </div>
              )}
            </div>

            <form onSubmit={handle2FAForceVerify}>
              <div className="form-group">
                <label><ShieldCheck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 3. Ingresa el código generado:</label>
                <input 
                  type="text" 
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                  required 
                  autoFocus
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary full-width">
                {loading ? 'Verificando...' : 'Verificar y Acceder'}
              </button>
            </form>

            <button 
              type="button" 
              onClick={() => {
                setError('');
                setStep('login');
                setTwoFactorCode('');
                setTempToken('');
                setQrCodeUrl('');
              }}
              className="forgot-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', marginTop: '15px' }}
            >
              Volver y cancelar
            </button>
          </>
        )}

        {step === 'demo-register' && (
          <>
            <div className="login-header">
              <h2>Solicitud de Demo</h2>
              <p>Completa tus datos para recibir tu código de acceso</p>
            </div>

            {error && <div className="alert error">{error}</div>}

            <form onSubmit={handleDemoRequest}>
              <div className="form-group">
                <label><User size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Nombre Completo</label>
                <input 
                  type="text" 
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required 
                />
              </div>

              <div className="form-group">
                <label><Phone size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Teléfono</label>
                <input 
                  type="tel" 
                  value={demoPhone}
                  onChange={(e) => setDemoPhone(e.target.value)}
                  placeholder="Ej. +56 9 1234 5678"
                />
              </div>

              <div className="form-group">
                <label><Mail size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Correo Electrónico</label>
                <input 
                  type="email" 
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  placeholder="Ej. juan@empresa.com"
                  required 
                />
              </div>

              <div className="form-group">
                <label><MessageSquare size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Mensaje / Empresa</label>
                <textarea 
                  value={demoMessage}
                  onChange={(e) => setDemoMessage(e.target.value)}
                  placeholder="Cuéntanos un poco sobre tu proyecto..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary full-width">
                {loading ? 'Enviando...' : 'Enviar Código de Verificación'}
              </button>
            </form>

            <button 
              type="button" 
              onClick={() => {
                setError('');
                setStep('login');
              }}
              className="forgot-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', marginTop: '15px' }}
            >
              Volver al inicio de sesión
            </button>
          </>
        )}

        {step === 'demo-verify' && (
          <>
            <div className="login-header">
              <h2>Verificación de Correo</h2>
              <p>Hemos enviado un código de 6 dígitos a <strong>{demoEmail}</strong></p>
            </div>

            {error && <div className="alert error">{error}</div>}

            {demoCodeDev && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #10b981',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '15px',
                color: '#065f46',
                fontSize: '13px',
                textAlign: 'center'
              }}>
                ℹ️ <strong>Modo Desarrollo:</strong> Tu código de prueba es <strong>{demoCodeDev}</strong> (Simulado en consola del backend)
              </div>
            )}

            <form onSubmit={handleDemoVerify}>
              <div className="form-group">
                <label><ShieldCheck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Código de Verificación</label>
                <input 
                  type="text" 
                  value={demoCode}
                  onChange={(e) => setDemoCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                  required 
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary full-width">
                {loading ? 'Verificando...' : 'Verificar y Acceder'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button 
                type="button" 
                onClick={() => {
                  setError('');
                  setStep('demo-register');
                }}
                className="forgot-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Cambiar datos / correo
              </button>
              <button 
                type="button" 
                onClick={handleDemoRequest}
                disabled={loading}
                className="forgot-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#4f46e5' }}
              >
                Reenviar código
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
