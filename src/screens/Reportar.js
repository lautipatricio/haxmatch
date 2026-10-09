import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { nombreDe, useStore } from '../data/store';
import { MOTIVOS_REPORTE } from '../domain/types';
import { Chips, Head } from '../ui';
export function Reportar() {
    const { userId = '' } = useParams();
    const s = useStore();
    const nav = useNavigate();
    const [motivo, setMotivo] = useState('No apareció');
    const [detalle, setDetalle] = useState('');
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const enviar = async () => {
        setOcupado(true);
        const e = await s.reportar({ reportado: userId, motivo, detalle });
        setOcupado(false);
        setError(e);
        if (!e)
            nav(-1);
    };
    const nombre = nombreDe(s, userId);
    const bloqueado = s.bloqueados.includes(userId);
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: `Reportar a ${nombre}`, back: true }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsx(Chips, { label: "Motivo", options: MOTIVOS_REPORTE, value: motivo, onChange: setMotivo }), _jsx("label", { className: "h sub", htmlFor: "detalle-reporte", children: "Detalle (opcional)" }), _jsx("textarea", { id: "detalle-reporte", className: "field", value: detalle, maxLength: 300, placeholder: "Contanos qu\u00E9 pas\u00F3", onChange: (e) => setDetalle(e.target.value) }), _jsx("div", { className: "m", children: "Los reportes los revisa el equipo de HaxMatch. Una cuenta reportada puede quedar suspendida." }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "grow", children: [_jsxs("div", { className: "strong", children: ["Bloquear a ", nombre] }), _jsx("div", { className: "m", children: s.bloqueosEnServidor
                                                ? 'No lo vas a ver en la cola, en el chat ni en Clips, y no puede escribirte, invitarte a su sala ni agregarte. Se desbloquea desde Amigos.'
                                                : 'No lo vas a ver en la cola, en el chat ni en Clips. Se desbloquea desde Amigos.' })] }), _jsx("button", { className: "switch", role: "switch", "aria-checked": bloqueado, "aria-label": `Bloquear a ${nombre}`, onClick: () => s.alternarBloqueo(userId) })] })] }) }), _jsxs("div", { className: "foot", style: { paddingBottom: 24 }, children: [_jsx("button", { className: "btn btn--lg", disabled: ocupado, onClick: () => void enviar(), children: ocupado ? 'Enviando…' : 'Enviar reporte' }), _jsx("button", { className: "btn btn--sec", onClick: () => nav(-1), children: "Cancelar" })] })] }));
}
