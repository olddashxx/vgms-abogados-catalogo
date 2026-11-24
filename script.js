// [SCRIPT PRINCIPAL VGMS] Navegación por pestañas SPA (sin scroll largo), Dock adaptable, Fetch + Lazy Loading, Anti-XSS y listas limpias

// [1. PWA SERVICE WORKER] Registra sw.js para funcionamiento Offline-First en HTTP/HTTPS
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', function () { // [PWA] Registra tras cargar la página principal
    navigator.serviceWorker
      .register('sw.js') // [PWA] Archivo de caché Offline-First v4
      .then((reg) => { // [PWA ÉXITO]
        console.log('[PWA VGMS] Service Worker v4 registrado:', reg.scope); // [LOG]
      })
      .catch((err) => { // [PWA RESILIENCIA]
        console.warn('[PWA VGMS] Registro de Service Worker omitido:', err); // [WARN]
      });
  });
}

let deferredInstallPrompt = null; // [PWA INSTALL] Guarda el evento de instalación diferida
window.addEventListener('beforeinstallprompt', (e) => { // [PWA INSTALL] Intercepta banner automático
  e.preventDefault(); // [PWA INSTALL] Espera clic en botón Instalar
  deferredInstallPrompt = e; // [PWA INSTALL] Almacena referencia
  $('#btnInstalarPWA, #btnInstalarPWADock').prop('hidden', false).fadeIn(); // [PWA UI] Muestra botones Instalar
});

// [ANTI-XSS DOMPURIFY] Helper seguro para limpiar HTML antes de insertar en el DOM
function sanitizarHTML(contenido) {
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) { // [ANTI-XSS] Usa DOMPurify cuando está cargado
    return DOMPurify.sanitize(contenido); // [ANTI-XSS] Limpia etiquetas o scripts maliciosos
  }
  const div = document.createElement('div'); // [FALLBACK XSS] Nodo temporal seguro
  div.textContent = contenido; // [FALLBACK XSS] Escapa HTML a texto plano
  return div.innerHTML; // [FALLBACK XSS] Devuelve texto escapado
}

// [2. DOM NATIVO: MODO OSCURO Y FILTRADO DE ÁREAS] Manipulación directa sin jQuery
document.addEventListener('DOMContentLoaded', function () {
  const themeBtn = document.getElementById('themeBtn'); // [DOM NATIVO] Botón de tema móvil
  const themeBtnDock = document.getElementById('themeBtnDock'); // [DOM NATIVO] Botón de tema sidebar
  const bodyElement = document.body; // [DOM NATIVO] Elemento body

  if (localStorage.getItem('vgms_tema') === 'oscuro') { // [PERSISTENCIA] Recupera modo oscuro guardado
    bodyElement.classList.add('dark-mode'); // [DARK MODE] Activa clase oscura
  }

  function alternarModoOscuro() { // [TOGGLE COMPARTIDO] Sincroniza botón móvil y sidebar
    bodyElement.classList.toggle('dark-mode'); // [CLASSLIST.TOGGLE] Alterna tema claro/oscuro
    const estaOscuro = bodyElement.classList.contains('dark-mode'); // [VERIFICA]
    localStorage.setItem('vgms_tema', estaOscuro ? 'oscuro' : 'claro'); // [LOCALSTORAGE] Guarda preferencia
  }

  if (themeBtn) themeBtn.addEventListener('click', alternarModoOscuro); // [LISTENER MÓVIL]
  if (themeBtnDock) themeBtnDock.addEventListener('click', alternarModoOscuro); // [LISTENER SIDEBAR]

  const botonesFiltro = document.querySelectorAll('.btn-filtro-cat'); // [DOM NATIVO] Botones de filtro por área
  botonesFiltro.forEach((boton) => {
    boton.addEventListener('click', function () {
      const categoria = boton.dataset.cat; // [DATASET] Lee atributo data-cat
      const tarjetas = document.querySelectorAll('.tarjeta-modulo'); // [TARJETAS]

      botonesFiltro.forEach((b) => { // [ESTILO ACTIVO BOTÓN]
        b.classList.remove('btn-primario'); // [LIMPIA]
        b.classList.add('btn-secundario'); // [NEUTRO]
      });
      boton.classList.remove('btn-secundario'); // [RESALTA]
      boton.classList.add('btn-primario'); // [PRIMARIO]

      tarjetas.forEach((card) => { // [FILTRADO POR DATASET.CATEGORIA]
        const catCard = card.dataset.categoria; // [LEE CATEGORÍA]
        if (categoria === 'todos' || catCard === categoria) { // [COINCIDE]
          card.style.display = 'block'; // [MUESTRA]
        } else {
          card.style.display = 'none'; // [OCULTA]
        }
      });
    });
  });
});

// [3. RESPALDO LOCAL DE SERVICIOS] Garantiza funcionamiento cuando se abre con protocolo file:// sin servidor HTTP
const SERVICIOS_RESPALDO = [
  { id: 1, codigo: 'S1', nombre: 'Registro de Marca y Signos Distintivos (SENAPI)', area: 'Propiedad Intelectual', categoria: 'propiedad-intelectual', especialista: 'Dr. Francisco Vela', honorario: 1800, etiqueta: 'SENAPI • Signos Distintivos', descripcion: 'Planificación estratégica, búsqueda de anterioridad, registro ante el SENAPI y vigilancia continua de signos distintivos para blindar la identidad de tu negocio.', palabrasClave: 'senapi marca registro signos distintivos logotipo francisco vela emprendimientos empresas', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2025/06/Francisco-Vela.jpeg' }, // [S1]
  { id: 2, codigo: 'S2', nombre: 'Patentes de Invención y Derechos de Autor', area: 'Propiedad Intelectual', categoria: 'propiedad-intelectual', especialista: 'Dr. Francisco Vela', honorario: 2500, etiqueta: 'SENAPI • Patentes & Autor', descripcion: 'Protección legal integral de invenciones industriales, modelos de utilidad, software, obras creativas y derechos conexos bajo normativa nacional e internacional.', palabrasClave: 'senapi patentes invencion derechos de autor software creaciones francisco vela', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2015/04/home_03-L43-870x653.jpg' }, // [S2]
  { id: 3, codigo: 'S3', nombre: 'Protección Activa y Medidas en Frontera', area: 'Protección Activa', categoria: 'proteccion-activa', especialista: 'Dr. Francisco Vela', honorario: 2200, etiqueta: 'Litigio • Antipiratería', descripcion: 'Estrategias ágiles para frenar infracciones marcarias y piratería de productos o servicios mediante acciones en frontera, mercado interno y litigios marcarios.', palabrasClave: 'proteccion activa litigio senapi fronteras pirateria infracciones francisco vela', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2025/08/banner-mapamundi2.webp' }, // [S3]
  { id: 4, codigo: 'S4', nombre: 'Constitución de Sociedades y Derecho Corporativo', area: 'Derecho Corporativo', categoria: 'derecho-corporativo', especialista: 'Dr. Álvaro Maldonado', honorario: 2400, etiqueta: 'Corporativo • S.R.L. / S.A.', descripcion: 'Asesoramiento desde la creación y constitución de sociedades a nivel nacional e internacional, gobierno societario y gestión de conflictos comerciales.', palabrasClave: 'corporativo sociedades empresas srl sa constitucion comercial alvaro maldonado', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2025/06/Alvaro-Maldonado.jpeg' }, // [S4]
  { id: 5, codigo: 'S5', nombre: 'Derecho Administrativo y Contrataciones Públicas', area: 'Derecho Corporativo', categoria: 'derecho-corporativo', especialista: 'Dr. Álvaro Maldonado', honorario: 1900, etiqueta: 'Corporativo • Regulatorio', descripcion: 'Patrocinio en contratación pública y privada, procedimientos administrativos, aduanas, transparencia y asesoramiento regulatorio ante instituciones estatales.', palabrasClave: 'corporativo administrativo contrataciones publicas aduanas transparencia alvaro maldonado', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2015/04/home_03-L43-768x576.jpg' }, // [S5]
  { id: 6, codigo: 'S6', nombre: 'Contratos Civiles, Conciliación y Legaltech', area: 'Civil y Penal', categoria: 'civil-penal', especialista: 'Dr. Juan Diego Andrade', honorario: 1200, etiqueta: 'Contratos • Legaltech', descripcion: 'Redacción y revisión de contratos de confidencialidad (NDA), comerciales y civiles, procesos monitorios, conciliación estratégica y soluciones Legaltech.', palabrasClave: 'contratos nda confidencialidad civil conciliacion legaltech juan diego andrade', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2025/07/foto-Juan-Diego-Andrade.jpg' }, // [S6]
  { id: 7, codigo: 'S7', nombre: 'Derecho Constitucional, Tributario y Municipal', area: 'Civil y Penal', categoria: 'civil-penal', especialista: 'Dr. Raúl Salta', honorario: 1600, etiqueta: 'Constitucional • Tributario', descripcion: 'Defensa y asesoramiento especializado en acciones constitucionales, derecho tributario empresarial, régimen autonómico y normativa municipal boliviana.', palabrasClave: 'constitucional tributario municipal autonomico litigio contratos raul salta', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2025/06/Raul-Salta.jpeg' }, // [S7]
  { id: 8, codigo: 'S8', nombre: 'Defensa Penal Estratégica y Ley 004', area: 'Civil y Penal', categoria: 'civil-penal', especialista: 'Dr. Paulo Ponce', honorario: 2100, etiqueta: 'Litigio • Procesal Penal', descripcion: 'Patrocinio penal integral ante Fiscalía y tribunales en delitos patrimoniales, legitimación de ganancias ilícitas, cumplimiento corporativo y Ley 004.', palabrasClave: 'litigio penal defensa fiscalia ley 004 patrimoniales paulo ponce', imagen: 'https://vgms.com.bo/wp/wp-content/uploads/2025/07/foto-PAULO-PONCE.jpg' } // [S8]
];

$(document).ready(function () { // [JQUERY READY] Inicializa módulos interactivos cuando el DOM está cargado

  // [4. NAVEGACIÓN POR PESTAÑAS SPA + DOCK ADAPTABLE + MENÚ HAMBURGUESA] Evita el scroll largo en PC, tablet y celular
  function cambiarTab(tabId) {
    if (!tabId) return; // [GUARDA]

    $('.panel-tab').removeClass('active').hide(); // [OCULTA TODAS LAS PESTAÑAS]
    $('#' + tabId).addClass('active').fadeIn(200); // [MUESTRA SOLO LA PESTAÑA ELEGIDA]

    $('.dock-acciones__btn').removeClass('active').attr('aria-selected', 'false'); // [DESACTIVA DOCK]
    $(`.dock-acciones__btn[data-tab="${tabId}"]`).addClass('active').attr('aria-selected', 'true'); // [ACTIVA BOTÓN DOCK]

    $('#navMenu').slideUp(200); // [CIERRA MENÚ HAMBURGUESA SI ESTABA ABIERTO]
    $('#hamburgerBtn').attr('aria-expanded', 'false'); // [A11Y]
    window.scrollTo({ top: 0, behavior: 'smooth' }); // [SUBE AL TOPE DE LA PESTAÑA]
  }

  $(document) // [DELEGACIÓN NAVEGACIÓN POR PESTAÑAS] Dock, CTAs del Hero, logo header y menú hamburguesa
    .off('click.tabsVGMS') // [ANTI-MEMORY LEAK]
    .on('click.tabsVGMS', '.dock-acciones__btn, .btn-go-tab, .nav-menu-tab', function () {
      const tabId = $(this).data('tab'); // [LEE DESTINO]
      if (tabId) cambiarTab(tabId); // [CAMBIA PESTAÑA]
    });

  function hidratarBotonesDOM(raiz) { // [HIDRATACIÓN SSR DE BOTONES CON .off().on()]
    const $contenedor = $('#contenedorMenu'); // [CONTENEDOR MENU]
    if ($contenedor.length && $contenedor.attr('data-hidratado') !== 'true') { // [VERIFICA]
      $contenedor.attr('data-hidratado', 'true'); // [MARCA HIDRATADO]
    }

    $(raiz)
      .find('button') // [RECORRE TODOS LOS BOTONES]
      .each(function () {
        const $btn = $(this); // [BOTÓN]
        if ($btn.attr('data-hidratado') === 'true') return; // [EVITA REHIDRATAR]

        $btn
          .attr('data-hidratado', 'true') // [MARCA]
          .addClass('hidratado-activo') // [CLASE]
          .off('click.vgmsHidratacion') // [PREVIENE MEMORY LEAKS]
          .on('click.vgmsHidratacion', function () { // [REGISTRO LIMPIO]
            $(this).attr('data-ultimo-evento', 'hidratado'); // [TRAZA]
          });
      });
  }

  setTimeout(function () { // [HIDRATACIÓN INICIAL]
    hidratarBotonesDOM(document); // [EJECUTA]
  }, 150);

  $('#hamburgerBtn') // [MENÚ HAMBURGUESA SLIDETOGGLE]
    .off('click') // [LIMPIA EVENTO PREVIO]
    .on('click', function () {
      const $menu = $('#navMenu'); // [MENÚ]
      $menu.slideToggle(300, function () { // [ANIMACIÓN JQUERY]
        $('#hamburgerBtn').attr('aria-expanded', $menu.is(':visible') ? 'true' : 'false'); // [A11Y]
      });
    });

  // [5. EFECTOS JQUERY: ACORDEONES Y CAMBIO DINÁMICO DE TEMÁTICA]
  $('.accordion-btn')
    .off('click') // [ANTI-MEMORY LEAK]
    .on('click', function () {
      const $panel = $(this).next('.accordion-panel'); // [PANEL HERMANO]
      $panel.slideToggle('fast'); // [ACORDEÓN JQUERY]
    });

  const configuracionTemas = { // [MODELO DE TEMAS DINÁMICOS VGMS]
    pi: {
      clase: 'tema-pi', // [CLASE GRADIENTE 1]
      icono: '®️', // [ICONO]
      titulo: 'Propiedad Intelectual & Estrategia SENAPI', // [TÍTULO]
      desc: 'Protegemos el mayor activo de tu empresa: marcas, patentes y derechos de autor con monitoreo continuo y seguimiento técnico personalizado.' // [TEXTO]
    },
    corporativo: {
      clase: 'tema-corporativo', // [CLASE GRADIENTE 2]
      icono: '🏢', // [ICONO]
      titulo: 'Derecho Corporativo, Societario & Tributario', // [TÍTULO]
      desc: 'Asesoramiento desde la constitución de sociedades nacionales e internacionales hasta contratación pública y resolución de conflictos comerciales.' // [TEXTO]
    },
    litigio: {
      clase: 'tema-litigio', // [CLASE GRADIENTE 3]
      icono: '⚖️', // [ICONO]
      titulo: 'Protección Activa, Fronteras & Litigio Estratégico', // [TÍTULO]
      desc: 'Medidas efectivas contra piratería en fronteras y mercado, redacción contractual Legaltech, defensa civil y patrocinio penal.' // [TEXTO]
    }
  };

  $('.btn-tema-sistema') // [BOTONES CAMBIO DE TEMÁTICA]
    .off('click') // [LIMPIA]
    .on('click', function () {
      const tema = $(this).data('tema'); // [LEE TEMA]
      const info = configuracionTemas[tema]; // [BUSCA CONFIGURACIÓN]
      if (!info) return; // [GUARDA]

      $('#panelTematico') // [ACTUALIZA ESTILO PANEL]
        .removeClass('tema-pi tema-corporativo tema-litigio') // [QUITA PREVIAS]
        .addClass(info.clase); // [APLICA NUEVA]

      $('#tituloTema') // [ACTUALIZA TÍTULO SEGURO ANTI-XSS]
        .empty() // [LIMPIA]
        .append(
          $('<span>').attr('id', 'iconoTema').text(info.icono), // [ICONO SEGURO]
          document.createTextNode(' ' + info.titulo) // [TEXTO PLANO SEGURO]
        );
      $('#descTema').text(info.desc); // [ACTUALIZA DESCRIPCIÓN]
    });

  // [6. FETCH ASÍNCRONO + LAZY LOADING + BEM + BUSCADOR EN VIVO + EVENT BUBBLING]
  function renderizarCatalogoServicios(servicios) {
    const $contenedor = $('#catalogoServicios'); // [CONTENEDOR GRID]
    $contenedor.empty(); // [LIMPIA PLACEHOLDER]

    servicios.forEach((item) => { // [CONSTRUYE TARJETA BEM POR SERVICIO S1-S8]
      const textoBusqueda = ( // [ÍNDICE DE BÚSQUEDA EN VIVO]
        item.codigo + ' ' + item.nombre + ' ' + item.area + ' ' +
        item.especialista + ' ' + item.etiqueta + ' ' + item.palabrasClave
      ).toLowerCase();

      const htmlTarjeta = `
        <article class="servicio-card" data-codigo="${item.codigo}" data-honorario="${item.honorario}" data-busqueda="${textoBusqueda}">
          <span class="servicio-card__badge">${item.etiqueta}</span>
          <div class="servicio-card__imagen-wrap">
            <img src="${item.imagen}" alt="${item.codigo} ${item.nombre} dirigido por ${item.especialista}" class="servicio-card__imagen" width="480" height="270" loading="lazy">
          </div>
          <div class="servicio-card__cuerpo">
            <h4 class="servicio-card__titulo">${item.codigo}: ${item.nombre}</h4>
            <p class="servicio-card__desc">${item.descripcion}</p>
            <span class="servicio-card__meta"><i class="fa-solid fa-user-tie"></i> ${item.especialista} • ${item.area}</span>
            <div class="servicio-card__pie">
              <span class="servicio-card__precio-val">${item.honorario} BOB</span>
              <div class="servicio-card__acciones">
                <button type="button" class="servicio-card__boton btn-comparar btn-hidratable" data-hidratado="false" aria-label="Comparar ${item.codigo}">Comparar</button>
                <button type="button" class="servicio-card__boton servicio-card__boton--destacado btn-cotizar-card btn-hidratable" data-hidratado="false" data-honorario="${item.honorario}" data-nombre="${item.codigo}: ${item.nombre}">+ Cotizar</button>
              </div>
            </div>
          </div>
        </article>
      `; // [PLANTILLA BEM]
      $contenedor.append(sanitizarHTML(htmlTarjeta)); // [ANTI-XSS DOMPURIFY]
    });

    hidratarBotonesDOM($contenedor); // [HIDRATA BOTONES NUEVOS]
  }

  fetch('data/servicios.json') // [FETCH API ASÍNCRONO] Carga catálogo desde JSON local
    .then((response) => {
      if (!response.ok) throw new Error('Error al consultar data/servicios.json'); // [VALIDA RESPUESTA]
      return response.json(); // [PARSEA JSON]
    })
    .then((data) => {
      renderizarCatalogoServicios(data); // [RENDERIZA DESDE FETCH]
    })
    .catch((err) => { // [RESPALDO LOCAL SI SE ABRE CON file://]
      console.warn('[VGMS] Cargando catálogo de respaldo local:', err.message); // [WARN]
      renderizarCatalogoServicios(SERVICIOS_RESPALDO); // [RENDERIZA RESPALDO]
    });

  function filtrarServiciosEnVivo(texto) { // [BUSCADOR EN VIVO]
    const filtro = texto.trim().toLowerCase(); // [NORMALIZA]
    $('#catalogoServicios .servicio-card').each(function () { // [FILTRA TARJETAS]
      const contenido = $(this).attr('data-busqueda') || ''; // [LEE ÍNDICE]
      if (contenido.indexOf(filtro) !== -1) { // [COINCIDE]
        $(this).show(); // [MUESTRA]
      } else {
        $(this).hide(); // [OCULTA]
      }
    });
  }

  $('#searchServicio') // [KEYUP BUSCADOR EN VIVO]
    .off('keyup') // [LIMPIA]
    .on('keyup', function () {
      filtrarServiciosEnVivo($(this).val()); // [FILTRA AL ESCRIBIR]
    });

  $('.btn-modo-filtro') // [FILTROS RÁPIDOS DE CATÁLOGO]
    .off('click') // [LIMPIA]
    .on('click', function () {
      $('.btn-modo-filtro').removeClass('active-chip'); // [DESACTIVA TODOS]
      $(this).addClass('active-chip'); // [ACTIVA PULSADO]
      const q = $(this).data('query') || ''; // [LEE CONSULTA]
      $('#searchServicio').val(q); // [SINCRONIZA INPUT]
      filtrarServiciosEnVivo(q); // [FILTRA]
    });

  $('#catalogoServicios') // [DELEGACIÓN POR EVENT BUBBLING] Comparar + Pasar a pestaña Cotizar
    .off('click', '.btn-comparar') // [LIMPIA]
    .on('click', '.btn-comparar', function () {
      const $card = $(this).closest('.servicio-card'); // [TARJETA]
      $card.toggleClass('servicio-card--activa'); // [DESTACA BORDE]
      const activo = $card.hasClass('servicio-card--activa'); // [ESTADO]
      $(this).text(activo ? '✓ Comparando' : 'Comparar'); // [TEXTO]
      mostrarToast(activo ? 'Servicio destacado para comparación.' : 'Servicio desmarcado.'); // [TOAST]
    })
    .off('click', '.btn-cotizar-card') // [LIMPIA]
    .on('click', '.btn-cotizar-card', function () {
      const honorario = String($(this).data('honorario') || '1800'); // [HONORARIO]
      const nombre = $(this).data('nombre') || 'Servicio VGMS'; // [NOMBRE]
      $('#planTarifa').val(honorario).trigger('change'); // [SELECCIONA EN COTIZADOR]
      agregarElementoACola('Cotizar: ' + nombre); // [AGREGA SOLO CUANDO EL USUARIO LO ELIGE]
      cambiarTab('tab-cotizar'); // [CAMBIA A PESTAÑA COTIZAR SIN SCROLL]
      mostrarToast('Servicio cargado en el Cotizador.'); // [TOAST]
    });

  // [7. VALIDACIÓN EN TIEMPO REAL (BLUR + INPUT)] Valida nombre real, celular Bolivia 6/7, correo y montos
  const BLACKLIST_NOMBRES = ['asdasd', 'asd', 'qwerty', 'test', 'prueba', 'xxx', 'aaa', 'zzz', 'null', 'undefined']; // [ANTI-BASURA]

  const reglasValidacion = {
    '#nombre': {
      err: '#errNombre', // [SPAN ERROR]
      validar: (val) => {
        const t = val.trim(); // [LIMPIO]
        if (t.length < 4 || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(t)) return false; // [SOLO LETRAS]
        if (/(.)\1\1/i.test(t)) return false; // [SIN REPETIDOS]
        if (BLACKLIST_NOMBRES.some((b) => t.toLowerCase().includes(b))) return false; // [SIN BLACKLIST]
        return t.split(/\s+/).filter(Boolean).length >= 2; // [AL MENOS NOMBRE Y APELLIDO]
      }
    },
    '#telefono': {
      err: '#errTelefono', // [SPAN ERROR]
      validar: (val) => /^[67][0-9]{7}$/.test(val.trim()) // [CELULAR BOLIVIANO 8 DÍGITOS 6/7]
    },
    '#correo': {
      err: '#errCorreo', // [SPAN ERROR]
      validar: (val) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim()) // [EMAIL VÁLIDO]
    },
    '#mensaje': {
      err: '#errMensaje', // [SPAN ERROR]
      validar: (val) => val.trim().length >= 5 // [MÍNIMO 5 CARACTERES]
    },
    '#clienteNombre': {
      err: '#errClienteNombre', // [SPAN ERROR]
      validar: (val) => val.trim().length >= 2 // [MÍNIMO 2 CARACTERES]
    },
    '#inputTramite': {
      err: '#errInputTramite', // [SPAN ERROR]
      validar: (val) => val.trim().length >= 3 // [MÍNIMO 3 CARACTERES]
    },
    '#cantidad': {
      err: '#errCantidad', // [SPAN ERROR]
      validar: (val) => {
        const n = Number(val); // [NÚMERO]
        return Number.isInteger(n) && n >= 1 && n <= 20; // [RANGO 1-20]
      }
    }
  };

  function validarCampo(selector) { // [EVALÚA CAMPO Y MUESTRA/OCULTA ERROR]
    const regla = reglasValidacion[selector]; // [REGLA]
    const $campo = $(selector); // [INPUT]
    if (!regla || !$campo.length) return true; // [GUARDA]

    const esValido = regla.validar($campo.val() || ''); // [EJECUTA REGLA]
    const $err = $(regla.err); // [ELEMENTO ERROR]

    if (esValido) { // [VÁLIDO]
      $campo.removeClass('input-invalido').addClass('input-valido'); // [BORDE VERDE]
      $err.stop(true, true).fadeOut(180); // [OCULTA MENSAJE]
    } else { // [INVÁLIDO]
      $campo.removeClass('input-valido').addClass('input-invalido'); // [BORDE ROJO]
      $err.stop(true, true).fadeIn(180); // [MUESTRA MENSAJE]
    }
    return esValido; // [RETORNO]
  }

  function limpiarEstadoValidacion(selectores) { // [RESET VISUAL DE CAMPOS]
    selectores.forEach((selector) => {
      const regla = reglasValidacion[selector]; // [REGLA]
      $(selector).removeClass('input-invalido input-valido').removeAttr('data-tocado'); // [LIMPIA]
      if (regla) $(regla.err).hide(); // [OCULTA ERROR]
    });
  }

  Object.keys(reglasValidacion).forEach((selector) => { // [CONECTA BLUR + INPUT EN TODOS LOS CAMPOS]
    $(selector)
      .off('blur.validacion input.validacion') // [EVITA DUPLICADOS]
      .on('blur.validacion', function () { // [AL SALIR DEL CAMPO]
        $(this).attr('data-tocado', 'true'); // [MARCA TOCADO]
        validarCampo(selector); // [VALIDA]
      })
      .on('input.validacion', function () { // [AL ESCRIBIR]
        if (selector === '#telefono') { // [FILTRO SOLO DÍGITOS EN CELULAR]
          const limpio = ($(this).val() || '').replace(/\D/g, '').slice(0, 8); // [8 DÍGITOS]
          if ($(this).val() !== limpio) $(this).val(limpio); // [ASIGNA]
        }
        if ($(this).attr('data-tocado') === 'true' || $(this).hasClass('input-invalido')) { // [ACTUALIZA EN VIVO]
          validarCampo(selector); // [VALIDA]
        }
      });
  });

  // [8. SEGURIDAD ANTI-XSS (.text()) Y COLA BLINDADA LIMPIA (SIN DATOS POR DEFECTO)]
  $('#formCaso')
    .off('submit') // [LIMPIA]
    .on('submit', function (e) {
      e.preventDefault(); // [EVITA RECARGA]
      if (!validarCampo('#clienteNombre')) return; // [VALIDA]

      const nombre = $('#clienteNombre').val().trim(); // [TITULAR]
      const area = $('#areaSelect').val(); // [ÁREA]

      const $item = $('<li>').addClass('item-reserva'); // [NODO SEGURO]
      const $textoSeguro = $('<strong>').text(nombre + ' — '); // [ANTI-XSS .text()]
      const $detalleArea = $('<span>').text(area); // [ANTI-XSS .text()]

      $item.append($textoSeguro, $detalleArea); // [INSERTA]
      $('#listaCasos').prepend($item); // [PREPEND]
      this.reset(); // [RESET]
      limpiarEstadoValidacion(['#clienteNombre']); // [LIMPIA ESTADO]
      mostrarToast('Consulta agregada a tu resumen.'); // [TOAST]
    });

  function agregarElementoACola(texto) { // [COLA TÁCTIL 44PX + TRUNCADO MIN-WIDTH: 0 + ANTI-XSS]
    const $fila = $('<div>').addClass('fila-cancion'); // [FILA]
    const $titulo = $('<span>').addClass('titulo-truncado').text(texto); // [TRUNCADO + .text()]
    const $btnQuitar = $('<button>')
      .addClass('btn-tactil btn-quitar btn-hidratable') // [44PX]
      .attr('data-hidratado', 'false') // [HIDRATACIÓN]
      .attr('type', 'button') // [TIPO]
      .attr('aria-label', 'Quitar trámite') // [A11Y]
      .text('✕'); // [TEXTO]

    $fila.append($titulo, $btnQuitar); // [ARMA FILA]
    $('#listaTramites').prepend($fila); // [INSERTA]
    hidratarBotonesDOM($fila); // [HIDRATA]
  }

  $('#btnPedir') // [BOTÓN AGREGAR A COLA] Solo agrega lo que el cliente escribe
    .off('click') // [LIMPIA]
    .on('click', function () {
      if (!validarCampo('#inputTramite')) return; // [VALIDA]
      const texto = $('#inputTramite').val().trim(); // [TEXTO]
      agregarElementoACola(texto); // [AGREGA]
      $('#inputTramite').val(''); // [LIMPIA INPUT]
      limpiarEstadoValidacion(['#inputTramite']); // [LIMPIA VALIDACIÓN]
    });

  $('#listaTramites') // [ELIMINACIÓN DELEGADA ANTI-MEMORY LEAKS]
    .off('click', '.btn-quitar') // [LIMPIA]
    .on('click', '.btn-quitar', function () {
      $(this).closest('.fila-cancion').remove(); // [ELIMINA FILA]
    });

  // [9. CALCULADOR DINÁMICO + TOAST ALERT]
  function calcularTotalVGMS() { // [CÁLCULO EN VIVO CON .animate()]
    const tarifaBase = parseInt($('#planTarifa').val(), 10) || 1800; // [TARIFA SERVICIO]
    const cantidad = Math.max(1, parseInt($('#cantidad').val(), 10) || 1); // [CANTIDAD]
    let extras = 0; // [COMPLEMENTARIOS]

    $('.extra-modulo:checked').each(function () { // [SUMA CHECKBOXES]
      extras += parseInt($(this).val(), 10) || 0; // [SUMA]
    });

    const totalCalculado = (tarifaBase * cantidad) + extras; // [TOTAL]

    $('#total') // [ANIMACIÓN JQUERY]
      .text(totalCalculado) // [ASIGNA]
      .stop(true, true) // [EVITA COLA]
      .animate({ opacity: 0.45 }, 120) // [PULSO]
      .animate({ opacity: 1 }, 180); // [RESTAURA]

    return totalCalculado; // [RETORNO]
  }

  $('#planTarifa, #cantidad, .extra-modulo') // [EVENTOS RECALCULO]
    .off('input change') // [LIMPIA]
    .on('input change', calcularTotalVGMS); // [EJECUTA]

  function mostrarToast(mensaje) { // [TOAST ALERT: slideDown -> 3s -> fadeOut]
    $('#toastMsg').text(mensaje); // [MENSAJE SEGURO]
    $('#toastAlert').stop(true, true).slideDown(250).delay(3000).fadeOut(400); // [ANIMACIÓN]
  }

  const btnWhatsAppCotizacion = document.getElementById('btnWhatsAppCotizacion'); // [MÓDULO 3 CONTRATO: CONSULTA WHATSAPP]
  if (btnWhatsAppCotizacion) {
    btnWhatsAppCotizacion.addEventListener('click', function () { // [DOM ADDEVENTLISTENER]
      if (!validarCampo('#cantidad')) return; // [VALIDA CANTIDAD]
      const total = calcularTotalVGMS(); // [CALCULA TOTAL REFERENCIAL]
      const planSelect = document.getElementById('planTarifa'); // [SERVICIO]
      const servicioTexto = planSelect ? planSelect.options[planSelect.selectedIndex].text : 'Servicio VGMS'; // [TEXTO OPCIÓN]
      const cantidad = $('#cantidad').val() || '1'; // [CANTIDAD]

      const extrasElegidos = []; // [GESTIONES COMPLEMENTARIAS]
      document.querySelectorAll('.extra-modulo:checked').forEach((chk) => {
        if (chk.dataset && chk.dataset.nombre) extrasElegidos.push(chk.dataset.nombre); // [DATASET NOMBRE]
      });

      const tramitesLista = []; // [TRÁMITES PRIORITARIOS EN COLA SI EL CLIENTE AGREGÓ]
      document.querySelectorAll('#listaTramites .fila-cancion span').forEach((sp) => {
        if (sp.textContent) tramitesLista.push(sp.textContent.trim()); // [TEXTO SEGURO]
      });

      const lineas = [
        'Hola VGMS Abogados & Consultores, solicito evaluación para esta cotización referencial:',
        '• Servicio: ' + servicioTexto,
        '• Cantidad: ' + cantidad,
        extrasElegidos.length ? '• Gestiones adicionales: ' + extrasElegidos.join(', ') : null,
        tramitesLista.length ? '• Trámites en lista: ' + tramitesLista.join(' | ') : null,
        '• Monto referencial estimado: ' + total + ' BOB',
        'Quedo atento/a a su orientación jurídica.'
      ].filter(Boolean);

      const urlWhatsApp = 'https://wa.me/59167005417?text=' + encodeURIComponent(lineas.join('\n')); // [URL WHATSAPP]
      window.open(urlWhatsApp, '_blank', 'noopener,noreferrer'); // [ABRE WHATSAPP]
      mostrarToast('Abriendo WhatsApp con el resumen de tu cotización...'); // [TOAST]
    });
  }

  // [10. DETECTOR ONLINE/OFFLINE + FORMULARIO CONTACTO CON COLA OFFLINE EN LOCALSTORAGE]
  function actualizarEstadoRed() {
    if (navigator.onLine) { // [EN LÍNEA]
      $('#estadoRed, #estadoRedDock')
        .text('🟢 En Línea') // [TEXTO]
        .css({ background: '#dcfce7', color: '#065f46' }); // [VERDE]

      const pendientes = JSON.parse(localStorage.getItem('vgms_cola_offline') || '[]'); // [COLA PENDIENTE]
      if (pendientes.length > 0) { // [SINCRONIZA AL RECONECTAR]
        mostrarToast('Conexión restablecida: ' + pendientes.length + ' consulta(s) pendiente(s) enviada(s).'); // [AVISO]
        localStorage.removeItem('vgms_cola_offline'); // [LIMPIA COLA]
      }
    } else { // [SIN CONEXIÓN]
      $('#estadoRed, #estadoRedDock')
        .text('🟠 Sin Conexión (Modo Local)') // [TEXTO]
        .css({ background: '#ffedd5', color: '#9a3412' }); // [NARANJA]
    }
  }

  $(window).off('online offline').on('online offline', actualizarEstadoRed); // [LISTENERS DE RED]
  actualizarEstadoRed(); // [INICIALIZA]

  $('#btnInstalarPWA, #btnInstalarPWADock') // [BOTÓN INSTALAR PWA]
    .off('click') // [LIMPIA]
    .on('click', async function () {
      if (!deferredInstallPrompt) return; // [GUARDA]
      deferredInstallPrompt.prompt(); // [MUESTRA PROMPT]
      await deferredInstallPrompt.userChoice; // [ESPERA]
      deferredInstallPrompt = null; // [LIMPIA]
      $('#btnInstalarPWA, #btnInstalarPWADock').prop('hidden', true).fadeOut(); // [OCULTA]
    });

  $('#pwaForm') // [ENVÍO DE CONTACTO CON RESPALDO OFFLINE]
    .off('submit') // [LIMPIA]
    .on('submit', function (e) {
      e.preventDefault(); // [EVITA RECARGA]
      const okNombre = validarCampo('#nombre'); // [VALIDA NOMBRE]
      const okTel = validarCampo('#telefono'); // [VALIDA TELÉFONO]
      const okCorreo = validarCampo('#correo'); // [VALIDA CORREO]
      const okMensaje = validarCampo('#mensaje'); // [VALIDA MENSAJE]

      if (okNombre && okTel && okCorreo && okMensaje) { // [SI TODO ES VÁLIDO]
        const nombre = $('#nombre').val().trim(); // [NOMBRE]
        const telefono = $('#telefono').val().trim(); // [TELÉFONO]
        const correo = $('#correo').val().trim(); // [CORREO]
        const mensaje = $('#mensaje').val().trim(); // [MENSAJE]

        if (navigator.onLine) { // [CON INTERNET]
          $('#successAlert')
            .text('✅ Consulta enviada con éxito al equipo de VGMS Abogados (Dr. Francisco Vela). Responderemos a la brevedad.') // [MENSAJE]
            .stop(true, true) // [LIMPIA COLA]
            .slideDown() // [MUESTRA]
            .delay(3500) // [ESPERA]
            .slideUp(); // [OCULTA]
        } else { // [MODO OFFLINE -> GUARDA EN LOCALSTORAGE]
          const cola = JSON.parse(localStorage.getItem('vgms_cola_offline') || '[]'); // [LEE COLA]
          cola.push({ nombre, telefono, correo, mensaje, fecha: new Date().toISOString() }); // [AGREGA]
          localStorage.setItem('vgms_cola_offline', JSON.stringify(cola)); // [GUARDA]

          $('#successAlert')
            .text('🟠 Sin conexión: Tu consulta fue guardada localmente y se enviará automáticamente al recuperar internet.') // [AVISO OFFLINE]
            .stop(true, true) // [LIMPIA]
            .slideDown() // [MUESTRA]
            .delay(4000) // [ESPERA]
            .slideUp(); // [OCULTA]
        }
        $('#pwaForm')[0].reset(); // [LIMPIA FORMULARIO]
        limpiarEstadoValidacion(['#nombre', '#telefono', '#correo', '#mensaje']); // [LIMPIA ESTADOS]
      }
    });

});
