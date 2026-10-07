// Foto de perfil elegida de la galería del celular.
// El usuario la encuadra (mover y zoom) y se guarda siempre cuadrada y del
// mismo tamaño, para que todas las fotos se vean igual y pesen poco.
// Con backend, el resultado se sube a Supabase Storage en lugar de guardarse en el dispositivo.

/** Lado en píxeles de la foto guardada. */
export const LADO_FOTO = 256
const PESO_MAXIMO = 20 * 1024 * 1024

export interface FotoElegida {
  img: HTMLImageElement
  /** Dirección temporal de la imagen. Hay que liberarla con soltarFoto al terminar. */
  url: string
}

/** Lee la imagen elegida. Tira un error con el motivo para mostrarle al usuario. */
export function cargarFoto(archivo: File): Promise<FotoElegida> {
  if (!archivo.type.startsWith('image/')) return Promise.reject(new Error('Elegí una imagen.'))
  if (archivo.size > PESO_MAXIMO) return Promise.reject(new Error('Esa imagen es muy pesada. Elegí una de menos de 20 MB.'))
  const url = URL.createObjectURL(archivo)
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) ok({ img, url })
      else { URL.revokeObjectURL(url); mal(new Error('No pudimos leer esa imagen. Probá con otra.')) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No pudimos leer esa imagen. Probá con otra.')) }
    img.src = url
  })
}

export function soltarFoto(f: FotoElegida) {
  URL.revokeObjectURL(f.url)
}

/**
 * Recorta un cuadrado de la imagen original (x, y y lado en píxeles de la
 * imagen) y lo devuelve como JPEG de LADO_FOTO x LADO_FOTO.
 */
export function recortarFoto(img: HTMLImageElement, x: number, y: number, lado: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = LADO_FOTO
  canvas.height = LADO_FOTO
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No pudimos preparar la foto. Probá de nuevo.')
  ctx.drawImage(img, x, y, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO)
  return canvas.toDataURL('image/jpeg', 0.85)
}
