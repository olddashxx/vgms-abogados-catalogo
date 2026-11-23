<?php
// [API CRUD] Endpoint REST para gestión de servicios legales y consultas jurídicas en VGMS Abogados (PHP PDO)
require_once __DIR__ . '/conexion.php'; // [API DEPENDENCIA] Carga instancia $pdo y responderJSON()

$metodo = $_SERVER['REQUEST_METHOD']; // [API ROUTER] Identifica el verbo HTTP de la petición entrante

// [API GET] Lista el catálogo de servicios jurídicos y el historial completo de consultas agendadas
if ($metodo === 'GET') {
    try {
        // [PDO QUERY] Consulta los 8 servicios ordenados por identificador S1..S8
        $stmtServicios = $pdo->query("SELECT id_servicio, nombre, area, especialista, honorario_base, estado FROM servicios ORDER BY id_servicio ASC");
        $servicios = $stmtServicios->fetchAll(); // [PDO FETCH] Recupera todo el catálogo jurídico

        // [PDO JOIN] Consulta las consultas jurídicas combinadas con el nombre y área del servicio asociado
        $sqlConsultas = "
            SELECT 
                c.id_consulta,
                c.titular_nombre,
                c.celular,
                c.correo,
                c.id_servicio,
                s.nombre AS servicio_nombre,
                s.area,
                s.especialista,
                c.fecha,
                c.hora_inicio,
                c.duracion_horas,
                c.modalidad,
                c.adicionales,
                c.total_bs,
                c.estado,
                c.creado_en
            FROM consultas c
            LEFT JOIN servicios s ON c.id_servicio = s.id_servicio
            ORDER BY c.fecha DESC, c.hora_inicio DESC, c.id_consulta DESC
        "; // [SQL JOIN] Ordena mostrando primero las consultas más recientes
        $stmtConsultas = $pdo->query($sqlConsultas); // [PDO QUERY] Ejecuta la consulta relacional
        $consultas = $stmtConsultas->fetchAll(); // [PDO FETCH] Obtiene la lista completa de consultas

        responderJSON([ // [API RESPUESTA] Entrega catálogo y consultas al frontend
            'ok' => true, // [API CONTRATO] Bandera de éxito
            'servicios' => $servicios, // [API PAYLOAD] Arreglo de servicios S1..S8
            'consultas' => $consultas // [API PAYLOAD] Arreglo de consultas jurídicas
        ]);
    } catch (PDOException $e) {
        responderJSON([ // [API ERROR] Informa fallo de lectura en MySQL
            'ok' => false, // [API CONTRATO] Bandera de error
            'mensaje' => 'Error al consultar servicios y consultas en MySQL.', // [API MENSAJE] Texto amigable
            'error' => $e->getMessage() // [API DEBUG] Excepción técnica
        ], 500); // [API HTTP] Código 500
    }
}

// [API POST] Registra una nueva consulta jurídica aplicando validaciones de servidor y control anti-colisión
if ($metodo === 'POST') {
    $rawBody = file_get_contents('php://input'); // [API INPUT] Lee cuerpo JSON enviado desde modal de confirmación
    $data = json_decode($rawBody, true); // [API JSON] Decodifica JSON en arreglo PHP
    if (!$data && !empty($_POST)) { // [API FALLBACK] Admite FormData tradicional si corresponde
        $data = $_POST; // [API INPUT] Toma el arreglo $_POST
    }

    $nombre = isset($data['titular_nombre']) ? trim($data['titular_nombre']) : ''; // [API CAMPO] Nombre completo del titular
    $celular = isset($data['celular']) ? trim($data['celular']) : ''; // [API CAMPO] Celular boliviano de 8 dígitos
    $correo = isset($data['correo']) ? trim($data['correo']) : ''; // [API CAMPO] Correo electrónico del solicitante
    $idServicio = isset($data['id_servicio']) ? trim($data['id_servicio']) : ''; // [API CAMPO] Código S1-S8 del servicio
    $fecha = isset($data['fecha']) ? trim($data['fecha']) : ''; // [API CAMPO] Fecha YYYY-MM-DD de la consulta
    $horaInicio = isset($data['hora_inicio']) ? trim($data['hora_inicio']) : ''; // [API CAMPO] Hora de inicio HH:00
    $duracion = isset($data['duracion_horas']) ? (int)$data['duracion_horas'] : 1; // [API CAMPO] Cantidad de horas reservadas
    $modalidad = isset($data['modalidad']) ? trim($data['modalidad']) : 'Presencial (Edificio La Paz I)'; // [API CAMPO] Modalidad de atención
    $adicionales = isset($data['adicionales']) ? trim($data['adicionales']) : ''; // [API CAMPO] Gestiones adicionales seleccionadas
    $totalBs = isset($data['total_bs']) ? (float)$data['total_bs'] : 0.0; // [API CAMPO] Honorarios totales en Bs

    // [VALIDACIÓN SERVIDOR] Exige solo caracteres alfabéticos y espacios en el nombre del titular
    if (empty($nombre) || !preg_match('/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/u', $nombre)) {
        responderJSON(['ok' => false, 'mensaje' => 'Nombre inválido: solo se permiten letras y espacios.'], 400); // [API HTTP] 400 Bad Request
    }
    $palabras = array_filter(explode(' ', $nombre)); // [VALIDACIÓN SERVIDOR] Separa palabras ignorando espacios múltiples
    if (count($palabras) < 2) { // [VALIDACIÓN SERVIDOR] Exige al menos nombre y apellido
        responderJSON(['ok' => false, 'mensaje' => 'Debes ingresar al menos nombre y apellido.'], 400); // [API HTTP] 400 Bad Request
    }

    // [VALIDACIÓN SERVIDOR] Exige celular móvil boliviano de 8 dígitos iniciando en 6 o 7
    if (!preg_match('/^[67][0-9]{7}$/', $celular)) {
        responderJSON(['ok' => false, 'mensaje' => 'Celular inválido: debe tener exactamente 8 dígitos comenzando con 6 o 7.'], 400); // [API HTTP] 400 Bad Request
    }

    // [VALIDACIÓN SERVIDOR] Valida estructura estándar de correo electrónico
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        responderJSON(['ok' => false, 'mensaje' => 'Formato de correo electrónico inválido.'], 400); // [API HTTP] 400 Bad Request
    }

    // [VALIDACIÓN SERVIDOR] Verifica presencia de servicio, fecha y hora de inicio
    if (empty($idServicio) || empty($fecha) || empty($horaInicio)) {
        responderJSON(['ok' => false, 'mensaje' => 'Faltan datos obligatorios de servicio, fecha u horario.'], 400); // [API HTTP] 400 Bad Request
    }

    try {
        // [ANTI-COLISIÓN] Verifica que no exista otra consulta activa en la misma fecha, servicio y hora
        $stmtCheck = $pdo->prepare("
            SELECT id_consulta FROM consultas 
            WHERE id_servicio = ? AND fecha = ? AND hora_inicio = ? AND estado != 'cancelada'
            LIMIT 1
        "); // [PDO PREPARED] Consulta parametrizada para verificar choque de horario
        $stmtCheck->execute([$idServicio, $fecha, $horaInicio]); // [PDO EXECUTE] Ejecuta validación de disponibilidad
        if ($stmtCheck->fetch()) { // [ANTI-COLISIÓN] Si hay registro coincidente, bloquea duplicidad
            responderJSON([ // [API CONFLICTO] Notifica horario ocupado con HTTP 409
                'ok' => false, // [API CONTRATO] Registro rechazado
                'mensaje' => "El horario de las {$horaInicio} para este servicio ya se encuentra agendado en la fecha seleccionada." // [API MENSAJE] Detalle del conflicto
            ], 409); // [API HTTP] Código 409 Conflict
        }

        // [PDO INSERT] Inserta la consulta en MySQL usando marcadores posicionales seguros contra SQLi
        $stmtInsert = $pdo->prepare("
            INSERT INTO consultas (titular_nombre, celular, correo, id_servicio, fecha, hora_inicio, duracion_horas, modalidad, adicionales, total_bs, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
        "); // [SQL INSERT] Estado inicial siempre 'pendiente'
        $stmtInsert->execute([ // [PDO EXECUTE] Enlaza todos los campos validados
            $nombre, // [SQL PARAM] titular_nombre
            $celular, // [SQL PARAM] celular
            $correo, // [SQL PARAM] correo
            $idServicio, // [SQL PARAM] id_servicio
            $fecha, // [SQL PARAM] fecha
            $horaInicio, // [SQL PARAM] hora_inicio
            $duracion, // [SQL PARAM] duracion_horas
            $modalidad, // [SQL PARAM] modalidad
            $adicionales, // [SQL PARAM] adicionales
            $totalBs // [SQL PARAM] total_bs
        ]);

        $idConsulta = (int)$pdo->lastInsertId(); // [PDO ID] Obtiene el ID autoincremental generado por MySQL

        responderJSON([ // [API ÉXITO] Devuelve registro creado con código HTTP 201 Created
            'ok' => true, // [API CONTRATO] Creación confirmada
            'mensaje' => 'Consulta jurídica guardada con éxito en la base de datos MySQL.', // [API MENSAJE] Confirmación al usuario
            'id_consulta' => $idConsulta, // [API ID] Identificador asignado
            'consulta' => [ // [API PAYLOAD] Objeto completo sincronizado con el frontend
                'id_consulta' => $idConsulta, // [API CAMPO] ID
                'titular_nombre' => $nombre, // [API CAMPO] Titular
                'celular' => $celular, // [API CAMPO] Celular
                'correo' => $correo, // [API CAMPO] Correo
                'id_servicio' => $idServicio, // [API CAMPO] Servicio
                'fecha' => $fecha, // [API CAMPO] Fecha
                'hora_inicio' => $horaInicio, // [API CAMPO] Hora inicio
                'duracion_horas' => $duracion, // [API CAMPO] Duración
                'modalidad' => $modalidad, // [API CAMPO] Modalidad
                'adicionales' => $adicionales, // [API CAMPO] Adicionales
                'total_bs' => $totalBs, // [API CAMPO] Total Bs
                'estado' => 'pendiente' // [API CAMPO] Estado inicial
            ]
        ], 201); // [API HTTP] Código 201 Created
    } catch (PDOException $e) {
        responderJSON([ // [API ERROR] Informa fallo de inserción SQL
            'ok' => false, // [API CONTRATO] Bandera de error
            'mensaje' => 'Error al registrar la consulta jurídica en MySQL.', // [API MENSAJE] Texto seguro
            'error' => $e->getMessage() // [API DEBUG] Excepción técnica
        ], 500); // [API HTTP] Código 500
    }
}

// [API PUT/PATCH] Actualiza estado operativo de consultas (Trabajador/Admin) o honorario/estado de servicios (Admin)
if ($metodo === 'PUT' || $metodo === 'PATCH') {
    $rawBody = file_get_contents('php://input'); // [API INPUT] Lee payload JSON de actualización
    $data = json_decode($rawBody, true); // [API JSON] Decodifica JSON en arreglo PHP

    if (!$data) { // [API VALIDACIÓN] Rechaza cuerpos JSON malformados o vacíos
        responderJSON(['ok' => false, 'mensaje' => 'Cuerpo de petición JSON inválido.'], 400); // [API HTTP] 400 Bad Request
    }

    $accion = isset($data['accion']) ? $data['accion'] : ''; // [API DISPATCHER] Identifica la operación solicitada

    // [ACCIÓN A - WORKER/ADMIN] Cambiar estado de consulta o registrar entrega de documentación jurídica
    if ($accion === 'cambiar_estado_consulta' || $accion === 'entregar_documentacion' || (isset($data['id_consulta']) && !isset($data['id_servicio']))) {
        $idConsulta = (int)$data['id_consulta']; // [API PARAM] Convierte a entero seguro el ID de consulta
        $nuevoEstado = isset($data['nuevo_estado']) ? trim($data['nuevo_estado']) : ''; // [API PARAM] Estado destino
        $nuevosAdicionales = isset($data['adicionales']) ? trim($data['adicionales']) : null; // [API PARAM] Texto actualizado de adicionales

        $estadosValidos = ['pendiente', 'en_atencion', 'completada', 'cancelada']; // [API WHITELIST] Lista blanca de estados permitidos
        if ($nuevoEstado !== '' && !in_array($nuevoEstado, $estadosValidos, true)) { // [API VALIDACIÓN] Bloquea estados arbitrarios
            responderJSON(['ok' => false, 'mensaje' => 'Estado no válido. Permitidos: pendiente, en_atencion, completada, cancelada.'], 400); // [API HTTP] 400
        }

        try {
            if ($nuevoEstado !== '' && $nuevosAdicionales !== null) { // [PDO UPDATE] Actualiza estado y documentación juntos
                $stmt = $pdo->prepare("UPDATE consultas SET estado = ?, adicionales = ? WHERE id_consulta = ?");
                $stmt->execute([$nuevoEstado, $nuevosAdicionales, $idConsulta]);
            } elseif ($nuevoEstado !== '') { // [PDO UPDATE] Actualiza únicamente el estado operativo
                $stmt = $pdo->prepare("UPDATE consultas SET estado = ? WHERE id_consulta = ?");
                $stmt->execute([$nuevoEstado, $idConsulta]);
            } elseif ($nuevosAdicionales !== null) { // [PDO UPDATE] Actualiza únicamente la marca de entrega documental
                $stmt = $pdo->prepare("UPDATE consultas SET adicionales = ? WHERE id_consulta = ?");
                $stmt->execute([$nuevosAdicionales, $idConsulta]);
            }

            responderJSON([ // [API ÉXITO] Confirma actualización de la consulta en MySQL
                'ok' => true, // [API CONTRATO] Estado positivo
                'mensaje' => "Consulta #{$idConsulta} actualizada con éxito en MySQL." // [API MENSAJE] Confirmación visual
            ]);
        } catch (PDOException $e) {
            responderJSON(['ok' => false, 'mensaje' => 'Error al actualizar consulta en MySQL.', 'error' => $e->getMessage()], 500); // [API HTTP] 500
        }
    }

    // [ACCIÓN B - ADMIN] Editar honorario base y estado operativo (disponible/pausado) de un servicio del catálogo
    if ($accion === 'editar_servicio' || isset($data['id_servicio'])) {
        $idServicio = trim($data['id_servicio']); // [API PARAM] Identificador S1..S8 del servicio jurídico
        $honorarioBase = isset($data['honorario_base']) ? (float)$data['honorario_base'] : null; // [API PARAM] Nuevo honorario en Bs
        $estadoServicio = isset($data['estado']) ? trim($data['estado']) : null; // [API PARAM] Nuevo estado ('disponible' o 'pausado')

        if (!$idServicio || ($honorarioBase === null && !$estadoServicio)) { // [API VALIDACIÓN] Exige al menos un campo modificable
            responderJSON(['ok' => false, 'mensaje' => 'Datos insuficientes para actualizar el servicio jurídico.'], 400); // [API HTTP] 400
        }

        try {
            if ($honorarioBase !== null && $estadoServicio !== null) { // [PDO UPDATE] Actualiza honorario y estado juntos
                $stmt = $pdo->prepare("UPDATE servicios SET honorario_base = ?, estado = ? WHERE id_servicio = ?");
                $stmt->execute([$honorarioBase, $estadoServicio, $idServicio]);
            } elseif ($honorarioBase !== null) { // [PDO UPDATE] Actualiza solo el honorario base
                $stmt = $pdo->prepare("UPDATE servicios SET honorario_base = ? WHERE id_servicio = ?");
                $stmt->execute([$honorarioBase, $idServicio]);
            } else { // [PDO UPDATE] Actualiza solo el estado operativo
                $stmt = $pdo->prepare("UPDATE servicios SET estado = ? WHERE id_servicio = ?");
                $stmt->execute([$estadoServicio, $idServicio]);
            }

            responderJSON([ // [API ÉXITO] Confirma actualización de servicio en MySQL
                'ok' => true, // [API CONTRATO] Estado positivo
                'mensaje' => "Servicio {$idServicio} actualizado correctamente en MySQL." // [API MENSAJE] Confirmación
            ]);
        } catch (PDOException $e) {
            responderJSON(['ok' => false, 'mensaje' => 'Error al actualizar servicio en MySQL.', 'error' => $e->getMessage()], 500); // [API HTTP] 500
        }
    }

    responderJSON(['ok' => false, 'mensaje' => 'Acción no reconocida en PUT/PATCH.'], 400); // [API ERROR] Acción desconocida
}

responderJSON(['ok' => false, 'mensaje' => 'Método HTTP no soportado.'], 405); // [API HTTP] 405 para otros verbos HTTP
