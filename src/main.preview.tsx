// Entrada de la vista previa: sin fuentes locales ni service worker,
// y con navegación en memoria porque corre dentro de una página publicada.
import './styles.css'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <App />
  </MemoryRouter>,
)
