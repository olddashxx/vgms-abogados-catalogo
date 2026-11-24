// [PWA OFFLINE-FIRST] Identificador único de versión de caché para invalidación controlada en Service Worker
const CACHE_NAME = 'vgms-abogados-v4';

// [PWA OFFLINE-FIRST] Lista de archivos locales esenciales incluyendo catálogo JSON para fetch offline
const LOCAL_ASSETS = [
  './', // [PWA] Ruta raíz del directorio actual
  './index.html', // [PWA] Documento HTML5 principal de VGMS Abogados
  './styles.css', // [PWA] Hoja de estilos corporativa v4
  './script.js', // [PWA] Lógica frontend, pestañas SPA, fetch, filtros y validación
  './manifest.json', // [PWA] Manifiesto de aplicación instalable
  './data/servicios.json' // [PWA FETCH] Catálogo jurídico JSON consumido por Fetch API
];

// [PWA OFFLINE-FIRST] Recursos externos CDN cacheados para operación offline (jQuery y DOMPurify)
const CDN_ASSETS = [
  'https://code.jquery.com/jquery-3.7.1.min.js', // [JQUERY] Librería DOM, efectos y eventos
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css', // [ICONOGRAFÍA] Iconos vectoriales Font Awesome
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js' // [ANTI-XSS] Sanitizador HTML DOMPurify
];

// [PWA INSTALL] Evento de instalación del Service Worker: precarga el App Shell y el JSON en Cache Storage
self.addEventListener('install', (event) => {
  event.waitUntil( // [PWA INSTALL] Mantiene la fase de instalación abierta hasta completar el caché
    caches.open(CACHE_NAME).then((cache) => { // [PWA CACHE] Abre o crea el almacén de caché versionado
      CDN_ASSETS.forEach((url) => { // [PWA CDN] Recorre cada librería externa declarada
        cache.add(url).catch(() => { // [PWA RESILIENCIA] Cachea el recurso CDN sin abortar si falla la red
          console.log('[PWA VGMS] Recurso CDN omitido en precaché inicial:', url); // [PWA LOG] Registra advertencia controlada
        });
      });
      return cache.addAll(LOCAL_ASSETS); // [PWA APP SHELL] Guarda de forma atómica los archivos locales y servicios.json
    })
  );
  self.skipWaiting(); // [PWA LIFECYCLE] Fuerza la activación inmediata del nuevo Service Worker
});

// [PWA ACTIVATE] Evento de activación: purga versiones antiguas de caché para liberar almacenamiento
self.addEventListener('activate', (event) => {
  event.waitUntil( // [PWA ACTIVATE] Espera a que concluya la limpieza de cachés obsoletas
    caches.keys().then((keys) => // [PWA CACHE] Obtiene todas las claves almacenadas en Cache Storage
      Promise.all( // [PWA ASYNC] Ejecuta todas las eliminaciones en paralelo
        keys
          .filter((key) => key !== CACHE_NAME) // [PWA VERSIONADO] Filtra cualquier versión distinta a la vigente
          .map((oldKey) => caches.delete(oldKey)) // [PWA LIMPIEZA] Elimina cada caché obsoleta
      )
    )
  );
  self.clients.claim(); // [PWA LIFECYCLE] Toma control inmediato de todas las pestañas abiertas
});

// [PWA FETCH] Interceptor de red: estrategia pura Cache-First con actualización dinámica y respaldo offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // [PWA SEGURIDAD] Solo cachea peticiones HTTP idempotentes GET

  event.respondWith( // [PWA CACHE-FIRST] Intercepta peticiones GET con estrategia Cache-First
    caches.match(event.request).then((cachedResponse) => { // [PWA CACHE] Busca coincidencia previa en Cache Storage
      if (cachedResponse) { // [PWA CACHE HIT] Verifica si el recurso ya existe en caché local
        return cachedResponse; // [PWA CACHE HIT] Devuelve el recurso instantáneamente sin depender de internet
      }

      return fetch(event.request) // [PWA NETWORK FALLBACK] Solicita el recurso a la red cuando no está cacheado
        .then((networkResponse) => { // [PWA CACHE UPDATE] Procesa la respuesta obtenida desde red
          if (networkResponse && networkResponse.status === 200) { // [PWA VALIDACIÓN] Valida código HTTP 200 OK antes de guardar
            const responseClone = networkResponse.clone(); // [PWA STREAM] Clona el flujo de respuesta para leerlo dos veces
            caches.open(CACHE_NAME).then((cache) => { // [PWA CACHE] Abre el almacén activo
              cache.put(event.request, responseClone); // [PWA CACHE] Almacena dinámicamente el nuevo recurso
            });
          }
          return networkResponse; // [PWA RESPUESTA] Entrega la respuesta de red al navegador
        })
        .catch(() => { // [PWA OFFLINE FALLBACK] Captura fallos de red cuando el usuario está sin conexión
          if (event.request.mode === 'navigate') { // [PWA NAVEGACIÓN] Comprueba si la petición corresponde a navegación HTML
            return caches.match('./index.html'); // [PWA OFFLINE] Retorna la aplicación principal cacheada
          }
        });
    })
  );
});
