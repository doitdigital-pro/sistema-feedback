import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, PlusCircle, Code, Globe, Edit2, Download, Phone, Mail } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '../components/Toast';

export default function ProjectDetail() {
  const toast = useToast();
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteData, setSiteData] = useState({ name: '', url: '' });
  const [submittingSite, setSubmittingSite] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', clientName: '', clientEmail: '', description: '' });
  const [savingProject, setSavingProject] = useState(false);

  const [reviewModal, setReviewModal] = useState({ show: false, url: '', snippet: '' });
  const [shareEmailModal, setShareEmailModal] = useState({ show: false, siteId: '', siteName: '', email: '', subject: '', body: '', sending: false });
  const [shareWhatsappModal, setShareWhatsappModal] = useState({ show: false, siteId: '', siteName: '', phone: '', message: '' });

  useEffect(() => {
    fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (err) {
      console.error('Error cargando detalle del proyecto', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!siteData.name || !siteData.url) return;
    setSubmittingSite(true);
    try {
      await api.post('/sites', {
        ...siteData,
        projectId: id
      });
      setSiteData({ name: '', url: '' });
      setShowSiteForm(false);
      fetchProject(); // recargar
    } catch (err) {
      console.error('Error creando sitio', err);
      toast.error('Error al crear el sitio web');
    } finally {
      setSubmittingSite(false);
    }
  };

  const handleGetReviewUrl = async (siteId) => {
    try {
      const res = await api.get(`/sites/${siteId}/snippet`);
      setReviewModal({ show: true, url: res.data.reviewUrl, snippet: res.data.snippet });
    } catch (err) {
      console.error('Error obteniendo URL de revisión', err);
      toast.error('Error al obtener la URL');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reviewModal.url);
    toast.success('Código copiado al portapapeles');
  };

  const handleOpenShareEmail = async (siteId, siteName) => {
    try {
      const snippetRes = await api.get(`/sites/${siteId}/snippet`);
      const reviewUrl = snippetRes.data.reviewUrl;
      
      const settingsRes = await api.get('/settings');
      const settingsData = settingsRes.data;
      
      const replacedSubject = settingsData.share_email_subject
        .replace(/\{\{projectName\}\}/g, project.name)
        .replace(/\{\{siteName\}\}/g, siteName)
        .replace(/\{\{reviewUrl\}\}/g, reviewUrl);
        
      const replacedBody = settingsData.share_email_body
        .replace(/\{\{projectName\}\}/g, project.name)
        .replace(/\{\{siteName\}\}/g, siteName)
        .replace(/\{\{reviewUrl\}\}/g, reviewUrl);
        
      setShareEmailModal({
        show: true,
        siteId,
        siteName,
        email: project.clientEmail || '',
        subject: replacedSubject,
        body: replacedBody,
        sending: false
      });
    } catch (err) {
      console.error('Error opening share email modal', err);
      toast.error('Error al cargar la plantilla de correo');
    }
  };

  const handleSendShareEmail = async (e) => {
    e.preventDefault();
    setShareEmailModal(prev => ({ ...prev, sending: true }));
    try {
      await api.post(`/sites/${shareEmailModal.siteId}/share-email`, {
        email: shareEmailModal.email,
        subject: shareEmailModal.subject,
        body: shareEmailModal.body
      });
      toast.success('Correo de revisión enviado con éxito');
      setShareEmailModal(prev => ({ ...prev, show: false }));
    } catch (err) {
      console.error('Error sending share email', err);
      toast.error(err.response?.data?.error || 'Error al enviar el correo');
    } finally {
      setShareEmailModal(prev => ({ ...prev, sending: false }));
    }
  };

  const handleOpenShareWhatsapp = async (siteId, siteName) => {
    try {
      const snippetRes = await api.get(`/sites/${siteId}/snippet`);
      const reviewUrl = snippetRes.data.reviewUrl;
      
      const settingsRes = await api.get('/settings');
      const settingsData = settingsRes.data;
      
      const replacedMessage = settingsData.share_whatsapp_template
        .replace(/\{\{projectName\}\}/g, project.name)
        .replace(/\{\{siteName\}\}/g, siteName)
        .replace(/\{\{reviewUrl\}\}/g, reviewUrl);
        
      setShareWhatsappModal({
        show: true,
        siteId,
        siteName,
        phone: '',
        message: replacedMessage
      });
    } catch (err) {
      console.error('Error opening share WhatsApp modal', err);
      toast.error('Error al cargar la plantilla de WhatsApp');
    }
  };

  const handleSendShareWhatsapp = (e) => {
    e.preventDefault();
    const cleanPhone = shareWhatsappModal.phone.replace(/[^0-9]/g, '');
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(shareWhatsappModal.message)}`;
    window.open(url, '_blank');
    setShareWhatsappModal(prev => ({ ...prev, show: false }));
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el proyecto "${project.name}" permanentemente? Se borrarán todos los sitios, comentarios y tickets asociados.`)) {
      return;
    }
    try {
      await api.delete(`/projects/${id}`);
      toast.success('Proyecto eliminado correctamente');
      window.location.href = '/projects';
    } catch (err) {
      console.error('Error eliminando proyecto', err);
      toast.error('Error al intentar eliminar el proyecto');
    }
  };

  const handleDeleteSite = async (siteId, siteName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el sitio web "${siteName}"? Se borrarán todos sus comentarios y tickets asociados.`)) {
      return;
    }
    try {
      await api.delete(`/sites/${siteId}`);
      fetchProject(); // recargar
    } catch (err) {
      console.error('Error eliminando sitio', err);
      toast.error('Error al intentar eliminar el sitio web');
    }
  };

  const startEditing = () => {
    setEditFormData({
      name: project.name || '',
      clientName: project.clientName || '',
      clientEmail: project.clientEmail || '',
      description: project.description || ''
    });
    setIsEditing(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim()) return;
    setSavingProject(true);
    try {
      const res = await api.put(`/projects/${project.id}`, editFormData);
      setProject({
        ...project,
        name: res.data.name,
        clientName: res.data.clientName,
        clientEmail: res.data.clientEmail,
        description: res.data.description
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Error actualizando proyecto', err);
      toast.error('Hubo un error al actualizar los datos del proyecto');
    } finally {
      setSavingProject(false);
    }
  };

  const [exporting, setExporting] = useState(false);

  const loadImageBase64 = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = url;
    });
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // 1. Obtener la data consolidada del backend
      const res = await api.get(`/projects/${id}/report`);
      const reportData = res.data;

      // 2. Crear instancia de jsPDF
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [79, 70, 229]; // RGB para #4f46e5 (Índigo)
      const secondaryColor = [71, 85, 105]; // RGB para #475569
      const lightBg = [248, 250, 252]; // RGB para #f8fafc

      // ==========================================
      // PAGINA 1: PORTADA
      // ==========================================
      
      // Rectángulo lateral decorativo (índigo)
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 25, 297, 'F');

      // Título principal
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(...primaryColor);
      doc.text('IMGC FEEDBACK', 35, 60);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...secondaryColor);
      doc.text('Reporte Ejecutivo de Feedback Visual', 35, 70);

      // Línea horizontal decorativa
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(35, 78, 195, 78);

      // Detalles del Proyecto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(reportData.name, 35, 95);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...secondaryColor);
      
      let yOffset = 105;
      doc.text(`Cliente: ${reportData.clientName || 'No especificado'}`, 35, yOffset);
      yOffset += 7;
      if (reportData.clientEmail) {
        doc.text(`Correo del Cliente: ${reportData.clientEmail}`, 35, yOffset);
        yOffset += 7;
      }
      doc.text(`Fecha de creación: ${new Date(reportData.createdAt).toLocaleDateString()}`, 35, yOffset);
      yOffset += 7;
      doc.text(`Fecha del reporte: ${new Date().toLocaleDateString()}`, 35, yOffset);

      if (reportData.description) {
        yOffset += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Descripción del Proyecto:', 35, yOffset);
        doc.setFont('helvetica', 'normal');
        yOffset += 6;
        const splitDesc = doc.splitTextToSize(reportData.description, 150);
        doc.text(splitDesc, 35, yOffset);
      }

      // Caja de Estadísticas
      yOffset = 180;
      doc.setFillColor(...lightBg);
      doc.rect(35, yOffset, 150, 45, 'F');
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(1);
      doc.line(35, yOffset, 35, yOffset + 45); // Línea izquierda resaltada

      // Calcular estadísticas
      let totalComments = 0;
      let openTickets = 0;
      let resolvedTickets = 0;

      reportData.sites.forEach(site => {
        totalComments += site.comments.length;
        site.comments.forEach(c => {
          if (c.ticket) {
            if (c.ticket.status === 'RESOLVED' || c.ticket.status === 'CLOSED') {
              resolvedTickets++;
            } else {
              openTickets++;
            }
          }
        });
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('RESUMEN ESTADÍSTICO', 42, yOffset + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text(`Sitios Web vinculados: ${reportData.sites.length}`, 42, yOffset + 20);
      doc.text(`Total de Feedback Recibido: ${totalComments}`, 42, yOffset + 26);
      doc.text(`Tickets Pendientes (Abiertos): ${openTickets}`, 42, yOffset + 32);
      doc.text(`Tickets Resueltos / Cerrados: ${resolvedTickets}`, 42, yOffset + 38);

      // Pie de portada
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text('Generado automáticamente por el Sistema IMGC Feedback', 35, 275);


      // ==========================================
      // PAGINA 2: TABLA RESUMEN CON AUTOTABLE
      // ==========================================
      doc.addPage();
      
      // Encabezado de página
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('Listado Consolidado de Feedback', 20, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('Tabla resumen de todos los reportes y su estado actual de resolución.', 20, 26);

      // Preparar filas para la tabla
      const tableRows = [];
      let globalIndex = 1;

      reportData.sites.forEach(site => {
        site.comments.forEach(c => {
          const device = (c.viewportWidth && c.viewportWidth < 768) ? 'Móvil' : 'PC';
          const statusText = c.ticket?.status || 'OPEN';
          
          let translatedStatus = 'Abierto';
          if (statusText === 'RESOLVED') translatedStatus = 'Resuelto';
          if (statusText === 'CLOSED') translatedStatus = 'Cerrado';
          if (statusText === 'IN_PROGRESS') translatedStatus = 'En Progreso';

          tableRows.push([
            `#${globalIndex}`,
            site.name,
            c.content.length > 50 ? c.content.substring(0, 50) + '...' : c.content,
            device,
            c.ticket?.priority || 'MEDIUM',
            translatedStatus
          ]);
          c.globalIndex = globalIndex; // Guardar para la hoja de detalle
          globalIndex++;
        });
      });

      doc.autoTable({
        startY: 32,
        head: [['ID', 'Sitio Web', 'Comentario', 'Dispositivo', 'Prioridad', 'Estado']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        margin: { left: 20, right: 20 }
      });


      // ==========================================
      // PAGINAS SIGUIENTES: HOJA DE DETALLE POR COMENTARIO
      // ==========================================
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

      for (const site of reportData.sites) {
        for (const c of site.comments) {
          doc.addPage();

          // Título de hoja de detalle
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(30, 41, 59);
          doc.text(`Detalle de Feedback #${c.globalIndex}`, 20, 20);

          // Detalles rápidos
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...secondaryColor);
          
          const device = (c.viewportWidth && c.viewportWidth < 768) ? 'Celular 📱' : 'PC 🖥️';
          const browserInfo = `${c.browserName || 'Desconocido'} (${c.osName || 'Desconocido'}) - ${c.screenWidth || '?'}x${c.screenHeight || '?'}`;
          
          doc.text(`Sitio: ${site.name}`, 20, 26);
          doc.text(`Página: ${c.pageUrl}`, 20, 31);
          doc.text(`Entorno: ${browserInfo} | Dispositivo: ${device}`, 20, 36);
          doc.text(`Fecha: ${new Date(c.createdAt).toLocaleString()}`, 20, 41);

          // Comentario
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          doc.text('Comentario:', 20, 49);

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          const splitContent = doc.splitTextToSize(`"${c.content}"`, 170);
          doc.text(splitContent, 20, 54);

          let currentY = 56 + (splitContent.length * 5);

          // Renderizar Screenshot
          if (c.screenshotUrl) {
            const fullImgUrl = c.screenshotUrl.startsWith('http') ? c.screenshotUrl : `${backendUrl}${c.screenshotUrl}`;
            
            // Añadir nota de cargando o descargando imagen
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            
            // Descargar Base64
            const base64 = await loadImageBase64(fullImgUrl);
            if (base64) {
              doc.addImage(base64, 'PNG', 20, currentY, 170, 95);
              currentY += 100;
            } else {
              doc.text('[Captura de pantalla no disponible para exportación (CORS/Offline)]', 20, currentY);
              currentY += 10;
            }
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('[Sin captura de pantalla asociada]', 20, currentY);
            currentY += 10;
          }

          // Renderizar Respuestas del Chat
          const messages = c.ticket?.messages || [];
          if (messages.length > 0) {
            currentY += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text('Historial de Respuestas:', 20, currentY);
            currentY += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);

            for (const m of messages) {
              const authorName = m.author ? m.author.name : (m.guestName || 'Cliente');
              const dateStr = new Date(m.createdAt).toLocaleString();
              const prefix = m.author ? '🛠️ Equipo' : '👤 Cliente';
              
              const label = `${prefix} (${authorName}) - ${dateStr}:`;
              
              // Verificar si cabe en la página, si no, agregar nueva
              if (currentY > 275) {
                doc.addPage();
                currentY = 25;
              }

              doc.setFont('helvetica', 'bold');
              doc.setTextColor(...secondaryColor);
              doc.text(label, 22, currentY);
              currentY += 4.5;

              doc.setFont('helvetica', 'normal');
              doc.setTextColor(15, 23, 42);
              const splitMsg = doc.splitTextToSize(m.content, 160);
              
              if (currentY + (splitMsg.length * 4) > 280) {
                doc.addPage();
                currentY = 25;
              }

              doc.text(splitMsg, 24, currentY);
              currentY += (splitMsg.length * 4) + 2;
            }
          }
        }
      }

      // Guardar PDF
      doc.save(`Reporte-Feedback-${reportData.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      toast.error('Hubo un error al generar el reporte PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <p>Cargando detalle del proyecto...</p>;
  if (!project) return <p>Proyecto no encontrado.</p>;

  return (
    <div className="project-detail-page">
      <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/projects" className="btn btn-cancel">
          <ArrowLeft size={16} /> Volver a Proyectos
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isEditing && (
            <>
              <button 
                onClick={handleExportPDF} 
                className="btn btn-primary"
                disabled={exporting}
                style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} /> {exporting ? 'Generando PDF...' : 'Exportar Reporte (PDF)'}
              </button>
              <button 
                onClick={startEditing} 
                className="btn btn-primary"
                style={{ background: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit2 size={16} /> Editar Proyecto
              </button>
            </>
          )}
          <button 
            onClick={handleDeleteProject} 
            className="btn btn-danger"
            style={{ background: '#ef4444' }}
          >
            Eliminar Proyecto
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="card mt-4 mb-4" style={{ padding: '24px' }}>
          <h3>Editar Detalles del Proyecto</h3>
          <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Nombre del Proyecto *</label>
                <input 
                  type="text" 
                  required 
                  value={editFormData.name} 
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Nombre del Cliente</label>
                <input 
                  type="text" 
                  value={editFormData.clientName} 
                  onChange={e => setEditFormData({...editFormData, clientName: e.target.value})} 
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Correo del Cliente</label>
                <input 
                  type="email" 
                  value={editFormData.clientEmail} 
                  onChange={e => setEditFormData({...editFormData, clientEmail: e.target.value})} 
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Descripción</label>
              <textarea 
                rows="3"
                value={editFormData.description} 
                onChange={e => setEditFormData({...editFormData, description: e.target.value})} 
                placeholder="Descripción del proyecto..."
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsEditing(false)} className="btn btn-cancel">
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingProject}>
                {savingProject ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card mt-4 mb-4" style={{ padding: '24px' }}>
          <h2>{project.name}</h2>
          <p style={{ color: '#64748b', fontSize: '15px' }}>
            <strong>Cliente:</strong> {project.clientName || 'No especificado'} 
            {project.clientEmail ? ` (${project.clientEmail})` : ''}
          </p>
          {project.description && <p style={{ marginTop: '12px', color: '#334155' }}>{project.description}</p>}
        </div>
      )}

      <div className="header-actions mt-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Sitios Web del Proyecto</h3>
        <button className="btn btn-primary" onClick={() => setShowSiteForm(!showSiteForm)}>
          <PlusCircle size={16} /> {showSiteForm ? 'Cancelar' : 'Añadir Sitio Web'}
        </button>
      </div>

      {showSiteForm && (
        <div className="card mt-4 mb-4" style={{ padding: '20px', background: '#f8fafc' }}>
          <h4>Registrar un nuevo Sitio Web</h4>
          <form onSubmit={handleCreateSite} style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Nombre del Sitio *</label>
              <input 
                type="text" 
                required 
                value={siteData.name} 
                onChange={e => setSiteData({...siteData, name: e.target.value})} 
                placeholder="Ej: Landing Page Principal"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>URL Pública *</label>
              <input 
                type="url" 
                required 
                value={siteData.url} 
                onChange={e => setSiteData({...siteData, url: e.target.value})} 
                placeholder="https://www.cliente.com"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submittingSite}>
              {submittingSite ? 'Guardando...' : 'Guardar Sitio'}
            </button>
          </form>
        </div>
      )}

      <div className="table-container mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sitio</th>
              <th>URL</th>
              <th>Tickets Totales</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {project.sites && project.sites.map(site => (
              <tr key={site.id}>
                <td><strong>{site.name}</strong></td>
                <td>
                  <a href={site.url} target="_blank" rel="noreferrer" className="text-link" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={14}/> {site.url}
                  </a>
                </td>
                <td>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                    {site._count?.comments || 0} tickets
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => handleGetReviewUrl(site.id)} 
                      className="btn btn-primary btn-sm"
                      style={{ background: '#10b981' }}
                    >
                      <Code size={16} /> URL de Revisión
                    </button>
                    <button 
                      onClick={() => handleDeleteSite(site.id, site.name)} 
                      className="btn btn-danger btn-sm"
                      style={{ background: '#ef4444' }}
                    >
                      Eliminar
                    </button>
                    {/* Botón WhatsApp */}
                    <button
                      onClick={() => handleOpenShareWhatsapp(site.id, site.name)}
                      className="btn btn-sm"
                      style={{
                        background: '#075e54',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Compartir por WhatsApp"
                    >
                      <Phone size={14} />
                    </button>
                    {/* Botón Correo */}
                    <button
                      onClick={() => handleOpenShareEmail(site.id, site.name)}
                      className="btn btn-sm"
                      style={{
                        background: '#1e3a8a',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Enviar por Correo"
                    >
                      <Mail size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!project.sites || project.sites.length === 0) && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                  Este proyecto aún no tiene sitios web. Añade uno para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal URL Revisión */}
      {reviewModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card" style={{ padding: '24px', width: '100%', maxWidth: '600px', margin: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Enlace de Revisión y SDK</h3>
            
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <strong>1. Enlace para el Cliente:</strong> Envíale esto para que pueda dejar comentarios.
            </p>
            <div style={{ 
              background: '#f1f5f9', color: '#0f172a', padding: '12px', borderRadius: '8px', 
              fontSize: '14px', border: '1px solid #e2e8f0', wordBreak: 'break-all', marginBottom: '16px'
            }}>
              {reviewModal.url}
            </div>

            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <strong>2. Código SDK (Invisible):</strong> Pega esto en el <code>&lt;head&gt;</code> del sitio web del cliente. Es completamente invisible para visitantes normales.
            </p>
            <pre style={{ 
              background: '#1e293b', color: '#f8fafc', padding: '16px', borderRadius: '8px', 
              overflowX: 'auto', fontSize: '13px', lineHeight: '1.5', margin: 0
            }}>
              {reviewModal.snippet}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-cancel" onClick={() => setReviewModal({ show: false, url: '', snippet: '' })}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={copyToClipboard}>
                Copiar URL Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Compartir por Correo */}
      {shareEmailModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <form onSubmit={handleSendShareEmail} className="card" style={{ padding: '24px', width: '100%', maxWidth: '600px', margin: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={20} style={{ color: '#1e3a8a' }} /> Enviar Enlace por Correo
            </h3>
            
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
              Envía los accesos para la revisión de <strong>{shareEmailModal.siteName}</strong> directamente al cliente.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Correo Destinatario</label>
              <input
                type="email"
                required
                value={shareEmailModal.email}
                onChange={e => setShareEmailModal({ ...shareEmailModal, email: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                placeholder="cliente@empresa.com"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Asunto</label>
              <input
                type="text"
                required
                value={shareEmailModal.subject}
                onChange={e => setShareEmailModal({ ...shareEmailModal, subject: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Mensaje</label>
              <textarea
                rows="6"
                required
                value={shareEmailModal.body}
                onChange={e => setShareEmailModal({ ...shareEmailModal, body: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button type="button" className="btn btn-cancel" onClick={() => setShareEmailModal({ ...shareEmailModal, show: false })} disabled={shareEmailModal.sending}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ background: '#1e3a8a' }} disabled={shareEmailModal.sending}>
                {shareEmailModal.sending ? 'Enviando...' : 'Enviar Correo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Compartir por WhatsApp */}
      {shareWhatsappModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <form onSubmit={handleSendShareWhatsapp} className="card" style={{ padding: '24px', width: '100%', maxWidth: '600px', margin: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={20} style={{ color: '#075e54' }} /> Enviar por WhatsApp
            </h3>
            
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
              Genera un mensaje de WhatsApp para compartir los accesos de <strong>{shareWhatsappModal.siteName}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Teléfono del Cliente (Opcional)</label>
              <input
                type="text"
                value={shareWhatsappModal.phone}
                onChange={e => setShareWhatsappModal({ ...shareWhatsappModal, phone: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                placeholder="Ej: +5215512345678"
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>Incluye el código de país. Si lo dejas vacío, podrás compartirlo con cualquier chat.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Mensaje a enviar</label>
              <textarea
                rows="6"
                required
                value={shareWhatsappModal.message}
                onChange={e => setShareWhatsappModal({ ...shareWhatsappModal, message: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button type="button" className="btn btn-cancel" onClick={() => setShareWhatsappModal({ ...shareWhatsappModal, show: false })}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ background: '#075e54' }}>
                Abrir WhatsApp Web
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
