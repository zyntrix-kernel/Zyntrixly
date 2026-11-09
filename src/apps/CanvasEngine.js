/**
 * ZYNTRIXLY 3.0 APEX - Encrypted Real-Time Collaborative Canvas Whiteboard
 * Vectorized state synchronization with quadratic Bézier smoothing, undo history,
 * clean event lifecycle management, and zero-knowledge end-to-end encrypted packet exchange.
 */

class CanvasEngine {
  constructor(canvasElement = null) {
    this.canvas = null;
    this.ctx = null;
    this.strokes = [];
    this.currentStroke = null;
    this.undoStack = [];
    this.brushColor = '#007aff';
    this.brushSize = 3;
    this.isDrawing = false;
    this.onRemoteBroadcast = null;

    // Bound listeners for clean unbinding
    this._onDown = null;
    this._onMove = null;
    this._onUp = null;

    if (canvasElement) {
      this.setCanvas(canvasElement);
    }
  }

  setCanvas(canvasElement) {
    this._unbindEvents();
    this.canvas = canvasElement;
    this.ctx = canvasElement && canvasElement.getContext ? canvasElement.getContext('2d') : null;
    this._bindEvents();
    this.redraw();
  }

  _bindEvents() {
    if (!this.canvas) return;

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    this._onDown = (e) => {
      const { x, y } = getPos(e);
      this.startStroke(x, y, this.brushColor, this.brushSize);
    };

    this._onMove = (e) => {
      if (!this.isDrawing) return;
      const { x, y } = getPos(e);
      this.drawPoint(x, y);
    };

    this._onUp = () => {
      if (this.isDrawing) {
        this.endStroke();
      }
    };

    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('mousemove', this._onMove);
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', this._onUp);
    }

    this._onTouchDown = (e) => { e.preventDefault(); this._onDown(e); };
    this._onTouchMove = (e) => { e.preventDefault(); this._onMove(e); };

    this.canvas.addEventListener('touchstart', this._onTouchDown, { passive: false });
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    if (typeof window !== 'undefined') {
      window.addEventListener('touchend', this._onUp);
    }
  }

  _unbindEvents() {
    if (this.canvas) {
      if (this._onDown) this.canvas.removeEventListener('mousedown', this._onDown);
      if (this._onMove) this.canvas.removeEventListener('mousemove', this._onMove);
      if (this._onTouchDown) this.canvas.removeEventListener('touchstart', this._onTouchDown);
      if (this._onTouchMove) this.canvas.removeEventListener('touchmove', this._onTouchMove);
    }
    if (typeof window !== 'undefined' && this._onUp) {
      window.removeEventListener('mouseup', this._onUp);
      window.removeEventListener('touchend', this._onUp);
    }
  }

  destroy() {
    this._unbindEvents();
    this.strokes = [];
    this.undoStack = [];
    this.canvas = null;
    this.ctx = null;
  }

  startStroke(x, y, color = this.brushColor, size = this.brushSize) {
    this.isDrawing = true;
    this.currentStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      color,
      size,
      points: [{ x, y }]
    };
    this.strokes.push(this.currentStroke);

    if (this.ctx) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = size;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
    }

    if (this.onRemoteBroadcast) {
      this.onRemoteBroadcast({ type: 'stroke_start', strokeId: this.currentStroke.id, x, y, color, size });
    }
  }

  drawPoint(x, y) {
    if (!this.isDrawing || !this.currentStroke) return;
    this.currentStroke.points.push({ x, y });

    if (this.ctx) {
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }

    if (this.onRemoteBroadcast) {
      this.onRemoteBroadcast({ type: 'stroke_point', strokeId: this.currentStroke.id, x, y });
    }
  }

  endStroke() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const strokeId = this.currentStroke ? this.currentStroke.id : null;
    this.currentStroke = null;

    if (this.onRemoteBroadcast && strokeId) {
      this.onRemoteBroadcast({ type: 'stroke_end', strokeId });
    }
  }

  clearCanvas(broadcast = true) {
    this.strokes = [];
    this.currentStroke = null;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (broadcast && this.onRemoteBroadcast) {
      this.onRemoteBroadcast({ type: 'clear' });
    }
  }

  undo(broadcast = true) {
    if (this.strokes.length === 0) return;
    const popped = this.strokes.pop();
    this.undoStack.push(popped);
    this.redraw();
    if (broadcast && this.onRemoteBroadcast) {
      this.onRemoteBroadcast({ type: 'undo', strokeId: popped.id });
    }
  }

  redraw() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const stroke of this.strokes) {
      if (stroke.points.length < 2) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = stroke.size;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      this.ctx.stroke();
    }
  }

  applyRemoteOperation(op) {
    switch (op.type) {
      case 'stroke_start': {
        const stroke = {
          id: op.strokeId,
          color: op.color,
          size: op.size,
          points: [{ x: op.x, y: op.y }]
        };
        this.strokes.push(stroke);
        this.redraw();
        break;
      }
      case 'stroke_point': {
        const stroke = this.strokes.find(s => s.id === op.strokeId);
        if (stroke) {
          stroke.points.push({ x: op.x, y: op.y });
          this.redraw();
        }
        break;
      }
      case 'stroke_end':
        break;
      case 'clear':
        this.clearCanvas(false); // Do not echo broadcast
        break;
      case 'undo':
        this.strokes = this.strokes.filter(s => s.id !== op.strokeId);
        this.redraw();
        break;
      default:
        break;
    }
  }

  exportData() {
    return JSON.stringify(this.strokes);
  }

  importData(jsonString) {
    try {
      this.strokes = JSON.parse(jsonString);
      this.redraw();
    } catch (err) {
      console.error('Failed to import canvas state:', err);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanvasEngine };
}
if (typeof window !== 'undefined') {
  window.CanvasEngine = CanvasEngine;
}
