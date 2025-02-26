
// const express =require('express');
// const app=express();
// const path = require("path");
// const dotenv = require("dotenv").config();
// const session = require("express-session")
// const passport = require("./config/passport");
// const db =require("./config/db")
// const userRouter=require("./routes/userRouter");
// const adminRouter=require("./routes/adminRouter");
// db()




// app.use(express.json());
// app.use(express.urlencoded({extended:true}));

// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: true,
//   cookie: { secure: false, httpOnly: true, maxAge: 72 * 60 * 60 * 1000 }
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// app.use((req,res,next)=>{
//   res.set("Cache-Control","no-store")
//   next();
// })

// app.set("view engine" ,"ejs");
// app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
// // app.set("views",path.join(__dirname,'views/user'));

// app.use(express.static("public"))


// app.use("/",userRouter);
// app.use("/admin",adminRouter);



// const PORT=process.env.PORT || 4488;
// app.listen(3001,()=>{
//   console.log("server running on port 3001 or 4488");
// })



const express = require("express");
const path = require("path");
const dotenv = require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo"); // Store sessions in MongoDB
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");

const app = express();

// Connect to MongoDB
db();

// Create error handling middleware
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

// Create improved user auth middleware
const userAuth = (req, res, next) => {
  // Skip auth check for static resources if needed
  if (req.path.startsWith('/public/') || req.path.startsWith('/assets/')) {
    return next();
  }
  
  if (req.session && req.session.user) {
    const User = require('./models/User'); // Adjust path as needed
    
    User.findById(req.session.user)
      .then(data => {
        if (data && !data.isBlocked) {
          // Attach user to request object for use in route handlers
          req.user = data;
          
          // Set cache control headers to prevent back button issues
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          
          next();
        } else {
          // Clear invalid session
          req.session.destroy(err => {
            if (err) console.error('Session destruction error:', err);
            res.redirect("/");
          });
        }
      })
      .catch(error => {
        console.error("Error in user authentication:", error);
        const err = new Error('Authentication error');
        err.statusCode = 500;
        next(err); // Pass to error handler
      });
  } else {
    res.redirect("/");
  }
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with MongoStore
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name',
    ttl: 24 * 60 * 60 // 1 day in seconds
  }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Prevent caching globally
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Set View Engine
app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);

// Static Files
app.use(express.static("public"));

// Global user variable for templates
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Error handling middleware (should be the last middleware)
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 4488;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});