<?php
// [API AUTH] Endpoint de autenticación RBAC con PHP PDO y verificación de hash bcrypt para VGMS Abogados
require_once __DIR__ . '/conexion.php'; // [API DEPENDENCIA] Reutiliza la conexión PDO y la función responderJSON()

// [API VALIDACIÓN MÉTODO] Restringe el acceso de login exclusivamente al verbo HTTP POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responderJSON([ // [API ERROR] Rechaza métodos GET/PUT/DELETE no autorizados
        'ok' => false, // [API CONTRATO] Estado negativo
        'mensaje' => 'Método no permitido. Se requiere petición POST.' // [API MENSAJE] Explicación del rechazo
    ], 405); // [API HTTP] Código 405 Method Not Allowed
}

$rawBody = file_get_contents('php://input'); // [API INPUT] Lee el cuerpo JSON bruto enviado por fetch()
$data = json_decode($rawBody, true); // [API JSON] Decodifica el payload JSON a arreglo asociativo PHP
if (!$data && !empty($_POST)) { // [API FALLBACK] Soporta envíos tradicionales FormData si JSON viene vacío
    $data = $_POST; // [API INPUT] Asigna datos de formulario estándar
}

$correo = isset($data['correo']) ? trim($data['correo']) : ''; // [API SANITIZACIÓN] Limpia espacios del correo recibido
$password = isset($data['password']) ? trim($data['password']) : ''; // [API SANITIZACIÓN] Limpia espacios de la contraseña recibida

// [API VALIDACIÓN] Verifica que correo y contraseña no estén vacíos antes de consultar MySQL
if (empty($correo) || empty($password)) {
    responderJSON([ // [API ERROR] Devuelve error de validación 400
        'ok' => false, // [API CONTRATO] Estado negativo
        'mensaje' => 'Debes ingresar correo electrónico y contraseña.' // [API MENSAJE] Guía de error para el modal de login
    ], 400); // [API HTTP] Código 400 Bad Request
}

try {
    // [PDO PREPARED] Consulta preparada por correo único para prevenir Inyección SQL
    $stmt = $pdo->prepare("SELECT id_usuario, nombre_completo, correo, password_hash, rol FROM usuarios WHERE correo = ? LIMIT 1");
    $stmt->execute([$correo]); // [PDO EXECUTE] Enlaza de forma segura el correo como parámetro posicional
    $usuario = $stmt->fetch(); // [PDO FETCH] Obtiene el registro coincidente o false

    // [SEGURIDAD BCRYPT] Valida la contraseña en texto plano contra el hash bcrypt almacenado en MySQL
    if ($usuario && password_verify($password, $usuario['password_hash'])) {
        responderJSON([ // [API ÉXITO] Retorna sesión válida y rol RBAC sin incluir el password_hash
            'ok' => true, // [API CONTRATO] Autenticación exitosa
            'mensaje' => 'Sesión iniciada correctamente en MySQL.', // [API MENSAJE] Confirmación para bitácora y toast
            'usuario' => [ // [API PAYLOAD] Objeto usuario consumido por el controlador RBAC en script.js
                'id' => (int)$usuario['id_usuario'], // [API CAMPO] ID entero del usuario
                'nombre' => $usuario['nombre_completo'], // [API CAMPO] Nombre visible en header y dock
                'correo' => $usuario['correo'], // [API CAMPO] Correo asociado a consultas
                'rol' => $usuario['rol'] // [API RBAC] Rol estricto ('cliente', 'trabajador' o 'admin')
            ]
        ], 200); // [API HTTP] Código 200 OK
    } else {
        responderJSON([ // [API ERROR] Credenciales inválidas
            'ok' => false, // [API CONTRATO] Autenticación rechazada
            'mensaje' => 'Credenciales inválidas. Verifica tu correo y contraseña.' // [API MENSAJE] Aviso sin revelar qué campo falló
        ], 401); // [API HTTP] Código 401 Unauthorized
    }
} catch (PDOException $e) {
    responderJSON([ // [API ERROR] Maneja fallos de consulta SQL
        'ok' => false, // [API CONTRATO] Estado negativo
        'mensaje' => 'Error al consultar usuarios en base de datos.', // [API MENSAJE] Descripción segura
        'error' => $e->getMessage() // [API DEBUG] Detalle PDO
    ], 500); // [API HTTP] Código 500 Error Interno
}
