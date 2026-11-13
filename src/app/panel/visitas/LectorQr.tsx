"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (fuente: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type ConstructorDetector = new (opts: { formats: string[] }) => Detector;

/**
 * Lector de códigos QR con la cámara (API BarcodeDetector del navegador).
 * Si el navegador no la soporta o no hay cámara, permite escribir o pegar el código del carné.
 */
export function LectorQr({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const callback = useRef(onCodigo);
  callback.current = onCodigo;

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setAviso("Este navegador no puede leer QR con la cámara. Escriba el código del carné (TA-…).");
      return;
    }
    let activo = true;
    let flujo: MediaStream | undefined;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = flujo;
        await video.current.play();
        while (activo) {
          const r = await detector.detect(video.current).catch(() => []);
          if (r[0]?.rawValue) {
            activo = false;
            callback.current(r[0].rawValue);
            break;
          }
          await new Promise((res) => setTimeout(res, 300));
        }
      } catch {
        setAviso("No se pudo acceder a la cámara. Escriba el código del carné (TA-…).");
      }
    })();
    return () => {
      activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="tarjeta" style={{ marginTop: 10 }}>
      {!aviso && <video ref={video} muted playsInline style={{ width: "100%", maxWidth: 320, borderRadius: 6 }} aria-label="Vista de la cámara para leer el QR" />}
      {aviso && <p className="mensaje mensaje-info">{aviso}</p>}
      <form
        className="fila"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onCodigo(manual.trim());
        }}
      >
        <div className="campo">
          <label htmlFor="codigo-qr">Código del carné</label>
          <input id="codigo-qr" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="TA-XXXXXXXXXX" autoComplete="off" />
        </div>
        <button className="btn" type="submit">Usar código</button>
      </form>
    </div>
  );
}
