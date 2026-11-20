# Dominio Seguro — Panel web

Interfaz de **Dominio Seguro**, la plataforma que analiza la seguridad del dominio de una pequeña empresa y
explica los resultados en lenguaje claro. Proyecto del curso **Seguridad Informática** (Universidad Politécnica
de Chiapas, grupo 7C).

- API y orquestación con Docker: https://github.com/JORED666/dominio-seguro-Backend

## Qué incluye

- **Inicio, registro e inicio de sesión**, con segundo factor (código TOTP) cuando la cuenta lo tiene activo.
- **Mis dominios:** tarjetas con puntaje, nivel, tendencia y el problema principal de cada dominio.
- **Resultado de un análisis:** puntaje por categoría, hallazgos con "qué hacer", certificado TLS, red e historial.
- **Historial** con gráfica de evolución, **dominios similares** (typosquatting) y **alertas**.
- **Verificación de propiedad** del dominio mediante un registro DNS TXT.
- **Cuenta:** configuración de MFA con código QR.

## Tecnología

Angular 22 con componentes standalone, signals y sin zone.js; TypeScript. En producción se sirve con Nginx.

## Desarrollo

    npm ci
    npm start        # http://localhost:4200

Necesita el backend corriendo en el puerto 3001: `proxy.conf.json` reenvía `/api` hacia él, así el navegador
habla con un solo origen y la cookie de refresco funciona igual que en producción.

## Producción

El `Dockerfile` compila la aplicación y la sirve con Nginx sin privilegios (puerto 8080). Nginx reenvía `/api`
al servicio `backend` y añade cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`). El `docker-compose.yml` que levanta todo el sistema está en el
repositorio del backend.

## Seguridad en el cliente

- El token de acceso (15 minutos) vive solo en `sessionStorage`; el de refresco es una cookie `HttpOnly`
  que el JavaScript no puede leer.
- Un interceptor renueva la sesión una sola vez ante un 401 y reintenta la petición; si falla, cierra la sesión.
- No hay secretos en el código del cliente.

## Licencia

[MIT](LICENSE).
