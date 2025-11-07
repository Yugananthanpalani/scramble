import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
  drawingData?: string;
  canDraw: boolean;
  onDrawingUpdate?: (data: string) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  drawingData,
  canDraw,
  onDrawingUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    if (drawingData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = drawingData;
    }
  }, [drawingData]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = isEraser ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || !canDraw) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas || !onDrawingUpdate) return;

    const dataUrl = canvas.toDataURL();
    onDrawingUpdate(dataUrl);
  };

  const clearCanvas = () => {
    if (!canDraw) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (onDrawingUpdate) {
      const dataUrl = canvas.toDataURL();
      onDrawingUpdate(dataUrl);
    }
  };

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-black">Drawing Board</h3>
        {canDraw && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEraser(!isEraser)}
              className={`p-2 rounded ${isEraser ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'} hover:opacity-80`}
              title="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 rounded bg-red-500 text-white hover:bg-red-600"
              title="Clear canvas"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className={`border-2 border-gray-300 rounded bg-white ${canDraw ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
        style={{ width: '100%', height: 'auto', aspectRatio: '4/3' }}
      />

      {canDraw && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Color:</span>
            <div className="flex space-x-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                  className={`w-6 h-6 rounded border-2 ${color === c && !isEraser ? 'border-gray-800' : 'border-gray-300'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Size:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 w-8">{lineWidth}px</span>
          </div>
        </div>
      )}
    </div>
  );
};
