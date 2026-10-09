import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { buscarMia, useStore } from '../data/store';
import { CANCHAS_SALA, REGLAS_CANCHA, ajustarSala } from '../domain/rules';
import { REGIONES } from '../domain/types';
import { Chips, ChipsMulti, Head, TabBar } from '../ui';
/**
 * "Necesito un jugador". Primero se elige la cancha: de ella depende cuántos
 * pueden faltar y qué posiciones hay. En Classic (1 contra 1) no hay nada más
 * que elegir: falta uno.
 */
export function FormSala() {
    const perfil = useStore((s) => s.perfil);
    const mia = useStore(buscarMia);
    const crear = useStore((s) => s.crearBusqueda);
    const nav = useNavigate();
    const [cancha, setCancha] = useState(null);
    const [nombreSala, setNombreSala] = useState('');
    const [faltan, setFaltan] = useState(1);
    const [posicion, setPosicion] = useState(['Polifuncional']);
    const [region, setRegion] = useState(perfil?.region ?? ['ARG']);
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    if (mia)
        return _jsx(Navigate, { to: "/buscando", replace: true });
    const elegirCancha = (c) => {
        const a = ajustarSala(c, faltan, posicion);
        setCancha(c);
        setFaltan(a.faltan);
        setPosicion(a.posicion);
        setError(null);
    };
    const reglas = cancha ? REGLAS_CANCHA[cancha] : null;
    const lugares = reglas ? Array.from({ length: reglas.maxFaltan }, (_, i) => i + 1) : [];
    const buscar = async () => {
        if (!cancha)
            return setError('Elegí la cancha.');
        setOcupado(true);
        const e = await crear({ modo: 'sala', formato: null, posicion, cancha: [cancha], region, duracion: 'match', nombreSala, faltan });
        setOcupado(false);
        setError(e);
        if (!e)
            nav('/buscando');
    };
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Necesito un jugador", back: "/" }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsx("h2", { className: "h sub", children: "Cancha" }), _jsx("div", { className: "chips", role: "group", "aria-label": "Cancha", children: CANCHAS_SALA.map((c) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": c === cancha, onClick: () => elegirCancha(c), children: c }, c))) }), !cancha && _jsx("div", { className: "m", children: "Eleg\u00ED la cancha para seguir." }), cancha && reglas && (_jsxs(_Fragment, { children: [_jsx("label", { className: "h sub", htmlFor: "nombre-sala", children: "Nombre de la sala" }), _jsx("input", { id: "nombre-sala", className: "field", value: nombreSala, maxLength: 40, autoComplete: "off", placeholder: "Como figura en HaxBall", "aria-describedby": error ? 'error-sala' : undefined, onChange: (e) => { setNombreSala(e.target.value); setError(null); } }), reglas.maxFaltan > 1 && _jsx(Chips, { label: "Cu\u00E1ntos faltan", options: lugares, value: faltan, onChange: setFaltan }), reglas.posiciones.length > 0 && (_jsx(ChipsMulti, { label: "Posici\u00F3n que busc\u00E1s", options: reglas.posiciones, value: posicion, onChange: setPosicion, todas: "Polifuncional" })), cancha === 'Classic' && _jsx("div", { className: "m", children: "Classic es de a uno: busc\u00E1s un jugador, sin posici\u00F3n." }), _jsx(ChipsMulti, { label: "Regi\u00F3n", options: REGIONES, value: region, onChange: setRegion })] })), error && _jsx("div", { id: "error-sala", className: "err", role: "alert", children: error })] }) }), _jsx("div", { className: "foot", children: _jsx("button", { className: "btn btn--lg btn--block", disabled: ocupado || !cancha, onClick: () => void buscar(), children: ocupado ? 'Un momento…' : 'Buscar jugador' }) }), _jsx(TabBar, { on: "inicio" })] }));
}
