import { useState, useRef, useEffect, useCallback } from 'react';
import { Square, ArrowUpRight, Pencil, Type, Undo2, Trash2, Check, X, Minus } from 'lucide-react';

const TOOLS = [
  { id: 'rect', label: 'Rectángulo', icon: Square },
  { id: 'arrow', label: 'Flecha', icon: ArrowUpRight },
  { id: 'freehand', label: 'Trazo Libre', icon: Pencil },
  { id: 'text', label: 'Texto', icon: Type },
];

const COLORS = [
  { id: 'red', value: '#ef4444' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'green', value: '#22c55e' },
  { id: 'yellow', value: '#eab308' },
  { id: 'white', value: '#ffffff' },
  { id: 'black', value: '#000000' },
];

const STROKE_WIDTHS = [
  { id: 'thin', value: 2, label: 'Fino' },
  { id: 'normal', value: 4, label: 'Normal' },
  { id: 'thick', value: 8, label: 'Grueso' },
];

const TEXT_SIZES = [
  { id: 'small', value: 16, label: 'Pequeño' },
  { id: 'medium', value: 28, label: 'Mediano' },
  { id: 'large', value: 48, label: 'Grande' },
];

export default function AnnotationCanvas({ imageBase64, onSave, onCancel }) {
  const bgCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const containerRef = useRef(null);

  const [tool, setTool] = useState('rect');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [textSize, setTextSize] = useState(28); // Added text size state
  const [shapes, setShapes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [textInput, setTextInput] = useState(null); // { x, y } when placing text
  const [textValue, setTextValue] = useState('');
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  // Load the background image onto the bg canvas
  useEffect(() => {
    if (!imageBase64 || !bgCanvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      const bgCanvas = bgCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!bgCanvas || !drawCanvas) return;

      // Scale image to fit within the viewport while maintaining aspect ratio
      const maxW = window.innerWidth * 0.88;
      const maxH = window.innerHeight * 0.82;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxW) {
        h = h * (maxW / w);
        w = maxW;
      }
      if (h > maxH) {
        w = w * (maxH / h);
        h = maxH;
      }

      w = Math.round(w);
      h = Math.round(h);

      bgCanvas.width = w;
      bgCanvas.height = h;
      drawCanvas.width = w;
      drawCanvas.height = h;

      setImgSize({ width: w, height: h });

      const ctx = bgCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = imageBase64;
  }, [imageBase64]);

  // Redraw all shapes on the draw canvas whenever shapes change
  const redrawShapes = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    shapes.forEach(shape => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (shape.type) {
        case 'rect':
          drawRect(ctx, shape);
          break;
        case 'arrow':
          drawArrow(ctx, shape);
          break;
        case 'freehand':
          drawFreehand(ctx, shape);
          break;
        case 'text':
          drawText(ctx, shape);
          break;
      }
    });
  }, [shapes]);

  useEffect(() => {
    redrawShapes();
  }, [redrawShapes]);

  // --- Drawing primitives ---

  function drawRect(ctx, shape) {
    const { x1, y1, x2, y2, color: c, strokeWidth: sw } = shape;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    // Semi-transparent fill
    ctx.fillStyle = c + '1A'; // ~10% opacity
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = c;
    ctx.lineWidth = sw;
    ctx.strokeRect(x, y, w, h);
  }

  function drawArrow(ctx, shape) {
    const { x1, y1, x2, y2, color: c, strokeWidth: sw } = shape;

    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = sw;

    // Line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const headLength = Math.max(14, sw * 4);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawFreehand(ctx, shape) {
    const { points, color: c, strokeWidth: sw } = shape;
    if (!points || points.length < 2) return;

    ctx.strokeStyle = c;
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  function drawText(ctx, shape) {
    const { x, y, text, color: c, size } = shape;
    ctx.font = `bold ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = c;
    ctx.textBaseline = 'top';

    // Draw text shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(text, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // --- Live preview while drawing ---

  function drawLivePreview(x2, y2) {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Redraw existing shapes first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach(shape => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      switch (shape.type) {
        case 'rect': drawRect(ctx, shape); break;
        case 'arrow': drawArrow(ctx, shape); break;
        case 'freehand': drawFreehand(ctx, shape); break;
        case 'text': drawText(ctx, shape); break;
      }
    });

    // Now draw the live preview shape
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'rect' && startPoint) {
      drawRect(ctx, { x1: startPoint.x, y1: startPoint.y, x2, y2, color, strokeWidth });
    } else if (tool === 'arrow' && startPoint) {
      drawArrow(ctx, { x1: startPoint.x, y1: startPoint.y, x2, y2, color, strokeWidth });
    } else if (tool === 'freehand' && currentPoints.length > 0) {
      const pts = [...currentPoints, { x: x2, y: y2 }];
      drawFreehand(ctx, { points: pts, color, strokeWidth });
    }
  }

  // --- Mouse event handlers ---

  function getCanvasCoords(e) {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handleMouseDown(e) {
    if (textInput) {
        // If clicking while text input is active, confirm the text first
        handleTextConfirm();
        return;
    }
    const pos = getCanvasCoords(e);

    if (tool === 'text') {
      setTextInput({ x: pos.x, y: pos.y });
      setTextValue('');
      return;
    }

    setIsDrawing(true);
    setStartPoint(pos);

    if (tool === 'freehand') {
      setCurrentPoints([pos]);
    }
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;
    const pos = getCanvasCoords(e);

    if (tool === 'freehand') {
      setCurrentPoints(prev => [...prev, pos]);
    }

    drawLivePreview(pos.x, pos.y);
  }

  function handleMouseUp(e) {
    if (!isDrawing) return;
    const pos = getCanvasCoords(e);
    setIsDrawing(false);

    if (tool === 'rect' && startPoint) {
      // Only add if the rectangle has some size
      if (Math.abs(pos.x - startPoint.x) > 3 || Math.abs(pos.y - startPoint.y) > 3) {
        setShapes(prev => [...prev, {
          type: 'rect',
          x1: startPoint.x, y1: startPoint.y,
          x2: pos.x, y2: pos.y,
          color, strokeWidth,
        }]);
      }
    } else if (tool === 'arrow' && startPoint) {
      const dist = Math.sqrt((pos.x - startPoint.x) ** 2 + (pos.y - startPoint.y) ** 2);
      if (dist > 5) {
        setShapes(prev => [...prev, {
          type: 'arrow',
          x1: startPoint.x, y1: startPoint.y,
          x2: pos.x, y2: pos.y,
          color, strokeWidth,
        }]);
      }
    } else if (tool === 'freehand') {
      const pts = [...currentPoints, pos];
      if (pts.length > 1) {
        setShapes(prev => [...prev, {
          type: 'freehand',
          points: pts,
          color, strokeWidth,
        }]);
      }
    }

    setStartPoint(null);
    setCurrentPoints([]);
  }

  function handleTextConfirm() {
    if (textValue.trim() && textInput) {
      setShapes(prev => [...prev, {
        type: 'text',
        x: textInput.x,
        y: textInput.y,
        text: textValue,
        color,
        size: textSize,
      }]);
    }
    setTextInput(null);
    setTextValue('');
  }

  function handleTextKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextConfirm();
    } else if (e.key === 'Escape') {
      setTextInput(null);
      setTextValue('');
    }
  }

  // --- Actions ---

  function handleUndo() {
    setShapes(prev => prev.slice(0, -1));
  }

  function handleClear() {
    setShapes([]);
  }

  function handleConfirm() {
    // Merge bg + draw canvases into one
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!bgCanvas || !drawCanvas) return;

    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width = bgCanvas.width;
    mergeCanvas.height = bgCanvas.height;
    const ctx = mergeCanvas.getContext('2d');

    ctx.drawImage(bgCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);

    const annotatedBase64 = mergeCanvas.toDataURL('image/jpeg', 0.85);
    onSave(annotatedBase64);
  }

  return (
    <div className="annotation-modal">
      {/* Toolbar */}
      <div className="annotation-toolbar">
        <div className="annotation-toolbar-group">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`annotation-tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => { setTool(t.id); setTextInput(null); }}
              title={t.label}
            >
              <t.icon size={18} />
            </button>
          ))}
        </div>

        <div className="annotation-separator" />

        <div className="annotation-toolbar-group">
          {COLORS.map(c => (
            <button
              key={c.id}
              className={`annotation-color-btn ${color === c.value ? 'active' : ''}`}
              onClick={() => setColor(c.value)}
              title={c.id}
              style={{ background: c.value }}
            />
          ))}
        </div>

        <div className="annotation-separator" />

        <div className="annotation-toolbar-group">
          {tool === 'text' ? (
            TEXT_SIZES.map(ts => (
              <button
                key={ts.id}
                className={`annotation-stroke-btn ${textSize === ts.value ? 'active' : ''}`}
                onClick={() => setTextSize(ts.value)}
                title={ts.label}
                style={{ fontSize: ts.value > 30 ? '16px' : ts.value > 20 ? '14px' : '11px', fontWeight: 'bold' }}
              >
                T
              </button>
            ))
          ) : (
            STROKE_WIDTHS.map(sw => (
              <button
                key={sw.id}
                className={`annotation-stroke-btn ${strokeWidth === sw.value ? 'active' : ''}`}
                onClick={() => setStrokeWidth(sw.value)}
                title={sw.label}
              >
                <Minus size={18} strokeWidth={sw.value} />
              </button>
            ))
          )}
        </div>

        <div className="annotation-separator" />

        <div className="annotation-toolbar-group">
          <button
            className="annotation-action-btn"
            onClick={handleUndo}
            disabled={shapes.length === 0}
            title="Deshacer"
          >
            <Undo2 size={18} />
          </button>
          <button
            className="annotation-action-btn danger"
            onClick={handleClear}
            disabled={shapes.length === 0}
            title="Limpiar todo"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <div className="annotation-toolbar-group">
          <button className="annotation-cancel-btn" onClick={onCancel}>
            <X size={16} /> Cancelar
          </button>
          <button className="annotation-confirm-btn" onClick={handleConfirm}>
            <Check size={16} /> Listo
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="annotation-canvas-wrapper" ref={containerRef}>
        <div
          className="annotation-canvas-container"
          style={{ width: imgSize.width || 'auto', height: imgSize.height || 'auto' }}
        >
          <canvas ref={bgCanvasRef} className="annotation-canvas-bg" />
          <canvas
            ref={drawCanvasRef}
            className="annotation-canvas-draw"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (isDrawing) handleMouseUp({ clientX: 0, clientY: 0 });
            }}
            style={{
              cursor: tool === 'text' ? 'text' : 'crosshair',
            }}
          />

          {/* Floating text input when in text mode */}
          {textInput && (
            <div
              className="annotation-text-input-container"
              style={{
                left: `${(textInput.x / (imgSize.width || 1)) * 100}%`,
                top: `${(textInput.y / (imgSize.height || 1)) * 100}%`,
              }}
            >
              <input
                type="text"
                className="annotation-text-input"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={handleTextKeyDown}
                onBlur={handleTextConfirm}
                placeholder="Escribe aquí..."
                autoFocus
                style={{ color, borderColor: color }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
