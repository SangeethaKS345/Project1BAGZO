// // errorHandler.js
// const errorHandler = (err, req, res, next) => {
//     console.error('Error:', err.stack);
    
    
//     // Default error page for other errors
//     return res.status(statusCode).render('error', {
//       title: 'Error',
//       message: process.env.NODE_ENV === 'production' 
//         ? 'Something went wrong. Please try again later.' 
//         : err.message
//     });
//   };
  
//   module.exports = errorHandler;

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