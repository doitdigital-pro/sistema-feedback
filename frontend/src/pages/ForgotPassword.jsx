import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h2>IMGC Feedback</h2>
          <p>Restablecer contraseña</p>
        </div>

        {sent ? (
          <div className="success-box" style={{ textAlign: 'center' }}>
            <CheckCircle size={32} style={{ marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Correo enviado</p>
            <p>Si el email existe en el sistema, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.</p>
          </div>
        ) : (
          <>
            {error && <div className="alert error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary full-width">
                {loading ? 'Enviando...' : <><Mail size={18} /> Enviar enlace</>}
              </button>
            </form>
          </>
        )}

        <Link to="/login" className="forgot-link" style={{ marginTop: '16px', textDecoration: 'none' }}>
          <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
