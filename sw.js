// [PWA OFFLINE-FIRST] Identificador único de versión de caché para invalidación controlada en Service Worker
const CACHE_NAME = 'vgms-abogados-v1';

// [PWA OFFLINE-FIRST] Lista de archivos locales esenciales de la arquitectura Un Solo Código Base
const LOCAL_ASSETS = [
  './', // [PWA] Ruta raíz del directorio actual
  './index.html', // [PWA] Documento HTML5 principal de la aplicación jurídica
  './styles.css', // [PWA] Hoja de estilos Mobile-First con tokens 60-30-10
  './script.js', // [PWA] Lógica principal, RBAC, filtros y validaciones
  './manifest.json' // [PWA] Manifiesto de aplicación instalable
];

// [PWA OFFLINE-FIRST] Recursos externos CDN cacheados para operación offline (jQuery, Font Awesome y DOMPurify)
const CDN_ASSETS = [
  'https://code.jquery.com/jquery-3.7.1.min.js', // [JQUERY] Librería DOM y eventos
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css', // [ICONOGRAFÍA] Iconos vectoriales Font Awesome
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js' // [ANTI-XSS] Sanitizador HTML DOMPurify
];

// [PWA INSTALL] Evento de instalación del Service Worker: precarga el App Shell en Cache Storage
self.addEventListener('install', (event) => {
  event.waitUntil( // [PWA INSTALL] Mantiene la fase de instalación abierta hasta completar el caché
    caches.open(CACHE_NAME).then((cache) => { // [PWA CACHE] Abre o crea el almacén de caché versionado
      CDN_ASSETS.forEach((url) => { // [PWA CDN] Recorre cada librería externa declarada
        cache.add(url).catch(() => { // [PWA RESILIENCIA] Cachea el recurso CDN sin abortar si falla la red
          console.log('[PWA VGMS] Recurso CDN omitido en precaché inicial:', url); // [PWA LOG] Registra advertencia controlada
        });
      });
      return cache.addAll(LOCAL_ASSETS); // [PWA APP SHELL] Guarda de forma atómica todos los archivos locales
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

// [PWA FETCH] Interceptor de red: Network-Only para API REST PHP/MySQL y Cache-First para activos estáticos
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) { // [PWA NETWORK-ONLY] Excluye endpoints PHP/MySQL para garantizar datos en vivo
    return; // [PWA NETWORK-ONLY] Permite que la petición vaya directo al servidor backend
  }

  if (event.request.method !== 'GET') return; // [PWA SEGURIDAD] Solo cachea peticiones HTTP idempotentes GET

  event.respondWith( // [PWA CACHE-FIRST] Intercepta la respuesta HTTP con estrategia Cache-First
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
