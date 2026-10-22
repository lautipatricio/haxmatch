-- Pruebas de permisos (IDOR, RLS y funciones). Se corren contra la base y NO cambian nada:
-- todo pasa dentro de un bloque que termina con un error a propósito, así se revierte.
-- Cómo correrlas: pegar en el SQL Editor de Supabase. El mensaje de error trae el resultado.
-- Cada línea dice OK (bloqueado, como corresponde) o FALLA (algo que no debería poder hacerse).
do $$
declare
  ua uuid; otro uuid; out text := ''; n int; fallas int := 0;
  b_chat bigint; b_clip uuid; b_reel uuid; b_msg uuid; b_match uuid;
begin
  -- Usuario A: un jugador común (no admin). Los objetos "ajenos" son de otro jugador.
  select id into ua from public.profiles where onboarding and id not in (select user_id from public.admins) order by created_at limit 1;
  select id into otro from public.profiles where onboarding and id <> ua order by created_at desc limit 1;
  select id into b_chat from public.chat where user_id <> ua and borrado_at is null limit 1;
  select id into b_clip from public.clips_link where user_id <> ua limit 1;
  select id into b_reel from public.reels where user_id <> ua limit 1;
  select id into b_msg from public.mensajes where a <> ua limit 1;
  select id into b_match from public.matches where creado_por <> ua limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin perform public.chat_borrar(b_chat); out := out||E'\nFALLA borrar mensaje de chat ajeno'; fallas := fallas+1; exception when others then out := out||E'\nOK borrar chat ajeno: '||sqlerrm; end;
  begin perform public.borrar_clip(b_clip); out := out||E'\nFALLA borrar clip ajeno'; fallas := fallas+1; exception when others then out := out||E'\nOK borrar clip ajeno: '||sqlerrm; end;
  begin perform public.reel_visible(b_reel, false); out := out||E'\nFALLA ocultar video ajeno'; fallas := fallas+1; exception when others then out := out||E'\nOK ocultar video ajeno: '||sqlerrm; end;
  begin perform public.responder_mensaje(b_msg, true); out := out||E'\nFALLA responder mensaje dirigido a otro'; fallas := fallas+1; exception when others then out := out||E'\nOK responder mensaje ajeno: '||sqlerrm; end;
  begin perform public.admin_resumen(); out := out||E'\nFALLA panel de admin sin ser admin'; fallas := fallas+1; exception when others then out := out||E'\nOK panel admin: '||sqlerrm; end;
  begin perform public.admin_suspender(otro, 30, 'x'); out := out||E'\nFALLA suspender sin ser admin'; fallas := fallas+1; exception when others then out := out||E'\nOK suspender: '||sqlerrm; end;
  begin perform public.marcar_entro(otro); out := out||E'\nFALLA marcar entrada en sala ajena'; fallas := fallas+1; exception when others then out := out||E'\nOK marcar entrada ajena: '||sqlerrm; end;
  begin perform public.marcar_salio(otro, b_match); out := out||E'\nFALLA sacar jugador de partido ajeno'; fallas := fallas+1; exception when others then out := out||E'\nOK sacar de partido ajeno: '||sqlerrm; end;
  begin perform 1 from public.mensajes limit 1; out := out||E'\nFALLA leer la tabla mensajes'; fallas := fallas+1; exception when others then out := out||E'\nOK leer mensajes: '||sqlerrm; end;
  begin perform 1 from public.config_privada limit 1; out := out||E'\nFALLA leer config_privada'; fallas := fallas+1; exception when others then out := out||E'\nOK leer config_privada: '||sqlerrm; end;
  begin perform 1 from public.push_suscripciones limit 1; out := out||E'\nFALLA leer suscripciones push'; fallas := fallas+1; exception when others then out := out||E'\nOK leer push: '||sqlerrm; end;
  begin perform discord_id from public.profiles limit 1; out := out||E'\nFALLA leer discord_id'; fallas := fallas+1; exception when others then out := out||E'\nOK leer discord_id: '||sqlerrm; end;
  begin update public.profiles set puntos = 99999 where id = ua; out := out||E'\nFALLA darse puntos'; fallas := fallas+1; exception when others then out := out||E'\nOK darse puntos: '||sqlerrm; end;
  begin update public.profiles set nick = 'hack' where id = otro; get diagnostics n = row_count;
    if n = 0 then out := out||E'\nOK cambiar nick ajeno: 0 filas'; else out := out||E'\nFALLA cambiar nick ajeno'; fallas := fallas+1; end if;
    exception when others then out := out||E'\nOK cambiar nick ajeno: '||sqlerrm; end;
  -- Arreglo 16.2
  begin update public.profiles set foto_url = 'https://sitio-malo.com/rastreo.gif' where id = ua;
    out := out||E'\nFALLA poner foto con dirección cualquiera'; fallas := fallas+1;
    exception when others then out := out||E'\nOK foto con dirección cualquiera: '||sqlerrm; end;
  begin perform public.kick_lista('secreto-falso-de-mas-de-treinta-y-dos-letras'); out := out||E'\nFALLA kick_lista con clave falsa'; fallas := fallas+1; exception when others then out := out||E'\nOK kick_lista clave falsa: '||sqlerrm; end;
  begin perform public.guardar_suscripcion('https://169.254.169.254/latest', repeat('a', 87), repeat('b', 22)); out := out||E'\nFALLA suscripción push a dirección interna (SSRF)'; fallas := fallas+1; exception when others then out := out||E'\nOK SSRF push: '||sqlerrm; end;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.tiktok_llaves('x', ua, '{}'::jsonb); out := out||E'\nFALLA anónimo guarda llaves de TikTok'; fallas := fallas+1; exception when others then out := out||E'\nOK anónimo tiktok_llaves: '||sqlerrm; end;
  begin perform public.mi_perfil(); out := out||E'\nFALLA anónimo lee perfil'; fallas := fallas+1; exception when others then out := out||E'\nOK anónimo mi_perfil: '||sqlerrm; end;
  begin perform 1 from public.profiles limit 1; out := out||E'\nFALLA anónimo lee profiles'; fallas := fallas+1; exception when others then out := out||E'\nOK anónimo profiles: '||sqlerrm; end;
  -- Arreglo 16.1
  begin perform public.rls_auto_enable(); out := out||E'\nFALLA anónimo llama rls_auto_enable'; fallas := fallas+1;
    exception when insufficient_privilege then out := out||E'\nOK anónimo rls_auto_enable: sin permiso';
    when others then out := out||E'\nFALLA anónimo puede llamar rls_auto_enable ('||sqlerrm||')'; fallas := fallas+1; end;

  raise exception E'RESULTADO: % fallas (todo revertido)%', fallas, out;
end $$;
