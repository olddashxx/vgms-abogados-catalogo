<?php
// [API PHP/PDO] Configuración de conexión segura a MySQL (XAMPP) para VGMS Abogados & Consultores S.R.L.
header('Content-Type: application/json; charset=utf-8'); // [API HEADERS] Define respuesta JSON en codificación UTF-8
header('Access-Control-Allow-Origin: *'); // [API CORS] Habilita consumo desde el cliente frontend en desarrollo local
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS'); // [API CORS] Declara métodos HTTP permitidos por el endpoint
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'); // [API CORS] Autoriza cabeceras JSON en fetch()

// [API CORS PREFLIGHT] Responde con código 200 inmediato a solicitudes de verificación OPTIONS del navegador
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); // [API HTTP] Establece estado 200 OK para preflight
    exit; // [API CONTROL] Detiene la ejecución sin abrir conexión innecesaria
}

$host = 'localhost'; // [MYSQL CONFIG] Servidor local MySQL de XAMPP
$db   = 'vgms_abogados_db'; // [MYSQL CONFIG] Nombre de la base de datos jurídica de VGMS
$user = 'root'; // [MYSQL CONFIG] Usuario administrador por defecto en XAMPP
$pass = ''; // [MYSQL CONFIG] Contraseña por defecto en entorno local XAMPP
$charset = 'utf8mb4'; // [MYSQL CONFIG] Juego de caracteres Unicode completo

// [API HELPER] Emite respuestas JSON estandarizadas con código HTTP y finaliza la ejecución del script
function responderJSON($data, $codigoEstado = 200) {
    http_response_code($codigoEstado); // [API HTTP] Asigna el código de estado HTTP correspondiente (200, 201, 400, 401, 409, 500)
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT); // [API JSON] Serializa manteniendo tildes y eñes legibles
    exit; // [API CONTROL] Evita salidas adicionales posteriores al JSON
}

try {
    $dsn = "mysql:host={$host};dbname={$db};charset={$charset}"; // [PDO DSN] Construye cadena de conexión Data Source Name
    $opciones = [ // [PDO OPCIONES] Define parámetros estrictos de seguridad y manejo de errores
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // [PDO ERROR] Lanza excepciones capturables ante fallos SQL
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, // [PDO FETCH] Devuelve filas como arreglos asociativos limpios
        PDO::ATTR_EMULATE_PREPARES   => false, // [PDO SEGURIDAD] Obliga consultas preparadas nativas contra Inyección SQL
    ];
    $pdo = new PDO($dsn, $user, $pass, $opciones); // [PDO INSTANCIA] Crea la conexión activa con MySQL
} catch (PDOException $e) {
    responderJSON([ // [API ERROR] Informa fallo de conexión sin exponer credenciales de base de datos
        'ok' => false, // [API CONTRATO] Bandera de error estandarizada
        'mensaje' => 'Error de conexión con la base de datos MySQL (XAMPP). Verifica que el servicio MySQL esté iniciado.', // [API MENSAJE] Mensaje legible al cliente
        'error' => $e->getMessage() // [API DEBUG] Detalle técnico de excepción PDO
    ], 500); // [API HTTP] Código 500 Error Interno del Servidor
}
