-- [MYSQL SCHEMA] Script de creación e inicialización de base de datos para VGMS Abogados & Consultores S.R.L.
-- [MYSQL CHARSET] Crea la base de datos con soporte completo UTF-8 multilenguaje si no existe previamente
CREATE DATABASE IF NOT EXISTS `vgms_abogados_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- [MYSQL CONTEXTO] Selecciona la base de datos recién creada como esquema activo
USE `vgms_abogados_db`;

-- [MYSQL LIMPIEZA] Elimina primero la tabla hija consultas para respetar integridad referencial de llaves foráneas
DROP TABLE IF EXISTS `consultas`;
-- [MYSQL LIMPIEZA] Elimina la tabla catálogo servicios antes de recrearla
DROP TABLE IF EXISTS `servicios`;
-- [MYSQL LIMPIEZA] Elimina la tabla usuarios para reiniciar registros con contraseñas bcrypt limpias
DROP TABLE IF EXISTS `usuarios`;

-- [MYSQL RBAC] Crea la tabla usuarios que almacena credenciales seguras y rol estricto (cliente, trabajador, admin)
CREATE TABLE `usuarios` (
  `id_usuario` INT AUTO_INCREMENT PRIMARY KEY, -- [MYSQL PK] Identificador autoincremental único de usuario
  `nombre_completo` VARCHAR(100) NOT NULL, -- [MYSQL CAMPO] Nombre completo del abogado, socio o cliente
  `correo` VARCHAR(100) NOT NULL UNIQUE, -- [MYSQL UNIQUE] Correo electrónico corporativo o personal único para login
  `password_hash` VARCHAR(255) NOT NULL, -- [MYSQL SEGURIDAD] Hash criptográfico bcrypt generado con password_hash()
  `rol` ENUM('cliente', 'trabajador', 'admin') NOT NULL DEFAULT 'cliente', -- [MYSQL RBAC] Rol estricto de acceso en la app
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- [MYSQL AUDITORÍA] Marca temporal automática de creación
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- [MYSQL MOTOR] InnoDB con soporte transaccional

-- [MYSQL SEED RBAC] Inserta los 3 usuarios de demostración con hashes bcrypt compatibles con Admin1234, Trabajador1234 y Cliente1234
INSERT INTO `usuarios` (`id_usuario`, `nombre_completo`, `correo`, `password_hash`, `rol`) VALUES
(1, 'Dr. Francisco Vela', 'fvela@vgms.com.bo', '$2y$10$aq9mzr5yV9/mBKKxoHRKH.k5BC.2ChItna8uuPs2BwnTRfREaMYAG', 'admin'), -- [MYSQL SEED] Socio Director / Admin
(2, 'Dr. Juan Diego Andrade', 'recepcion@vgms.com.bo', '$2y$10$wtQjCKxnSFOT0eHMWGtio.GiWeo1frsc3SOqxgl8vjbW6tGW4.DMS', 'trabajador'), -- [MYSQL SEED] Abogado / Recepción
(3, 'Vania Ramos', 'vania.ramos@gmail.com', '$2y$10$uxZ/d8rC2M7Fn.d0VHGtuenGPCUR8T1GVXjwlkp9l.QYxUOrc3/L2', 'cliente'); -- [MYSQL SEED] Cliente real de referencia

-- [MYSQL CATÁLOGO] Crea la tabla servicios con los 8 servicios legales especializados de VGMS Abogados & Consultores
CREATE TABLE `servicios` (
  `id_servicio` VARCHAR(10) PRIMARY KEY, -- [MYSQL PK] Código identificador del servicio jurídico (S1 a S8)
  `nombre` VARCHAR(100) NOT NULL, -- [MYSQL CAMPO] Nombre comercial y jurídico del servicio
  `area` VARCHAR(50) NOT NULL, -- [MYSQL CAMPO] Área de práctica legal (Propiedad Intelectual, Corporativo, etc.)
  `especialista` VARCHAR(80) NOT NULL, -- [MYSQL CAMPO] Abogado titular responsable en VGMS
  `honorario_base` DECIMAL(8,2) NOT NULL, -- [MYSQL CAMPO] Honorario base por bloque de consultoría en bolivianos (Bs)
  `estado` ENUM('disponible', 'pausado') NOT NULL DEFAULT 'disponible' -- [MYSQL ESTADO] Control operativo gestionado por Admin
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- [MYSQL MOTOR] InnoDB para llaves foráneas

-- [MYSQL SEED CATÁLOGO] Carga los 8 servicios jurídicos reales basados en las áreas de vgms.com.bo/wp/
INSERT INTO `servicios` (`id_servicio`, `nombre`, `area`, `especialista`, `honorario_base`, `estado`) VALUES
('S1', 'Registro de Marca y Signos Distintivos (SENAPI)', 'Propiedad Intelectual', 'Dr. Francisco Vela', 1800.00, 'disponible'), -- [MYSQL SEED S1] Marcas y signos distintivos
('S2', 'Patentes de Invención y Derechos de Autor', 'Propiedad Intelectual', 'Dr. Francisco Vela', 2500.00, 'disponible'), -- [MYSQL SEED S2] Patentes y derechos de autor
('S3', 'Protección Activa y Medidas en Frontera', 'Protección Activa', 'Dr. Francisco Vela', 2200.00, 'disponible'), -- [MYSQL SEED S3] Antipiratería y vigilancia marcaria
('S4', 'Constitución de Sociedades y Derecho Corporativo', 'Derecho Corporativo', 'Dr. Álvaro Maldonado', 2400.00, 'disponible'), -- [MYSQL SEED S4] Sociedades comerciales
('S5', 'Derecho Administrativo y Contrataciones Públicas', 'Derecho Corporativo', 'Dr. Álvaro Maldonado', 1900.00, 'disponible'), -- [MYSQL SEED S5] Contratación pública y gestión
('S6', 'Contratos Civiles, Conciliación y Legaltech', 'Civil y Penal', 'Dr. Juan Diego Andrade', 1200.00, 'disponible'), -- [MYSQL SEED S6] Contratos y conciliación
('S7', 'Derecho Constitucional, Tributario y Autonómico', 'Civil y Penal', 'Dr. Raúl Salta', 1600.00, 'disponible'), -- [MYSQL SEED S7] Derecho tributario y constitucional
('S8', 'Defensa Penal Estratégica y Ley 004', 'Civil y Penal', 'Dr. Paulo Ponce', 2100.00, 'disponible'); -- [MYSQL SEED S8] Litigio penal estratégico

-- [MYSQL CONSULTAS] Crea la tabla transaccional de consultas jurídicas agendadas con estados operativos
CREATE TABLE `consultas` (
  `id_consulta` INT AUTO_INCREMENT PRIMARY KEY, -- [MYSQL PK] Identificador único de la consulta legal
  `titular_nombre` VARCHAR(100) NOT NULL, -- [MYSQL CAMPO] Nombre y apellido del cliente o representante legal
  `celular` VARCHAR(8) NOT NULL, -- [MYSQL CAMPO] Celular boliviano de 8 dígitos para contacto WhatsApp
  `correo` VARCHAR(100) NOT NULL, -- [MYSQL CAMPO] Correo electrónico validado del cliente
  `id_servicio` VARCHAR(10) NOT NULL, -- [MYSQL FK] Referencia al servicio S1-S8 del catálogo
  `fecha` DATE NOT NULL, -- [MYSQL CAMPO] Fecha agendada de la reunión jurídica
  `hora_inicio` VARCHAR(10) NOT NULL, -- [MYSQL CAMPO] Bloque horario de inicio (ej. 10:00)
  `duracion_horas` INT NOT NULL DEFAULT 1, -- [MYSQL CAMPO] Duración de la sesión en horas
  `modalidad` VARCHAR(50) NOT NULL DEFAULT 'presencial', -- [MYSQL CAMPO] Modalidad (Presencial Edificio La Paz I o Virtual)
  `adicionales` VARCHAR(200) NULL DEFAULT '', -- [MYSQL CAMPO] Servicios complementarios contratados
  `total_bs` DECIMAL(10,2) NOT NULL, -- [MYSQL CAMPO] Monto total calculado en bolivianos (Bs)
  `estado` ENUM('pendiente', 'en_atencion', 'completada', 'cancelada') NOT NULL DEFAULT 'pendiente', -- [MYSQL FLUJO] Flujo operativo de atención
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- [MYSQL AUDITORÍA] Fecha y hora exacta de registro en servidor
  CONSTRAINT `fk_consultas_servicio` FOREIGN KEY (`id_servicio`) REFERENCES `servicios` (`id_servicio`) ON UPDATE CASCADE ON DELETE RESTRICT -- [MYSQL FK] Integridad referencial con catálogo
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- [MYSQL MOTOR] InnoDB con soporte de claves foráneas

-- [MYSQL SEED CONSULTAS] Inserta 2 consultas de ejemplo para la fecha actual del servidor MySQL
INSERT INTO `consultas` (`titular_nombre`, `celular`, `correo`, `id_servicio`, `fecha`, `hora_inicio`, `duracion_horas`, `modalidad`, `adicionales`, `total_bs`, `estado`) VALUES
('Vania Ramos', '67005417', 'vania.ramos@gmail.com', 'S1', CURDATE(), '10:00', 1, 'Presencial (Edificio La Paz I)', 'Búsqueda de Anterioridad SENAPI', 2050.00, 'pendiente'), -- [MYSQL SEED] Consulta activa cliente demo
('Willy Gómez', '78854844', 'willy.gomez@gmail.com', 'S2', CURDATE(), '15:00', 1, 'Videollamada Legaltech', 'Revisión de Contratos y NDA', 2850.00, 'en_atencion'); -- [MYSQL SEED] Consulta en atención
