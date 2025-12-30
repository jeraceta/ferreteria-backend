// Global error handler — centraliza respuestas de error
module.exports = function errorHandler(err, req, res, next) {
  // Log en servidor para diagnóstico
  console.error(err);

  // Determinar status: usar `err.status` si está, mapear algunos códigos comunes
  let status = err.status || 500;
  if (err.code === 'ER_DUP_ENTRY') status = 400;

  const payload = {
    success: false,
    error: err.message || 'Internal Server Error'
  };

  if (err.detail) payload.detalle = err.detail;

  res.status(status).json(payload);
};
