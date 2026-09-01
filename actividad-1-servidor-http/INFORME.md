# Informe — Actividad 1

**Materia:** Arquitectura Web
**Actividad:** Servidor HTTP con Node.js

## Entorno utilizado

Instalación **local** de Node.js sobre **macOS 26.5.1** (Apple Silicon, arm64).
No se utilizó Docker.

## Método de instalación

Se instaló Node.js mediante **`nvm` (Node Version Manager)** v0.40.7, clonando el
repositorio oficial en `~/.nvm` e inicializándolo desde `~/.zshrc`. Sobre ese gestor
se instaló la versión LTS vigente con `nvm install --lts`: **Node.js v24.19.0
("Krypton")** con **npm 11.17.0**, fijada por defecto mediante
`nvm alias default 'lts/*'`.

## Dificultades encontradas

El equipo ya tenía Node.js v26.7.0 instalado vía Homebrew, pero esa versión pertenece
a la línea *Current* y no a una LTS: fue publicada el 05/08/2026 y todavía no pasó a
soporte de largo plazo, siendo la v24.19.0 la LTS activa. Como la consigna exige una
versión LTS, se instaló `nvm` para incorporar la v24 sin desinstalar la de Homebrew,
quedando ambas disponibles y conmutables.

En la implementación, el punto que requirió mayor atención fue el manejo del body en
`POST /archivo`: `req` es un *stream* legible, por lo que el contenido no está
disponible al invocarse el callback, sino que llega en fragmentos a través del evento
`data`. Se resolvió acumulando `chunk.length` en un contador y respondiendo dentro del
evento `end`, evitando cargar el payload completo en memoria. El conteo se verificó
contra archivos de 2048 bytes y de 5 MB, con resultado exacto en ambos casos.
