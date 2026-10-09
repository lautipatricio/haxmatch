import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { recortarFoto } from '../data/foto';
/** Lado del recuadro de encuadre, en píxeles de pantalla. */
const VISOR = 280;
const ZOOM_MAX = 4;
/**
 * Encuadre de la foto de perfil: se arrastra para mover y se hace zoom con el
 * control, pellizcando o con la rueda. La foto siempre cubre todo el círculo.
 */
export function Recortador({ foto, onGuardar, onCancelar }) {
    const ancho = foto.img.naturalWidth;
    const alto = foto.img.naturalHeight;
    // Escala mínima: el lado más corto de la imagen ocupa justo el visor.
    const base = VISOR / Math.min(ancho, alto);
    const [e, setE] = useState({ zoom: 1, x: 0, y: 0 });
    const [error, setError] = useState(null);
    const punteros = useRef(new Map());
    const pinza = useRef(null);
    /** Mantiene el zoom en rango y la imagen cubriendo todo el visor. */
    const ajustar = (n) => {
        const zoom = Math.min(ZOOM_MAX, Math.max(1, n.zoom));
        const maxX = (ancho * base * zoom - VISOR) / 2;
        const maxY = (alto * base * zoom - VISOR) / 2;
        return { zoom, x: Math.min(maxX, Math.max(-maxX, n.x)), y: Math.min(maxY, Math.max(-maxY, n.y)) };
    };
    const cambiar = (f) => setE((v) => ajustar(f(v)));
    const distancia = () => {
        const [a, b] = [...punteros.current.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const alApoyar = (ev) => {
        ev.currentTarget.setPointerCapture(ev.pointerId);
        punteros.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (punteros.current.size === 2)
            pinza.current = { dist: distancia(), zoom: e.zoom };
    };
    const alMover = (ev) => {
        const antes = punteros.current.get(ev.pointerId);
        if (!antes)
            return;
        punteros.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (punteros.current.size === 1) {
            const dx = ev.clientX - antes.x;
            const dy = ev.clientY - antes.y;
            cambiar((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }
        else if (punteros.current.size === 2 && pinza.current) {
            const p = pinza.current;
            const zoom = p.zoom * (distancia() / p.dist);
            cambiar((v) => ({ ...v, zoom }));
        }
    };
    const alSoltar = (ev) => {
        punteros.current.delete(ev.pointerId);
        if (punteros.current.size < 2)
            pinza.current = null;
    };
    const alGirarRueda = (ev) => cambiar((v) => ({ ...v, zoom: v.zoom - ev.deltaY * 0.002 }));
    const alTeclear = (ev) => {
        const paso = 12;
        const mover = { ArrowLeft: [paso, 0], ArrowRight: [-paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] };
        if (mover[ev.key]) {
            ev.preventDefault();
            const [dx, dy] = mover[ev.key];
            cambiar((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }
        else if (ev.key === '+' || ev.key === '-') {
            cambiar((v) => ({ ...v, zoom: v.zoom + (ev.key === '+' ? 0.2 : -0.2) }));
        }
    };
    const escala = base * e.zoom;
    const w = ancho * escala;
    const h = alto * escala;
    const guardar = () => {
        try {
            // Del visor a la imagen original: qué cuadrado quedó adentro del recuadro.
            onGuardar(recortarFoto(foto.img, (w / 2 - e.x - VISOR / 2) / escala, (h / 2 - e.y - VISOR / 2) / escala, VISOR / escala));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos preparar la foto. Probá de nuevo.');
        }
    };
    return (_jsxs("div", { className: "recorte", role: "dialog", "aria-label": "Ajustar foto de perfil", children: [_jsx("h1", { className: "h title", children: "Ajustar foto" }), _jsx("div", { className: "m center", children: "Arrastr\u00E1 para moverla y acerc\u00E1 hasta que quede como quer\u00E9s." }), _jsxs("div", { className: "recorte__visor", style: { width: VISOR, height: VISOR }, tabIndex: 0, "aria-label": "Encuadre de la foto. Us\u00E1 las flechas para moverla y m\u00E1s o menos para el zoom", onPointerDown: alApoyar, onPointerMove: alMover, onPointerUp: alSoltar, onPointerCancel: alSoltar, onWheel: alGirarRueda, onKeyDown: alTeclear, children: [_jsx("img", { src: foto.url, alt: "", draggable: false, style: { width: w, height: h, left: VISOR / 2 - w / 2 + e.x, top: VISOR / 2 - h / 2 + e.y } }), _jsx("div", { className: "recorte__circulo" })] }), _jsxs("div", { className: "recorte__zoom", children: [_jsx("label", { className: "m", htmlFor: "zoom-foto", children: "Zoom" }), _jsx("input", { id: "zoom-foto", type: "range", min: 1, max: ZOOM_MAX, step: 0.01, value: e.zoom, onChange: (ev) => cambiar((v) => ({ ...v, zoom: Number(ev.target.value) })) })] }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsxs("div", { className: "recorte__acciones", children: [_jsx("button", { className: "btn btn--lg", onClick: guardar, children: "Guardar foto" }), _jsx("button", { className: "btn btn--sec", onClick: onCancelar, children: "Cancelar" })] })] }));
}
