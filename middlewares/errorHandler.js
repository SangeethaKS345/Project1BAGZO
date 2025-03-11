

// function errorHandler(err, req, res, next) {
//   console.error(err.stack);
//   res.status(500).render("page-404", { message: "Internal Server Error" });
// }
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  // Check if it's an AJAX request
  if (req.xhr || req.headers["content-type"] === "application/json") {
    return res.status(status).json({ error: message });
  }

  // Fallback for server-rendered pages
  res.status(status).render("page-404", { message });
}

function adminErrorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).render("error", { message: "Internal Server Error" });
}

module.exports = {
  errorHandler,
  adminErrorHandler
  };