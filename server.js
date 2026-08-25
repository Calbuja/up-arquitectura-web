// Servidor HTTP mínimo construido únicamente con el módulo nativo 'http' de Node.js.
// Trabajo Práctico Integrador - Arquitectura Web - Actividad 1

// El módulo 'http' viene incluido en Node.js: no hace falta instalarlo con npm.
// Nos da la capa más baja para hablar HTTP, sin la abstracción de un framework.
const http = require('node:http');

const PORT = 3000;

// createServer recibe un callback que Node ejecuta UNA VEZ POR CADA request entrante.
//   req -> IncomingMessage: es un stream LEGIBLE (de él leemos el body que manda el cliente)
//   res -> ServerResponse:  es un stream ESCRIBIBLE (en él escribimos la respuesta)
const server = http.createServer((req, res) => {

  // req.url incluye el query string (ej: "/archivo?x=1"), así que nos quedamos
  // solo con el path para que el ruteo no dependa de parámetros opcionales.
  const path = req.url.split('?')[0];

  // --- Ruta 1: GET / ---
  // Responde 200 con un texto plano confirmando que el servidor está vivo.
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor funcionando correctamente\n');
    return;
  }

  // --- Ruta 2: POST /archivo ---
  // El body NO llega completo de una sola vez: llega de a fragmentos (chunks),
  // de forma asíncrona, a medida que los paquetes van saliendo de la red.
  if (req.method === 'POST' && path === '/archivo') {
    let totalBytes = 0;

    // Se dispara cada vez que llega un fragmento del body.
    // 'chunk' es un Buffer, y su propiedad .length es la cantidad exacta de bytes
    // de ESE fragmento. Solo acumulamos el número: nunca guardamos el archivo
    // completo en memoria, así el servidor soporta payloads de cualquier tamaño.
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
    });

    // Se dispara una sola vez, cuando el cliente terminó de enviar el body.
    // Recién acá sabemos el total real y podemos responder.
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Bytes recibidos: ${totalBytes}\n`);
    });

    // Si la conexión se corta a mitad de la transferencia, avisamos con un 400
    // en lugar de dejar el request colgado para siempre.
    req.on('error', (error) => {
      console.error('Error al recibir el body:', error.message);
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error al recibir el archivo\n');
    });

    return;
  }

  // --- Cualquier otra combinación de método y ruta ---
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Recurso no encontrado\n');
});

// listen abre el socket TCP y deja al proceso esperando conexiones.
// A diferencia de un script común, el proceso NO termina: queda escuchando.
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
