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
const {errorHandler, adminErrorHandler} = require("./middlewares/errorHandler.js");

// Connect to MongoDB
db();

<<<<<<< HEAD
// Error Handling Middleware

// User Authentication Middleware
const userAuth = (req, res, next) => {
  if (req.path.startsWith("/public/") || req.path.startsWith("/assets/")) {
    return next();
  }

=======
// Connect to MongoDB
db();

// Error Handling Middleware

// User Authentication Middleware
const userAuth = (req, res, next) => {
  if (req.path.startsWith("/public/") || req.path.startsWith("/assets/")) {
    return next();
  }

>>>>>>> 334f225 (cart page added. working on profile page.)
  if (req.session && req.session.user) {
    const User = require("./models/User"); // Adjust path as needed

    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          req.user = data;

          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");

          next();
        } else {
          req.session.destroy((err) => {
            if (err) console.error("Session destruction error:", err);
            res.redirect("/");
          });
        }
      })
      .catch((error) => {
        console.error("Error in user authentication:", error);
        const err = new Error("Authentication error");
        err.statusCode = 500;
        next(err);
      });
  } else {
    res.redirect("/");
  }
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl:
        process.env.MONGODB_URI || "mongodb://localhost:27017/your-db-name",
      ttl: 24 * 60 * 60, // 1 day
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // Secure in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Prevent Caching Globally
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
<<<<<<< HEAD
=======

// Middleware to pass user data to all views
app.use((req, res, next) => {
  res.locals.userData = req.session.user || null;
  next();
});

// Set View Engine
app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);
>>>>>>> 334f225 (cart page added. working on profile page.)

// Serve Static Files
app.use(express.static("public"));

<<<<<<< HEAD
// Set View Engine
app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);

// Serve Static Files
app.use(express.static("public"));

=======
>>>>>>> 334f225 (cart page added. working on profile page.)
// Global User Variable for Templates
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
<<<<<<< HEAD

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);



// error handler
app.use(errorHandler,adminErrorHandler);
=======
>>>>>>> 334f225 (cart page added. working on profile page.)

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

// error handler
app.use(errorHandler,adminErrorHandler);

// Start Server
const PORT = process.env.PORT || 4488;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
<<<<<<< HEAD
});
=======
});
>>>>>>> 334f225 (cart page added. working on profile page.)
