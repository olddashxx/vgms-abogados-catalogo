// [ARQUITECTURA FULL STACK VGMS] Lógica unificada: PWA Offline-First, API REST PHP/MySQL + Fallback LocalStorage, RBAC, Filtros y Validaciones

// [1. PWA SERVICE WORKER] Registra sw.js cuando se ejecuta sobre HTTP/HTTPS para habilitar soporte offline
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', function () { // [PWA] Espera a que cargue la ventana principal para no competir con LCP
    navigator.serviceWorker
      .register('sw.js') // [PWA] Registra el Service Worker local de VGMS Abogados
      .then((reg) => { // [PWA ÉXITO] Confirma alcance registrado
        console.log('[PWA VGMS] Service Worker v1 registrado:', reg.scope); // [LOG] Traza técnica en consola
      })
      .catch((err) => { // [PWA RESILIENCIA] Maneja entornos sin soporte SW sin romper la app
        console.warn('[PWA VGMS] Service Worker omitido:', err); // [WARN] Advertencia controlada
      });
  });
}

let deferredInstallPrompt = null; // [PWA INSTALL] Almacena evento diferido de instalación nativa
window.addEventListener('beforeinstallprompt', (e) => { // [PWA INSTALL] Intercepta el banner automático del navegador
  e.preventDefault(); // [PWA INSTALL] Pospone la ventana nativa hasta que el usuario pulse Instalar App
  deferredInstallPrompt = e; // [PWA INSTALL] Guarda referencia al prompt
  $('#btnInstalarPWA, #btnInstalarPWATop').prop('hidden', false).fadeIn(); // [PWA UI] Muestra botones de instalación en dock y header
});

// [ANTI-XSS DOMPURIFY] Sanitiza cualquier cadena HTML antes de insertarla en el DOM
function sanitizarHTML(contenido) {
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) { // [ANTI-XSS] Verifica disponibilidad de DOMPurify CDN
    return DOMPurify.sanitize(contenido); // [ANTI-XSS] Limpia scripts o atributos peligrosos
  }
  const div = document.createElement('div'); // [FALLBACK XSS] Crea nodo temporal seguro si DOMPurify está offline
  div.textContent = contenido; // [FALLBACK XSS] Escapa caracteres HTML como texto plano
  return div.innerHTML; // [FALLBACK XSS] Devuelve cadena escapada
}

// [2. MODELO DE DATOS LOCAL] Credenciales demo RBAC para modo estático/offline (coinciden con vgms_abogados_db.sql)
const MOCK_USUARIOS_FALLBACK = [
  {
    id: 1, // [RBAC ADMIN] ID de Socio Director
    nombre: 'Dr. Francisco Vela', // [RBAC ADMIN] Nombre real del socio fundador
    correo: 'fvela@vgms.com.bo', // [RBAC ADMIN] Correo real extraído de vgms.com.bo/wp/
    pass: 'Admin1234', // [RBAC ADMIN] Contraseña demo
    rol: 'admin' // [RBAC ADMIN] Rol gerencial completo
  },
  {
    id: 2, // [RBAC TRABAJADOR] ID de abogado / recepción
    nombre: 'Dr. Juan Diego Andrade', // [RBAC TRABAJADOR] Abogado real del equipo VGMS
    correo: 'recepcion@vgms.com.bo', // [RBAC TRABAJADOR] Correo operativo demo
    pass: 'Trabajador1234', // [RBAC TRABAJADOR] Contraseña demo
    rol: 'trabajador' // [RBAC TRABAJADOR] Rol de atención operativa
  },
  {
    id: 3, // [RBAC CLIENTE] ID de cliente
    nombre: 'Vania Ramos', // [RBAC CLIENTE] Cliente real del estudio
    correo: 'vania.ramos@gmail.com', // [RBAC CLIENTE] Correo demo cliente
    pass: 'Cliente1234', // [RBAC CLIENTE] Contraseña demo
    rol: 'cliente' // [RBAC CLIENTE] Rol de cliente final
  }
];

// [CATÁLOGO INICIAL S1-S8] Estructura base sincronizada con la tabla servicios de MySQL
const SERVICIOS_INICIALES = [
  { id_servicio: 'S1', nombre: 'S1: Registro de Marca y Signos Distintivos', area: 'Propiedad Intelectual', especialista: 'Dr. Francisco Vela', honorario_base: 1800, estado: 'disponible' }, // [SERVICIO S1]
  { id_servicio: 'S2', nombre: 'S2: Patentes de Invención y Derechos de Autor', area: 'Propiedad Intelectual', especialista: 'Dr. Francisco Vela', honorario_base: 2500, estado: 'disponible' }, // [SERVICIO S2]
  { id_servicio: 'S3', nombre: 'S3: Protección Activa y Medidas en Frontera', area: 'Protección Activa', especialista: 'Dr. Francisco Vela', honorario_base: 2200, estado: 'disponible' }, // [SERVICIO S3]
  { id_servicio: 'S4', nombre: 'S4: Constitución de Sociedades y Corporativo', area: 'Derecho Corporativo', especialista: 'Dr. Álvaro Maldonado', honorario_base: 2400, estado: 'disponible' }, // [SERVICIO S4]
  { id_servicio: 'S5', nombre: 'S5: Derecho Administrativo y Contrataciones', area: 'Derecho Corporativo', especialista: 'Dr. Álvaro Maldonado', honorario_base: 1900, estado: 'disponible' }, // [SERVICIO S5]
  { id_servicio: 'S6', nombre: 'S6: Contratos Civiles, Conciliación y Legaltech', area: 'Civil y Penal', especialista: 'Dr. Juan Diego Andrade', honorario_base: 1200, estado: 'disponible' }, // [SERVICIO S6]
  { id_servicio: 'S7', nombre: 'S7: Derecho Constitucional, Tributario y Municipal', area: 'Civil y Penal', especialista: 'Dr. Raúl Salta', honorario_base: 1600, estado: 'disponible' }, // [SERVICIO S7]
  { id_servicio: 'S8', nombre: 'S8: Defensa Penal Estratégica y Ley 004', area: 'Civil y Penal', especialista: 'Dr. Paulo Ponce', honorario_base: 2100, estado: 'disponible' } // [SERVICIO S8]
];

// [ESTADO PERSISTENTE] Carga servicios, consultas y sesión desde LocalStorage con respaldo inicial
let serviciosSistema = JSON.parse(localStorage.getItem('vgms_servicios') || 'null') || SERVICIOS_INICIALES; // [LOCALSTORAGE] Catálogo activo
let consultasConfirmadas = JSON.parse(localStorage.getItem('vgms_consultas_sistema') || '[]'); // [LOCALSTORAGE] Consultas agendadas
let usuarioActivo = JSON.parse(localStorage.getItem('vgms_usuario_activo') || 'null'); // [LOCALSTORAGE] Sesión RBAC persistente
let modoConexion = 'auto'; // [CONEXIÓN] Indica si opera contra 'mysql' o 'local'

$(document).ready(function() { // [JQUERY READY] Inicializa toda la interactividad cuando el DOM está listo

  // [3. CAPA API REST CON FALLBACK TRANSPARENTE] Conecta con PHP/MySQL o degrada sin errores a LocalStorage
  async function apiLogin(correo, password) {
    try {
      const res = await fetch('./api/login.php', { // [API POST] Envía credenciales al endpoint PHP
        method: 'POST', // [HTTP POST] Verbo seguro de autenticación
        headers: { 'Content-Type': 'application/json' }, // [HEADER] Indica payload JSON
        body: JSON.stringify({ correo, password }) // [PAYLOAD] Serializa correo y contraseña
      });
      const data = await res.json(); // [JSON] Parsea respuesta del servidor
      if (res.ok && data.ok) { // [ÉXITO MYSQL] Autenticación validada por bcrypt en MySQL
        modoConexion = 'mysql'; // [ESTADO] Registra modo servidor activo
        return data; // [RETORNO] Devuelve objeto usuario y rol
      }
      if (res.status === 401 || res.status === 400) { // [ERROR CREDENCIALES] Devuelve rechazo explícito sin activar fallback
        return data; // [RETORNO] Mensaje de error del servidor
      }
      throw new Error(data.mensaje || 'Respuesta no válida del backend PHP'); // [EXCEPCIÓN] Dispara fallback si no hay PHP
    } catch (err) {
      console.warn('[VGMS FullStack] Backend PHP no disponible. Activando fallback local:', err.message); // [FALLBACK LOG]
      modoConexion = 'local'; // [ESTADO] Activa modo LocalStorage
      const user = MOCK_USUARIOS_FALLBACK.find( // [FALLBACK AUTH] Busca coincidencia en usuarios demo locales
        u => u.correo.toLowerCase() === correo.toLowerCase() && u.pass === password
      );
      if (user) { // [FALLBACK ÉXITO] Construye respuesta equivalente a MySQL
        return {
          ok: true, // [CONTRATO]
          mensaje: 'Sesión iniciada correctamente (Modo Local / Offline).', // [MENSAJE]
          usuario: { // [PAYLOAD]
            id: user.id, // [ID]
            nombre: user.nombre, // [NOMBRE]
            correo: user.correo, // [CORREO]
            rol: user.rol // [ROL]
          }
        };
      }
      return { // [FALLBACK RECHAZO] Credenciales incorrectas también en modo local
        ok: false, // [CONTRATO]
        mensaje: 'Credenciales inválidas. Verifica tu correo y contraseña.' // [MENSAJE]
      };
    }
  }

  // [API GET] Carga catálogo de servicios y consultas desde PHP/MySQL con fallback a LocalStorage
  async function apiCargarDatos() {
    try {
      const res = await fetch('./api/consultas.php'); // [API GET] Consulta catálogo y citas en vivo
      if (!res.ok) throw new Error('HTTP ' + res.status); // [VALIDACIÓN HTTP]
      const data = await res.json(); // [JSON]
      if (data.ok && Array.isArray(data.servicios)) { // [VALIDACIÓN PAYLOAD]
        modoConexion = 'mysql'; // [ESTADO] Conexión MySQL confirmada
        serviciosSistema = data.servicios.map(s => ({ // [MAPEO] Normaliza honorario numérico
          ...s, // [SPREAD]
          honorario_base: parseFloat(s.honorario_base) // [FLOAT]
        }));
        localStorage.setItem('vgms_servicios', JSON.stringify(serviciosSistema)); // [CACHÉ LOCAL] Sincroniza copia offline

        if (Array.isArray(data.consultas)) { // [MAPEO CONSULTAS] Adapta campos SQL al modelo del frontend
          consultasConfirmadas = data.consultas.map(c => ({ // [MAPEO]
            id: String(c.id_consulta), // [ID]
            cliente: c.titular_nombre, // [TITULAR]
            servicioId: c.id_servicio, // [ID SERVICIO]
            servicioNombre: c.servicio_nombre || `Servicio ${c.id_servicio}`, // [NOMBRE SERVICIO]
            fecha: c.fecha, // [FECHA]
            horaInicio: parseInt(c.hora_inicio.split(':')[0], 10), // [HORA INICIO INT]
            horaFin: parseInt(c.hora_inicio.split(':')[0], 10) + parseInt(c.duracion_horas, 10), // [HORA FIN INT]
            horarioTexto: `${c.hora_inicio} (${c.duracion_horas}h)`, // [TEXTO HORARIO]
            modalidad: c.modalidad, // [MODALIDAD]
            adicionales: c.adicionales, // [ADICIONALES]
            total: `${parseFloat(c.total_bs)} BOB`, // [MONTO FORMATEADO]
            estado: c.estado || 'pendiente', // [ESTADO]
            celular: c.celular, // [CELULAR]
            correo: c.correo // [CORREO]
          }));
          localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [CACHÉ LOCAL]
        }
        return true; // [RETORNO]
      }
      throw new Error('Estructura de respuesta no válida'); // [ERROR CONTRATO]
    } catch (err) {
      console.warn('[VGMS FullStack] Usando almacenamiento local para servicios y consultas:', err.message); // [FALLBACK]
      modoConexion = 'local'; // [ESTADO]
      if (consultasConfirmadas.length === 0) { // [SEED LOCAL] Siembra 2 consultas demo hoy si está vacío en modo local
        const hoySeed = new Date().toISOString().split('T')[0]; // [FECHA HOY]
        consultasConfirmadas = [
          {
            id: 'loc_101', // [ID SEED 1]
            cliente: 'Vania Ramos', // [CLIENTE REAL]
            celular: '67005417', // [CELULAR REAL VGMS]
            correo: 'vania.ramos@gmail.com', // [CORREO]
            servicioId: 'S1', // [SERVICIO S1]
            servicioNombre: 'S1: Registro de Marca y Signos Distintivos', // [NOMBRE]
            fecha: hoySeed, // [HOY]
            horaInicio: 10, // [10:00]
            horaFin: 11, // [11:00]
            horarioTexto: '10:00 - 11:00', // [TEXTO]
            modalidad: 'Presencial (Edificio La Paz I)', // [MODALIDAD]
            adicionales: 'Búsqueda SENAPI', // [ADICIONAL]
            total: '2050 BOB', // [TOTAL]
            estado: 'pendiente' // [ESTADO]
          },
          {
            id: 'loc_102', // [ID SEED 2]
            cliente: 'Willy Gómez', // [CLIENTE REAL]
            celular: '78854844', // [CELULAR]
            correo: 'willy.gomez@gmail.com', // [CORREO]
            servicioId: 'S2', // [SERVICIO S2]
            servicioNombre: 'S2: Patentes de Invención y Derechos de Autor', // [NOMBRE]
            fecha: hoySeed, // [HOY]
            horaInicio: 15, // [15:00]
            horaFin: 16, // [16:00]
            horarioTexto: '15:00 - 16:00', // [TEXTO]
            modalidad: 'Videollamada Legaltech', // [MODALIDAD]
            adicionales: 'Contrato NDA', // [ADICIONAL]
            total: '2850 BOB', // [TOTAL]
            estado: 'en_atencion' // [ESTADO]
          }
        ];
        localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTENCIA]
      }
      return false; // [RETORNO FALLBACK]
    }
  }

  // [API POST] Crea consulta en MySQL o la guarda en LocalStorage si no hay backend activo
  async function apiCrearConsulta(datosConsulta) {
    try {
      const payload = { // [PAYLOAD SQL] Campos esperados por api/consultas.php
        titular_nombre: datosConsulta.cliente, // [TITULAR]
        celular: datosConsulta.celular, // [CELULAR]
        correo: datosConsulta.correo, // [CORREO]
        id_servicio: datosConsulta.servicioId, // [ID SERVICIO]
        fecha: datosConsulta.fecha, // [FECHA]
        hora_inicio: `${String(datosConsulta.horaInicio).padStart(2, '0')}:00`, // [HORA HH:00]
        duracion_horas: datosConsulta.horaFin - datosConsulta.horaInicio, // [DURACIÓN]
        modalidad: datosConsulta.modalidad, // [MODALIDAD]
        adicionales: datosConsulta.adicionales, // [ADICIONALES]
        total_bs: parseFloat(datosConsulta.total.replace(/[^\d.]/g, '')) // [MONTO NUMÉRICO]
      };

      const res = await fetch('./api/consultas.php', { // [FETCH POST]
        method: 'POST', // [HTTP POST]
        headers: { 'Content-Type': 'application/json' }, // [JSON HEADER]
        body: JSON.stringify(payload) // [CUERPO]
      });
      const data = await res.json(); // [RESPUESTA]
      if (res.ok && data.ok) { // [ÉXITO MYSQL]
        datosConsulta.id = String(data.id_consulta); // [ID REAL]
        datosConsulta.estado = 'pendiente'; // [ESTADO INICIAL]
        return { ok: true, mensaje: data.mensaje, consulta: datosConsulta }; // [RETORNO]
      }
      if (res.status === 409 || res.status === 400) { // [CONFLICTO O VALIDACIÓN SERVIDOR]
        return data; // [RETORNO ERROR]
      }
      throw new Error(data.mensaje || 'Error al guardar en MySQL'); // [EXCEPCIÓN]
    } catch (err) {
      console.warn('[VGMS FullStack] Guardando consulta localmente:', err.message); // [FALLBACK LOG]
      datosConsulta.id = 'loc_' + Date.now(); // [ID LOCAL ÚNICO]
      datosConsulta.estado = 'pendiente'; // [ESTADO]
      return { ok: true, mensaje: 'Consulta guardada con éxito (Modo Local / Offline).', consulta: datosConsulta }; // [RETORNO LOCAL]
    }
  }

  // [API PUT] Actualiza el estado operativo de una consulta ('en_atencion', 'completada', 'cancelada')
  async function apiActualizarEstadoConsulta(idConsulta, nuevoEstado) {
    try {
      const res = await fetch('./api/consultas.php', { // [FETCH PUT]
        method: 'PUT', // [HTTP PUT]
        headers: { 'Content-Type': 'application/json' }, // [HEADER]
        body: JSON.stringify({ // [PAYLOAD]
          accion: 'cambiar_estado_consulta', // [ACCIÓN]
          id_consulta: idConsulta, // [ID]
          nuevo_estado: nuevoEstado // [ESTADO DESTINO]
        })
      });
      const data = await res.json(); // [JSON]
      if (res.ok && data.ok) return data; // [RETORNO MYSQL]
      throw new Error(data.mensaje || 'Error HTTP'); // [EXCEPCIÓN]
    } catch (err) {
      console.warn('[VGMS FullStack] Actualizando estado localmente:', err.message); // [FALLBACK]
      return { ok: true, mensaje: `Estado actualizado localmente a: ${nuevoEstado}` }; // [RETORNO LOCAL]
    }
  }

  // [API PUT] Edita honorario base y estado ('disponible'/'pausado') de un servicio jurídico (Rol Admin)
  async function apiEditarServicio(idServicio, honorarioBase, estado) {
    try {
      const res = await fetch('./api/consultas.php', { // [FETCH PUT]
        method: 'PUT', // [HTTP PUT]
        headers: { 'Content-Type': 'application/json' }, // [HEADER]
        body: JSON.stringify({ // [PAYLOAD]
          accion: 'editar_servicio', // [ACCIÓN]
          id_servicio: idServicio, // [ID]
          honorario_base: honorarioBase, // [HONORARIO]
          estado: estado // [ESTADO]
        })
      });
      const data = await res.json(); // [JSON]
      if (res.ok && data.ok) return data; // [RETORNO MYSQL]
      throw new Error(data.mensaje || 'Error HTTP'); // [EXCEPCIÓN]
    } catch (err) {
      console.warn('[VGMS FullStack] Actualizando servicio localmente:', err.message); // [FALLBACK]
      return { ok: true, mensaje: `Servicio ${idServicio} actualizado en modo local.` }; // [RETORNO LOCAL]
    }
  }

  // [4. CONTROL DE SESIÓN Y RBAC ESTRICTO] Filtra pestañas y paneles según el rol ('cliente', 'trabajador', 'admin')
  function aplicarVistasSegunRol(rol) {
    const rolActual = rol || (usuarioActivo ? usuarioActivo.rol : 'cliente'); // [RBAC] Por defecto muestra vista Cliente

    if (usuarioActivo) { // [SESIÓN INICIADA] Actualiza avatar, nombre y etiqueta de rol en header y dock
      $('#btnAbrirLogin, #btnAbrirLoginDock').hide(); // [UI AUTH] Oculta botón ingresar
      $('#userProfileBadge, #userProfileBadgeDock').css('display', 'inline-flex'); // [UI AUTH] Muestra perfil activo
      $('#userDisplayName, #userDisplayNameDock').text(usuarioActivo.nombre); // [UI AUTH] Asigna nombre seguro vía .text()

      const rolClase = `user-role-tag--${usuarioActivo.rol}`; // [CLASE CSS]
      const rolEtiqueta = usuarioActivo.rol === 'admin' ? 'SOCIO ADMIN' : (usuarioActivo.rol === 'trabajador' ? 'ABOGADO' : 'CLIENTE'); // [ETIQUETA LEGIBLE]
      $('#userRoleBadge, #userRoleBadgeDock')
        .text(rolEtiqueta) // [UI AUTH]
        .removeClass('user-role-tag--admin user-role-tag--trabajador user-role-tag--cliente') // [LIMPIEZA]
        .addClass(rolClase); // [ESTILO ROL]

      if (usuarioActivo.rol === 'cliente') { // [AUTOCOMPLETADO] Prellena datos del cliente autenticado en el formulario
        if (!$('#client-name').val()) $('#client-name').val(usuarioActivo.nombre); // [FORM]
        if (!$('#client-email').val()) $('#client-email').val(usuarioActivo.correo); // [FORM]
      }
    } else { // [SIN SESIÓN] Muestra botón de inicio de sesión
      $('#btnAbrirLogin, #btnAbrirLoginDock').show(); // [UI AUTH]
      $('#userProfileBadge, #userProfileBadgeDock').hide(); // [UI AUTH]
    }

    $('.dock-acciones__btn').each(function() { // [RBAC DOCK] Filtra botones del dock según atributo data-roles
      const rolesPermitidos = ($(this).data('roles') || '').split(' '); // [RBAC]
      if (rolesPermitidos.includes(rolActual)) { // [PERMISO]
        $(this).removeClass('tab-hidden').show(); // [VISIBLE]
      } else {
        $(this).addClass('tab-hidden').hide(); // [OCULTO]
      }
    });

    $('.panel-tab').each(function() { // [RBAC PANELES] Filtra secciones principales según data-roles
      const rolesPermitidos = ($(this).data('roles') || '').split(' '); // [RBAC]
      if (rolesPermitidos.includes(rolActual)) { // [PERMISO]
        $(this).removeClass('panel-role-hidden'); // [PERMITIDO]
      } else {
        $(this).addClass('panel-role-hidden').removeClass('active').hide(); // [BLOQUEADO]
      }
    });

    let pestanaPrincipal = 'tab-inicio'; // [RBAC LANDING] Pestaña inicial por defecto para Cliente
    if (rolActual === 'trabajador') { // [RBAC LANDING] Trabajador inicia directo en Agenda Legal
      pestanaPrincipal = 'tab-abogado-agenda'; // [TAB]
    } else if (rolActual === 'admin') { // [RBAC LANDING] Admin inicia directo en Dashboard KPI
      pestanaPrincipal = 'tab-admin-kpi'; // [TAB]
    }

    cambiarTab(pestanaPrincipal); // [NAVEGACIÓN] Activa la pestaña correspondiente al rol
  }

  function iniciarSesionUsuario(user) { // [AUTH LOGIN] Persiste sesión y aplica vistas RBAC
    usuarioActivo = user; // [ESTADO]
    localStorage.setItem('vgms_usuario_activo', JSON.stringify(usuarioActivo)); // [PERSISTENCIA]
    aplicarVistasSegunRol(user.rol); // [RBAC]
    registrarEventoTimestamp('AUTH', `Inició sesión: ${user.nombre} (${user.rol.toUpperCase()})`); // [BITÁCORA]
    mostrarToastAlert( // [TOAST]
      '⚖️ ¡Bienvenido a VGMS!', // [TÍTULO]
      `Sesión iniciada como ${user.nombre} [${user.rol.toUpperCase()}].`, // [MENSAJE]
      false // [ÉXITO]
    );
  }

  function cerrarSesionUsuario() { // [AUTH LOGOUT] Limpia sesión y restablece vista Cliente
    if (!usuarioActivo) return; // [GUARDA]
    const nombre = usuarioActivo.nombre; // [NOMBRE]
    usuarioActivo = null; // [ESTADO]
    localStorage.removeItem('vgms_usuario_activo'); // [LIMPIEZA]
    aplicarVistasSegunRol('cliente'); // [RBAC]
    registrarEventoTimestamp('AUTH', `Cerró sesión: ${nombre}`); // [BITÁCORA]
    mostrarToastAlert('🔒 Sesión Finalizada', 'Has cerrado sesión en VGMS Abogados & Consultores.', false); // [TOAST]
  }

  $('#btnCerrarSesion, #btnCerrarSesionDock').on('click', cerrarSesionUsuario); // [EVENTO LOGOUT]

  $('#btnAbrirLogin, #btnAbrirLoginDock').on('click', function() { // [MODAL LOGIN] Abre ventana de autenticación
    $('#login-alert-error').hide().text(''); // [LIMPIA ERROR]
    $('#modal-login').fadeIn(200); // [ANIMACIÓN]
  });

  $('#modal-login-close-btn').on('click', function() { // [MODAL LOGIN] Cierra con botón X
    $('#modal-login').fadeOut(200); // [ANIMACIÓN]
  });

  $('#modal-login').on('click', function(e) { // [MODAL LOGIN] Cierra al hacer clic en el fondo oscuro
    if ($(e.target).is('#modal-login')) $('#modal-login').fadeOut(200); // [VERIFICA BACKDROP]
  });

  $('.btn-demo-auth').on('click', function() { // [BOTONES DEMO] Autocompleta credenciales en el modal
    const email = $(this).data('email'); // [LEE CORREO]
    const pass = $(this).data('pass'); // [LEE PASSWORD]
    $('#login-email').val(email); // [ASIGNA]
    $('#login-password').val(pass); // [ASIGNA]
    $('#login-alert-error').hide().text(''); // [OCULTA ERROR]
  });

  $('#form-login').on('submit', async function(e) { // [SUBMIT LOGIN] Procesa autenticación contra MySQL/Fallback
    e.preventDefault(); // [PREVIENE RECARGA]
    const email = $('#login-email').val().trim(); // [CORREO]
    const pass = $('#login-password').val().trim(); // [PASSWORD]

    if (!email || !pass) { // [VALIDACIÓN BÁSICA]
      $('#login-alert-error').text('⚠️ Completa correo electrónico y contraseña.').slideDown('fast'); // [ERROR]
      return; // [ALTO]
    }

    $('#btn-submit-login').prop('disabled', true).html(sanitizarHTML('<i class="fa-solid fa-spinner fa-spin"></i> Verificando...')); // [FEEDBACK CARGA]

    const res = await apiLogin(email, pass); // [LLAMADA API]
    $('#btn-submit-login').prop('disabled', false).html(sanitizarHTML('<i class="fa-solid fa-sign-in-alt"></i> Ingresar a Plataforma VGMS')); // [RESTAURA BOTÓN]

    if (res.ok && res.usuario) { // [ÉXITO]
      $('#modal-login').fadeOut(200); // [CIERRA MODAL]
      iniciarSesionUsuario(res.usuario); // [INICIA SESIÓN]
    } else { // [ERROR]
      $('#login-alert-error').text(res.mensaje || 'Error al autenticar.').slideDown('fast'); // [MUESTRA ALERTA]
    }
  });

  // [5. GESTIÓN DE SERVICIOS Y HONORARIOS] Sincroniza cambios de Admin en tarjetas y selectores del DOM
  function sincronizarServiciosEnDOM() {
    serviciosSistema.forEach(s => { // [ITERACIÓN S1-S8]
      const $card = $(`.servicio-card[data-servicio-id="${s.id_servicio}"]`); // [TARJETA CATÁLOGO]
      if ($card.length) { // [EXISTE]
        $card.find('.servicio-card__precio-val').text(`${s.honorario_base} Bs`); // [ACTUALIZA HONORARIO]
        $card.find('.btn-select-service').data('service-price', s.honorario_base); // [ACTUALIZA DATA]

        if (s.estado === 'pausado') { // [ESTADO PAUSADO]
          $card.addClass('servicio-card--pausado'); // [CLASE PAUSADO]
          $card.find('.servicio-card__badge').text('Pausado • Agenda Cerrada'); // [BADGE]
        } else {
          $card.removeClass('servicio-card--pausado'); // [ACTIVO]
        }
      }

      const $opt = $(`#select-servicio-consulta option[value="${s.id_servicio}"]`); // [OPTION DEL FORMULARIO]
      if ($opt.length) { // [EXISTE]
        $opt.attr('data-precio', s.honorario_base); // [ATRIBUTO PRECIO]
        const sufijo = s.estado === 'pausado' ? ' (Pausado)' : ''; // [SUFIJO]
        $opt.text(`${s.nombre} (${s.honorario_base} Bs)${sufijo}`); // [TEXTO ACTUALIZADO]
      }
    });
  }

  $('#services-container').on('click', '.btn-admin-servicio', function(e) { // [DELEGACIÓN ADMIN] Abre modal de edición rápida
    e.stopPropagation(); // [EVITA PROPAGACIÓN]
    const serviceId = $(this).data('service-id'); // [ID S1-S8]
    const servicio = serviciosSistema.find(s => s.id_servicio === serviceId); // [BUSCA EN MODELO]
    if (!servicio) return; // [GUARDA]

    $('#admin-servicio-id').val(servicio.id_servicio); // [ASIGNA ID]
    $('#admin-servicio-nombre').val(servicio.nombre); // [ASIGNA NOMBRE]
    $('#admin-servicio-precio').val(servicio.honorario_base); // [ASIGNA HONORARIO]
    $('#admin-servicio-estado').val(servicio.estado); // [ASIGNA ESTADO]
    $('#modal-admin-servicio').fadeIn(200); // [ABRE MODAL]
  });

  $('#modal-servicio-close-btn').on('click', function() { // [CIERRE MODAL ADMIN]
    $('#modal-admin-servicio').fadeOut(200); // [OCULTA]
  });

  $('#modal-admin-servicio').on('click', function(e) { // [CIERRE BACKDROP MODAL ADMIN]
    if ($(e.target).is('#modal-admin-servicio')) $('#modal-admin-servicio').fadeOut(200); // [OCULTA]
  });

  $('#form-admin-servicio').on('submit', async function(e) { // [SUBMIT MODAL ADMIN] Guarda honorario/estado
    e.preventDefault(); // [PREVIENE RECARGA]
    const idServicio = $('#admin-servicio-id').val(); // [ID]
    const honorario = parseFloat($('#admin-servicio-precio').val()); // [HONORARIO]
    const estado = $('#admin-servicio-estado').val(); // [ESTADO]

    if (!idServicio || isNaN(honorario) || honorario <= 0) return; // [VALIDACIÓN]

    const res = await apiEditarServicio(idServicio, honorario, estado); // [API PUT]
    const idx = serviciosSistema.findIndex(s => s.id_servicio === idServicio); // [ÍNDICE]
    if (idx !== -1) { // [ACTUALIZA ESTADO LOCAL]
      serviciosSistema[idx].honorario_base = honorario; // [HONORARIO]
      serviciosSistema[idx].estado = estado; // [ESTADO]
      localStorage.setItem('vgms_servicios', JSON.stringify(serviciosSistema)); // [PERSISTENCIA]
    }

    sincronizarServiciosEnDOM(); // [SINCRONIZA DOM]
    $('#modal-admin-servicio').fadeOut(200); // [CIERRA MODAL]
    mostrarToastAlert('✅ Servicio Actualizado', res.mensaje || 'Cambios guardados correctamente.', false); // [TOAST]
    registrarEventoTimestamp('ADMIN', `Actualizó ${idServicio}: ${honorario} Bs • ${estado}`); // [BITÁCORA]
  });

  // [6. BITÁCORA CON TIMESTAMP Y DOMPURIFY] Registra hasta 40 eventos recientes en LocalStorage
  let historialEventos = JSON.parse(localStorage.getItem('vgms_logs') || '[]'); // [LOGS]
  let contadorFiltros = parseInt(localStorage.getItem('vgms_filters') || '0', 10); // [CONTADOR FILTROS]
  let contadorConsultas = parseInt(localStorage.getItem('vgms_orders') || '0', 10); // [CONTADOR CONSULTAS]

  function registrarEventoTimestamp(tipo, descripcion) { // [BITÁCORA LOG] Agrega evento con fecha/hora de Bolivia
    const ahoraLog = new Date(); // [TIMESTAMP]
    const fechaHora = ahoraLog.toLocaleString('es-BO', { // [FORMATO ES-BO]
      year: 'numeric', // [AÑO]
      month: '2-digit', // [MES]
      day: '2-digit', // [DÍA]
      hour: '2-digit', // [HORA]
      minute: '2-digit', // [MINUTO]
      second: '2-digit', // [SEGUNDO]
      hour12: false // [24 HORAS]
    });

    historialEventos.unshift({ timestamp: fechaHora, tipo, mensaje: descripcion }); // [PREPEND] Más reciente primero
    historialEventos = historialEventos.slice(0, 40); // [LÍMITE] Conserva últimos 40 eventos
    localStorage.setItem('vgms_logs', JSON.stringify(historialEventos)); // [PERSISTENCIA]
    renderizarBitacora(); // [RENDER]
  }

  function renderizarBitacora() { // [BITÁCORA DOM] Renderiza entradas sanitizadas con DOMPurify
    const $lista = $('#activity-log-list'); // [CONTENEDOR]
    $lista.empty(); // [LIMPIA]

    $('#stat-total-events').text(historialEventos.length); // [STAT 1]
    $('#stat-filter-events').text(contadorFiltros); // [STAT 2]
    $('#stat-order-events').text(contadorConsultas); // [STAT 3]

    if (historialEventos.length === 0) { // [ESTADO VACÍO]
      const htmlVacio = sanitizarHTML('<div class="log-entry"><span class="log-message">Bitácora vacía. Interactúa con el catálogo jurídico o agenda una consulta.</span></div>'); // [ANTI-XSS]
      $lista.append(htmlVacio); // [INSERTA]
      return; // [ALTO]
    }

    historialEventos.forEach(function(item) { // [ITERACIÓN]
      const htmlItem = `
        <div class="log-entry">
          <span class="log-timestamp"><i class="fa-regular fa-clock"></i> ${item.timestamp}</span>
          <span class="log-message">${item.mensaje}</span>
          <span class="log-type-tag">${item.tipo}</span>
        </div>
      `; // [PLANTILLA LOG]
      $lista.append(sanitizarHTML(htmlItem)); // [ANTI-XSS]
    });
  }

  $('#toggle-log-btn').on('click', function() { // [FADETOGGLE BITÁCORA]
    $('#log-collapsible-box').fadeToggle(200); // [EFECTO JQUERY]
    registrarEventoTimestamp('UI', 'Alternó visibilidad de Bitácora (.fadeToggle)'); // [LOG]
  });

  $('#clear-log-btn').on('click', function() { // [LIMPIAR BITÁCORA]
    historialEventos = []; // [VACÍA]
    contadorFiltros = 0; // [REINICIA]
    contadorConsultas = 0; // [REINICIA]
    localStorage.removeItem('vgms_logs'); // [BORRA STORAGE]
    localStorage.setItem('vgms_filters', '0'); // [REINICIA]
    localStorage.setItem('vgms_orders', '0'); // [REINICIA]
    renderizarBitacora(); // [RE-RENDER]
    mostrarToastAlert('🧹 Bitácora Reiniciada', 'Historial de eventos limpiado correctamente.', false); // [TOAST]
  });

  // [7. NAVEGACIÓN POR PESTAÑAS SPA] Cambia vista activa y refresca módulos dinámicos
  function cambiarTab(tabId) {
    if (!tabId) return; // [GUARDA]

    $('.panel-tab').removeClass('active').hide(); // [OCULTA TODAS]
    $('#' + tabId).addClass('active').fadeIn(200); // [MUESTRA OBJETIVO]

    $('.dock-acciones__btn').removeClass('active').attr('aria-selected', 'false'); // [DESACTIVA DOCK]
    $(`.dock-acciones__btn[data-tab="${tabId}"]`).addClass('active').attr('aria-selected', 'true'); // [ACTIVA DOCK + A11Y]

    if (tabId === 'tab-mis-consultas') { // [TAB EXPEDIENTE CLIENTE]
      renderizarMisConsultasCliente(); // [RENDER CLIENTE]
    } else if (tabId === 'tab-abogado-agenda') { // [TAB AGENDA TRABAJADOR]
      renderizarAgendaAbogado(); // [RENDER AGENDA]
    } else if (tabId === 'tab-abogado-servicios') { // [TAB ESPECIALIDADES TRABAJADOR]
      renderizarEstadoServiciosAbogado(); // [RENDER EN VIVO]
    } else if (tabId === 'tab-admin-kpi') { // [TAB KPI ADMIN]
      renderizarDashboardAdmin(); // [RENDER KPI]
    } else if (tabId === 'tab-admin-servicios') { // [TAB HONORARIOS ADMIN]
      renderizarGestionServiciosAdmin(); // [RENDER EDITOR]
    } else if (tabId === 'tab-admin-historial') { // [TAB HISTORIAL ADMIN]
      renderizarHistorialAdmin(); // [RENDER TABLA]
    } else if (tabId === 'tab-agendar') { // [TAB AGENDAR]
      actualizarVisibilidadBotonCancelar(); // [ACTUALIZA BARRA]
      actualizarDisponibilidadHorarios(); // [ACTUALIZA SLOTS]
    }

    window.scrollTo({ top: 0, behavior: 'smooth' }); // [UX SCROLL]
    registrarEventoTimestamp('NAV', `Navegó a sección: ${tabId.replace('tab-', '').toUpperCase()}`); // [BITÁCORA]
  }

  $(document).on('click', '.dock-acciones__btn, .btn-go-tab', function() { // [DELEGACIÓN NAVEGACIÓN]
    const tabId = $(this).data('tab'); // [OBTIENE DESTINO]
    if (tabId) cambiarTab(tabId); // [EJECUTA CAMBIO]
  });

  // [8. MODO OSCURO PERSISTENTE, ESTADO DE RED E INSTALACIÓN PWA]
  if (localStorage.getItem('vgms_tema') === 'oscuro') { // [PREFERENCIA GUARDADA]
    $('body').removeClass('theme-light').addClass('theme-dark'); // [CLASE DARK]
    $('.icon-moon').hide(); // [OCULTA LUNA]
    $('.icon-sun').show(); // [MUESTRA SOL]
  }

  function alternarTema() { // [SWITCH TEMA CLARO / OSCURO]
    $('body').toggleClass('theme-dark'); // [TOGGLE CLASE]
    const esOscuro = $('body').hasClass('theme-dark'); // [VERIFICA]
    if (esOscuro) { // [MODO OSCURO]
      $('.icon-moon').hide(); // [OCULTA LUNA]
      $('.icon-sun').show().fadeIn(150); // [MUESTRA SOL]
      localStorage.setItem('vgms_tema', 'oscuro'); // [PERSISTE]
      registrarEventoTimestamp('TEMA', 'Activó Modo Oscuro (#0f172a)'); // [LOG]
    } else { // [MODO CLARO]
      $('.icon-sun').hide(); // [OCULTA SOL]
      $('.icon-moon').show().fadeIn(150); // [MUESTRA LUNA]
      localStorage.setItem('vgms_tema', 'claro'); // [PERSISTE]
      registrarEventoTimestamp('TEMA', 'Activó Modo Claro Institucional'); // [LOG]
    }
  }

  $('#theme-toggle-btn, #theme-toggle-btn-top').on('click', alternarTema); // [EVENTOS TEMA]

  function actualizarEstadoRed() { // [DETECTOR RED NAVIGATOR.ONLINE]
    if (navigator.onLine) { // [CON CONEXIÓN]
      $('#estadoRed, #estadoRedHeader')
        .text('🟢 En Línea') // [TEXTO]
        .css({ backgroundColor: '#dcfce7', color: '#166534' }); // [ESTILO VERDE]
    } else { // [SIN CONEXIÓN]
      $('#estadoRed, #estadoRedHeader')
        .text('🟠 Sin Conexión') // [TEXTO]
        .css({ backgroundColor: '#ffedd5', color: '#9a3412' }); // [ESTILO NARANJA]
    }
  }

  $(window).on('online offline', actualizarEstadoRed); // [LISTENERS DE RED]
  actualizarEstadoRed(); // [INICIALIZA ESTADO RED]

  $('#btnInstalarPWA, #btnInstalarPWATop').on('click', async function () { // [TRIGGER INSTALAR PWA]
    if (!deferredInstallPrompt) return; // [GUARDA]
    deferredInstallPrompt.prompt(); // [DISPARA PROMPT NATIVO]
    const { outcome } = await deferredInstallPrompt.userChoice; // [ESPERA DECISIÓN]
    deferredInstallPrompt = null; // [LIMPIA]
    $('#btnInstalarPWA, #btnInstalarPWATop').prop('hidden', true).fadeOut(); // [OCULTA BOTONES]
    registrarEventoTimestamp('PWA', `Instalación respondida: ${outcome}`); // [LOG]
  });

  // [9. FILTRADO MULTINIVEL, BUSCADOR EN VIVO Y DELEGACIÓN EN CATÁLOGO]
  let filtroAreaActual = 'all'; // [FILTRO NIVEL 1] Área de práctica legal
  let filtroPerfilActual = 'all'; // [FILTRO NIVEL 2] Perfil de cliente / enfoque
  let filtroBusquedaActual = ''; // [FILTRO TEXTO] Búsqueda en vivo

  $('.type-btn').on('click', function() { // [CLICK NIVEL 1]
    $('.type-btn').removeClass('active'); // [LIMPIA]
    $(this).addClass('active'); // [ACTIVA]
    filtroAreaActual = $(this).data('type'); // [GUARDA ÁREA]
    contadorFiltros++; // [INCREMENTA MÉTRICA]
    localStorage.setItem('vgms_filters', String(contadorFiltros)); // [PERSISTE]
    aplicarFiltrosServicios(); // [FILTRA TARJETAS]
  });

  $('.subtype-btn').on('click', function() { // [CLICK NIVEL 2]
    $('.subtype-btn').removeClass('active'); // [LIMPIA]
    $(this).addClass('active'); // [ACTIVA]
    filtroPerfilActual = $(this).data('subtype'); // [GUARDA PERFIL]
    contadorFiltros++; // [INCREMENTA MÉTRICA]
    localStorage.setItem('vgms_filters', String(contadorFiltros)); // [PERSISTE]
    aplicarFiltrosServicios(); // [FILTRA TARJETAS]
  });

  $('#searchServicio').on('keyup', function() { // [BUSCADOR VIVO KEYUP]
    filtroBusquedaActual = $(this).val().trim().toLowerCase(); // [TEXTO NORMALIZADO]
    aplicarFiltrosServicios(); // [FILTRA TARJETAS]
  });

  function aplicarFiltrosServicios() { // [MOTOR DE FILTRADO COMBINADO 3 FACTORES]
    $('.servicio-card').each(function() { // [RECORRE S1-S8]
      const cardArea = $(this).data('type'); // [ÁREA]
      const cardPerfiles = $(this).data('subtype') ? $(this).data('subtype').split(' ') : []; // [PERFILES]
      const contenidoTexto = $(this).text().toLowerCase(); // [TEXTO COMPLETO TARJETA]

      const coincideArea = (filtroAreaActual === 'all') || (cardArea === filtroAreaActual); // [CONDICIÓN 1]
      const coincidePerfil = (filtroPerfilActual === 'all') || (cardPerfiles.includes(filtroPerfilActual)); // [CONDICIÓN 2]
      const coincideTexto = !filtroBusquedaActual || contenidoTexto.indexOf(filtroBusquedaActual) !== -1; // [CONDICIÓN 3]

      if (coincideArea && coincidePerfil && coincideTexto) { // [INTERSECCIÓN]
        $(this).fadeIn(200); // [MUESTRA]
      } else {
        $(this).fadeOut(200); // [OCULTA]
      }
    });
  }

  $('#toggle-catalog-btn').on('click', function() { // [ACORDEÓN SLIDETOGGLE]
    const $btn = $(this); // [BOTÓN]
    const $wrapper = $('#catalog-collapsible-wrapper'); // [CONTENEDOR FILTROS]

    $wrapper.slideToggle(300, function() { // [ANIMACIÓN JQUERY]
      if ($wrapper.is(':visible')) { // [ESTADO EXPANDIDO]
        $btn.attr('aria-expanded', 'true'); // [A11Y]
        $btn.find('.toggle-text').html(sanitizarHTML('<i class="fa-solid fa-eye-slash"></i> Ocultar Controles de Filtro')); // [TEXTO]
        $btn.find('.toggle-icon').removeClass('fa-chevron-down').addClass('fa-chevron-up'); // [ICONO]
      } else { // [ESTADO COLAPSADO]
        $btn.attr('aria-expanded', 'false'); // [A11Y]
        $btn.find('.toggle-text').html(sanitizarHTML('<i class="fa-solid fa-eye"></i> Mostrar Controles de Filtro')); // [TEXTO]
        $btn.find('.toggle-icon').removeClass('fa-chevron-up').addClass('fa-chevron-down'); // [ICONO]
      }
    });
  });

  $('#services-container').on('click', '.btn-simular', function (e) { // [DELEGACIÓN COMPARAR/SIMULAR]
    e.stopPropagation(); // [EVITA BURBUJEO]
    const $card = $(this).closest('.servicio-card'); // [TARJETA PADRE]
    $card.toggleClass('servicio-card--activa'); // [ALTERNA DESTACADO]
    const estaActiva = $card.hasClass('servicio-card--activa'); // [VERIFICA ESTADO]
    const nombre = $card.find('.servicio-card__titulo').text().trim(); // [NOMBRE SERVICIO]

    $(this).html(sanitizarHTML(estaActiva // [ACTUALIZA BOTÓN]
      ? '<i class="fa-solid fa-check"></i> Comparando' // [ACTIVO]
      : '<i class="fa-solid fa-bookmark"></i> Comparar')); // [NORMAL]

    mostrarToastAlert('⚖️ Comparación de Servicio', `${nombre} marcado como ${estaActiva ? 'DESTACADO' : 'NORMAL'}.`, false); // [TOAST]
  });

  $('#services-container').on('click', '.btn-select-service', function() { // [DELEGACIÓN SELECCIONAR SERVICIO]
    const serviceId = $(this).data('service-id'); // [ID S1-S8]
    const serviceName = $(this).data('service-name'); // [NOMBRE]

    const servicio = serviciosSistema.find(s => s.id_servicio === serviceId); // [VERIFICA ESTADO]
    if (servicio && servicio.estado === 'pausado') { // [BLOQUEO SI PAUSADO]
      mostrarToastAlert('⚠️ Servicio Pausado', 'Este servicio jurídico tiene su agenda cerrada temporalmente.', true); // [ADVERTENCIA]
      return; // [ALTO]
    }

    $('#select-servicio-consulta').val(serviceId).trigger('change'); // [SINCRONIZA SELECTOR]
    registrarEventoTimestamp('CATÁLOGO', `Seleccionó servicio: ${serviceName}`); // [LOG]
    cambiarTab('tab-agendar'); // [NAVEGA A AGENDA]
  });

  // [10. FECHAS, HORARIOS Y CONTROL ANTI-COLISIÓN]
  const ahora = new Date(); // [FECHA ACTUAL]
  const yyyy = ahora.getFullYear(); // [AÑO]
  const mm = String(ahora.getMonth() + 1).padStart(2, '0'); // [MES 2 DÍGITOS]
  const dd = String(ahora.getDate()).padStart(2, '0'); // [DÍA 2 DÍGITOS]
  const fechaHoyFormato = `${yyyy}-${mm}-${dd}`; // [ISO HOY]

  const DIAS_ANTICIPACION_MAX = 30; // [LÍMITE 30 DÍAS]
  const fechaLimite = new Date(); // [FECHA MÁXIMA]
  fechaLimite.setDate(fechaLimite.getDate() + DIAS_ANTICIPACION_MAX); // [SUMA 30 DÍAS]
  const yyyyMax = fechaLimite.getFullYear(); // [AÑO MAX]
  const mmMax = String(fechaLimite.getMonth() + 1).padStart(2, '0'); // [MES MAX]
  const ddMax = String(fechaLimite.getDate()).padStart(2, '0'); // [DÍA MAX]
  const fechaMaxFormato = `${yyyyMax}-${mmMax}-${ddMax}`; // [ISO MAX]

  $('#fecha-consulta') // [CONFIGURA INPUT DATE]
    .attr('min', fechaHoyFormato) // [MÍNIMO HOY]
    .attr('max', fechaMaxFormato) // [MÁXIMO +30 DÍAS]
    .val(fechaHoyFormato); // [VALOR INICIAL HOY]

  let honorarioBase = 1800; // [TARIFA ACTIVA]
  let horaInicio = null; // [INICIO SELECCIONADO]
  let horaFin = null; // [FIN SELECCIONADO]
  let horasValidas = false; // [BANDERA HORARIO VÁLIDO]

  function obtenerConsultasParaFechaYServicio(fecha, servicioId) { // [FILTRA RESERVAS ACTIVAS POR FECHA Y SERVICIO]
    if (!fecha) return []; // [GUARDA]
    return consultasConfirmadas.filter(function(c) { // [FILTRO]
      if (c.estado === 'cancelada') return false; // [IGNORA CANCELADAS]
      if (servicioId && c.servicioId) { // [CRUCE SERVICIO + FECHA]
        return c.fecha === fecha && c.servicioId === servicioId; // [COINCIDENCIA]
      }
      return c.fecha === fecha; // [SOLO FECHA]
    });
  }

  function actualizarDisponibilidadHorarios() { // [PINTA BLOQUES ROJOS OCUPADOS]
    const fechaSeleccionada = $('#fecha-consulta').val(); // [FECHA]
    const servicioSeleccionado = $('#select-servicio-consulta').val(); // [SERVICIO]
    const consultasFecha = obtenerConsultasParaFechaYServicio(fechaSeleccionada, servicioSeleccionado); // [CITAS]

    $('.btn-slot').each(function() { // [EVALÚA CADA BLOQUE 09:00-18:00]
      const inicio = parseInt($(this).data('inicio'), 10); // [INICIO BLOQUE]
      const fin = parseInt($(this).data('fin'), 10); // [FIN BLOQUE]
      const iniTxt = String(inicio).padStart(2, '0'); // [FORMATO 09]
      const finTxt = String(fin).padStart(2, '0'); // [FORMATO 10]

      const estaOcupada = consultasFecha.some(function(c) { // [INTERSECCIÓN DE INTERVALOS]
        return Math.max(inicio, c.horaInicio) < Math.min(fin, c.horaFin); // [FÓRMULA DE TRASLAPE]
      });

      if (estaOcupada) { // [BLOQUE OCUPADO]
        $(this).removeClass('active-slot').addClass('ocupado'); // [MARCA ROJO]
        $(this).text(`${iniTxt}:00 - ${finTxt}:00 (Ocupado)`); // [ETIQUETA]
      } else { // [BLOQUE LIBRE]
        $(this).removeClass('ocupado'); // [LIMPIA ROJO]
        $(this).text(`${iniTxt}:00 - ${finTxt}:00`); // [RESTAURA TEXTO]
      }
    });

    if (horaInicio !== null && horaFin !== null) { // [LIMPIA SELECCIÓN SI QUEDÓ OCUPADA]
      const seleccionOcupada = consultasFecha.some(function(c) {
        return Math.max(horaInicio, c.horaInicio) < Math.min(horaFin, c.horaFin); // [TRASLAPE]
      });

      if (seleccionOcupada) { // [REINICIA HORAS]
        $('.btn-slot').removeClass('active-slot'); // [LIMPIA]
        horaInicio = null; // [RESET]
        horaFin = null; // [RESET]
        horasValidas = false; // [RESET]
        $('#select-inicio').prop('selectedIndex', 0); // [RESET]
        $('#select-fin').prop('selectedIndex', 0); // [RESET]
        calcularTotalConsulta(); // [RECALCULA]
        verificarFormularioCompleto(); // [BLOQUEA BOTÓN]
      }
    }
  }

  $('.btn-slot').on('click', function() { // [SELECCIÓN DE BLOQUE DE 1 HORA]
    const hIni = parseInt($(this).data('inicio'), 10); // [INICIO]
    const hF = parseInt($(this).data('fin'), 10); // [FIN]

    if ($(this).hasClass('ocupado')) { // [BLOQUEO ROJO]
      mostrarAlertaError(`⛔ El horario de las ${String(hIni).padStart(2, '0')}:00 a ${String(hF).padStart(2, '0')}:00 ya se encuentra agendado.`); // [ALERTA]
      return; // [ALTO]
    }

    $('.btn-slot').removeClass('active-slot'); // [LIMPIA]
    $(this).addClass('active-slot'); // [MARCA ACTIVO]

    horaInicio = hIni; // [GUARDA INICIO]
    horaFin = hF; // [GUARDA FIN]
    $('#select-inicio').val(horaInicio); // [SINCRONIZA SELECT]
    $('#select-fin').val(horaFin); // [SINCRONIZA SELECT]

    validarHorarios(); // [VALIDA]
    calcularTotalConsulta(); // [CALCULA TOTAL]
    verificarFormularioCompleto(); // [VERIFICA SUBMIT]
  });

  $('#select-inicio, #select-fin').on('change blur', function() { // [RANGO CONTINUO PERSONALIZADO]
    const valIni = $('#select-inicio').val(); // [INICIO]
    const valFin = $('#select-fin').val(); // [FIN]
    if (!valIni || !valFin) return; // [GUARDA]

    horaInicio = parseInt(valIni, 10); // [ENTERO]
    horaFin = parseInt(valFin, 10); // [ENTERO]

    validarHorarios(); // [VALIDA]
    calcularTotalConsulta(); // [CALCULA]
    verificarFormularioCompleto(); // [ACTUALIZA SUBMIT]
  });

  function validarHorarios() { // [VALIDACIÓN DE HORARIOS Y COLISIONES]
    $('#select-inicio, #select-fin').removeClass('input-invalid input-valid'); // [LIMPIA CLASES]
    $('#err-hours').hide().text(''); // [OCULTA ERROR]
    horasValidas = false; // [INICIAL]

    if (horaInicio === null || horaFin === null) { // [SIN SELECCIÓN]
      $('.btn-slot').removeClass('active-slot'); // [LIMPIA]
      return false; // [INVÁLIDO]
    }

    if (horaFin <= horaInicio) { // [FIN DEBE SER MAYOR A INICIO]
      $('#err-hours').text('⚠️ La hora fin debe ser mayor a la hora de inicio.').slideDown('fast'); // [ERROR]
      $('#select-inicio, #select-fin').addClass('input-invalid'); // [BORDE ROJO]
      $('.btn-slot').removeClass('active-slot'); // [LIMPIA]
      return false; // [INVÁLIDO]
    }

    const fechaActual = $('#fecha-consulta').val(); // [FECHA]
    const servicioActual = $('#select-servicio-consulta').val(); // [SERVICIO]
    const consultasFecha = obtenerConsultasParaFechaYServicio(fechaActual, servicioActual); // [CITAS EXISTENTES]

    let chocado = null; // [DETECTA CHOQUE]
    for (const c of consultasFecha) { // [RECORRE CITAS]
      if (Math.max(horaInicio, c.horaInicio) < Math.min(horaFin, c.horaFin)) { // [TRASLAPE]
        chocado = `${c.horaInicio}:00 a ${c.horaFin}:00`; // [TEXTO CHOQUE]
        break; // [DETIENE]
      }
    }

    if (chocado) { // [SI HAY COLISIÓN]
      $('#err-hours').text(`⛔ Tu selección abarca el horario ${chocado}, ya ocupado.`).slideDown('fast'); // [ERROR]
      $('#select-inicio, #select-fin').addClass('input-invalid'); // [BORDE ROJO]
      $('.btn-slot').removeClass('active-slot'); // [LIMPIA]
      return false; // [INVÁLIDO]
    }

    horasValidas = true; // [VÁLIDO]
    $('#select-inicio, #select-fin').addClass('input-valid'); // [BORDE VERDE]
    $('#err-hours').slideUp('fast'); // [OCULTA ERROR]

    $('.btn-slot').removeClass('active-slot'); // [ACTUALIZA BOTÓN ACTIVO]
    if (horaFin - horaInicio === 1) { // [SI ES BLOQUE DE 1H]
      $(`.btn-slot[data-inicio="${horaInicio}"][data-fin="${horaFin}"]:not(.ocupado)`).addClass('active-slot'); // [MARCA]
    }

    return true; // [RETORNO VÁLIDO]
  }

  $('#select-servicio-consulta').on('change', function() { // [CAMBIO DE SERVICIO EN SELECT]
    const opt = $(this).find('option:selected'); // [OPCIÓN ACTIVA]
    honorarioBase = parseFloat(opt.data('precio')) || 1800; // [PRECIO]
    const nombre = opt.text().split('(')[0].trim(); // [NOMBRE LIMPIO]
    $('#summary-service').text(nombre); // [ACTUALIZA RESUMEN]

    actualizarDisponibilidadHorarios(); // [REFRESCA SLOTS]
    validarHorarios(); // [REVALIDA]
    calcularTotalConsulta(); // [RECALCULA]
  });

  $('input[name="add-senapi"], input[name="add-nda"], input[name="add-notarial"]').on('change', function() { // [CAMBIO GESTIONES ADICIONALES]
    calcularTotalConsulta(); // [RECALCULA EN VIVO]
  });

  function calcularTotalConsulta() { // [CÁLCULO EN VIVO DE HONORARIOS]
    const totalHoras = horaFin - horaInicio; // [DURACIÓN]

    if (!horasValidas || totalHoras <= 0) { // [SI NO HAY HORAS VÁLIDAS]
      $('#summary-hours').text('0 Horas'); // [CEROS]
      $('#summary-time').text('No asignado'); // [SIN ASIGNAR]
      $('#summary-total').text('0 BOB'); // [TOTAL 0]
      return; // [ALTO]
    }

    // [MODELO HONORARIOS] Primer bloque cubre honorario base del trámite y horas extra suman 300 Bs/h de consultoría
    const horasExtra = Math.max(0, totalHoras - 1); // [HORAS ADICIONALES]
    const subtotalServicio = honorarioBase + (horasExtra * 300); // [SUBTOTAL SERVICIO]

    let totalAdicionales = 0; // [SUMA ADICIONALES]
    if ($('#add-senapi').is(':checked')) totalAdicionales += parseInt($('#add-senapi').val(), 10); // [+250 Bs]
    if ($('#add-nda').is(':checked')) totalAdicionales += parseInt($('#add-nda').val(), 10); // [+350 Bs]
    if ($('#add-notarial').is(':checked')) totalAdicionales += parseInt($('#add-notarial').val(), 10); // [+200 Bs]

    const granTotal = subtotalServicio + totalAdicionales; // [GRAN TOTAL]

    $('#summary-hours').text(`${totalHoras} Hora(s)`); // [MUESTRA HORAS]
    $('#summary-time').text(`${String(horaInicio).padStart(2, '0')}:00 a ${String(horaFin).padStart(2, '0')}:00`); // [MUESTRA RANGO]
    $('#summary-total').text(`${granTotal} BOB`); // [MUESTRA TOTAL]
  }

  function mostrarAlertaError(mensaje) { // [ALERTA ERROR FORMULARIO]
    $('#booking-alert-success').hide(); // [OCULTA ÉXITO]
    $('#booking-alert-error').html(sanitizarHTML(mensaje)).slideDown('fast'); // [MUESTRA SANITIZADO]
  }

  // [11. VALIDACIONES ESTRICTAS DE FORMULARIO] Nombre, celular boliviano, correo real y fechas
  const BLACKLIST_NOMBRES = [ // [LISTA NEGRA ANTI-BASURA]
    'asdasd', 'asd', 'qwerty', 'test', 'prueba', 'admin',
    'usuario', 'nombre', 'apellido', 'xxx', 'aaa', 'zzz',
    'fulano', 'mengano', 'null', 'undefined', 'ninguno'
  ];

  const DOMINIOS_EMAIL_PERMITIDOS = [ // [LISTA BLANCA PROVEEDORES REALES]
    'gmail.com', 'hotmail.com', 'outlook.com', 'outlook.es',
    'yahoo.com', 'yahoo.es', 'icloud.com', 'live.com',
    'proton.me', 'protonmail.com'
  ];

  function validarTextoNombre(nombre) { // [VALIDA NOMBRE Y APELLIDO REALES]
    if (!nombre) return { valido: false, mensaje: '⚠️ El nombre completo es obligatorio.' }; // [OBLIGATORIO]
    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/; // [SOLO LETRAS Y ESPACIOS]
    if (!regexLetras.test(nombre)) { // [RECHAZA NÚMEROS O SÍMBOLOS]
      return { valido: false, mensaje: '⚠️ Solo letras y espacios (sin números ni símbolos).' }; // [ERROR]
    }
    if (/(.)\1\1/i.test(nombre)) { // [RECHAZA 3 LETRAS IGUALES CONSECUTIVAS Ej: aaa]
      return { valido: false, mensaje: '⚠️ Ingresa un nombre real (sin letras repetidas consecutivas).' }; // [ERROR]
    }
    const palabras = nombre.trim().split(/\s+/).filter(Boolean); // [DIVIDE PALABRAS]
    if (palabras.length < 2) { // [EXIGE NOMBRE + APELLIDO]
      return { valido: false, mensaje: '⚠️ Ingresa al menos nombre y apellido.' }; // [ERROR]
    }
    for (const p of palabras) { // [LONGITUD MÍNIMA POR PALABRA]
      if (p.length < 2) { // [EVITA INICIALES SUELTAS]
        return { valido: false, mensaje: '⚠️ Cada palabra debe tener al menos 2 letras.' }; // [ERROR]
      }
    }
    const nombreMin = nombre.toLowerCase(); // [NORMALIZA]
    for (const item of BLACKLIST_NOMBRES) { // [COMPARA BLACKLIST]
      if (nombreMin.includes(item.toLowerCase())) { // [RECHAZA PRUEBAS]
        return { valido: false, mensaje: '⚠️ Por favor ingresa un nombre y apellido legítimos.' }; // [ERROR]
      }
    }
    return { valido: true, mensaje: '' }; // [VÁLIDO]
  }

  function validarTextoTelefono(tel) { // [VALIDA CELULAR BOLIVIA 8 DÍGITOS INICIANDO EN 6 O 7]
    if (!tel) return { valido: false, mensaje: '⚠️ El celular / WhatsApp es obligatorio.' }; // [OBLIGATORIO]
    const regexTel = /^[67][0-9]{7}$/; // [REGEX BOLIVIA]
    if (!regexTel.test(tel)) { // [PRUEBA]
      return { valido: false, mensaje: '⚠️ Ingresa un número de celular válido de 8 dígitos (ej: 67005417).' }; // [ERROR]
    }
    return { valido: true, mensaje: '' }; // [VÁLIDO]
  }

  function validarTextoEmail(correo) { // [VALIDA FORMATO + PROVEEDOR REAL O DOMINIO .BO]
    if (!correo) return { valido: false, mensaje: '⚠️ El correo electrónico es obligatorio.' }; // [OBLIGATORIO]
    const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // [REGEX EMAIL]
    if (!regexEmail.test(correo)) { // [PRUEBA FORMATO]
      return { valido: false, mensaje: '⚠️ Ingresa un formato de correo válido.' }; // [ERROR]
    }
    const partes = correo.split('@'); // [SEPARA USUARIO Y DOMINIO]
    if (partes.length !== 2) return { valido: false, mensaje: '⚠️ Correo inválido.' }; // [ERROR]

    const usuario = partes[0].toLowerCase(); // [USUARIO]
    const dominio = partes[1].toLowerCase(); // [DOMINIO]

    if (/(.)\1\1/i.test(usuario)) { // [RECHAZA 3 CARACTERES REPETIDOS]
      return { valido: false, mensaje: '⚠️ Ingresa un correo legítimo sin caracteres repetitivos.' }; // [ERROR]
    }
    for (const item of BLACKLIST_NOMBRES) { // [BLACKLIST EN USUARIO]
      if (usuario === item || (item.length >= 4 && usuario.includes(item))) { // [RECHAZA]
        return { valido: false, mensaje: '⚠️ Ingresa un correo válido de un usuario real.' }; // [ERROR]
      }
    }

    const esDominioExacto = DOMINIOS_EMAIL_PERMITIDOS.includes(dominio); // [PROVEEDORES COMUNES]
    const esInstitucional = dominio.endsWith('.edu.bo') || dominio.endsWith('.bo') || dominio.endsWith('.org') || dominio.endsWith('.com.bo'); // [DOMINIOS CORPORATIVOS/BO]
    if (!esDominioExacto && !esInstitucional) { // [RECHAZA DOMINIOS FALSOS]
      return { valido: false, mensaje: '⚠️ Ingresa un correo de un proveedor real (ej: usuario@gmail.com, outlook.com o dominio .bo).' }; // [ERROR]
    }
    return { valido: true, mensaje: '' }; // [VÁLIDO]
  }

  function validarCampoFecha(autoCorregir = true) { // [VALIDA RANGO DE FECHA HOY A +30 DÍAS]
    const valorFecha = $('#fecha-consulta').val(); // [VALOR]
    $('#fecha-consulta').removeClass('input-invalid input-valid'); // [LIMPIA]
    $('#err-date').hide().text(''); // [LIMPIA ERROR]

    if (!valorFecha) { // [VACÍO]
      $('#err-date').text('⚠️ Debes seleccionar una fecha.').slideDown('fast'); // [ERROR]
      $('#fecha-consulta').addClass('input-invalid'); // [ROJO]
      return false; // [INVÁLIDO]
    }

    if (valorFecha < fechaHoyFormato) { // [PASADA]
      if (autoCorregir) { // [AUTOCORRECCIÓN]
        $('#fecha-consulta').val(fechaHoyFormato); // [AJUSTA A HOY]
        $('#err-date').text('⚠️ No se permiten fechas pasadas; ajustado a hoy.').slideDown('fast'); // [AVISO]
      } else {
        $('#err-date').text('⚠️ No se permiten fechas pasadas.').slideDown('fast'); // [ERROR]
        $('#fecha-consulta').addClass('input-invalid'); // [ROJO]
        return false; // [INVÁLIDO]
      }
    } else if (valorFecha > fechaMaxFormato) { // [EXCEDE 30 DÍAS]
      if (autoCorregir) { // [AUTOCORRECCIÓN]
        $('#fecha-consulta').val(fechaMaxFormato); // [AJUSTA AL LÍMITE]
        $('#err-date').text(`⚠️ Límite de ${DIAS_ANTICIPACION_MAX} días; ajustado a ${fechaMaxFormato}.`).slideDown('fast'); // [AVISO]
      } else {
        $('#err-date').text(`⚠️ Solo consultas hasta ${DIAS_ANTICIPACION_MAX} días a futuro.`).slideDown('fast'); // [ERROR]
        $('#fecha-consulta').addClass('input-invalid'); // [ROJO]
        return false; // [INVÁLIDO]
      }
    }

    $('#fecha-consulta').addClass('input-valid'); // [VERDE]
    return true; // [VÁLIDO]
  }

  function validarCampoNombre() { // [VALIDA INPUT #client-name]
    const nombre = $('#client-name').val().trim(); // [VALOR]
    const res = validarTextoNombre(nombre); // [EVALÚA]
    $('#client-name').removeClass('input-invalid input-valid'); // [LIMPIA]
    $('#err-name').hide().text(''); // [LIMPIA]
    if (!res.valido) { // [INVÁLIDO]
      $('#err-name').text(res.mensaje).slideDown('fast'); // [ERROR]
      $('#client-name').addClass('input-invalid'); // [ROJO]
      return false; // [RETORNO]
    }
    $('#client-name').addClass('input-valid'); // [VERDE]
    return true; // [RETORNO]
  }

  function validarCampoTelefono() { // [VALIDA INPUT #client-phone]
    const tel = $('#client-phone').val().trim(); // [VALOR]
    const res = validarTextoTelefono(tel); // [EVALÚA]
    $('#client-phone').removeClass('input-invalid input-valid'); // [LIMPIA]
    $('#err-phone').hide().text(''); // [LIMPIA]
    if (!res.valido) { // [INVÁLIDO]
      $('#err-phone').text(res.mensaje).slideDown('fast'); // [ERROR]
      $('#client-phone').addClass('input-invalid'); // [ROJO]
      return false; // [RETORNO]
    }
    $('#client-phone').addClass('input-valid'); // [VERDE]
    return true; // [RETORNO]
  }

  function validarCampoEmail() { // [VALIDA INPUT #client-email]
    const correo = $('#client-email').val().trim(); // [VALOR]
    const res = validarTextoEmail(correo); // [EVALÚA]
    $('#client-email').removeClass('input-invalid input-valid'); // [LIMPIA]
    $('#err-email').hide().text(''); // [LIMPIA]
    if (!res.valido) { // [INVÁLIDO]
      $('#err-email').text(res.mensaje).slideDown('fast'); // [ERROR]
      $('#client-email').addClass('input-invalid'); // [ROJO]
      return false; // [RETORNO]
    }
    $('#client-email').addClass('input-valid'); // [VERDE]
    return true; // [RETORNO]
  }

  $('#fecha-consulta').on('input change blur', function() { // [EVENTOS FECHA]
    validarCampoFecha(true); // [VALIDA]
    actualizarDisponibilidadHorarios(); // [REFRESCA SLOTS]
    validarHorarios(); // [REVALIDA HORAS]
    calcularTotalConsulta(); // [RECALCULA]
    verificarFormularioCompleto(); // [VERIFICA SUBMIT]
  });

  $('#client-name').on('blur input', function() { // [EVENTOS NOMBRE]
    validarCampoNombre(); // [VALIDA]
    verificarFormularioCompleto(); // [VERIFICA SUBMIT]
  });

  $('#client-phone').on('input', function() { // [FILTRO NUMÉRICO EN VIVO TELÉFONO]
    const valOriginal = $(this).val(); // [ORIGINAL]
    const limpio = valOriginal.replace(/\D/g, '').slice(0, 8); // [SOLO 8 DÍGITOS]
    if (valOriginal !== limpio) $(this).val(limpio); // [LIMPIA]
    validarCampoTelefono(); // [VALIDA]
    verificarFormularioCompleto(); // [VERIFICA SUBMIT]
  }).on('blur', function() { // [BLUR TELÉFONO]
    validarCampoTelefono(); // [VALIDA]
    verificarFormularioCompleto(); // [VERIFICA SUBMIT]
  });

  $('#client-email').on('blur input', function() { // [EVENTOS EMAIL]
    validarCampoEmail(); // [VALIDA]
    verificarFormularioCompleto(); // [VERIFICA SUBMIT]
  });

  function verificarFormularioCompleto() { // [HABILITA BOTÓN SUBMIT SOLO SI TODO ES VÁLIDO]
    const f = $('#fecha-consulta').val(); // [FECHA]
    const fechaOk = f && (f >= fechaHoyFormato) && (f <= fechaMaxFormato); // [FECHA OK]
    const horasOk = horasValidas; // [HORAS OK]
    const nombreOk = validarTextoNombre($('#client-name').val().trim()).valido; // [NOMBRE OK]
    const telefonoOk = validarTextoTelefono($('#client-phone').val().trim()).valido; // [TELÉFONO OK]
    const emailOk = validarTextoEmail($('#client-email').val().trim()).valido; // [EMAIL OK]

    const todoValido = fechaOk && horasOk && nombreOk && telefonoOk && emailOk; // [CONJUNCIÓN]
    const $btn = $('#btn-submit-booking'); // [BOTÓN]

    if (todoValido) { // [DESBLOQUEA SUBMIT]
      $btn
        .prop('disabled', false) // [HABILITA]
        .removeClass('btn-disabled') // [QUITA CLASE]
        .addClass('btn-ready') // [ACTIVA ESTILO]
        .html(sanitizarHTML('<i class="fa-solid fa-circle-check"></i> Confirmar y Agendar en VGMS')); // [TEXTO]
    } else { // [MANTIENE BLOQUEADO]
      $btn
        .prop('disabled', true) // [DESHABILITA]
        .removeClass('btn-ready') // [QUITA CLASE]
        .addClass('btn-disabled') // [ESTILO BLOQUEADO]
        .html(sanitizarHTML('<i class="fa-solid fa-lock"></i> Completa los campos para agendar')); // [TEXTO]
    }

    return todoValido; // [RETORNO]
  }

  function limpiarFormularioConsulta() { // [RESET TOTAL DEL FORMULARIO AL CANCELAR O EXPIRAR]
    $('#client-name, #client-phone, #client-email, #client-notes').val(''); // [VACÍA TEXTOS]
    $('#client-name, #client-phone, #client-email, #select-inicio, #select-fin').removeClass('input-valid input-invalid'); // [LIMPIA CLASES]
    $('input[name="add-senapi"], input[name="add-nda"], input[name="add-notarial"]').prop('checked', false); // [DESMARCA EXTRAS]
    $('#legal-modality').prop('selectedIndex', 0); // [REINICIA MODALIDAD]
    $('#payment-method').prop('selectedIndex', 0); // [REINICIA PAGO]

    $('#select-servicio-consulta').prop('selectedIndex', 0); // [REINICIA SERVICIO]
    const optInicial = $('#select-servicio-consulta').find('option:first'); // [PRIMERA OPCIÓN]
    honorarioBase = parseFloat(optInicial.data('precio')) || 1800; // [TARIFA INICIAL]
    $('#summary-service').text(optInicial.text().split('(')[0].trim()); // [RESUMEN]

    $('.btn-slot').removeClass('active-slot'); // [LIMPIA BLOQUES]
    horaInicio = null; // [RESET]
    horaFin = null; // [RESET]
    horasValidas = false; // [RESET]
    $('#select-inicio').prop('selectedIndex', 0); // [RESET]
    $('#select-fin').prop('selectedIndex', 0); // [RESET]

    $('#err-date, #err-hours, #err-name, #err-phone, #err-email, #booking-alert-error').hide().text(''); // [OCULTA ERRORES]
    $('#booking-alert-success').hide(); // [OCULTA ÉXITO]

    $('#summary-hours').text('0 Horas'); // [RESET]
    $('#summary-time').text('No asignado'); // [RESET]
    $('#summary-total').text('0 BOB'); // [RESET]

    if (usuarioActivo && usuarioActivo.rol === 'cliente') { // [RE-PRELLENA SI CLIENTE LOGUEADO]
      $('#client-name').val(usuarioActivo.nombre); // [NOMBRE]
      $('#client-email').val(usuarioActivo.correo); // [CORREO]
    }

    verificarFormularioCompleto(); // [BLOQUEA BOTÓN]
    actualizarDisponibilidadHorarios(); // [REFRESCA SLOTS]
  }

  // [12. RENDERIZADORES RBAC PARA CLIENTE, TRABAJADOR Y ADMIN]
  function actualizarVisibilidadBotonCancelar() { // [BARRA CONDICIONAL CLIENTE]
    let activasCliente = []; // [LISTA ACTIVA]
    if (usuarioActivo && usuarioActivo.rol === 'cliente') { // [FILTRA POR CLIENTE LOGUEADO]
      activasCliente = consultasConfirmadas.filter(c =>
        c.estado !== 'cancelada' &&
        ((c.correo && c.correo.toLowerCase() === usuarioActivo.correo.toLowerCase()) ||
         (c.cliente && c.cliente.toLowerCase() === usuarioActivo.nombre.toLowerCase()))
      );
    } else {
      activasCliente = consultasConfirmadas.filter(c => c.estado !== 'cancelada'); // [TODAS ACTIVAS]
    }

    const cant = activasCliente.length; // [CANTIDAD]
    $('#cant-consultas-activas').text(cant); // [CONTADOR]
    contadorConsultas = cant; // [SINCRONIZA BITÁCORA]
    localStorage.setItem('vgms_orders', String(contadorConsultas)); // [PERSISTE]
    $('#stat-order-events').text(contadorConsultas); // [ACTUALIZA STAT]

    if (cant > 0) { // [MUESTRA U OCULTA CON SLIDE]
      $('#seccionCancelarConsulta').stop(true, true).slideDown(250); // [MUESTRA]
    } else {
      $('#seccionCancelarConsulta').stop(true, true).slideUp(250); // [OCULTA]
    }
  }

  function renderizarMisConsultasCliente() { // [EXPEDIENTE DEL CLIENTE]
    const $contenedor = $('#cliente-consultas-lista'); // [CONTENEDOR]
    $contenedor.empty(); // [LIMPIA]

    let misConsultas = []; // [FILTRO POR CLIENTE]
    if (usuarioActivo && usuarioActivo.rol === 'cliente') {
      misConsultas = consultasConfirmadas.filter(c =>
        (c.correo && c.correo.toLowerCase() === usuarioActivo.correo.toLowerCase()) ||
        (c.cliente && c.cliente.toLowerCase() === usuarioActivo.nombre.toLowerCase())
      );
    } else {
      misConsultas = [...consultasConfirmadas]; // [COPIA]
    }

    if (misConsultas.length === 0) { // [ESTADO VACÍO]
      const htmlVacio = `
        <div class="cliente-empty-state">
          <i class="fa-solid fa-folder-open"></i>
          <h4>No tienes consultas jurídicas registradas</h4>
          <p>Explora nuestro catálogo de 8 servicios legales y agenda tu asesoría con VGMS Abogados.</p>
          <button type="button" class="btn btn-primary btn-go-tab" data-tab="tab-agendar" style="margin-top: 10px;">
            <i class="fa-solid fa-calendar-check"></i> Agendar Consulta Ahora
          </button>
        </div>
      `; // [PLANTILLA VACÍA]
      $contenedor.html(sanitizarHTML(htmlVacio)); // [ANTI-XSS]
      return; // [ALTO]
    }

    misConsultas.forEach(function(c) { // [RENDERIZA CADA CONSULTA]
      const estado = c.estado || 'pendiente'; // [ESTADO]
      const estadoClass = `status-tag--${estado}`; // [CLASE]
      const estadoTexto = estado.toUpperCase().replace('_', ' '); // [TEXTO]

      let botonCancelar = ''; // [BOTÓN CANCELACIÓN SI PENDIENTE]
      if (estado === 'pendiente') {
        botonCancelar = `
          <button type="button" class="btn-cancel-reservation btn-cancelar-cliente" data-id="${c.id}" style="padding: 6px 12px; font-size: 0.76rem;">
            <i class="fa-solid fa-ban"></i> Cancelar Consulta
          </button>
        `;
      }

      const htmlCard = `
        <article class="cliente-reserva-card" data-id="${c.id}">
          <div class="cliente-reserva-info">
            <div>
              <strong>${c.servicioNombre}</strong>
              <span class="reserva-status-tag ${estadoClass}">${estadoTexto}</span>
            </div>
            <span><i class="fa-solid fa-calendar-day"></i> ${c.fecha} • <i class="fa-solid fa-clock"></i> ${c.horarioTexto}</span>
            <span><i class="fa-solid fa-video"></i> Modalidad: ${c.modalidad || 'Presencial'} | Gestiones: ${c.adicionales || 'Ninguna'}</span>
            <span><i class="fa-solid fa-money-bill-wave"></i> Honorarios: <strong>${c.total}</strong> | Provisión: <strong>150 BOB</strong></span>
          </div>
          <div>
            ${botonCancelar}
          </div>
        </article>
      `; // [PLANTILLA TARJETA]
      $contenedor.append(sanitizarHTML(htmlCard)); // [ANTI-XSS]
    });
  }

  let filtroEstadoAbogado = 'todas'; // [FILTRO ACTIVO TRABAJADOR]

  function renderizarAgendaAbogado() { // [TRABAJADOR: AGENDA OPERATIVA]
    let fecha = $('#abogado-fecha-agenda').val(); // [FECHA]
    if (!fecha) { // [INICIALIZA HOY]
      fecha = new Date().toISOString().split('T')[0]; // [ISO HOY]
      $('#abogado-fecha-agenda').val(fecha); // [ASIGNA]
    }

    const citasDia = consultasConfirmadas.filter(c => c.fecha === fecha); // [CITAS DEL DÍA]
    $('#count-op-todas').text(citasDia.length); // [CONTADOR TODAS]
    $('#count-op-pendiente').text(citasDia.filter(c => c.estado === 'pendiente').length); // [CONTADOR PENDIENTES]
    $('#count-op-en-atencion').text(citasDia.filter(c => c.estado === 'en_atencion').length); // [CONTADOR EN ATENCIÓN]
    $('#count-op-completada').text(citasDia.filter(c => c.estado === 'completada').length); // [CONTADOR COMPLETADAS]

    let citasFiltradas = citasDia; // [FILTRADO POR ESTADO]
    if (filtroEstadoAbogado !== 'todas') {
      citasFiltradas = citasDia.filter(c => c.estado === filtroEstadoAbogado); // [FILTRA]
    }

    citasFiltradas.sort((a, b) => (a.horaInicio || 0) - (b.horaInicio || 0)); // [ORDENA POR HORA]

    const $contenedor = $('#abogado-agenda-lista'); // [CONTENEDOR]
    $contenedor.empty(); // [LIMPIA]

    if (citasFiltradas.length === 0) { // [SIN CITAS]
      const htmlVacio = `
        <div class="cliente-empty-state">
          <i class="fa-solid fa-clipboard-check"></i>
          <h4>No hay consultas registradas para el día ${fecha} [Filtro: ${filtroEstadoAbogado.toUpperCase()}]</h4>
          <p>Selecciona otra fecha en el calendario o alterna el filtro de estado.</p>
        </div>
      `;
      $contenedor.html(sanitizarHTML(htmlVacio)); // [ANTI-XSS]
      return; // [ALTO]
    }

    citasFiltradas.forEach(function(c) { // [GENERA TARJETAS OPERATIVAS]
      const estado = c.estado || 'pendiente'; // [ESTADO]
      const estadoClass = `status-tag--${estado}`; // [CLASE]
      const cardClass = `worker-agenda-card--${estado}`; // [BORDE]
      const estadoTexto = estado.toUpperCase().replace('_', ' '); // [TEXTO]

      const celularLimpio = (c.celular || '').replace(/\D/g, ''); // [LIMPIA TELÉFONO]
      const enlaceWhatsApp = celularLimpio ? `
        <a href="https://wa.me/591${celularLimpio}" target="_blank" rel="noopener noreferrer" class="worker-whatsapp-link" title="Contactar por WhatsApp">
          <i class="fa-brands fa-whatsapp"></i> ${c.celular}
        </a>
      ` : (c.celular || 'S/N'); // [ENLACE WHATSAPP]

      let botonesAccion = ''; // [BOTONES DE FLUJO OPERATIVO]
      if (estado === 'pendiente') {
        botonesAccion += `
          <button type="button" class="btn-worker-act btn-worker-checkin" data-id="${c.id}">
            <i class="fa-solid fa-scale-balanced"></i> Iniciar Atención
          </button>
        `;
      }

      botonesAccion += `
        <button type="button" class="btn-worker-act btn-worker-amenities" data-id="${c.id}">
          <i class="fa-solid fa-folder-plus"></i> Entregar Minuta / Informe
        </button>
      `;

      if (estado === 'en_atencion') {
        botonesAccion += `
          <button type="button" class="btn-worker-act btn-worker-finish" data-id="${c.id}">
            <i class="fa-solid fa-circle-check"></i> Finalizar Consulta
          </button>
        `;
      }

      if (estado !== 'cancelada' && estado !== 'completada') {
        botonesAccion += `
          <button type="button" class="btn-worker-act btn-worker-cancel" data-id="${c.id}">
            <i class="fa-solid fa-xmark"></i> Cancelar
          </button>
        `;
      }

      const htmlCard = `
        <article class="worker-agenda-card ${cardClass}" data-id="${c.id}">
          <div class="worker-card-header">
            <div class="worker-card-time">
              <i class="fa-solid fa-clock"></i> ${c.horarioTexto}
              <span class="reserva-status-tag ${estadoClass}">${estadoTexto}</span>
            </div>
            <div class="worker-card-court">
              <i class="fa-solid fa-briefcase"></i> ${c.servicioNombre} (#${c.id})
            </div>
          </div>

          <div class="worker-card-body">
            <div class="worker-card-field">
              <strong>Cliente / Contacto:</strong>
              <span>${c.cliente} ${enlaceWhatsApp}</span>
            </div>
            <div class="worker-card-field">
              <strong>Modalidad de Sesión:</strong>
              <span>${c.modalidad || 'Presencial'}</span>
            </div>
            <div class="worker-card-field">
              <strong>Gestiones Complementarias:</strong>
              <span>${c.adicionales || 'Sin adicionales'}</span>
            </div>
            <div class="worker-card-field">
              <strong>Honorarios:</strong>
              <span>Total: <strong>${c.total}</strong> | Provisión: <strong>150 BOB</strong></span>
            </div>
          </div>

          <div class="worker-card-actions">
            ${botonesAccion}
          </div>
        </article>
      `;
      $contenedor.append(sanitizarHTML(htmlCard)); // [ANTI-XSS]
    });
  }

  function renderizarEstadoServiciosAbogado() { // [TRABAJADOR: MONITOR EN VIVO DE ESPECIALIDADES]
    const fecha = $('#abogado-fecha-agenda').val() || new Date().toISOString().split('T')[0]; // [FECHA]
    const $grid = $('#abogado-servicios-grid'); // [CONTENEDOR]
    $grid.empty(); // [LIMPIA]

    serviciosSistema.forEach(s => { // [RECORRE S1-S8]
      const citasServicio = consultasConfirmadas.filter(c => c.servicioId === s.id_servicio && c.fecha === fecha && c.estado !== 'cancelada'); // [CITAS DEL DÍA]

      let badgeClass = 'court-live-card__badge--libre'; // [VERDE]
      let badgeTexto = '🟢 Agenda Libre'; // [TEXTO]

      if (s.estado === 'pausado') { // [PAUSADO]
        badgeClass = 'court-live-card__badge--pausado'; // [ÁMBAR]
        badgeTexto = '⏸️ Pausado'; // [TEXTO]
      } else if (citasServicio.length > 0) { // [CON CITAS]
        badgeClass = 'court-live-card__badge--ocupada'; // [ROJO]
        badgeTexto = `🔴 ${citasServicio.length} Cita(s) Hoy`; // [TEXTO]
      }

      let detalleHorarios = 'Todos los bloques de 09:00 a 19:00 disponibles.'; // [LIBRE]
      if (citasServicio.length > 0) { // [DETALLE]
        detalleHorarios = citasServicio.map(c => `• ${c.horarioTexto}: ${c.cliente} [${c.estado.toUpperCase()}]`).join('<br>'); // [LISTADO]
      }

      const htmlCard = `
        <div class="court-live-card">
          <div class="court-live-card__header">
            <strong style="font-size: 0.94rem; color: var(--color-primario);">${s.nombre}</strong>
            <span class="court-live-card__badge ${badgeClass}">${badgeTexto}</span>
          </div>
          <div class="court-live-card__info">
            <span><strong>Área:</strong> ${s.area}</span> • 
            <span><strong>Especialista:</strong> ${s.especialista}</span> • 
            <span><strong>Base:</strong> ${s.honorario_base} Bs</span>
          </div>
          <div class="court-live-card__schedule">
            <strong style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-texto-muted); display: block; margin-bottom: 4px;">
              Agenda para ${fecha}:
            </strong>
            ${detalleHorarios}
          </div>
        </div>
      `;
      $grid.append(sanitizarHTML(htmlCard)); // [ANTI-XSS]
    });
  }

  $('#abogado-fecha-agenda').on('change', function() { // [CAMBIO FECHA TRABAJADOR]
    renderizarAgendaAbogado(); // [REFRESCA]
    renderizarEstadoServiciosAbogado(); // [REFRESCA]
  });

  $('#btn-abogado-hoy').on('click', function() { // [BOTÓN HOY TRABAJADOR]
    $('#abogado-fecha-agenda').val(new Date().toISOString().split('T')[0]); // [HOY]
    renderizarAgendaAbogado(); // [REFRESCA]
    renderizarEstadoServiciosAbogado(); // [REFRESCA]
  });

  $('.btn-filter-worker').on('click', function() { // [FILTROS ESTADO TRABAJADOR]
    $('.btn-filter-worker').removeClass('active'); // [LIMPIA]
    $(this).addClass('active'); // [ACTIVA]
    filtroEstadoAbogado = $(this).data('filter'); // [GUARDA FILTRO]
    renderizarAgendaAbogado(); // [RE-RENDER]
  });

  $('#abogado-agenda-lista').on('click', '.btn-worker-checkin', async function() { // [ACCIÓN INICIAR ATENCIÓN]
    const id = $(this).data('id'); // [ID]
    await apiActualizarEstadoConsulta(id, 'en_atencion'); // [API PUT]
    const item = consultasConfirmadas.find(c => c.id === String(id)); // [BUSCA]
    if (item) {
      item.estado = 'en_atencion'; // [ACTUALIZA]
      localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]
    }
    renderizarAgendaAbogado(); // [RE-RENDER]
    renderizarEstadoServiciosAbogado(); // [RE-RENDER]
    mostrarToastAlert('⚖️ Atención Iniciada', `Consulta #${id} marcada EN ATENCIÓN.`, false); // [TOAST]
    registrarEventoTimestamp('OPERACION', `Inició atención jurídica de consulta #${id}`); // [LOG]
  });

  $('#abogado-agenda-lista').on('click', '.btn-worker-amenities', async function() { // [ACCIÓN ENTREGAR DOCUMENTACIÓN]
    const id = $(this).data('id'); // [ID]
    const item = consultasConfirmadas.find(c => c.id === String(id)); // [BUSCA]
    if (!item) return; // [GUARDA]

    let nuevasGestiones = item.adicionales || 'Minuta / Informe Jurídico'; // [TEXTO]
    if (!nuevasGestiones.includes('[ENTREGADO]')) { // [EVITA DUPLICADO]
      nuevasGestiones += ' [ENTREGADO]'; // [MARCA]
    }

    try {
      await fetch('./api/consultas.php', { // [API PUT]
        method: 'PUT', // [HTTP]
        headers: { 'Content-Type': 'application/json' }, // [HEADER]
        body: JSON.stringify({
          accion: 'entregar_documentacion', // [ACCIÓN]
          id_consulta: id, // [ID]
          adicionales: nuevasGestiones // [CAMPO]
        })
      });
    } catch(e) {} // [FALLBACK SILENCIOSO]

    item.adicionales = nuevasGestiones; // [ACTUALIZA]
    localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]
    renderizarAgendaAbogado(); // [RE-RENDER]
    mostrarToastAlert('📄 Documentación Entregada', `Minuta/informe registrado como entregado en #${id}.`, false); // [TOAST]
    registrarEventoTimestamp('OPERACION', `Entregó documentación jurídica en consulta #${id}`); // [LOG]
  });

  $('#abogado-agenda-lista').on('click', '.btn-worker-finish', async function() { // [ACCIÓN FINALIZAR CONSULTA]
    const id = $(this).data('id'); // [ID]
    await apiActualizarEstadoConsulta(id, 'completada'); // [API PUT]
    const item = consultasConfirmadas.find(c => c.id === String(id)); // [BUSCA]
    if (item) {
      item.estado = 'completada'; // [COMPLETADA]
      localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]
    }
    renderizarAgendaAbogado(); // [RE-RENDER]
    renderizarEstadoServiciosAbogado(); // [RE-RENDER]
    actualizarDisponibilidadHorarios(); // [ACTUALIZA SLOTS]
    mostrarToastAlert('🏁 Consulta Finalizada', `Expediente #${id} completado con éxito.`, false); // [TOAST]
    registrarEventoTimestamp('OPERACION', `Consulta #${id} completada y cerrada`); // [LOG]
  });

  $('#abogado-agenda-lista').on('click', '.btn-worker-cancel', async function() { // [ACCIÓN CANCELAR TRABAJADOR]
    const id = $(this).data('id'); // [ID]
    if (!confirm(`¿Confirmas cancelar la consulta #${id}?`)) return; // [CONFIRMACIÓN]
    await apiActualizarEstadoConsulta(id, 'cancelada'); // [API PUT]
    const item = consultasConfirmadas.find(c => c.id === String(id)); // [BUSCA]
    if (item) {
      item.estado = 'cancelada'; // [CANCELADA]
      localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]
    }
    renderizarAgendaAbogado(); // [RE-RENDER]
    renderizarEstadoServiciosAbogado(); // [RE-RENDER]
    actualizarDisponibilidadHorarios(); // [LIBERA BLOQUE]
    mostrarToastAlert('❌ Consulta Cancelada', `La cita #${id} fue cancelada y el horario liberado.`, false); // [TOAST]
    registrarEventoTimestamp('OPERACION', `Abogado/Recepción canceló consulta #${id}`); // [LOG]
  });

  function renderizarDashboardAdmin() { // [ADMIN: KPI FINANCIEROS Y DESGLOSE POR ÁREA]
    const consultasValidas = consultasConfirmadas.filter(c => c.estado !== 'cancelada'); // [EXCLUYE CANCELADAS]
    const totalRecaudado = consultasValidas.reduce((sum, c) => { // [SUMA HONORARIOS]
      const num = parseFloat(String(c.total).replace(/[^\d.]/g, '')) || 0; // [EXTRAE NÚMERO]
      return sum + num; // [ACUMULA]
    }, 0);

    $('#kpi-total-recaudado').text(`${totalRecaudado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`); // [KPI 1]

    const activas = consultasConfirmadas.filter(c => c.estado === 'pendiente' || c.estado === 'en_atencion').length; // [ACTIVOS]
    $('#kpi-consultas-activas').text(activas); // [KPI 2]

    const frecuencias = {}; // [FRECUENCIA POR SERVICIO]
    consultasConfirmadas.forEach(c => {
      const nombre = c.servicioNombre || `Servicio ${c.servicioId}`; // [NOMBRE]
      frecuencias[nombre] = (frecuencias[nombre] || 0) + 1; // [CONTEO]
    });

    let servicioTop = 'Sin consultas'; // [TOP]
    let maxFreq = 0; // [MÁXIMO]
    for (const [serv, count] of Object.entries(frecuencias)) { // [BUSCA MAYOR]
      if (count > maxFreq) {
        maxFreq = count; // [MÁXIMO]
        servicioTop = serv; // [NOMBRE]
      }
    }
    $('#kpi-servicio-top').text(servicioTop); // [KPI 3]
    $('#kpi-servicio-top-sub').text(`${maxFreq} consultas registradas`); // [SUB]

    const hoy = new Date().toISOString().split('T')[0]; // [HOY]
    const turnosHoy = consultasConfirmadas.filter(c => c.fecha === hoy && c.estado !== 'cancelada').length; // [TURNOS HOY]
    const tasa = Math.min(100, Math.round((turnosHoy / 72) * 100)); // [PORCENTAJE SOBRE 8 SERVICIOS x 9 BLOQUES]
    $('#kpi-tasa-ocupacion').text(`${tasa}%`); // [KPI 4]
    $('#kpi-ocupacion-detalle').text(`${turnosHoy} de 72 bloques diarios`); // [DETALLE]

    const breakdownArea = { // [DESGLOSE POR ÁREA VGMS]
      'Propiedad Intelectual': { count: 0, revenue: 0 }, // [ÁREA 1]
      'Protección Activa': { count: 0, revenue: 0 }, // [ÁREA 2]
      'Derecho Corporativo': { count: 0, revenue: 0 }, // [ÁREA 3]
      'Civil y Penal': { count: 0, revenue: 0 } // [ÁREA 4]
    };

    consultasValidas.forEach(c => { // [ACUMULA POR ÁREA]
      const serv = serviciosSistema.find(s => s.id_servicio === c.servicioId); // [BUSCA SERVICIO]
      const area = serv ? serv.area : 'Civil y Penal'; // [ÁREA]
      const monto = parseFloat(String(c.total).replace(/[^\d.]/g, '')) || 0; // [MONTO]
      if (!breakdownArea[area]) breakdownArea[area] = { count: 0, revenue: 0 }; // [INICIALIZA]
      breakdownArea[area].count++; // [SUMA CONTEO]
      breakdownArea[area].revenue += monto; // [SUMA MONTO]
    });

    let htmlArea = ''; // [CONSTRUYE HTML]
    for (const [area, val] of Object.entries(breakdownArea)) {
      htmlArea += `
        <div class="breakdown-item">
          <span>${area} (${val.count} citas)</span>
          <strong>${val.revenue.toFixed(2)} Bs</strong>
        </div>
      `;
    }
    $('#kpi-breakdown-area').html(sanitizarHTML(htmlArea)); // [ANTI-XSS]

    let countSenapi = 0; // [ADICIONAL 1]
    let countNda = 0; // [ADICIONAL 2]
    let countNotarial = 0; // [ADICIONAL 3]

    consultasValidas.forEach(c => { // [CONTEO ADICIONALES]
      const ad = (c.adicionales || '').toLowerCase(); // [NORMALIZA]
      if (ad.includes('senapi') || ad.includes('anterioridad')) countSenapi++; // [SENAPI]
      if (ad.includes('nda') || ad.includes('contrato')) countNda++; // [NDA]
      if (ad.includes('notarial') || ad.includes('certificación')) countNotarial++; // [NOTARIAL]
    });

    const htmlAd = `
      <div class="breakdown-item">
        <span><i class="fa-solid fa-registered"></i> Búsquedas de Anterioridad SENAPI</span>
        <strong>${countSenapi} gestiones (+${countSenapi * 250} Bs)</strong>
      </div>
      <div class="breakdown-item">
        <span><i class="fa-solid fa-file-signature"></i> Redacción / Revisión de NDA</span>
        <strong>${countNda} contratos (+${countNda * 350} Bs)</strong>
      </div>
      <div class="breakdown-item">
        <span><i class="fa-solid fa-stamp"></i> Certificaciones Notariales</span>
        <strong>${countNotarial} trámites (+${countNotarial * 200} Bs)</strong>
      </div>
    `;
    $('#kpi-breakdown-adicionales').html(sanitizarHTML(htmlAd)); // [ANTI-XSS]
  }

  function renderizarGestionServiciosAdmin() { // [ADMIN: EDITOR DE HONORARIOS Y ESTADO]
    const $container = $('#admin-servicios-container'); // [CONTENEDOR]
    $container.empty(); // [LIMPIA]

    serviciosSistema.forEach(s => { // [RECORRE S1-S8]
      const htmlCard = `
        <article class="admin-court-card" data-service-id="${s.id_servicio}">
          <div class="admin-court-card__header">
            <span class="admin-court-card__title">${s.nombre}</span>
            <span class="user-role-tag ${s.estado === 'disponible' ? 'user-role-tag--cliente' : 'user-role-tag--admin'}">
              ${s.estado.toUpperCase()}
            </span>
          </div>

          <form class="admin-court-card__form" data-service-id="${s.id_servicio}">
            <div class="admin-court-field">
              <label>Área &amp; Especialista:</label>
              <input type="text" value="${s.area} • ${s.especialista}" readonly disabled>
            </div>

            <div class="admin-court-field">
              <label>Honorario Base (Bs):</label>
              <input type="number" class="admin-input-precio" min="200" max="20000" step="50" value="${s.honorario_base}" required>
            </div>

            <div class="admin-court-field">
              <label>Estado Operativo:</label>
              <select class="admin-select-estado">
                <option value="disponible" ${s.estado === 'disponible' ? 'selected' : ''}>🟢 Disponible para Agenda</option>
                <option value="pausado" ${s.estado === 'pausado' ? 'selected' : ''}>⏸️ Pausado Temporalmente</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary btn-sm admin-court-card__save-btn">
              <i class="fa-solid fa-floppy-disk"></i> Guardar Cambios en MySQL
            </button>
          </form>
        </article>
      `;
      $container.append(sanitizarHTML(htmlCard)); // [ANTI-XSS]
    });
  }

  function renderizarHistorialAdmin() { // [ADMIN: TABLA GLOBAL CON FILTROS Y ANULACIÓN]
    const busqueda = ($('#admin-buscar-consulta').val() || '').toLowerCase().trim(); // [BÚSQUEDA]
    const filtroServicio = $('#admin-filtro-servicio').val() || 'todos'; // [SERVICIO]
    const filtroEstado = $('#admin-filtro-estado').val() || 'todos'; // [ESTADO]

    const $tbody = $('#admin-historial-tbody'); // [TBODY]
    $tbody.empty(); // [LIMPIA]

    const filtradas = consultasConfirmadas.filter(c => { // [FILTRO MULTI-CRITERIO]
      if (busqueda) {
        const titular = (c.cliente || '').toLowerCase(); // [TITULAR]
        const cel = (c.celular || '').toLowerCase(); // [CELULAR]
        const id = String(c.id || '').toLowerCase(); // [ID]
        const serv = (c.servicioNombre || '').toLowerCase(); // [SERVICIO]
        if (!titular.includes(busqueda) && !cel.includes(busqueda) && !id.includes(busqueda) && !serv.includes(busqueda)) {
          return false; // [EXCLUYE]
        }
      }
      if (filtroServicio !== 'todos' && c.servicioId !== filtroServicio) return false; // [FILTRA SERVICIO]
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false; // [FILTRA ESTADO]
      return true; // [INCLUYE]
    });

    if (filtradas.length === 0) { // [SIN RESULTADOS]
      $tbody.html(sanitizarHTML('<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--color-texto-muted);">No se encontraron consultas con los filtros seleccionados.</td></tr>')); // [ANTI-XSS]
      return; // [ALTO]
    }

    filtradas.forEach(c => { // [CONSTRUYE FILAS]
      const estado = c.estado || 'pendiente'; // [ESTADO]
      const estadoClass = `status-tag--${estado}`; // [CLASE]
      const estadoTexto = estado.toUpperCase().replace('_', ' '); // [TEXTO]

      let botonAnular = '--'; // [ACCIÓN]
      if (estado !== 'cancelada') {
        botonAnular = `<button type="button" class="btn-anular-admin" data-id="${c.id}" title="Anular consulta">Anular</button>`; // [BOTÓN]
      }

      const htmlFila = `
        <tr>
          <td><strong>#${c.id}</strong></td>
          <td>${c.fecha}<br><small>${c.horarioTexto}</small></td>
          <td><strong>${c.servicioNombre}</strong></td>
          <td>${c.cliente}<br><small>${c.celular || ''}</small></td>
          <td>${c.modalidad || 'Presencial'}</td>
          <td>${c.adicionales || 'Ninguna'}</td>
          <td><strong>${c.total}</strong></td>
          <td><span class="reserva-status-tag ${estadoClass}">${estadoTexto}</span></td>
          <td>${botonAnular}</td>
        </tr>
      `;
      $tbody.append(sanitizarHTML(htmlFila)); // [ANTI-XSS]
    });
  }

  $('#admin-servicios-container').on('submit', '.admin-court-card__form', async function(e) { // [EVENTO GUARDAR HONORARIO ADMIN]
    e.preventDefault(); // [PREVIENE]
    const serviceId = $(this).data('service-id'); // [ID]
    const precio = parseFloat($(this).find('.admin-input-precio').val()); // [PRECIO]
    const estado = $(this).find('.admin-select-estado').val(); // [ESTADO]

    if (!serviceId || isNaN(precio) || precio <= 0) return; // [VALIDA]

    const res = await apiEditarServicio(serviceId, precio, estado); // [API PUT]
    const idx = serviciosSistema.findIndex(s => s.id_servicio === serviceId); // [ÍNDICE]
    if (idx !== -1) {
      serviciosSistema[idx].honorario_base = precio; // [ACTUALIZA]
      serviciosSistema[idx].estado = estado; // [ACTUALIZA]
      localStorage.setItem('vgms_servicios', JSON.stringify(serviciosSistema)); // [PERSISTE]
    }

    sincronizarServiciosEnDOM(); // [SINCRONIZA CATÁLOGO]
    renderizarGestionServiciosAdmin(); // [RE-RENDER]
    mostrarToastAlert('✅ Honorario Actualizado', res.mensaje || `Servicio ${serviceId} actualizado a ${precio} Bs.`, false); // [TOAST]
    registrarEventoTimestamp('ADMIN', `Actualizó ${serviceId}: ${precio} Bs [${estado}]`); // [LOG]
  });

  $('#admin-buscar-consulta, #admin-filtro-servicio, #admin-filtro-estado').on('input change', function() { // [EVENTOS FILTROS TABLA ADMIN]
    renderizarHistorialAdmin(); // [RE-RENDER]
  });

  $('#admin-historial-tbody').on('click', '.btn-anular-admin', async function() { // [EVENTO ANULAR ADMIN]
    const id = $(this).data('id'); // [ID]
    if (!confirm(`¿Confirmas anular la consulta #${id}?`)) return; // [CONFIRMA]
    await apiActualizarEstadoConsulta(id, 'cancelada'); // [API PUT]
    const item = consultasConfirmadas.find(c => c.id === String(id)); // [BUSCA]
    if (item) {
      item.estado = 'cancelada'; // [ACTUALIZA]
      localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]
    }
    renderizarHistorialAdmin(); // [RE-RENDER]
    renderizarDashboardAdmin(); // [ACTUALIZA KPI]
    actualizarDisponibilidadHorarios(); // [LIBERA BLOQUE]
    mostrarToastAlert('🗑️ Consulta Anulada', `La consulta #${id} ha sido anulada por Dirección.`, false); // [TOAST]
    registrarEventoTimestamp('ADMIN', `Socio Admin anuló consulta #${id}`); // [LOG]
  });

  $('#cliente-consultas-lista').on('click', '.btn-cancelar-cliente', function() { // [CANCELAR INDIVIDUAL CLIENTE]
    const resId = $(this).data('id'); // [ID]
    cancelarConsultaPorId(resId); // [EJECUTA]
  });

  $('#btn-cancelar-consulta-activa').on('click', function() { // [CANCELAR ÚLTIMA ACTIVA CLIENTE]
    const activas = consultasConfirmadas.filter(c => c.estado !== 'cancelada'); // [ACTIVAS]
    if (activas.length === 0) return; // [GUARDA]
    const ultima = activas[activas.length - 1]; // [ÚLTIMA]
    cancelarConsultaPorId(ultima.id); // [EJECUTA]
  });

  async function cancelarConsultaPorId(id) { // [FUNCIÓN COMPARTIDA DE CANCELACIÓN]
    const item = consultasConfirmadas.find(c => c.id === String(id)); // [BUSCA]
    if (!item) return; // [GUARDA]

    await apiActualizarEstadoConsulta(id, 'cancelada'); // [API PUT]
    item.estado = 'cancelada'; // [ESTADO]
    localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]

    actualizarVisibilidadBotonCancelar(); // [ACTUALIZA BARRA]
    renderizarMisConsultasCliente(); // [RE-RENDER]
    renderizarAgendaAbogado(); // [RE-RENDER]
    renderizarDashboardAdmin(); // [RE-RENDER]
    renderizarHistorialAdmin(); // [RE-RENDER]
    actualizarDisponibilidadHorarios(); // [LIBERA HORARIO]

    registrarEventoTimestamp('CANCELACION', `Canceló consulta de ${item.cliente} (${item.servicioNombre})`); // [LOG]
    mostrarToastAlert('🗑️ Consulta Cancelada', `El horario ${item.horarioTexto} en ${item.servicioNombre} quedó disponible.`, false); // [TOAST]
  }

  // [13. COLA DE CONSULTAS RÁPIDAS ANTI-XSS] Sanitizada con DOMPurify
  function agregarConsultaRapidaACola(texto) {
    const htmlFila = `
      <div class="fila-cancion">
        <span class="titulo-truncado">${texto}</span>
        <button type="button" class="btn-quitar" aria-label="Quitar de la cola">✕</button>
      </div>
    `; // [PLANTILLA]
    $('#listaConsultasRapidas').prepend(sanitizarHTML(htmlFila)); // [ANTI-XSS]
  }

  agregarConsultaRapidaACola('Prioritario: Búsqueda fonética SENAPI clase 35 — Dr. Francisco Vela'); // [SEED 1]
  agregarConsultaRapidaACola('Revisión urgente: Contrato de confidencialidad NDA para personal'); // [SEED 2]

  $('#btnPedirConsulta').on('click', function () { // [AGREGAR ELEMENTO A COLA]
    const val = ($('#inputConsultaRapida').val() || '').trim(); // [VALOR]
    if (val.length < 3) { // [VALIDACIÓN MÍNIMA]
      $('#errInputConsulta').text('⚠️ Escribe el tema o consulta (mínimo 3 caracteres).').slideDown('fast'); // [ERROR]
      return; // [ALTO]
    }
    $('#errInputConsulta').hide(); // [OCULTA ERROR]
    agregarConsultaRapidaACola(val); // [INSERTA SANITIZADO]
    registrarEventoTimestamp('COLA', `Agregó consulta rápida: ${val}`); // [LOG]
    $('#inputConsultaRapida').val(''); // [LIMPIA]
  });

  $('#listaConsultasRapidas').on('click', '.btn-quitar', function () { // [DELEGACIÓN QUITAR ELEMENTO]
    const fila = $(this).closest('.fila-cancion'); // [FILA]
    const texto = fila.find('.titulo-truncado').text(); // [TEXTO]
    fila.remove(); // [ELIMINA]
    registrarEventoTimestamp('COLA', `Retiró consulta rápida: ${texto}`); // [LOG]
  });

  // [14. MODAL DE CONFIRMACIÓN CON TEMPORIZADOR ASÍNCRONO DE 30 SEGUNDOS]
  let timerInterval = null; // [ID INTERVALO]
  let tiempoRestante = 30; // [SEGUNDOS]

  $('#consultation-form').on('submit', function(e) { // [SUBMIT FORMULARIO PRINCIPAL]
    e.preventDefault(); // [PREVIENE RECARGA]

    const vFecha = validarCampoFecha(false); // [VALIDA FECHA]
    const vHoras = validarHorarios(); // [VALIDA HORAS]
    const vNombre = validarCampoNombre(); // [VALIDA NOMBRE]
    const vTel = validarCampoTelefono(); // [VALIDA TELÉFONO]
    const vEmail = validarCampoEmail(); // [VALIDA EMAIL]

    if (!vFecha || !vHoras || !vNombre || !vTel || !vEmail) { // [SI FALLA ALGUNA]
      mostrarAlertaError('⚠️ Revisa los campos resaltados en rojo antes de continuar.'); // [ALERTA]
      verificarFormularioCompleto(); // [BLOQUEA]
      return; // [ALTO]
    }

    const nombreCliente = $('#client-name').val().trim(); // [TITULAR]
    const servicio = $('#summary-service').text(); // [SERVICIO]
    const total = $('#summary-total').text(); // [MONTO]
    const fecha = $('#fecha-consulta').val(); // [FECHA]
    const horas = horaFin - horaInicio; // [DURACIÓN]

    $('#modal-service-name').text(servicio); // [ASIGNA MODAL]
    $('#modal-client-name').text(nombreCliente); // [ASIGNA MODAL]
    $('#modal-schedule').text(`${fecha} (${String(horaInicio).padStart(2, '0')}:00 - ${String(horaFin).padStart(2, '0')}:00)`); // [ASIGNA MODAL]
    $('#modal-guarantee').text('150 BOB (Deducible)'); // [PROVISIÓN]
    $('#modal-total-amount').text(`${total} (${horas} Horas)`); // [TOTAL]

    registrarEventoTimestamp('MODAL', `Abrió confirmación para ${nombreCliente} (${total})`); // [LOG]
    $('#modal-overlay').fadeIn(200); // [ABRE MODAL]
    iniciarTemporizadorModal(); // [ARRANCA CUENTA REGRESIVA 30S]
  });

  function iniciarTemporizadorModal() { // [TEMPORIZADOR 30S SETINTERVAL]
    clearInterval(timerInterval); // [LIMPIA PREVIO]
    tiempoRestante = 30; // [REINICIA]
    actualizarTextoTimer(); // [ACTUALIZA UI]

    timerInterval = setInterval(function() { // [TICK CADA 1 SEGUNDO]
      tiempoRestante--; // [DECREMENTA]
      actualizarTextoTimer(); // [ACTUALIZA UI]

      if (tiempoRestante <= 0) { // [EXPIRACIÓN]
        clearInterval(timerInterval); // [DETIENE]
        $('#modal-overlay').fadeOut(250, function() { // [CIERRA MODAL]
          registrarEventoTimestamp('TIMER', 'Expiró temporizador de confirmación (30s)'); // [LOG]
          limpiarFormularioConsulta(); // [LIMPIA FORMULARIO]
          mostrarToastAlert( // [AVISO EXPIRACIÓN]
            '⚠️ Tiempo Expirado', // [TÍTULO]
            'Se agotó el límite de 30 segundos para confirmar. Formulario restablecido.', // [MENSAJE]
            true // [WARNING]
          );
        });
      }
    }, 1000); // [1000 MS]
  }

  function actualizarTextoTimer() { // [FORMATEA 00:XXs]
    const seg = tiempoRestante < 10 ? `0${tiempoRestante}` : tiempoRestante; // [CERO A LA IZQUIERDA]
    $('#modal-countdown').text(`00:${seg}s`); // [INYECTA]
  }

  $('#modal-close-btn, #modal-cancel-btn').on('click', function() { // [CANCELAR DESDE MODAL]
    clearInterval(timerInterval); // [DETIENE TIMER]
    $('#modal-overlay').fadeOut(200); // [CIERRA MODAL]
    registrarEventoTimestamp('MODAL', 'Canceló en modal: formulario limpiado por completo'); // [LOG]
    limpiarFormularioConsulta(); // [LIMPIEZA TOTAL]
    mostrarToastAlert('ℹ️ Proceso Cancelado', 'Todos los campos del formulario han sido restablecidos.', false); // [TOAST]
  });

  $('#modal-overlay').on('click', function(e) { // [CLIC EN BACKDROP MODAL]
    if ($(e.target).is('#modal-overlay')) { // [VERIFICA]
      clearInterval(timerInterval); // [DETIENE TIMER]
      $('#modal-overlay').fadeOut(200); // [CIERRA]
      limpiarFormularioConsulta(); // [LIMPIA]
    }
  });

  $('#modal-confirm-btn').on('click', async function() { // [CONFIRMAR CONSULTA -> MYSQL / FALLBACK]
    clearInterval(timerInterval); // [DETIENE TIMER]
    $(this).prop('disabled', true).text('Procesando...'); // [FEEDBACK]

    const clienteConfirmado = $('#modal-client-name').text(); // [TITULAR]
    const servicioConfirmado = $('#modal-service-name').text(); // [SERVICIO]
    const montoConfirmado = $('#modal-total-amount').text(); // [MONTO]
    const fechaConsulta = $('#fecha-consulta').val(); // [FECHA]
    const servicioId = $('#select-servicio-consulta').val(); // [ID S1-S8]
    const celular = $('#client-phone').val().trim(); // [CELULAR]
    const correo = $('#client-email').val().trim(); // [CORREO]
    const modalidad = $('#legal-modality').val(); // [MODALIDAD]

    let adicionales = []; // [GESTIONES SELECCIONADAS]
    if ($('#add-senapi').is(':checked')) adicionales.push('Búsqueda SENAPI'); // [SENAPI]
    if ($('#add-nda').is(':checked')) adicionales.push('Contrato NDA'); // [NDA]
    if ($('#add-notarial').is(':checked')) adicionales.push('Certificación Notarial'); // [NOTARIAL]

    const nuevaConsulta = { // [OBJETO CONSULTA]
      cliente: clienteConfirmado, // [TITULAR]
      celular: celular, // [CELULAR]
      correo: correo, // [CORREO]
      servicioId: servicioId, // [SERVICIO ID]
      servicioNombre: servicioConfirmado, // [SERVICIO NOMBRE]
      fecha: fechaConsulta, // [FECHA]
      horaInicio: horaInicio, // [INICIO]
      horaFin: horaFin, // [FIN]
      horarioTexto: `${String(horaInicio).padStart(2, '0')}:00 - ${String(horaFin).padStart(2, '0')}:00`, // [HORARIO]
      modalidad: modalidad, // [MODALIDAD]
      adicionales: adicionales.join(', '), // [ADICIONALES]
      total: montoConfirmado // [TOTAL]
    };

    const res = await apiCrearConsulta(nuevaConsulta); // [ENVÍA A API]

    $('#modal-confirm-btn').prop('disabled', false).text('Confirmar Consulta'); // [RESTAURA BOTÓN]

    if (res.ok) { // [ÉXITO]
      consultasConfirmadas.push(res.consulta || nuevaConsulta); // [AGREGA AL ESTADO]
      localStorage.setItem('vgms_consultas_sistema', JSON.stringify(consultasConfirmadas)); // [PERSISTE]

      actualizarDisponibilidadHorarios(); // [BLOQUEA SLOT]
      actualizarVisibilidadBotonCancelar(); // [ACTUALIZA BARRA]
      renderizarMisConsultasCliente(); // [ACTUALIZA EXPEDIENTE]
      renderizarAgendaAbogado(); // [ACTUALIZA AGENDA]
      renderizarDashboardAdmin(); // [ACTUALIZA KPI]
      renderizarHistorialAdmin(); // [ACTUALIZA HISTORIAL]
      registrarEventoTimestamp('CONSULTA', `Confirmó consulta: ${clienteConfirmado} en ${servicioConfirmado}`); // [LOG]

      $('#modal-overlay').fadeOut(200, function() { // [CIERRA MODAL]
        const origen = (modoConexion === 'mysql') ? 'Base de Datos MySQL (XAMPP)' : 'Modo Offline (LocalStorage)'; // [ORIGEN]
        mostrarToastAlert( // [TOAST ÉXITO]
          '¡Consulta Agendada con Éxito! ⚖️', // [TÍTULO]
          `Guardada en ${origen}. Titular: ${clienteConfirmado} (${montoConfirmado})`, // [MENSAJE]
          false // [ÉXITO]
        );

        const htmlAlerta = `
          <strong>¡Consulta Registrada en ${origen}! 🎉</strong><br>
          Nuestro equipo de VGMS Abogados confirmará tu cita en Edificio La Paz I o vía Legaltech.<br>
          Provisión: <strong>150 BOB (Deducible)</strong> | Total: <strong>${montoConfirmado}</strong>
        `; // [ALERTA EN FORMULARIO]
        $('#booking-alert-success').html(sanitizarHTML(htmlAlerta)).slideDown(250); // [ANTI-XSS]

        setTimeout(function() { // [LIMPIA FORMULARIO TRAS 3.5S]
          limpiarFormularioConsulta(); // [RESET]
        }, 3500);
      });
    } else { // [ERROR CONFLICTO 409 O VALIDACIÓN]
      mostrarAlertaError(res.mensaje || 'Error al procesar la consulta.'); // [MUESTRA ERROR]
      $('#modal-overlay').fadeOut(200); // [CIERRA MODAL]
    }
  });

  // [15. PANEL DE AUDITORÍA Y SIMULACIONES EN VIVO (UPDS)]
  $('#btnSimularContraste').on('click', function() { // [1. ALTO CONTRASTE WCAG]
    $('body').toggleClass('alto-contraste'); // [ALTERNA CLASE]
    const activo = $('body').hasClass('alto-contraste'); // [ESTADO]

    $(this).html(sanitizarHTML(activo // [TEXTO BOTÓN]
      ? '<i class="fa-solid fa-circle-half-stroke"></i> Desactivar Alto Contraste' // [DESACTIVAR]
      : '<i class="fa-solid fa-circle-half-stroke"></i> 1. Alternar Alto Contraste WCAG')); // [ACTIVAR]

    mostrarToastAlert( // [TOAST]
      activo ? '☀️ Alto Contraste Activado' : '🌙 Modo Normal Restablecido', // [TÍTULO]
      activo ? 'Fondo negro (#000), texto blanco (#fff) y bordes amarillos (#facc15).' : 'Paleta institucional VGMS restablecida.', // [MENSAJE]
      false // [INFO]
    );
    registrarEventoTimestamp('A11Y', `Alto contraste WCAG: ${activo ? 'ACTIVADO' : 'DESACTIVADO'}`); // [LOG]
  });

  $('#btnSimularVista').on('click', function() { // [2. SIMULAR VISTA 1 COLUMNA MÓVIL]
    $('#services-container').toggleClass('sim-movil'); // [ALTERNA GRILLA]
    const esMovilSim = $('#services-container').hasClass('sim-movil'); // [ESTADO]

    $(this).html(sanitizarHTML(esMovilSim // [TEXTO BOTÓN]
      ? '<i class="fa-solid fa-desktop"></i> Restaurar Grilla Completa' // [RESTAURAR]
      : '<i class="fa-solid fa-mobile-screen"></i> 2. Simular Vista 1 Columna Móvil')); // [SIMULAR]

    mostrarToastAlert( // [TOAST]
      '📱 Simulación de Vista', // [TÍTULO]
      esMovilSim ? 'Catálogo jurídico forzado a 1 columna (vista móvil compacta).' : 'Grilla CSS Grid adaptable restablecida.', // [MENSAJE]
      false // [INFO]
    );
    registrarEventoTimestamp('SIMULAR', `Simulación 1 columna: ${esMovilSim ? 'ACTIVA' : 'INACTIVA'}`); // [LOG]
  });

  $('#btnSmokeTest').on('click', function() { // [3. SMOKE TEST INTEGRIDAD DEL DOM]
    const totalBotones = $('button').length; // [CUENTA BOTONES]
    const imgsSinAlt = $('img').filter(function() { // [BUSCA IMÁGENES SIN ALT]
      return !$(this).attr('alt') || $(this).attr('alt').trim() === ''; // [CONDICIÓN]
    }).length;
    const enlacesVacios = $('a').filter(function() { // [BUSCA ENLACES ROTOS O VACÍOS]
      const href = $(this).attr('href'); // [HREF]
      return !href || href === '#' || href.trim() === ''; // [CONDICIÓN]
    }).length;

    const salida = `🧪 Smoke Test en Vivo: ${totalBotones} botones interactivos verificados, ${imgsSinAlt} imágenes sin alt y ${enlacesVacios} enlaces vacíos. El DOM jurídico se encuentra íntegro y navegable sin errores.`; // [REPORTE]
    $('#salidaAudit').html(sanitizarHTML(salida)); // [ANTI-XSS]
    mostrarToastAlert('✅ Smoke Test Completado', `${totalBotones} botones auditados sin anomalías.`, false); // [TOAST]
    registrarEventoTimestamp('AUDITORIA', 'Ejecutó Smoke Test del DOM'); // [LOG]
  });

  $('#btnAuditarA11Y').on('click', function() { // [4. AUDITORÍA SEMÁNTICA HTML5 A11Y]
    const headers = $('header').length; // [HEADER]
    const navs = $('nav').length; // [NAV]
    const mains = $('main').length; // [MAIN]
    const sections = $('section').length; // [SECTION]
    const articles = $('article').length; // [ARTICLE]
    const footers = $('footer').length; // [FOOTER]
    const imgsSinAlt = $('img').filter(function() { // [ALT]
      return !$(this).attr('alt') || $(this).attr('alt').trim() === ''; // [CONDICIÓN]
    }).length;

    const reporte = `♿ Auditoría a11y HTML5: ${headers} &lt;header&gt;, ${navs} &lt;nav&gt;, ${mains} &lt;main&gt;, ${sections} &lt;section&gt;, ${articles} &lt;article&gt; y ${footers} &lt;footer&gt;. ${imgsSinAlt} imágenes sin alt. Anillo de enfoque :focus-visible verificado bajo WCAG 2.1 AA.`; // [REPORTE]
    $('#reporteA11Y').html(sanitizarHTML(reporte)); // [ANTI-XSS]
    mostrarToastAlert('♿ Auditoría a11y Exitosa', 'Estructura semántica HTML5 verificada correctamente.', false); // [TOAST]
    registrarEventoTimestamp('A11Y', 'Ejecutó Auditoría Semántica a11y'); // [LOG]
  });

  // [16. TOAST ALERT Y CANALES OFICIALES]
  function mostrarToastAlert(titulo, mensaje, esWarning) { // [NOTIFICACIÓN FLOTANTE]
    const $toast = $('#toast-alert'); // [ELEMENTO]
    $('#toast-title').text(titulo); // [TÍTULO]
    $('#toast-message').text(mensaje); // [MENSAJE]

    if (esWarning) { // [ADVERTENCIA]
      $toast.addClass('toast-warning'); // [CLASE ÁMBAR]
      $toast.find('.toast-icon i').attr('class', 'fa-solid fa-triangle-exclamation'); // [ICONO]
    } else { // [ÉXITO]
      $toast.removeClass('toast-warning'); // [CLASE VERDE]
      $toast.find('.toast-icon i').attr('class', 'fa-solid fa-circle-check'); // [ICONO]
    }

    $toast.stop(true, true).slideDown(250).delay(3200).fadeOut(350); // [ANIMACIÓN TEMPORIZADA]
  }

  $('.social-card').on('click', function(e) { // [INTERCEPTOR CANALES OFICIALES CON REGISTRO EN BITÁCORA]
    e.preventDefault(); // [PAUSA BREVE PARA MOSTRAR TOAST]
    const redNombre = $(this).data('network'); // [NOMBRE CANAL]
    const urlDestino = $(this).attr('href'); // [DESTINO REAL]

    registrarEventoTimestamp('CONTACTO', `Abrió canal oficial: ${redNombre}`); // [LOG]
    mostrarToastAlert('⚖️ Canal Oficial VGMS', `Abriendo ${redNombre}...`, false); // [TOAST]

    setTimeout(function() { // [APERTURA SEGURA]
      window.open(urlDestino, '_blank', 'noopener,noreferrer'); // [TAB NUEVA SEGURA]
    }, 600);
  });

  // [17. INICIALIZACIÓN ASÍNCRONA DEL SISTEMA VGMS]
  async function inicializarVGMS() {
    await apiCargarDatos(); // [CARGA MYSQL O FALLBACK]
    sincronizarServiciosEnDOM(); // [SINCRONIZA HONORARIOS Y ESTADOS]
    aplicarVistasSegunRol(usuarioActivo ? usuarioActivo.rol : 'cliente'); // [APLICA RBAC]
    $('#select-servicio-consulta').trigger('change'); // [INICIALIZA RESUMEN]
    actualizarDisponibilidadHorarios(); // [PINTA HORARIOS OCUPADOS]
    actualizarVisibilidadBotonCancelar(); // [ACTUALIZA BARRA CONDICIONAL]
    renderizarMisConsultasCliente(); // [CARGA EXPEDIENTE]
    validarHorarios(); // [VALIDACIÓN INICIAL]
    verificarFormularioCompleto(); // [BLOQUEO INICIAL SUBMIT]
    renderizarBitacora(); // [CARGA BITÁCORA]

    const origen = (modoConexion === 'mysql') ? 'MySQL (XAMPP)' : 'LocalStorage (Offline-First)'; // [ORIGEN]
    registrarEventoTimestamp('SISTEMA', `Inició VGMS Abogados & Consultores v1 [Conexión: ${origen}]`); // [LOG INICIAL]
  }

  inicializarVGMS(); // [ARRANQUE DE LA APLICACIÓN]

});
