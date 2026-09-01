# Actividad 2 — Documentación de la API

**Módulo 2 · Arquitectura Web · Universidad de Palermo**

Documentación formal de los endpoints de la API del backend elegido para el Trabajo
Práctico Integrador: un **sistema de gestión de taller mecánico**.

## Entregables

| Archivo | Contenido |
|---|---|
| [`Documentacion-API.pdf`](Documentacion-API.pdf) | **Documento exportado** (22 páginas). Es el entregable formal de la actividad |
| [`Documentacion-API.html`](Documentacion-API.html) | Fuente del PDF, por si hace falta regenerarlo |
| [`openapi.yaml`](openapi.yaml) | Especificación **OpenAPI 3.0.3** del mismo contrato. Se abre en [editor.swagger.io](https://editor.swagger.io) |
| Este `README.md` | La documentación completa, en el repositorio |

> **Los códigos de estado de esta documentación están verificados, no listados de
> memoria.** Cada uno se provocó con un request real contra la implementación: se
> ejecutaron 82 casos, uno por cada par *(endpoint, código de estado)*. Ver la
> [sección de verificación](#5-verificación-del-contrato).

---

## 1. Descripción general del backend

### 1.1. Dominio y problema que resuelve

El backend implementa la gestión operativa de un **taller mecánico**. El problema que
resuelve es el seguimiento del trabajo que el taller realiza sobre las unidades de sus
clientes: qué vehículos atiende, qué reparaciones se les hicieron, qué repuestos y horas
de mano de obra consumió cada reparación, cuánto se facturó y qué unidades están
pendientes de un nuevo service.

Antes de un sistema así esa información vive en papel o en una planilla: no hay forma
confiable de saber cuánto costó mantener una unidad a lo largo del tiempo, ni de detectar
qué clientes deberían volver al taller.

### 1.2. Modelo de recursos

```
Vehículo  ────<  Orden de trabajo  ────<  Ítem
(recurso maestro)  (recurso transaccional)   (repuesto / mano de obra)
      │                     │
      │                     └──>  Reportes (recursos derivados, solo lectura)
      │
      └── un vehículo tiene muchas órdenes a lo largo de su vida
```

- **Vehículo** — la unidad que atiende el taller, identificada por su patente. Es el
  recurso maestro y sobre él se implementa el ABM completo.
- **Orden de trabajo** — el ingreso de un vehículo al taller por un trabajo determinado.
  Tiene un ciclo de vida propio y es el recurso que alimenta los reportes.
- **Ítem** — cada repuesto colocado o cada tarea de mano de obra dentro de una orden. No
  existe fuera de su orden, por eso se modela como sub-recurso anidado.
- **Reportes** — recursos derivados que se calculan a demanda. No se almacenan y solo
  admiten lectura.

### 1.3. Ciclo de vida de una orden de trabajo

Varios de los `409 Conflict` documentados más abajo se explican por esta máquina de
estados. Cualquier transición que no figure acá es rechazada:

```
                    ┌──────────────┐
      alta ───────► │  PENDIENTE   │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │  EN_PROCESO  │ ───────► │  CANCELADA   │  (final)
       └──────┬───────┘          └──────────────┘
              │                         ▲
              ▼                         │
       ┌──────────────┐                 │
       │   CERRADA    │  (final)  ──────┘  también desde PENDIENTE
       └──────────────┘
```

Dos reglas asociadas al cierre condicionan el contrato:

- Una orden **no puede cerrarse sin ítems cargados**: no se factura una orden vacía.
- Al cerrarse, si el kilometraje de ingreso es mayor al registrado en el vehículo, **el
  kilometraje del vehículo se actualiza**.

---

## 2. Convenciones del contrato

Estas reglas aplican a **todos** los endpoints, por eso no se repiten en cada ficha.

### 2.1. URL base y versionado

```
http://localhost:3001/api/v1
```

La versión viaja en la URI. Adoptar versionado desde el primer release evita quedar
atado a un contrato implícito cuando ya existen consumidores.

### 2.2. Diseño de las URIs

- Los recursos se nombran con **sustantivos en plural** (`/vehiculos`, `/ordenes`). La
  acción la aporta el verbo HTTP, nunca la URI: no existe `/crearVehiculo`.
- Los **filtros viajan por query string**: `/vehiculos?marca=Toyota` es una vista de la
  colección, no un recurso nuevo.
- El **anidamiento se reserva para relaciones de pertenencia** (`/ordenes/{id}/items`) y
  no supera los dos niveles.

### 2.3. Content-Type

Todo request con cuerpo (`POST`, `PUT`, `PATCH`) debe enviar
`Content-Type: application/json`. La API responde siempre `application/json`.

### 2.4. Formato de las respuestas de colección

```json
{
  "datos": [ ],
  "meta": {
    "total": 8, "page": 1, "limit": 20,
    "totalPaginas": 1, "hayPaginaSiguiente": false
  }
}
```

Parámetros comunes a todas las colecciones: `page` (entero ≥ 1, por defecto `1`) y
`limit` (entero entre 1 y 100, por defecto `20`). El ordenamiento usa `sort=campo`
ascendente y `sort=-campo` descendente.

### 2.5. Formato de los errores

Todos los errores comparten una única forma, para que el cliente pueda manejarlos de
manera genérica:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos invalidos",
    "details": [
      { "campo": "patente", "mensaje": "'patente' no tiene un formato valido (AAA111 o AB123CD)" },
      { "campo": "anio",    "mensaje": "'anio' debe estar entre 1950 y 2027" }
    ]
  }
}
```

| Código | `error.code` | Cuándo lo devuelve |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Datos del cuerpo, parámetros de consulta o campos desconocidos inválidos |
| `400` | `INVALID_JSON` | El cuerpo del request no es JSON parseable |
| `404` | `NOT_FOUND` | El recurso identificado en la URI no existe |
| `404` | `ROUTE_NOT_FOUND` | La ruta no corresponde a ningún endpoint de la API |
| `405` | `METHOD_NOT_ALLOWED` | La URI existe pero no admite ese verbo. Incluye el header `Allow` |
| `409` | `CONFLICT` | El request es válido pero choca con el estado actual del sistema |
| `413` | `PAYLOAD_TOO_LARGE` | El cuerpo del request supera los 100 kB |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | El `Content-Type` no es `application/json` |
| `500` | `INTERNAL_SERVER_ERROR` | Error no previsto. El detalle se registra en el servidor y no se envía al cliente |

**Criterio `400` frente a `409`.** Un `400` indica que el request está mal formado y el
cliente puede corregirlo mirando solamente lo que envió. Un `409` indica que el request
es correcto pero incompatible con el estado actual del servidor: la patente ya existe, la
orden ya está cerrada, el vehículo tiene trabajo pendiente. El cliente no podía saberlo de
antemano.

### 2.6. Comportamientos transversales

Estos tres códigos son alcanzables en toda la API y por eso no se repiten en cada ficha:

- **`405 Method Not Allowed`** — cualquier URI existente invocada con un verbo que no
  soporta. La respuesta incluye el header `Allow` con los verbos admitidos.
- **`413 Payload Too Large`** — todo endpoint que acepta cuerpo, si este supera los 100 kB.
- **`500 Internal Server Error`** — cualquier endpoint, ante un error no previsto.

### 2.7. Propiedades de los métodos

Un método es **safe** cuando su invocación no le pide al servidor ningún cambio en los
recursos que expone, e **idempotente** cuando invocarlo varias veces deja el sistema en el
mismo estado que invocarlo una sola vez.

| Método | Safe | Idempotente |
|---|---|---|
| `GET` | Sí | Sí |
| `POST` | No | No |
| `PUT` | No | Sí |
| `PATCH` | No | Sí *en esta API* — los campos se asignan por valor absoluto, nunca por delta |
| `DELETE` | No | Sí |

**Sobre la idempotencia de `DELETE`.** Repetir un `DELETE` sobre un recurso ya eliminado
devuelve `404`. Eso no contradice la idempotencia: la propiedad se refiere al *estado del
sistema* tras completarse el request, no al código devuelto. El recurso queda igualmente
eliminado. El mismo razonamiento aplica a `PUT /ordenes/{id}/estado`, que devuelve `409`
al repetirse pero deja la orden en el mismo estado.

### 2.8. Nivel de madurez

| Nivel | Requisito | Cumplimiento |
|---|---|---|
| 0 | HTTP como mecanismo de transporte | Cumplido |
| 1 | Recursos identificados por URI | Cumplido — `/vehiculos`, `/vehiculos/{id}`, `/ordenes/{id}/items` |
| 2 | Uso semántico de verbos HTTP y códigos de estado | Cumplido — cinco verbos según su semántica, `Location` en los `201`, `Allow` en los `405` |
| 3 | Controles hipermedia (HATEOAS) | Parcial — el índice `GET /` publica las URIs de todos los recursos, pero las representaciones individuales no incluyen enlaces |

La API se sitúa en el **Nivel 2 del Modelo de Madurez de Richardson**.

---

## 3. Documentación de los endpoints

Se documentan los **22 endpoints** que el backend expone efectivamente.

### 3.1. Recursos de servicio

| # | Verbo | Ruta | Propósito | Códigos de estado |
|---|---|---|---|---|
| 01 | `GET` | `/api/v1` | Índice de la API: lista los recursos disponibles con su URI, para poder descubrirla sin leer la documentación | `200` Índice devuelto |
| 02 | `GET` | `/api/v1/health` | Chequeo de salud. Confirma que el servidor está operativo e informa cuántos registros cargó el set de datos por defecto | `200` Servicio operativo |

Ninguno de los dos recibe parámetros, por lo que `200` es su único resultado posible.

### 3.2. Vehículos

#### 03 · `GET /api/v1/vehiculos`

Lista la colección de vehículos, con búsqueda, filtros, ordenamiento y paginación.
*Safe · Idempotente · Allow: `GET, POST, OPTIONS`*

| Parámetro | Tipo | Descripción |
|---|---|---|
| `q` | texto | Búsqueda libre sobre patente, marca, modelo y titular |
| `marca` | texto | Filtra por marca exacta, sin distinguir mayúsculas |
| `activo` | booleano | Filtra por estado de alta |
| `sort` | texto | `patente`, `marca`, `modelo`, `anio`, `kilometraje`, `id`. Prefijo `-` para descendente. Por defecto `patente` |
| `page` | entero | Página, desde 1. Por defecto `1` |
| `limit` | entero | Resultados por página, 1–100. Por defecto `20` |

| Código | Caso |
|---|---|
| `200 OK` | Listado devuelto. Una búsqueda sin resultados también devuelve `200`, con `datos` vacío |
| `400 Bad Request` | `page` menor a 1, `limit` fuera del rango 1–100, o `sort` sobre un campo no admitido |

#### 04 · `POST /api/v1/vehiculos`

Da de alta un vehículo. La patente es la clave natural y debe ser única. La respuesta
incluye el header `Location` con la URI del recurso creado.
*No safe · No idempotente · Allow: `GET, POST, OPTIONS`*

```json
{
  "patente": "AZ999ZZ",
  "marca": "Honda",
  "modelo": "Civic",
  "anio": 2020,
  "kilometraje": 54000,
  "titularNombre": "Carla Nunez",
  "titularTelefono": "11-1234-5678",
  "activo": true
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `patente` | Sí | Formato argentino: `AAA111` o `AB123CD`. Se normaliza a mayúsculas |
| `marca` | Sí | Texto de 2 a 40 caracteres |
| `modelo` | Sí | Texto de 1 a 40 caracteres |
| `anio` | Sí | Entero entre 1950 y el año próximo |
| `kilometraje` | Sí | Entero entre 0 y 2.000.000 |
| `titularNombre` | Sí | Texto de 3 a 80 caracteres |
| `titularTelefono` | Sí | Texto de 6 a 30 caracteres |
| `activo` | No | Booleano. Por defecto `true` |

| Código | Caso |
|---|---|
| `201 Created` | Vehículo creado. Devuelve la representación completa y el header `Location` |
| `400 Bad Request` | Falta un campo obligatorio, un valor no cumple sus reglas, se envió un campo que el recurso no acepta, o el cuerpo no es JSON parseable |
| `409 Conflict` | Ya existe otro vehículo con esa patente |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

#### 05 · `GET /api/v1/vehiculos/{id}`

Devuelve la representación completa de un vehículo.
*Safe · Idempotente · Allow: `GET, PUT, PATCH, DELETE, OPTIONS`*

| Código | Caso |
|---|---|
| `200 OK` | Vehículo encontrado |
| `404 Not Found` | No existe un vehículo con ese id. También se devuelve cuando el id no es numérico, porque tampoco identifica ningún recurso |

#### 06 · `PUT /api/v1/vehiculos/{id}`

Reemplaza por completo la representación del vehículo. El cliente debe enviar **todos**
los campos obligatorios: se validan con las mismas reglas que el alta. Es la diferencia
esencial con `PATCH`.
*No safe · Idempotente · Allow: `GET, PUT, PATCH, DELETE, OPTIONS`*

```json
{
  "patente": "AB123CD",
  "marca": "Toyota",
  "modelo": "Corolla XEI",
  "anio": 2019,
  "kilometraje": 90000,
  "titularNombre": "Laura Gimenez",
  "titularTelefono": "11-4455-8890",
  "activo": true
}
```

| Código | Caso |
|---|---|
| `200 OK` | Vehículo reemplazado |
| `400 Bad Request` | Falta algún campo obligatorio, un valor es inválido, o se envió un campo desconocido |
| `404 Not Found` | No existe un vehículo con ese id |
| `409 Conflict` | La patente enviada ya pertenece a otro vehículo, o el kilometraje es menor al registrado |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

#### 07 · `PATCH /api/v1/vehiculos/{id}`

Modifica parcialmente un vehículo: aplica únicamente los campos enviados y conserva el
resto.
*No safe · Idempotente · Allow: `GET, PUT, PATCH, DELETE, OPTIONS`*

```json
{ "kilometraje": 92000 }
```

```json
{ "activo": false }
```

| Código | Caso |
|---|---|
| `200 OK` | Vehículo modificado. Devuelve la representación completa resultante |
| `400 Bad Request` | El cuerpo viene vacío (un `PATCH` sin cambios no tiene sentido), algún valor es inválido, o se envió un campo desconocido |
| `404 Not Found` | No existe un vehículo con ese id |
| `409 Conflict` | La patente enviada ya pertenece a otro vehículo, o el kilometraje es menor al registrado |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

#### 08 · `DELETE /api/v1/vehiculos/{id}`

Elimina un vehículo junto con sus órdenes históricas. La baja se bloquea si la unidad
tiene órdenes abiertas, porque eliminarla dejaría órdenes apuntando a un vehículo
inexistente.
*No safe · Idempotente · Sin cuerpo · Allow: `GET, PUT, PATCH, DELETE, OPTIONS`*

| Código | Caso |
|---|---|
| `204 No Content` | Vehículo eliminado. Sin cuerpo: la baja no tiene nada útil que informar |
| `404 Not Found` | No existe un vehículo con ese id |
| `409 Conflict` | El vehículo tiene al menos una orden en estado `PENDIENTE` o `EN_PROCESO` |

#### 09 · `GET /api/v1/vehiculos/{id}/ordenes`

Historial completo de órdenes del vehículo, de la más reciente a la más antigua. Es un
sub-recurso: las órdenes pertenecen al vehículo y la URI lo expresa por anidamiento.
*Safe · Idempotente · Allow: `GET, OPTIONS`*

| Código | Caso |
|---|---|
| `200 OK` | Historial devuelto. Un vehículo sin órdenes devuelve `200` con la lista vacía |
| `404 Not Found` | El vehículo indicado en la URI no existe |

### 3.3. Órdenes de trabajo

#### 10 · `GET /api/v1/ordenes`

Lista la colección de órdenes con filtros, ordenamiento y paginación. Cada orden se
devuelve enriquecida con los datos básicos de su vehículo, para que una grilla no
necesite un request por fila.
*Safe · Idempotente · Allow: `GET, POST, OPTIONS`*

| Parámetro | Tipo | Descripción |
|---|---|---|
| `estado` | texto | Uno o varios estados separados por coma, ej. `PENDIENTE,EN_PROCESO` |
| `vehiculoId` | entero | Filtra por vehículo |
| `mecanico` | texto | Coincidencia parcial sobre el nombre del mecánico |
| `desde` / `hasta` | fecha | Rango sobre la fecha de ingreso, en ISO 8601 |
| `sort` | texto | `id`, `numero`, `fechaIngreso`, `estado`, `total`, `mecanico`. Por defecto `-fechaIngreso` |
| `page` / `limit` | entero | Paginación. Por defecto `1` y `20` |

| Código | Caso |
|---|---|
| `200 OK` | Listado devuelto con los datos y la metadata de paginación |
| `400 Bad Request` | `page` o `limit` fuera de rango, `sort` sobre un campo no admitido, o `desde` / `hasta` con una fecha no interpretable |

#### 11 · `POST /api/v1/ordenes`

Abre una orden de trabajo sobre un vehículo activo. Toda orden nace en `PENDIENTE` y sin
ítems: el estado no se acepta desde el cliente, solo puede avanzar por el endpoint de
transición. Permitir fijarlo en el alta habilitaría crear órdenes ya cerradas, salteando
la validación de que una orden cerrada necesita ítems.
*No safe · No idempotente · Allow: `GET, POST, OPTIONS`*

```json
{
  "vehiculoId": 1,
  "descripcion": "Cambio de correa de distribucion y tensor",
  "mecanico": "Ruben Paz",
  "kilometrajeIngreso": 95000
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `vehiculoId` | Sí | Entero. El vehículo debe existir y estar activo |
| `descripcion` | Sí | Texto de 5 a 300 caracteres |
| `mecanico` | Sí | Texto de 3 a 80 caracteres |
| `kilometrajeIngreso` | Sí | Entero. No puede ser menor al kilometraje actual del vehículo |

| Código | Caso |
|---|---|
| `201 Created` | Orden creada en `PENDIENTE`, con su número de negocio y el header `Location` |
| `400 Bad Request` | Falta un campo, un valor es inválido, se envió un campo desconocido, o **el vehículo referenciado no existe**. Este último caso es `400` y no `404` porque el recurso pedido (`/ordenes`) sí existe: lo que está mal es un dato del cuerpo |
| `409 Conflict` | El vehículo está dado de baja, o el kilometraje de ingreso es menor al último registrado |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

#### 12 · `GET /api/v1/ordenes/{id}`

Devuelve una orden con todos sus ítems y el total calculado a partir de ellos. El total
nunca se almacena: se deriva en cada lectura, de modo que no pueda desincronizarse.
*Safe · Idempotente · Allow: `GET, PATCH, DELETE, OPTIONS`*

| Código | Caso |
|---|---|
| `200 OK` | Orden encontrada |
| `404 Not Found` | No existe una orden con ese id |

#### 13 · `PATCH /api/v1/ordenes/{id}`

Modifica la descripción del trabajo y/o el mecánico asignado. Solo se admite mientras la
orden esté abierta.

> Este recurso **no expone `PUT`** deliberadamente: una orden tiene campos que el cliente
> no puede fijar (`numero`, `estado`, fechas, `total`), y ofrecer un reemplazo completo
> daría a entender que se pueden enviar todos.

*No safe · Idempotente · Allow: `GET, PATCH, DELETE, OPTIONS`*

```json
{ "descripcion": "Revision general del motor", "mecanico": "Nadia Ocampo" }
```

Ambos campos son opcionales pero debe enviarse al menos uno. `descripcion` admite de 5 a
300 caracteres y `mecanico` de 3 a 80.

| Código | Caso |
|---|---|
| `200 OK` | Orden modificada |
| `400 Bad Request` | El cuerpo viene vacío, un valor es inválido, o se envió un campo que este endpoint no acepta (por ejemplo `estado`) |
| `404 Not Found` | No existe una orden con ese id |
| `409 Conflict` | La orden está `CERRADA` o `CANCELADA`: es un documento cerrado y no se reescribe |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

#### 14 · `DELETE /api/v1/ordenes/{id}`

Elimina una orden abierta o cancelada. Las cerradas no se eliminan: forman el historial
facturado que alimenta los reportes. Para descartar una orden sin borrarla existe el
estado `CANCELADA`.
*No safe · Idempotente · Sin cuerpo · Allow: `GET, PATCH, DELETE, OPTIONS`*

| Código | Caso |
|---|---|
| `204 No Content` | Orden eliminada. Sin cuerpo de respuesta |
| `404 Not Found` | No existe una orden con ese id |
| `409 Conflict` | La orden está `CERRADA` y forma parte del historial facturado |

#### 15 · `PUT /api/v1/ordenes/{id}/estado`

Aplica una transición de estado respetando la máquina de estados de la sección 1.3. Al
pasar a `CERRADA`, además, actualiza el kilometraje del vehículo si el de ingreso es
mayor.

> El estado se modela como **sub-recurso propio** y no como un campo más del `PATCH`
> porque cambiarlo dispara efectos de negocio —validar la transición, exigir ítems para
> cerrar, actualizar el vehículo— que no son una simple edición de un atributo. Se usa
> `PUT` y no `POST` porque la operación fija el estado a un valor determinado, lo que la
> hace idempotente en su intención.

*No safe · Idempotente · Allow: `PUT, OPTIONS`*

```json
{ "estado": "EN_PROCESO" }
```

Valores admitidos: `PENDIENTE`, `EN_PROCESO`, `CERRADA`, `CANCELADA`. Es el único campo
aceptado.

| Código | Caso |
|---|---|
| `200 OK` | Transición aplicada. Devuelve la orden con su nuevo estado y, si corresponde, la fecha de cierre |
| `400 Bad Request` | El valor de `estado` no pertenece al conjunto admitido, o se envió otro campo |
| `404 Not Found` | No existe una orden con ese id |
| `409 Conflict` | Tres casos: la transición no está permitida por la máquina de estados; la orden ya se encuentra en el estado solicitado; o se intenta cerrar una orden sin ítems cargados |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

### 3.4. Ítems de una orden

#### 16 · `GET /api/v1/ordenes/{id}/items`

Lista los repuestos y las tareas de mano de obra cargados en una orden, con el subtotal
de cada uno.
*Safe · Idempotente · Allow: `GET, POST, OPTIONS`*

| Código | Caso |
|---|---|
| `200 OK` | Ítems devueltos. Una orden sin ítems devuelve `200` con la lista vacía |
| `404 Not Found` | La orden indicada en la URI no existe |

#### 17 · `POST /api/v1/ordenes/{id}/items`

Agrega un repuesto o una tarea de mano de obra a una orden abierta. El subtotal del ítem
y el total de la orden se recalculan automáticamente.
*No safe · No idempotente · Allow: `GET, POST, OPTIONS`*

```json
{
  "tipo": "REPUESTO",
  "descripcion": "Kit de distribucion",
  "cantidad": 1,
  "precioUnitario": 195000
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `tipo` | Sí | `REPUESTO` o `MANO_DE_OBRA` |
| `descripcion` | Sí | Texto de 3 a 150 caracteres |
| `cantidad` | Sí | Entero entre 1 y 999 |
| `precioUnitario` | Sí | Número mayor o igual a 0 |

| Código | Caso |
|---|---|
| `201 Created` | Ítem agregado. Devuelve el ítem con su subtotal calculado y el header `Location`. El id del ítem es único dentro de su orden, no globalmente |
| `400 Bad Request` | Falta un campo, el tipo no pertenece al conjunto admitido, la cantidad no es un entero positivo, o se envió un campo desconocido |
| `404 Not Found` | La orden indicada en la URI no existe |
| `409 Conflict` | La orden está `CERRADA` o `CANCELADA` y ya no admite carga de ítems |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |

#### 18 · `DELETE /api/v1/ordenes/{id}/items/{itemId}`

Quita un ítem de una orden abierta y recalcula el total.
*No safe · Idempotente · Sin cuerpo · Allow: `DELETE, OPTIONS`*

| Código | Caso |
|---|---|
| `204 No Content` | Ítem quitado. Sin cuerpo de respuesta |
| `404 Not Found` | La orden no existe, o el ítem no existe dentro de esa orden |
| `409 Conflict` | La orden está `CERRADA` o `CANCELADA` |

### 3.5. Reportes

Los cuatro son recursos derivados y de solo lectura: se calculan a demanda y no se
almacenan. Responden siempre con `Cache-Control: no-store` y solo admiten `GET`. Criterio
común: únicamente las órdenes `CERRADA` cuentan como facturación, porque una orden abierta
todavía puede cambiar de monto y una cancelada nunca se cobró.

#### 19 · `GET /api/v1/reportes/resumen`

Indicadores generales: facturación total, ticket promedio por orden, cantidad de órdenes
por estado y conteo de vehículos activos e inactivos. No recibe parámetros.

| Código | Caso |
|---|---|
| `200 OK` | Reporte calculado. Único resultado posible: el endpoint no recibe entrada |

#### 20 · `GET /api/v1/reportes/facturacion-mensual`

Facturación agrupada por mes. Devuelve siempre los doce meses, incluidos los sin
movimiento: un gráfico con meses faltantes distorsiona la lectura de la tendencia.

Parámetro: `anio` — entero entre 2000 y el año próximo. Por defecto, el año en curso.

| Código | Caso |
|---|---|
| `200 OK` | Reporte calculado. Un año sin actividad devuelve la grilla completa en cero |
| `400 Bad Request` | `anio` no es un entero, o está fuera del rango admitido |

#### 21 · `GET /api/v1/reportes/costos-por-vehiculo`

Costo histórico de mantenimiento de cada unidad, discriminado entre repuestos y mano de
obra, ordenado de mayor a menor facturación.

Parámetro: `limit` — entero entre 1 y 100, para pedir el top N. Por defecto, todos.

| Código | Caso |
|---|---|
| `200 OK` | Reporte calculado |
| `400 Bad Request` | `limit` no es un entero, o está fuera del rango admitido |

#### 22 · `GET /api/v1/reportes/service-vencido`

Vehículos activos que recorrieron más kilómetros que el umbral desde su última orden
cerrada. Una unidad que nunca ingresó se mide contra su kilometraje total. El reporte
incluye el teléfono del titular, porque su caso de uso es llamarlo para ofrecerle el turno.

Parámetro: `umbralKm` — entero entre 1.000 y 100.000. Por defecto `10000`.

| Código | Caso |
|---|---|
| `200 OK` | Reporte calculado. Si ninguna unidad supera el umbral, devuelve la lista vacía |
| `400 Bad Request` | `umbralKm` no es un entero, o está fuera del rango admitido |

---

## 4. Tabla resumen

Los códigos `405` y `500`, por transversales, no se repiten en cada fila (ver sección 2.6).

| # | Verbo | Ruta | Propósito | Códigos de estado |
|---|---|---|---|---|
| 01 | `GET` | `/api/v1` | Índice de recursos | `200` |
| 02 | `GET` | `/api/v1/health` | Chequeo de salud | `200` |
| 03 | `GET` | `/api/v1/vehiculos` | Listar vehículos | `200`, `400` |
| 04 | `POST` | `/api/v1/vehiculos` | Dar de alta un vehículo | `201`, `400`, `409`, `413`, `415` |
| 05 | `GET` | `/api/v1/vehiculos/{id}` | Obtener un vehículo | `200`, `404` |
| 06 | `PUT` | `/api/v1/vehiculos/{id}` | Reemplazar un vehículo | `200`, `400`, `404`, `409`, `413`, `415` |
| 07 | `PATCH` | `/api/v1/vehiculos/{id}` | Modificar parcialmente un vehículo | `200`, `400`, `404`, `409`, `413`, `415` |
| 08 | `DELETE` | `/api/v1/vehiculos/{id}` | Eliminar un vehículo | `204`, `404`, `409` |
| 09 | `GET` | `/api/v1/vehiculos/{id}/ordenes` | Historial de órdenes del vehículo | `200`, `404` |
| 10 | `GET` | `/api/v1/ordenes` | Listar órdenes de trabajo | `200`, `400` |
| 11 | `POST` | `/api/v1/ordenes` | Abrir una orden de trabajo | `201`, `400`, `409`, `413`, `415` |
| 12 | `GET` | `/api/v1/ordenes/{id}` | Obtener una orden con sus ítems | `200`, `404` |
| 13 | `PATCH` | `/api/v1/ordenes/{id}` | Modificar una orden abierta | `200`, `400`, `404`, `409`, `413`, `415` |
| 14 | `DELETE` | `/api/v1/ordenes/{id}` | Eliminar una orden | `204`, `404`, `409` |
| 15 | `PUT` | `/api/v1/ordenes/{id}/estado` | Cambiar el estado de una orden | `200`, `400`, `404`, `409`, `413`, `415` |
| 16 | `GET` | `/api/v1/ordenes/{id}/items` | Listar los ítems de una orden | `200`, `404` |
| 17 | `POST` | `/api/v1/ordenes/{id}/items` | Agregar un ítem a una orden | `201`, `400`, `404`, `409`, `413`, `415` |
| 18 | `DELETE` | `/api/v1/ordenes/{id}/items/{itemId}` | Quitar un ítem de una orden | `204`, `404`, `409` |
| 19 | `GET` | `/api/v1/reportes/resumen` | Indicadores generales | `200` |
| 20 | `GET` | `/api/v1/reportes/facturacion-mensual` | Facturación por mes | `200`, `400` |
| 21 | `GET` | `/api/v1/reportes/costos-por-vehiculo` | Costo de mantenimiento por unidad | `200`, `400` |
| 22 | `GET` | `/api/v1/reportes/service-vencido` | Unidades con el service vencido | `200`, `400` |

### Correspondencia entre operación, verbo y código de éxito

| Operación | Verbo | Código de éxito | Endpoints |
|---|---|---|---|
| Obtener un recurso o una colección | `GET` | `200 OK` | 01–03, 05, 09, 10, 12, 16, 19–22 |
| Crear un recurso nuevo | `POST` | `201 Created` | 04, 11, 17 |
| Reemplazar un recurso completo | `PUT` | `200 OK` | 06, 15 |
| Modificar parcialmente un recurso | `PATCH` | `200 OK` | 07, 13 |
| Eliminar un recurso | `DELETE` | `204 No Content` | 08, 14, 18 |

---

## 5. Verificación del contrato

Los códigos de estado de esta documentación no se listaron *únicamente* a partir de la
lectura del código: **cada uno se comprobó ejecutándolo**. El procedimiento fue:

1. Se recorrieron los archivos de rutas, controladores, servicios y middlewares para
   identificar qué códigos son alcanzables en cada endpoint.
2. Se construyó un caso de prueba por cada par *(endpoint, código de estado)*, partiendo
   siempre del mismo set de datos inicial.
3. Se ejecutaron los 82 casos resultantes, comparando el código obtenido contra el
   declarado.

Ese contraste es el que le da valor al procedimiento: la primera corrida detectó **tres
discrepancias** entre el contrato que se pretendía documentar y el comportamiento real.
Las tres se corrigieron en la implementación:

| Endpoint | Caso | Declarado | Obtenido | Diagnóstico y corrección |
|---|---|---|---|---|
| `GET /ordenes` | `?desde=xxx` | `400` | `500` | `new Date('xxx')` no lanza ninguna excepción: devuelve una fecha inválida, que aparenta ser un valor utilizable. El error recién se producía más adelante, al invocar `toISOString()` sobre ella para comparar el rango, y como en ese punto nadie lo esperaba terminaba escalando a `500`. Se agregó la validación del parámetro *antes* de tocar los datos: ahora devuelve `400` indicando el campo |
| `GET /ordenes` | `?hasta=xxx` | `400` | `500` | El otro extremo del mismo filtro de rango, con idéntica causa y corrección |
| `POST /api/v1` | Verbo no soportado | `405` | `404` | El índice era el único recurso de la API que no declaraba sus verbos admitidos, por lo que respondía `404` donde todos los demás responden `405`. Se unificó el comportamiento |

**Por qué eran defectos y no decisiones de diseño.** Un `500` le comunica al cliente que el
servidor falló y que no hay nada que él pueda hacer al respecto. Pero una fecha mal escrita
es un dato inválido que el cliente sí puede corregir, y eso pertenece al rango `4xx`:
devolver `500` lo mandaba a buscar el problema en el lugar equivocado. El caso del `404` es
más leve, pero rompía la uniformidad del contrato: un cliente que ya había aprendido que
esta API responde `405` ante un verbo no admitido recibía otra cosa en un único endpoint.

Tras las correcciones, los **82 casos coinciden** con lo documentado.

### Cómo se hizo repetible la verificación

Los 82 casos no quedaron como una comprobación hecha una sola vez: se incorporaron al
código del backend como una suite de pruebas automatizadas (`tests/contrato-api.test.js`),
ejecutable con `npm test`. Cada prueba afirma uno de los códigos de estado declarados en
estas páginas, de modo que **si el comportamiento de un endpoint cambia, la suite falla y
señala que esta documentación quedó desactualizada**.

Al pasarlos a suite se agregaron seis casos que la comprobación inicial no cubría —el `405`
del health check, un rango de fechas válido, el `405` de los cuatro reportes y una
verificación de que todos los errores comparten la misma forma—, con lo cual la suite de
contrato contiene **88 pruebas**. Sumadas a las del resto del backend, el proyecto tiene
**178 pruebas**.

> **Sobre el código del backend.** La implementación que este documento describe —incluida
> la suite de verificación— se incorporará a este repositorio junto con el Trabajo Práctico
> Integrador, en la instancia correspondiente de la cursada. Esta entrega comprende la
> documentación del contrato.

### Especificación OpenAPI

El mismo contrato está publicado como [`openapi.yaml`](openapi.yaml), en **OpenAPI 3.0.3**.
Se puede abrir en [editor.swagger.io](https://editor.swagger.io) (`File → Import file`) para
obtener documentación navegable y probar cada endpoint contra el servidor local. La
especificación fue validada con el linter *Redocly* y no presenta errores.
