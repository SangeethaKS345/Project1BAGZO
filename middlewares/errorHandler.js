

function errorHandler(err, req, res, next) {
  console.error(err.stack);
<<<<<<< HEAD
  res.status(500).render("page-404", { message: "Internal Server Error" });
=======
  res.status(500).render("error", { message: "Internal Server Error" });
>>>>>>> 334f225 (cart page added. working on profile page.)
}

function adminErrorHandler(err, req, res, next) {
  console.error(err.stack);
<<<<<<< HEAD
  res.status(500).render("error", { message: "Internal Server Error" });
=======
  res.status(500).render("page-404", { message: "Internal Server Error" });
>>>>>>> 334f225 (cart page added. working on profile page.)
}

module.exports = {
  errorHandler,
  adminErrorHandler
  };