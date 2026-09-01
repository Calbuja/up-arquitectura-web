# Actividad 1 — Servidor HTTP con Node.js

**Módulo 1 · Arquitectura Web · Universidad de Palermo**

Servidor HTTP mínimo implementado **exclusivamente** con el módulo nativo `http` de
Node.js, sin frameworks. Expone dos rutas:

| Método | Ruta         | Respuesta                                              |
|--------|--------------|--------------------------------------------------------|
| `GET`  | `/`          | `200` — texto plano confirmando que el servidor corre  |
| `POST` | `/archivo`   | `200` — cantidad total de bytes recibidos en el body   |
| *otro* | *cualquiera* | `404` — recurso no encontrado                          |

## Cómo ejecutarlo

```bash
node server.js
```

El servidor queda escuchando en `http://localhost:3000`.

## Cómo probarlo

```bash
# Ruta raíz
curl http://localhost:3000/
```

```bash
# Envío de un archivo binario
curl -X POST --data-binary @algun-archivo.bin http://localhost:3000/archivo
```

```bash
# Ruta inexistente (404)
curl -i http://localhost:3000/otra-cosa
```

## Entorno

- **Sistema operativo:** macOS 26.5.1 (Apple Silicon)
- **Node.js:** v24.19.0 LTS ("Krypton"), instalado con `nvm`
- **npm:** 11.17.0

## Contenido de la carpeta

```
actividad-1-servidor-http/
├── README.md      # este archivo
├── INFORME.md     # entorno, método de instalación y dificultades encontradas
├── EVIDENCIA.md   # capturas de pantalla y salidas de los comandos de prueba
├── evidencia/     # capturas de pantalla
└── server.js      # servidor HTTP del Ejercicio 3
```

## Documentación de la entrega

- [INFORME.md](INFORME.md) — entorno, método de instalación y dificultades encontradas
- [EVIDENCIA.md](EVIDENCIA.md) — capturas de pantalla y salidas de los comandos de prueba
