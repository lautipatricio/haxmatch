// Foto de perfil elegida de la galería del celular.
// Se recorta cuadrada y se achica antes de guardarla, para que pese poco.
// Con backend, el resultado se sube a Supabase Storage en lugar de guardarse en el dispositivo.

const LADO = 256
const PESO_MAXIMO = 20 * 1024 * 1024

function cargar(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => mal(new Error('imagen'))
    img.src = url
  })
}

/** Devuelve la foto lista para usar (JPEG cuadrado de 256 px), o tira un error con el motivo para mostrar. */
export async function prepararFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elegí una imagen.')
  if (archivo.size > PESO_MAXIMO) throw new Error('Esa imagen es muy pesada. Elegí una de menos de 20 MB.')
  const url = URL.createObjectURL(archivo)
  try {
    const img = await cargar(url)
    const lado = Math.min(img.naturalWidth, img.naturalHeight)
    if (!lado) throw new Error('imagen')
    const canvas = document.createElement('canvas')
    canvas.width = LADO
    canvas.height = LADO
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('imagen')
    // Recorte centrado: se queda con el cuadrado del medio.
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    throw new Error('No pudimos leer esa imagen. Probá con otra.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
