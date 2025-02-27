

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).render("page-404", { message: "Internal Server Error" });
}

function adminErrorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).render("error", { message: "Internal Server Error" });
}

module.exports = {
  errorHandler,
  adminErrorHandler
  };