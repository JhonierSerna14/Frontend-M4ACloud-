# M4A — Mis Materias, Mis Apuntes

> Organizá tus materias, apuntes y tareas académicas. Grabá audio en clase y obtené una transcripción + resumen generado por IA en segundos.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white)

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Features](#features)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Setup local](#setup-local)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Deploy](#deploy)

---

## Descripción

M4A es una SPA (Single Page Application) PWA orientada a estudiantes. Permite organizar el contenido académico en **materias**, crear y editar **notas** con un editor de texto enriquecido, gestionar **tareas/evaluaciones** en un tablero kanban y **grabar audio** durante una clase para que el backend procese la transcripción y genere un resumen automáticamente con IA.

El progreso del procesamiento de audio se sincroniza en tiempo real con el frontend vía **WebSocket**, sin necesidad de hacer polling manual.

---

## Features

| Módulo | Descripción |
|---|---|
| **Materias** | CRUD de materias con color personalizado y editor de contenido HTML |
| **Notas** | Editor de texto enriquecido (TipTap) con soporte para imágenes redimensionables, tablas, listas de tareas y links |
| **Tareas** | Tablero kanban con columnas Pendiente / En Proceso / Finalizado, filtros por materia/tipo y arrastrar para reordenar |
| **Grabar** | Grabación de audio in-browser (MediaRecorder API), upload al backend y seguimiento del procesamiento IA en tiempo real |
| **Dashboard** | Resumen estadístico + calendario mensual con eventos y alertas de tareas vencidas |
| **Autenticación** | Login / Registro con JWT. Auto-refresh del access token transparente mediante interceptor Axios |
| **Exportar PDF** | Descarga de notas en PDF con barra de progreso |
| **PWA** | Instalable en Android/iOS/Desktop, funciona offline para contenido ya cacheado |

---

## Stack tecnológico

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | 19 | UI |
| TypeScript | 5 | Tipado estático |
| Vite | 6 | Build tool + dev server con proxy |
| Tailwind CSS | 4 | Estilos utilitarios (CSS variables nativo) |
| React Router | 7 | SPA routing |
| TanStack React Query | 5 | Server state, caché y mutaciones |
| Axios | 1 | HTTP client con interceptores JWT |
| TipTap | 3 | Editor de texto enriquecido extensible |
| date-fns | 4 | Formateo de fechas |
| lucide-react | — | Iconografía |
| vite-plugin-pwa | — | Service Worker / PWA con Workbox |


**Flujo de autenticación:**
1. Login → recibe `access_token` + `refresh_token` → guarda en `localStorage`
2. Cada request Axios adjunta `Authorization: Bearer <access_token>` automáticamente
3. Si el backend devuelve `401`, el interceptor hace refresh silencioso y reintenta la request original
4. Las peticiones que llegaron durante el refresh se encolan y se procesan al recibir el nuevo token

**Flujo de procesamiento de audio:**
1. Se graba audio con la MediaRecorder API (WebM/OGG con Opus)
2. Se sube al backend vía `POST /notas/audio/upload` con `multipart/form-data`
3. El backend crea la nota inmediatamente y procesa la transcripción + resumen en background
4. El frontend se conecta por WebSocket a `/notas/{id}/progress` y actualiza la UI en tiempo real
5. Al terminar, la nota se recarga automáticamente con el contenido generado

---

## Setup local

### Requisitos previos
- Node.js 20+
- Backend M4A corriendo en `http://localhost:8000` (ver repositorio backend)

### Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd Frontend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editá .env si el backend corre en un puerto distinto a 8000

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La app estará disponible en [http://localhost:5173](http://localhost:5173).

> El servidor de Vite actúa como proxy: todas las peticiones a `/api` se redirigen automáticamente al backend, evitando problemas de CORS en desarrollo.

---

## Variables de entorno

| Variable | Entorno | Descripción | Valor por defecto |
|---|---|---|---|
| `VITE_BACKEND_TARGET` | Desarrollo | URL base del backend al que apunta el proxy de Vite | `http://localhost:8000` |
| `VITE_API_URL` | Producción | URL completa del backend desplegado, terminando en `/api` | *(requerida en prod)* |



## Scripts disponibles

```bash
npm run dev       # Servidor de desarrollo con HMR en :5173
npm run build     # Build de producción (TypeScript check + Vite build)
npm run preview   # Sirve el build de producción localmente
npm run lint      # ESLint sobre todo el proyecto
```