const express = require("express");
const path = require("path");
const Razorpay = require('razorpay');
const dotenv = require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const app = express();
const multer = require("./helpers/multer");
const Cart = require("./models/cartSchema");
const Wishlist = require("./models/wishListSchema");



const { errorHandler, adminErrorHandler } = require("./middlewares/errorHandler.js");
const nocache = require('nocache');
app.use(nocache());

// Connect to MongoDB
db();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Prevent Caching Globally
app.use((req, res, next) => {
  if (req.path.startsWith("/login")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Middleware to fetch cart and wishlist counts
app.use(async (req, res, next) => {
  res.locals.userData = req.session.user || null;
  res.locals.cartCount = 0;
  res.locals.wishlistCount = 0;

  if (req.session.user && req.session.user.id) {
    try {
      const cart = await Cart.findOne({ userId: req.session.user.id });
      const wishlist = await Wishlist.findOne({ userId: req.session.user.id });

      res.locals.cartCount = cart ? cart.products.length : 0;
      res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;
    } catch (error) {
      console.error("Error fetching cart/wishlist counts:", error);
    }
  }
  next();
});

// Set View Engine
app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);

app.use((req, res, next) => {
  res.locals.viewsPaths = app.get('views');
  next();
});

// Serve Static Files
app.use(express.static("public"));

// Global User Variable for Templates
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

// Error handler
app.use("/admin", adminErrorHandler);
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 4488;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});