# Dominio Seguro: Frontend

Aplicación web en Angular para monitorear la seguridad de dominios en pequeñas empresas.

Backend (API REST): https://github.com/JORED666/dominio-seguro-Backend

## Requisitos

- Node.js 22 o superior
- API del backend corriendo en `http://localhost:3001`

## Cómo correrlo

1. `npm install`
2. `npm start`
3. Abrir `http://localhost:4200`

La URL de la API se cambia en `src/app/core/api.ts`.

## Pantallas

- Inicio de sesión y registro
- Mis dominios (lista con puntaje y estado)
- Resultado del análisis (hallazgos, certificado, subdominios e historial)

## Estructura

- `src/app/core/`: servicios, interceptor JWT, guard de rutas y modelos
- `src/app/pages/`: una carpeta por pantalla

## Pendiente

- MFA, verificación de dominio, alertas y reporte PDF
- Rediseño visual
