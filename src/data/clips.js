import { tokenDeSesion } from './cuenta';
import { YO } from './seed';
import { SUPABASE_URL } from './supabase';
import { SIN_BASE, rpc } from './transporte';
function colorDe(id) {
    const colores = ['#5B8C7A', '#8C7A5B', '#7A5B8C', '#5B6F8C', '#8C5B62', '#6F8C5B', '#8C6A5B', '#5B8C8A', '#8C825B'];
    let n = 0;
    for (const c of id)
        n = (n * 31 + c.charCodeAt(0)) >>> 0;
    return colores[n % colores.length];
}
let conNiveles = true;
let sinNiveles = 0;
export async function leerClips(miId) {
    // Con el paso 5 viene además el nivel de cada autor. Sin él, los clips andan igual.
    let r = conNiveles ? await rpc('clips_completo') : { error: SIN_BASE };
    if (r.error === SIN_BASE) {
        conNiveles = ++sinNiveles % 10 === 0;
        r = await rpc('clips');
    }
    if (!r.data)
        return { error: r.error };
    const e = r.data;
    const id = (u) => (u === miId ? YO : u);
    const usuarios = {};
    const porId = new Map();
    const base = (f) => ({
        id: f.id, origen: 'tiktok', titulo: f.titulo, hashtags: f.hashtags ?? [], publicadoAt: Date.parse(f.publicado_at),
        tiktokId: f.tiktok_id, enlace: f.enlace ?? undefined, duracion: f.duracion ?? undefined,
        portada: f.portada?.startsWith('https://') ? f.portada : undefined,
    });
    for (const f of e.feed ?? []) {
        const foto = f.foto !== null && SUPABASE_URL
            ? `${SUPABASE_URL}/storage/v1/object/public/avatares/${f.user_id}/foto.jpg?v=${encodeURIComponent(f.foto)}`
            : null;
        usuarios[id(f.user_id)] = { id: id(f.user_id), username: f.nick, discord: f.username, nivel: typeof f.nivel === 'number' ? f.nivel : null, color: colorDe(f.user_id), foto };
        // En pantalla se muestra "las de los demás + la mía", así que acá va sin la mía.
        porId.set(f.id, { ...base(f), userId: id(f.user_id), visible: true, reacciones: f.reacciones - (f.reaccione ? 1 : 0) });
    }
    for (const m of e.mios ?? []) {
        const enFeed = porId.get(m.id);
        porId.set(m.id, { ...base(m), userId: YO, visible: m.visible, inicial: m.inicial, reacciones: enFeed?.reacciones ?? m.reacciones });
    }
    return {
        clips: {
            reels: [...porId.values()],
            misReacciones: (e.feed ?? []).filter((f) => f.reaccione).map((f) => f.id),
            usuarios,
            tiktok: e.tiktok ? { nombre: e.tiktok.nombre, sincronizadaAt: e.tiktok.sincronizada_at ? Date.parse(e.tiktok.sincronizada_at) : null, error: e.tiktok.error } : null,
        },
    };
}
const hacer = async (nombre, args = {}) => (await rpc(nombre, args)).error ?? null;
export const clipsApi = {
    visible: (reel, visible) => hacer('reel_visible', { p_reel: reel, p_visible: visible }),
    reaccionar: (reel, marcar) => hacer('reaccionar', { p_reel: reel, p_marcar: marcar }),
    actualizar: () => hacer('tiktok_actualizar'),
    desvincular: () => hacer('tiktok_desvincular'),
    /**
     * Le pide a TikTok los videos nuevos de las cuentas vinculadas. Devuelve a cuántas
     * se les pidió (después hay que esperar unos segundos y volver a leer), o el problema.
     */
    refrescar: async () => {
        const r = await rpc('clips_refrescar');
        // Si la base todavía no tiene esta función, se sigue con lo que hay.
        if (r.error)
            return r.error === SIN_BASE ? { pedidas: 0 } : { pedidas: 0, error: r.error };
        return { pedidas: Number(r.data) || 0 };
    },
};
/** ¿La web ya tiene cargadas las claves de TikTok? */
export async function tiktokHabilitado() {
    try {
        const r = await fetch('/api/tiktok/estado', { cache: 'no-store' });
        return (await r.json()).configurado === true;
    }
    catch {
        return false;
    }
}
/**
 * Empieza la vinculación: si todo va bien, la página se va a TikTok y vuelve
 * sola a "Mis videos". Devuelve el problema si no se pudo empezar.
 */
export async function irATikTok() {
    const sesion = await tokenDeSesion();
    if (!sesion)
        return 'Primero entrá con Discord.';
    try {
        const r = await fetch('/api/tiktok/entrar', { method: 'POST', headers: { Authorization: `Bearer ${sesion}` }, cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d.url || !d.url.startsWith('https://www.tiktok.com/'))
            return d.error ?? 'No pudimos empezar la vinculación. Probá de nuevo.';
        window.location.assign(d.url);
        return null;
    }
    catch {
        return 'No pudimos conectar con el servidor. Revisá tu internet e intentá de nuevo.';
    }
}
/** Qué decirle al usuario cuando vuelve de TikTok (?tiktok=...). */
export const RESULTADO_TIKTOK = {
    ok: { ok: true, texto: 'TikTok vinculado. Importamos tus videos: los que tienen #haxball o #haxmatch ya están en Clips.' },
    cancelado: { ok: false, texto: 'No se vinculó: no diste el permiso en TikTok.' },
    vencido: { ok: false, texto: 'La vinculación tardó demasiado o se abrió en otro navegador. Probá de nuevo.' },
    ocupada: { ok: false, texto: 'Esa cuenta de TikTok ya está vinculada a otro usuario de HaxMatch.' },
    permiso: { ok: false, texto: 'Para mostrar tus clips hace falta el permiso de ver tus videos. Probá de nuevo y dejalo marcado.' },
    error: { ok: false, texto: 'No pudimos vincular tu cuenta de TikTok. Probá de nuevo.' },
};
