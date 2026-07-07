import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MessageSquare, Send, X, User, MousePointer, AlertTriangle, Paperclip, Clock, CheckCircle, Monitor, Smartphone, Pencil } from 'lucide-react';
import AnnotationCanvas from '../components/AnnotationCanvas';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Función auxiliar para determinar si un comentario corresponde a PC o Celular
const getCommentDevice = (comment, breakpoint) => {
  const bp = breakpoint || 768;
  return (comment.viewportWidth && comment.viewportWidth < bp) ? 'mobile' : 'desktop';
};

// Función auxiliar para asignar número de secuencia cronológica estática (ascendente)
// y mantener el orden del array descendente (más nuevo primero) para el sidebar
const processComments = (rawComments) => {
  if (!rawComments || rawComments.length === 0) return [];
  
  // Clonar y ordenar por fecha ascendente para calcular la secuencia estática
  const sortedAsc = [...rawComments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  // Asignar el sequenceNumber
  const mapped = sortedAsc.map((comment, index) => ({
    ...comment,
    sequenceNumber: index + 1
  }));
  
  // Devolver en orden descendente (más nuevo primero)
  return mapped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export default function ReviewPage() {
  const { token } = useParams();
  const [siteInfo, setSiteInfo] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [comments, setComments] = useState([]);
  const localCommentIds = useRef(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // SDK detection
  const [sdkReady, setSdkReady] = useState(false);

  // Guest name
  const [guestName, setGuestName] = useState(() => localStorage.getItem('imgc_guest_name') || '');
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Feedback mode
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [pendingClick, setPendingClick] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAnnotation, setShowAnnotation] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeComment, setActiveComment] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'resolved'
  const [activeDevice, setActiveDevice] = useState('desktop'); // 'desktop' or 'mobile'
  const [mobileSize, setMobileSize] = useState('390'); // '375', '390', '414' (ancho en px)
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [scrollPositions, setScrollPositions] = useState({}); // { [pageUrl_device]: scrollY }

  const iframeRef = useRef(null);
  const overlayRef = useRef(null);

  // Mobile breakpoint: configurable por proyecto, default 768
  const mobileBreakpoint = siteInfo?.site?.mobileBreakpoint || 768;

  // Dimensiones según tamaño de celular seleccionado
  const mobileDimensions = {
    '375': { width: 375, height: 812 },
    '390': { width: 390, height: 844 },
    '414': { width: 414, height: 896 },
  };

  // Keep a ref of comments so postMessage handlers always have the latest value
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  // Keep a ref of activeTab so postMessage handlers always have the latest value
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Keep a ref of activeDevice so postMessage handlers always have the latest value
  const activeDeviceRef = useRef(activeDevice);
  activeDeviceRef.current = activeDevice;

  // Keep a ref of mobileBreakpoint
  const breakpointRef = useRef(mobileBreakpoint);
  breakpointRef.current = mobileBreakpoint;

  // Helper para comparar páginas de forma estricta, ignorando solo trailing slashes en el path y el hash
  const isSamePage = (url1, url2) => {
    if (!url1 || !url2) return false;
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      
      const p1 = u1.pathname.replace(/\/$/, '') || '/';
      const p2 = u2.pathname.replace(/\/$/, '') || '/';
      
      const q1 = u1.search;
      const q2 = u2.search;
      
      const h1 = u1.hash.replace(/\/$/, '');
      const h2 = u2.hash.replace(/\/$/, '');
      
      return u1.origin === u2.origin && p1 === p2 && q1 === q2 && h1 === h2;
    } catch (e) {
      const clean1 = url1.replace(/\/$/, '');
      const clean2 = url2.replace(/\/$/, '');
      return clean1 === clean2;
    }
  };

  // 1. Load site info and comments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [siteRes, commentsRes] = await Promise.all([
          axios.get(`${API_URL}/review/${token}`),
          axios.get(`${API_URL}/review/${token}/comments`)
        ]);
        setSiteInfo(siteRes.data);
        setCurrentUrl(siteRes.data.site.url);
        setComments(processComments(commentsRes.data));
      } catch (err) {
        console.error('Error loading review page', err);
        setError(err.response?.status === 404 ? 'invalid' : 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // 1.5. Conectar a Socket.io para actualizaciones en tiempo real
  useEffect(() => {
    if (loading || error) return;

    const socket = io(BACKEND_URL, {
      auth: {
        sdkToken: token
      }
    });

    socket.on('connect', () => {
      console.log('⚡ Conectado a WebSockets (Review Page)');
    });

    socket.on('feedback:new', (data) => {
      console.log('🔔 Nuevo feedback recibido via socket:', data);
      if (data.comment) {
        setComments(prev => {
          if (prev.some(c => c.id === data.comment.id)) return prev;
          if (localCommentIds.current.has(data.comment.id)) return prev;
          return processComments([data.comment, ...prev]);
        });
      }
    });

    socket.on('ticket:updated', (data) => {
      console.log('📝 Ticket actualizado via socket:', data);
      setComments(prev => prev.map(c => {
        if (c.id === data.commentId) {
          return {
            ...c,
            ticket: {
              ...(c.ticket || {}),
              status: data.status,
              priority: data.priority,
              resolvedAt: data.resolvedAt,
              notes: data.notes,
              assignee: data.assignee
            }
          };
        }
        return c;
      }));
    });

    socket.on('message:new', (data) => {
      console.log('💬 Nuevo mensaje de chat via socket:', data);
      setComments(prev => prev.map(c => {
        if (c.id === data.commentId) {
          const currentMessages = c.ticket?.messages || [];
          if (currentMessages.some(m => m.id === data.message.id)) return c;
          return {
            ...c,
            ticket: {
              ...(c.ticket || {}),
              messages: [...currentMessages, data.message]
            }
          };
        }
        return c;
      }));
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Error de conexión de Socket.io:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, loading, error]);

  // 2. Listen to ALL postMessage events from the SDK inside the iframe
  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data || {};
      if (!data.type) return;

      switch (data.type) {
        case 'SDK_LOADED': {
          console.log('[ReviewPage] SDK detected in iframe, URL:', data.url);
          setSdkReady(true);
          setCurrentUrl(data.url);
          // Send existing comments for this page to the SDK immediately
          const pageComments = commentsRef.current.filter(c => {
            const matchPage = isSamePage(c.pageUrl, data.url);
            const matchDevice = getCommentDevice(c, breakpointRef.current) === activeDeviceRef.current;
            if (!matchPage || !matchDevice) return false;
            const isResolvedStatus = c.ticket && (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED');
            return activeTabRef.current === 'pending' ? !isResolvedStatus : isResolvedStatus;
          });
          iframeRef.current?.contentWindow?.postMessage({
            type: 'INIT_REVIEW',
            comments: pageComments
          }, '*');
          // If feedback mode was active when the page changed, re-enable it in the new page's SDK
          if (feedbackMode) {
            setTimeout(() => {
              iframeRef.current?.contentWindow?.postMessage({
                type: 'TOGGLE_FEEDBACK_MODE',
                active: true
              }, '*');
            }, 100);
          }
          break;
        }
        case 'NEW_CLICK': {
          // SDK captured a click inside the iframe - show comment form in sidebar
          console.log('[ReviewPage] NEW_CLICK from SDK:', data.data);
          setPendingClick({
            xPercent: data.data.xPercent,
            yPercent: data.data.yPercent,
            scrollX: data.data.scrollX,
            scrollY: data.data.scrollY,
            screenshotBase64: data.data.screenshotBase64,
            browserInfo: data.data.browserInfo,
            fromSDK: true // Mark that this click came from the SDK
          });
          setSidebarOpen(true);
          break;
        }
        case 'PIN_CLICKED': {
          // User clicked an existing pin inside the iframe
          setActiveComment(data.commentId);
          setSidebarOpen(true);
          break;
        }
        case 'TAKING_SCREENSHOT': {
          // SDK is taking a screenshot - could show a loading indicator
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [feedbackMode]);

  // 3. When comments, currentUrl, activeTab, activeDevice or SDK is ready change, re-send pins for the current page
  useEffect(() => {
    if (!sdkReady || !iframeRef.current) return;
    const pageComments = comments.filter(c => {
      const matchPage = isSamePage(c.pageUrl, currentUrl);
      const matchDevice = getCommentDevice(c, mobileBreakpoint) === activeDevice;
      if (!matchPage || !matchDevice) return false;
      const isResolvedStatus = c.ticket && (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED');
      return activeTab === 'pending' ? !isResolvedStatus : isResolvedStatus;
    });
    iframeRef.current.contentWindow?.postMessage({
      type: 'INIT_REVIEW',
      comments: pageComments
    }, '*');
  }, [comments, currentUrl, sdkReady, activeTab, activeDevice]);

  // 4. Ask for name if not set
  useEffect(() => {
    if (!loading && !error && !guestName) {
      setShowNameModal(true);
    }
  }, [loading, error, guestName]);

  const saveName = () => {
    const name = nameInput.trim() || 'Anónimo';
    setGuestName(name);
    localStorage.setItem('imgc_guest_name', name);
    setShowNameModal(false);
  };

  const toggleFeedbackMode = () => {
    const newMode = !feedbackMode;
    setFeedbackMode(newMode);
    if (!newMode) {
      setPendingClick(null);
      setCommentText('');
    }
    // If SDK is active, delegate feedback mode to it
    if (sdkReady && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'TOGGLE_FEEDBACK_MODE',
        active: newMode
      }, '*');
    }
  };

  // Save scroll position before switching device
  const handleDeviceChange = (device, size) => {
    if (currentUrl) {
      const key = `${currentUrl}_${activeDevice}`;
      try {
        const scrollY = iframeRef.current?.contentWindow?.scrollY || 0;
        setScrollPositions(prev => ({
          ...prev,
          [key]: scrollY
        }));
      } catch (e) {
        // Cross-origin, ignore
      }
    }

    if (size) {
      setMobileSize(size);
    }

    setActiveDevice(device);
  };

  // Handle click on the overlay (ONLY used when SDK is NOT installed - fallback mode)
  const handleOverlayClick = (e) => {
    if (!feedbackMode || pendingClick || sdkReady) return;

    const container = overlayRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    const browserInfo = {
      browserName: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: activeDevice === 'mobile' ? (mobileDimensions[mobileSize]?.width || 390) : window.innerWidth,
      viewportHeight: activeDevice === 'mobile' ? (mobileDimensions[mobileSize]?.height || 844) : window.innerHeight
    };

    setPendingClick({
      xPercent,
      yPercent,
      clickX,
      clickY,
      containerWidth: rect.width,
      containerHeight: rect.height,
      browserInfo,
      screenshotBase64: null,
      fromSDK: false
    });
  };

  const cancelFeedback = () => {
    setPendingClick(null);
    setCommentText('');
    setSelectedFiles([]);
    // Notify SDK to remove temp pin
    if (sdkReady && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({ type: 'CANCEL_COMMENT' }, '*');
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !pendingClick) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('content', commentText);
      formData.append('guestName', guestName);
      formData.append('pageUrl', currentUrl || siteInfo.site.url);
      formData.append('xPercent', pendingClick.xPercent.toFixed(2));
      formData.append('yPercent', pendingClick.yPercent.toFixed(2));
      
      if (pendingClick.scrollX !== undefined && pendingClick.scrollX !== null) {
        formData.append('scrollX', pendingClick.scrollX);
      }
      if (pendingClick.scrollY !== undefined && pendingClick.scrollY !== null) {
        formData.append('scrollY', pendingClick.scrollY);
      }
      
      if (pendingClick.browserInfo) {
        formData.append('browserInfo', JSON.stringify(pendingClick.browserInfo));
      }
      if (pendingClick.screenshotBase64) {
        formData.append('screenshotBase64', pendingClick.screenshotBase64);
      }

      // Adjuntar archivos seleccionados
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await axios.post(`${API_URL}/review/${token}/comments`, formData);
      const newComment = res.data;

      // Marcar este comentario como creado localmente para que el socket no lo duplique
      localCommentIds.current.add(newComment.id);
      setComments(prev => processComments([newComment, ...prev]));
      setActiveTab('pending');
      setActiveDevice(getCommentDevice(newComment, mobileBreakpoint));
      setCommentText('');
      setSelectedFiles([]);
      setPendingClick(null);
      setFeedbackMode(false);

      // Notify SDK to finalize the pin and disable feedback mode
      if (sdkReady && iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage({
          type: 'COMMENT_SAVED',
          comment: newComment
        }, '*');
        iframeRef.current.contentWindow?.postMessage({
          type: 'TOGGLE_FEEDBACK_MODE',
          active: false
        }, '*');
      }

    } catch (err) {
      console.error('Error submitting comment', err);
      alert('Error al enviar el comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (commentId) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await axios.post(`${API_URL}/review/${token}/comments/${commentId}/reply`, {
        content: replyText,
        guestName
      });
      const res = await axios.get(`${API_URL}/review/${token}/comments`);
      setComments(processComments(res.data));
      setReplyText('');
    } catch (err) {
      console.error('Error sending reply', err);
    } finally {
      setSendingReply(false);
    }
  };

  // Calculate comment form position (only for overlay/fallback mode)
  const getFormPosition = () => {
    if (!pendingClick || !overlayRef.current) return {};
    const rect = overlayRef.current.getBoundingClientRect();
    let left = pendingClick.clickX + 20;
    let top = pendingClick.clickY + 20;

    if (left + 320 > rect.width) left = pendingClick.clickX - 340;
    if (top + 220 > rect.height) top = pendingClick.clickY - 240;
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    return { left: `${left}px`, top: `${top}px` };
  };

  // Filter comments for current page & active tab & active device (unified)
  const currentPageComments = comments.filter(c => {
    const matchPage = isSamePage(c.pageUrl, currentUrl);
    const matchDevice = getCommentDevice(c, mobileBreakpoint) === activeDevice;
    if (!matchPage || !matchDevice) return false;
    const isResolvedStatus = c.ticket && (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED');
    return activeTab === 'pending' ? !isResolvedStatus : isResolvedStatus;
  });

  const pendingCommentsCount = comments.filter(c => {
    const matchDevice = getCommentDevice(c, mobileBreakpoint) === activeDevice;
    if (!matchDevice) return false;
    const isResolvedStatus = c.ticket && (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED');
    return !isResolvedStatus;
  }).length;

  const resolvedCommentsCount = comments.filter(c => {
    const matchDevice = getCommentDevice(c, mobileBreakpoint) === activeDevice;
    if (!matchDevice) return false;
    return c.ticket && (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED');
  }).length;

  const filteredComments = comments.filter(c => {
    const matchDevice = getCommentDevice(c, mobileBreakpoint) === activeDevice;
    if (!matchDevice) return false;
    const isResolvedStatus = c.ticket && (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED');
    return activeTab === 'pending' ? !isResolvedStatus : isResolvedStatus;
  });

  if (loading) {
    return (
      <div className="review-loading">
        <div className="review-loading-spinner"></div>
        <p>Cargando página de revisión...</p>
      </div>
    );
  }

  if (error === 'invalid') {
    return (
      <div className="review-error">
        <h2>Enlace inválido</h2>
        <p>Este enlace de revisión no existe o ha sido desactivado.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-error">
        <h2>Error</h2>
        <p>Hubo un error al cargar la página de revisión.</p>
      </div>
    );
  }

  return (
    <div className="review-page">
      {/* Name Modal */}
      {showNameModal && (
        <div className="review-modal-overlay">
          <div className="review-modal">
            <div className="review-modal-icon">
              <User size={32} />
            </div>
            <h2>¡Bienvenido!</h2>
            <p>Ingresa tu nombre para dejar comentarios sobre el sitio.</p>
            <input
              type="text"
              placeholder="Tu nombre"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              autoFocus
            />
            <button className="review-btn review-btn-primary" onClick={saveName}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="review-toolbar" style={{ borderColor: siteInfo.project.color }}>
        <div className="review-toolbar-left">
          <div className="review-logo" style={{ background: siteInfo.project.color }}>
            IMGC
          </div>
          <div className="review-site-info">
            <strong>{siteInfo.site.name}</strong>
            <span>{siteInfo.project.name}</span>
          </div>
        </div>

        {/* Selector de Dispositivo (PC / Celular) */}
        <div className="review-device-selector">
          <button 
            className={`review-device-btn ${activeDevice === 'desktop' ? 'active' : ''}`}
            onClick={() => handleDeviceChange('desktop')}
            title="Vista PC"
          >
            <Monitor size={18} />
          </button>
          <button 
            className={`review-device-btn ${activeDevice === 'mobile' ? 'active' : ''}`}
            onClick={() => handleDeviceChange('mobile')}
            title="Vista Celular"
          >
            <Smartphone size={18} />
          </button>
        </div>

        {/* Selector de tamaño de celular (solo visible en modo mobile) */}
        {activeDevice === 'mobile' && (
          <div className="review-mobile-size-selector">
            {['375', '390', '414'].map(size => (
              <button
                key={size}
                className={`review-mobile-size-btn ${mobileSize === size ? 'active' : ''}`}
                onClick={() => handleDeviceChange('mobile', size)}
                title={`iPhone ${size === '375' ? 'SE/8' : size === '390' ? '14/15' : 'Plus/Max'} (${size}px)`}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        <div className="review-toolbar-right">
          <span className="review-user-badge">
            <User size={14} /> {guestName}
          </span>
          <button
            className={`review-btn ${feedbackMode ? 'review-btn-danger' : 'review-btn-primary'}`}
            onClick={toggleFeedbackMode}
          >
            {feedbackMode ? (
              <><X size={16} /> Cancelar</>
            ) : (
              <><MessageSquare size={16} /> Dejar Comentario</>
            )}
          </button>
          <button
            className="review-btn review-btn-ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MessageSquare size={16} />
            <span className="review-badge-count">{comments.length}</span>
          </button>
        </div>
      </div>

      {/* Feedback mode indicator */}
      {feedbackMode && !pendingClick && (
        <div style={{
          background: '#4f46e5',
          color: 'white',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <MousePointer size={16} />
          Haz clic en cualquier parte del sitio para dejar un comentario
        </div>
      )}

      {/* SDK not detected warning */}
      {!sdkReady && !loading && (
        <div style={{
          background: '#fef3c7',
          color: '#92400e',
          textAlign: 'center',
          padding: '6px 16px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <AlertTriangle size={14} />
          SDK no detectado en el sitio. Para una experiencia completa (pines fijos y separados por página), instala el snippet del SDK en el sitio del cliente.
        </div>
      )}

      {/* Main content */}
      <div className={`review-content viewport-${activeDevice}`}>
        {/* Iframe container with overlay */}
        <div 
          className={`review-iframe-container viewport-${activeDevice}${activeDevice === 'mobile' ? ` size-${mobileSize}` : ''}`}
        >
          
          {/* Badge de vista activa en modo celular */}
          {activeDevice === 'mobile' && (
            <div className="review-viewport-badge">
              <Smartphone size={12} />
              Celular {mobileSize}px
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={siteInfo.site.url}
            title={siteInfo.site.name}
            className="review-iframe"
          />

          {/* ===== OVERLAY MODE (fallback when SDK is NOT installed) ===== */}
          {!sdkReady && (
            <>
              {/* Overlay to capture clicks when in feedback mode */}
              {feedbackMode && (
                <div
                  ref={overlayRef}
                  onClick={handleOverlayClick}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: pendingClick ? 'default' : 'crosshair',
                    zIndex: 10,
                    background: pendingClick ? 'transparent' : 'rgba(79, 70, 229, 0.03)',
                  }}
                >
                  {/* Existing comment pins on overlay */}
                  {currentPageComments.map((comment, index) => (
                    <div
                      key={comment.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveComment(comment.id);
                        setSidebarOpen(true);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${comment.xPercent}%`,
                        top: `${comment.yPercent}%`,
                        width: '28px',
                        height: '28px',
                        background: activeComment === comment.id ? '#4f46e5' : '#6366f1',
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer',
                        boxShadow: activeComment === comment.id 
                          ? '0 0 0 3px rgba(79, 70, 229, 0.4), 0 2px 8px rgba(0,0,0,0.3)' 
                          : '0 2px 6px rgba(0,0,0,0.3)',
                        border: '2px solid white',
                        zIndex: 20,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%)'}
                    >
                      {comment.sequenceNumber || (index + 1)}
                    </div>
                  ))}

                  {/* Temporary pin at click position */}
                  {pendingClick && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${pendingClick.xPercent}%`,
                        top: `${pendingClick.yPercent}%`,
                        width: '28px',
                        height: '28px',
                        background: '#ef4444',
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'sans-serif',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
                        border: '2px solid white',
                        zIndex: 25,
                        animation: 'imgc-pin-pulse 1.5s infinite',
                      }}
                    >
                      +
                    </div>
                  )}

                  {/* Comment form at click position (overlay mode) */}
                  {pendingClick && (
                    <div
                      style={{
                        position: 'absolute',
                        ...getFormPosition(),
                        zIndex: 30,
                        background: 'white',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                        width: '320px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <form onSubmit={handleSubmitComment}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b' }}>
                          Nuevo Comentario
                        </h4>
                        <textarea
                          placeholder="Escribe tu comentario..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          autoFocus
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            resize: 'none',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                        {/* Selector de archivos adjuntos */}
                        <div style={{ marginTop: '10px' }}>
                          <label style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontSize: '12px', 
                            color: '#4f46e5', 
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}>
                            <Paperclip size={14} /> Adjuntar archivos o imágenes
                            <input 
                              type="file" 
                              multiple 
                              style={{ display: 'none' }} 
                              onChange={(e) => {
                                if (e.target.files) {
                                  setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                }
                              }}
                            />
                          </label>
                          
                          {/* Listado de archivos seleccionados */}
                          {selectedFiles.length > 0 && (
                            <div style={{ 
                              marginTop: '8px', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '4px',
                              maxHeight: '80px',
                              overflowY: 'auto'
                            }}>
                              {selectedFiles.map((file, idx) => (
                                <div key={idx} style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  background: '#f8fafc', 
                                  padding: '4px 8px', 
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  <span style={{ 
                                    textOverflow: 'ellipsis', 
                                    overflow: 'hidden', 
                                    whiteSpace: 'nowrap',
                                    maxWidth: '200px',
                                    color: '#334155'
                                  }}>
                                    {file.name}
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      color: '#ef4444', 
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      padding: '0 4px'
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                          <button 
                            type="button" 
                            className="review-btn review-btn-ghost" 
                            onClick={cancelFeedback}
                            style={{ fontSize: '13px', padding: '6px 14px' }}
                          >
                            Cancelar
                          </button>
                          <button 
                            type="submit" 
                            className="review-btn review-btn-primary" 
                            disabled={submitting || !commentText.trim()}
                            style={{ fontSize: '13px', padding: '6px 14px' }}
                          >
                            {submitting ? 'Enviando...' : 'Enviar'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* Show pins even when NOT in feedback mode (overlay fallback) */}
              {!feedbackMode && currentPageComments.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}>
                  {currentPageComments.map((comment, index) => (
                    <div
                      key={comment.id}
                      onClick={() => {
                        setActiveComment(comment.id);
                        setSidebarOpen(true);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${comment.xPercent}%`,
                        top: `${comment.yPercent}%`,
                        width: '28px',
                        height: '28px',
                        background: activeComment === comment.id ? '#4f46e5' : '#6366f1',
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        border: '2px solid white',
                        zIndex: 20,
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%)'}
                    >
                      {comment.sequenceNumber || (index + 1)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {/* ===== END OVERLAY MODE ===== */}

          {/* ===== SDK MODE: When SDK is active, the iframe handles its own pins. ===== */}
          {/* No overlay pins needed — the SDK renders them inside the iframe DOM */}
          {/* The overlay for capturing clicks is also handled by the SDK inside the iframe */}

        </div>

        {/* Sidebar */}
        <div className={`review-sidebar ${sidebarOpen ? 'open' : ''} ${activeDevice === 'mobile' && sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="review-sidebar-header">
            <h3>Comentarios ({comments.length})</h3>
            <button className="review-btn-icon" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Pestañas para filtrar por Pendientes y Resueltos */}
          <div className="review-sidebar-tabs">
            <button 
              className={`review-sidebar-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <Clock size={12} style={{ marginRight: '6px' }} />
              Pendientes ({pendingCommentsCount})
            </button>
            <button 
              className={`review-sidebar-tab ${activeTab === 'resolved' ? 'active' : ''}`}
              onClick={() => setActiveTab('resolved')}
            >
              <CheckCircle size={12} style={{ marginRight: '6px' }} />
              Resueltos ({resolvedCommentsCount})
            </button>
          </div>

          {/* Comment form when click comes from SDK (shown in sidebar) */}
          {sdkReady && pendingClick && pendingClick.fromSDK && (
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}>
              <form onSubmit={handleSubmitComment}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b' }}>
                  Nuevo Comentario
                </h4>
                <textarea
                  placeholder="Escribe tu comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  autoFocus
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    resize: 'none',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
                {/* Selector de archivos adjuntos */}
                <div style={{ marginTop: '10px' }}>
                  <label style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontSize: '12px', 
                    color: '#4f46e5', 
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}>
                    <Paperclip size={14} /> Adjuntar archivos o imágenes
                    <input 
                      type="file" 
                      multiple 
                      style={{ display: 'none' }} 
                      onChange={(e) => {
                        if (e.target.files) {
                          setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
                        }
                      }}
                    />
                  </label>
                  
                  {/* Listado de archivos seleccionados */}
                  {selectedFiles.length > 0 && (
                    <div style={{ 
                      marginTop: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px',
                      maxHeight: '80px',
                      overflowY: 'auto'
                    }}>
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          background: '#f8fafc', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <span style={{ 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden', 
                            whiteSpace: 'nowrap',
                            maxWidth: '200px',
                            color: '#334155'
                          }}>
                            {file.name}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: '#ef4444', 
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '0 4px'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Screenshot preview with Annotate button */}
                {pendingClick.screenshotBase64 && (
                  <div className="annotation-screenshot-preview" style={{ marginTop: '10px' }}>
                    <img src={pendingClick.screenshotBase64} alt="Captura de pantalla" />
                    <button
                      type="button"
                      className="annotation-edit-btn"
                      onClick={() => setShowAnnotation(true)}
                    >
                      <Pencil size={14} /> Anotar
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    className="review-btn review-btn-ghost" 
                    onClick={cancelFeedback}
                    style={{ fontSize: '13px', padding: '6px 14px' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="review-btn review-btn-primary" 
                    disabled={submitting || !commentText.trim()}
                    style={{ fontSize: '13px', padding: '6px 14px' }}
                  >
                    {submitting ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="review-sidebar-list">
            {filteredComments.length === 0 ? (
              <div className="review-sidebar-empty">
                <MessageSquare size={32} />
                <p>No hay comentarios {activeTab === 'pending' ? 'pendientes' : 'resueltos'} aún.</p>
                {activeTab === 'pending' && <p>Haz clic en "Dejar Comentario" para empezar.</p>}
              </div>
            ) : (
              filteredComments.map((comment, index) => (
                <div
                  key={comment.id}
                  className={`review-comment-card ${activeComment === comment.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveComment(activeComment === comment.id ? null : comment.id);
                    // If comment is on another page, navigate the iframe to it
                    if (comment.pageUrl && !isSamePage(comment.pageUrl, currentUrl) && iframeRef.current) {
                      iframeRef.current.src = comment.pageUrl;
                      setCurrentUrl(comment.pageUrl);
                      // SDK will re-initialize on that page and send SDK_LOADED
                    }
                  }}
                >
                  <div className="review-comment-header">
                    <div className="review-comment-pin-num">{comment.sequenceNumber || (index + 1)}</div>
                    <div className="review-comment-meta">
                      <strong>{comment.guestName || comment.author?.name || 'Anónimo'}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <small>{new Date(comment.createdAt).toLocaleDateString()}</small>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#94a3b8' }} title={`Creado en vista ${getCommentDevice(comment, mobileBreakpoint) === 'desktop' ? 'PC' : 'Celular'}`}>
                          • {getCommentDevice(comment, mobileBreakpoint) === 'desktop' ? <Monitor size={10} /> : <Smartphone size={10} />}
                        </span>
                      </div>
                    </div>
                    {comment.ticket && (
                      <span className={`review-status review-status-${comment.ticket.status.toLowerCase()}`}>
                        {comment.ticket.status === 'OPEN' ? 'Abierto' :
                         comment.ticket.status === 'IN_PROGRESS' ? 'En Progreso' :
                         comment.ticket.status === 'RESOLVED' ? 'Resuelto' : 'Cerrado'}
                      </span>
                    )}
                  </div>
                  {/* Show the page path for context */}
                  {comment.pageUrl && (
                    <small style={{ color: '#94a3b8', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                      {(() => { try { return new URL(comment.pageUrl).pathname; } catch { return comment.pageUrl; } })()}
                    </small>
                  )}
                  <p className="review-comment-text">{comment.content}</p>

                  {/* Archivos adjuntos del comentario */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div 
                      style={{ 
                        marginTop: '8px', 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px',
                        marginBottom: '8px'
                      }}
                      onClick={(e) => e.stopPropagation()} // Evitar colapsar la tarjeta al hacer clic en adjuntos
                    >
                      {comment.attachments.map(att => {
                        const isImage = att.mimetype.startsWith('image/');
                        const attUrl = att.path.startsWith('http') ? att.path : `${BACKEND_URL}/uploads/attachments/${att.path}`;
                        
                        return (
                          <div key={att.id} style={{ fontSize: '11px' }}>
                            {isImage ? (
                              <a href={attUrl} target="_blank" rel="noreferrer">
                                <img 
                                  src={attUrl} 
                                  alt={att.filename} 
                                  style={{ 
                                    width: '56px', 
                                    height: '56px', 
                                    objectFit: 'cover', 
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    display: 'block'
                                  }} 
                                  title={att.filename}
                                />
                              </a>
                            ) : (
                              <a 
                                href={attUrl} 
                                download={att.filename}
                                target="_blank" 
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  background: '#f1f5f9',
                                  borderRadius: '6px',
                                  color: '#475569',
                                  textDecoration: 'none',
                                  border: '1px solid #e2e8f0',
                                  fontWeight: '600'
                                }}
                              >
                                <Paperclip size={10} />
                                <span style={{ 
                                  maxWidth: '100px', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  {att.filename}
                                </span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Replies thread */}
                  {activeComment === comment.id && comment.ticket?.messages && (
                    <div className="review-thread">
                      {comment.ticket.messages.length > 0 && (
                        <div className="review-thread-messages">
                          {comment.ticket.messages.map(msg => (
                            <div key={msg.id} className={`review-thread-msg ${msg.authorId ? 'team' : 'client'}`}>
                              <div className="review-thread-msg-header">
                                <strong>{msg.author?.name || msg.guestName || 'Cliente'}</strong>
                                {msg.authorId && <span className="review-team-badge">Equipo</span>}
                                <small>{new Date(msg.createdAt).toLocaleString()}</small>
                              </div>
                              <p>{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="review-reply-box">
                        <input
                          type="text"
                          placeholder="Responder..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendReply(comment.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          className="review-btn-icon primary"
                          onClick={(e) => { e.stopPropagation(); handleSendReply(comment.id); }}
                          disabled={sendingReply || !replyText.trim()}
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CSS animation for the pulsing pin */}
      <style>{`
        @keyframes imgc-pin-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      {/* Annotation Canvas Modal */}
      {showAnnotation && pendingClick?.screenshotBase64 && (
        <AnnotationCanvas
          imageBase64={pendingClick.screenshotBase64}
          onSave={(annotatedBase64) => {
            setPendingClick(prev => ({
              ...prev,
              screenshotBase64: annotatedBase64
            }));
            setShowAnnotation(false);
          }}
          onCancel={() => setShowAnnotation(false)}
        />
      )}
    </div>
  );
}
