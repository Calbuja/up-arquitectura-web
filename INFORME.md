# Informe — Actividad Individual Módulo 1

**Materia:** Arquitectura Web
**Actividad:** Servidor HTTP con Node.js

## Entorno utilizado

Se trabajó con una **instalación local** de Node.js sobre **macOS 26.5.1** en
hardware Apple Silicon (arm64). No se utilizó Docker.

## Método de instalación

Se optó por instalar Node.js mediante **`nvm` (Node Version Manager)**, versión
v0.40.7, clonando el repositorio oficial en `~/.nvm` e inicializándolo desde
`~/.zshrc`. Sobre ese gestor se instaló la versión **LTS** vigente con
`nvm install --lts`, quedando **Node.js v24.19.0 ("Krypton")** con **npm 11.17.0**,
fijada como versión por defecto mediante `nvm alias default 'lts/*'`.

Verificación:

```
$ node --version
v24.19.0
$ npm --version
11.17.0
```

## Dificultades encontradas

La única dificultad relevante fue de diagnóstico previo. El equipo ya tenía Node.js
instalado vía Homebrew, pero en su versión **v26.7.0**, que al momento de realizar la
actividad corresponde a la línea *Current* y **no** a una LTS: según el índice oficial
de distribuciones de nodejs.org, la v26 fue publicada el 05/08/2026 y todavía no pasó
a soporte de largo plazo, siendo la v24.19.0 la LTS activa. Dado que la consigna exige
explícitamente una versión LTS, se instaló `nvm` para poder incorporar la v24 sin
desinstalar ni pisar la instalación existente de Homebrew, quedando ambas disponibles
y conmutables con un solo comando.

Fuera de eso, la implementación del servidor no presentó inconvenientes. El punto que
requirió mayor atención conceptual fue el manejo del body en `POST /archivo`: el
objeto `req` es un *stream* legible, por lo que el contenido no está disponible al
momento de invocarse el callback, sino que llega de forma asíncrona en fragmentos a
través del evento `data`. Se resolvió acumulando únicamente `chunk.length` en un
contador y respondiendo dentro del handler del evento `end`, evitando almacenar el
payload completo en memoria. Se verificó el conteo tanto contra un archivo de 2048
bytes como contra uno de 5.242.880 bytes (5 MB), obteniendo en ambos casos el valor
exacto.
