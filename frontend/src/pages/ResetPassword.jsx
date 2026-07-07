import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h2>IMGC Feedback</h2>
            <p>Enlace inválido</p>
          </div>
          <div className="alert error" style={{ textAlign: 'center' }}>
            <AlertCircle size={24} style={{ marginBottom: '8px' }} />
            <p>El enlace de restablecimiento no es válido o está incompleto.</p>
          </div>
          <Link to="/login" className="btn btn-primary full-width" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h2>IMGC Feedback</h2>
            <p>Contraseña restablecida</p>
          </div>
          <div className="success-box" style={{ textAlign: 'center' }}>
            <CheckCircle size={32} style={{ marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>¡Contraseña actualizada!</p>
            <p>Serás redirigido al inicio de sesión en unos segundos...</p>
          </div>
          <Link to="/login" className="btn btn-primary full-width" style={{ textAlign: 'center', textDecoration: 'none', marginTop: '16px' }}>
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h2>IMGC Feedback</h2>
          <p>Nueva contraseña</p>
        </div>

        {error && <div className="alert error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nueva Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Confirmar Contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary full-width">
            {loading ? 'Guardando...' : <><Lock size={18} /> Restablecer contraseña</>}
          </button>
        </form>

        <Link to="/login" className="forgot-link" style={{ marginTop: '16px' }}>
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
