import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { APP_URL, REAL } from '../config';
import { YO, useStore } from '../data/store';
import { AMISTOSOS_REFERIDO, PUNTOS } from '../domain/rules';
import { Avatar, Head, Icon, TabBar, copiar } from '../ui';
export function Referir() {
    const s = useStore();
    const [aviso, setAviso] = useState(null);
    const codigo = s.perfil?.codigo ?? '';
    const link = APP_URL ? `${APP_URL}/?ref=${codigo}` : '';
    const invitacion = link
        ? `Sumate a HaxMatch para armar amistosos de HaxBall: ${link}`
        : `Sumate a HaxMatch para armar amistosos de HaxBall. Usá mi código ${codigo} al entrar.`;
    const puntos = s.puntosServidor
        ? s.puntosServidor.deReferidos
        : s.eventos.filter((e) => e.userId === YO && e.tipo === 'referido').reduce((t, e) => t + e.puntos, 0);
    const completos = s.referidos.filter((r) => r.acreditado).length;
    const copiarTexto = async (texto, ok) => {
        setAviso((await copiar(texto)) ? ok : 'No se pudo copiar. Mantené apretado el texto para copiarlo.');
    };
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Refer\u00ED amigos", back: "/perfil" }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsxs("div", { children: ["Sum\u00E1s ", PUNTOS.referido, " puntos cuando tu amigo entra con Discord y juega ", AMISTOSOS_REFERIDO, " amistosos confirmados."] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "m", children: "Tu c\u00F3digo" }), _jsx("div", { className: "h num", style: { fontSize: 34, letterSpacing: '.06em', userSelect: 'all', overflowWrap: 'anywhere' }, children: codigo })] }), _jsxs("button", { className: "btn", onClick: () => copiarTexto(codigo, 'Código copiado.'), children: [_jsx(Icon, { name: "copiar", size: 18 }), "Copiar"] })] }), link ? (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "m", children: "Tu link" }), _jsx("div", { className: "strong", style: { overflowWrap: 'anywhere', userSelect: 'all' }, children: link })] }), _jsx("button", { className: "btn btn--sec", onClick: () => copiarTexto(link, 'Link copiado.'), children: "Copiar" })] })) : (_jsx("div", { className: "m", children: "Tu link de referido se arma con la direcci\u00F3n de la app cuando est\u00E9 publicada." })), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn btn--sec grow", onClick: () => copiarTexto(invitacion, 'Invitación copiada. Pegala en Discord.'), children: "Compartir por Discord" }), _jsx("a", { className: "btn btn--sec grow", href: `https://wa.me/?text=${encodeURIComponent(invitacion)}`, target: "_blank", rel: "noopener noreferrer", children: "Compartir por WhatsApp" })] }), aviso && _jsx("div", { className: "ok", role: "status", children: aviso }), _jsxs("div", { className: "stats", style: { marginTop: 8 }, children: [_jsxs("div", { className: "stat", children: [_jsx("div", { className: "h num", children: completos }), _jsx("div", { className: "m", children: "amigos referidos" })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "h num", children: puntos }), _jsx("div", { className: "m", children: "puntos ganados" })] })] }), _jsx("h2", { className: "h sub", children: "Tus referidos" }), s.referidos.length === 0 && (_jsx("div", { className: "m", children: REAL && !s.puntosServidor
                                ? 'Quien entre con tu código queda anotado como referido tuyo. La lista y los puntos se van a ver acá en una próxima actualización.'
                                : 'Todavía no referiste a nadie. Quien entre con tu código o tu link aparece acá.' })), s.referidos.map((r) => (_jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { user: s.usuarios[r.userId] }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong cut", children: s.usuarios[r.userId]?.username ?? 'Jugador' }), _jsx("div", { className: "m", children: !r.acreditado
                                                ? `Va ${r.amistosos} de ${AMISTOSOS_REFERIDO} amistosos · todavía no suma`
                                                : r.puntos === 0
                                                    ? `Completó ${AMISTOSOS_REFERIDO} amistosos · ese mes ya habías llegado al tope`
                                                    : `Completó ${AMISTOSOS_REFERIDO} amistosos · +${r.puntos ?? PUNTOS.referido} puntos` })] })] }, r.userId))), !REAL && s.referidos.some((r) => !r.acreditado) && (_jsxs("div", { className: "demo", children: [_jsx("div", { className: "h", children: "Herramienta de prueba" }), s.referidos.filter((r) => !r.acreditado).map((r) => (_jsxs("button", { className: "btn btn--sec", onClick: () => s.simularAmistosoReferido(r.userId), children: ["Simular que ", s.usuarios[r.userId]?.username ?? 'Jugador', " juega un amistoso"] }, r.userId)))] }))] }) }), _jsx(TabBar, { on: "perfil" })] }));
}
