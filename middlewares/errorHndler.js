// errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Set status code based on error type or use 500 as default
    const statusCode = err.statusCode || 500;
    
    // Different response formats based on request type
    const isApiRequest = req.originalUrl.startsWith('/api');
    
    if (isApiRequest) {
      // API error response
      return res.status(statusCode).json({
        success: false,
        error: {
          message: err.message || 'Internal Server Error',
          code: statusCode
        }
      });
    } 
    
    // For regular web requests
    // You can render an error page or redirect to appropriate page
    if (statusCode === 404) {
      return res.status(404).render('error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
      });
    }
    
    // Default error page for other errors
    return res.status(statusCode).render('error', {
      title: 'Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Something went wrong. Please try again later.' 
        : err.message
    });
  };
  
  module.exports = errorHandler;