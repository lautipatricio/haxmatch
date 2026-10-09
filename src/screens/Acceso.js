import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ERROR_DE_INGRESO, REAL, REF_INICIAL } from '../config';
import { useStore } from '../data/store';
import { REGIONES } from '../domain/types';
import { Avatar, ChipsMulti, Head, Icon } from '../ui';
export function Ingresar() {
    const entrar = useStore((s) => s.entrarConDiscord);
    const nav = useNavigate();
    // Si llegó por un link de referido, arranca con el código ya cargado.
    const [conCodigo, setConCodigo] = useState(REF_INICIAL !== '');
    const [codigo, setCodigo] = useState(REF_INICIAL);
    const [error, setError] = useState(ERROR_DE_INGRESO ? 'No se completó el ingreso con Discord. Probá de nuevo.' : null);
    const [ocupado, setOcupado] = useState(false);
    // Con servidor, entrar manda a Discord y la página vuelve sola ya con la sesión.
    // En modo demostración entra en el momento y sigue al registro.
    const ingresar = async (codigoAmigo) => {
        setOcupado(true);
        const problema = await entrar(codigoAmigo);
        setError(problema);
        if (problema)
            setOcupado(false);
        else if (useStore.getState().perfil)
            nav('/bienvenida');
    };
    const registrar = (e) => {
        e.preventDefault();
        // El código se valida antes de pasar al registro.
        void ingresar(codigo);
    };
    return (_jsx("div", { className: "screen", children: _jsxs("div", { className: "scroll", children: [_jsxs("div", { className: "portada", children: [_jsxs("div", { className: "hero", style: { gap: 14 }, children: [_jsxs("h1", { className: "h logo", children: ["Hax", _jsx("br", {}), _jsx("span", { children: "Match" })] }), _jsx("div", { className: "m", children: "Amistosos de HaxBall, sin vueltas" })] }), conCodigo ? (_jsxs("form", { className: "foot", onSubmit: registrar, children: [_jsx("label", { className: "h sub", htmlFor: "codigo-amigo", children: "C\u00F3digo de un amigo" }), _jsx("input", { id: "codigo-amigo", className: "field", value: codigo, placeholder: REAL ? 'Ej.: HXA2B3' : 'Ej.: NICO23', autoCapitalize: "characters", autoComplete: "off", maxLength: 12, autoFocus: true, "aria-describedby": error ? 'ingreso-error' : undefined, onChange: (e) => { setCodigo(e.target.value); setError(null); } }), error && _jsx("div", { id: "ingreso-error", className: "err", role: "alert", children: error }), _jsx("button", { className: "btn btn--lg btn--block", type: "submit", disabled: ocupado, children: ocupado ? 'Un momento…' : 'Continuar' }), _jsx("button", { className: "btn btn--sec btn--block", type: "button", disabled: ocupado, onClick: () => { setConCodigo(false); setError(null); }, children: "Volver" })] })) : (_jsxs("div", { className: "foot", children: [error && _jsx("div", { className: "err center", role: "alert", children: error }), _jsx("button", { className: "btn btn--lg btn--block", disabled: ocupado, onClick: () => void ingresar(), children: ocupado ? 'Abriendo Discord…' : 'Entrar con Discord' }), _jsx("button", { className: "btn btn--sec btn--block", style: { minHeight: 52 }, disabled: ocupado, onClick: () => { setConCodigo(true); setError(null); }, children: "Registrarme con el c\u00F3digo de un amigo" }), _jsx("p", { className: "m center", style: { margin: 0 }, children: REAL
                                        ? 'Encontrá jugadores de HaxBall, armá amistosos y mirá los clips de la comunidad.'
                                        : 'Versión de prueba: el ingreso está simulado y los demás jugadores son inventados.' }), _jsxs("p", { className: "m center", style: { margin: 0 }, children: ["Al entrar acept\u00E1s los ", _jsx("a", { href: "/terminos", children: "T\u00E9rminos" }), " y la ", _jsx("a", { href: "/privacidad", children: "Pol\u00EDtica de privacidad" }), "."] })] })), _jsxs("button", { type: "button", className: "btn btn--ghost portada__mas", onClick: () => document.getElementById('que-es')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), children: ["Qu\u00E9 es HaxMatch ", _jsx(Icon, { name: "abajo", size: 18 })] })] }), _jsxs("div", { className: "pad sobre", id: "que-es", children: [_jsxs("section", { children: [_jsx("h2", { className: "h", children: "Para jugar m\u00E1s amistosos" }), _jsx("p", { children: "HaxMatch es una app gratuita para la comunidad de HaxBall. Te junta con otros jugadores para armar amistosos en el momento, sin andar preguntando en diez servidores de Discord, y re\u00FAne los clips que sube la comunidad." })] }), _jsxs("section", { children: [_jsx("h2", { className: "h", children: "C\u00F3mo funciona" }), _jsxs("ol", { className: "pasos", children: [_jsxs("li", { children: [_jsx("span", { className: "strong", children: "Entr\u00E1s con tu cuenta de Discord." }), _jsx("span", { className: "m", children: "Eleg\u00EDs tu nick y tu regi\u00F3n. No pedimos contrase\u00F1a ni mail." })] }), _jsxs("li", { children: [_jsx("span", { className: "strong", children: "Toc\u00E1s \u201CQuiero jugar un amistoso\u201D." }), _jsx("span", { className: "m", children: "Qued\u00E1s en la cola, a la vista de las salas a las que les falta gente." })] }), _jsxs("li", { children: [_jsx("span", { className: "strong", children: "O abr\u00EDs tu sala y eleg\u00EDs a qui\u00E9n invitar." }), _jsx("span", { className: "m", children: "Dec\u00EDs qu\u00E9 posici\u00F3n te falta y en qu\u00E9 cancha. Al jugador le llega la invitaci\u00F3n y, si acepta, entra." })] }), _jsxs("li", { children: [_jsx("span", { className: "strong", children: "Juegan en HaxBall y confirman el partido." }), _jsx("span", { className: "m", children: "Cada amistoso confirmado suma puntos y te hace subir de nivel." })] })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "h", children: "Clips de la comunidad" }), _jsxs("p", { children: ["Si vincul\u00E1s tu cuenta de TikTok, tus videos p\u00FAblicos con ", _jsx("strong", { children: "#haxball" }), " o ", _jsx("strong", { children: "#haxmatch" }), " aparecen en la secci\u00F3n Clips, con tu nombre de TikTok, para que los vea y reaccione el resto de la comunidad."] }), _jsxs("ul", { className: "steps m", children: [_jsx("li", { children: "Solo leemos tu nombre de TikTok y la lista de tus videos p\u00FAblicos." }), _jsx("li", { children: "Los videos se reproducen desde TikTok: no los copiamos ni publicamos nada en tu cuenta." }), _jsx("li", { children: "Pod\u00E9s ocultar cualquier video, o desvincular tu cuenta cuando quieras: se borra todo lo que trajimos." })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "h", children: "Amigos, niveles y avisos" }), _jsx("p", { children: "Agreg\u00E1 amigos para enterarte cuando se ponen a buscar partido, sum\u00E1 puntos por jugar y por entrar seguido, y recib\u00ED un aviso en el celular o en la computadora cuando una sala te invita." })] }), _jsxs("footer", { className: "m", children: [_jsx("p", { children: "HaxMatch es un proyecto independiente de la comunidad. No est\u00E1 afiliado a HaxBall, Discord ni TikTok." }), _jsxs("p", { children: [_jsx("a", { href: "/terminos", children: "T\u00E9rminos y condiciones" }), " \u00B7 ", _jsx("a", { href: "/privacidad", children: "Pol\u00EDtica de privacidad" }), " \u00B7", ' ', _jsx("a", { href: "mailto:lpatriciogauna@outlook.com", children: "Contacto" })] })] })] })] }) }));
}
export function Onboarding() {
    const perfil = useStore((s) => s.perfil);
    const usuarios = useStore((s) => s.usuarios);
    const completar = useStore((s) => s.completarOnboarding);
    const nav = useNavigate();
    const [nick, setNick] = useState('');
    const [region, setRegion] = useState(perfil?.region.length ? perfil.region : ['ARG']);
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const invito = perfil?.invitoNick ?? (perfil?.referidoPor ? usuarios[perfil.referidoPor]?.username : null);
    // Lo que se va a usar si no escribe un nick.
    const sugerido = REAL ? perfil?.nick : perfil?.username;
    const empezar = async () => {
        setOcupado(true);
        const e = await completar({ nick: nick.trim() || sugerido || '', region });
        setError(e);
        setOcupado(false);
        if (!e)
            nav('/');
    };
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Bienvenido" }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsx("label", { className: "h sub", htmlFor: "nick", children: "Tu nick (opcional)" }), _jsx("input", { id: "nick", className: "field", value: nick, placeholder: sugerido, autoComplete: "off", maxLength: 20, "aria-describedby": "nick-ayuda", onChange: (e) => { setNick(e.target.value); setError(null); } }), _jsxs("div", { id: "nick-ayuda", className: "m", children: ["Es el nombre que aparece en tu perfil. Si lo dej\u00E1s vac\u00EDo, usamos ", REAL ? 'tu nombre de Discord' : 'tu usuario de Discord', "."] }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsxs("div", { className: "card", children: [_jsx(Avatar, { nombre: nick.trim() || sugerido }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "Discord conectado" }), _jsxs("div", { className: "m cut", children: [perfil?.username, invito && ` · te invitó ${invito}`] })] }), _jsx("span", { style: { color: 'var(--accent)' }, children: _jsx(Icon, { name: "check" }) })] }), _jsx("div", { children: "Tu nivel empieza en 0 y sube con tu actividad en la app." }), _jsx(ChipsMulti, { label: "Regi\u00F3n", options: REGIONES, value: region, onChange: setRegion }), _jsx("div", { className: "m", children: "Pod\u00E9s marcar m\u00E1s de una regi\u00F3n. La posici\u00F3n la eleg\u00EDs cada vez que busc\u00E1s un amistoso o un jugador." })] }) }), _jsx("div", { className: "foot", style: { paddingBottom: 24 }, children: _jsx("button", { className: "btn btn--lg btn--block", disabled: ocupado, onClick: () => void empezar(), children: ocupado ? 'Guardando…' : 'Empezar' }) })] }));
}
