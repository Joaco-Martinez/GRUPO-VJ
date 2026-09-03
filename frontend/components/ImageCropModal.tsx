'use client';

import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { X, ZoomIn, Check } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (area: Area) => void;
}

export default function ImageCropModal({ imageSrc, onCancel, onConfirm }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <b>Ajustar imagen</b>

          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 320,
              background: '#111',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <ZoomIn size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '100%' }}
              aria-label="Zoom"
            />
          </div>

          <small style={{ display: 'block', marginTop: 10, color: 'var(--text3)' }}>
            Arrastrá la imagen para moverla y usá el control para hacer zoom. Se recorta en
            formato cuadrado (1:1), el mismo que se usa en el POS y la tienda online.
          </small>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancelar
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!croppedAreaPixels}
            onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels)}
          >
            <Check size={14} />
            Aplicar recorte
          </button>
        </div>
      </div>
    </div>
  );
}
