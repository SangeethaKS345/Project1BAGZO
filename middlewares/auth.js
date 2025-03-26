
const mongoose = require("mongoose");
const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  console.log("Authentication Middleware Started");
  console.log("Full Session Object:", req.session);
  console.log("Session User:", req.session.user);

  if (!req.session || !req.session.user) {
    console.log("No session or no user in session");
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please log in."
    });
  }

  let userId;
  try {
    if (req.session.user.id) {
      userId = req.session.user.id;
    } else if (req.session.user._id) {
      userId = req.session.user._id;
    } else if (typeof req.session.user === 'string') {
      userId = req.session.user;
    } else {
      console.error("CANNOT EXTRACT USER ID. Session user structure:", req.session.user);
      return res.status(401).json({
        success: false,
        error: "Invalid session data"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid User ID format:", userId);
      return res.status(401).json({
        success: false,
        error: "Invalid user ID"
      });
    }

    User.findById(userId)
      .then((user) => {
        if (!user) {
          console.log(`No user found with ID: ${userId}`);
          return res.status(401).json({
            success: false,
            error: "User not found"
          });
        }

        req.user = user;
        req.userId = userId;
        res.locals.user = user;
        res.locals.userData = user;

        console.log("User authenticated successfully:", user.name || user.email);
        next();
      })
      .catch((err) => {
        console.error("Database lookup error:", err);
        res.status(500).json({
          success: false,
          error: "Server error during authentication"
        });
      });
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
};


// const adminAuth = async (req, res, next) => {
//   try {
//     console.log("admin session id :",req.session.admin)
//     if (!req.session.admin || !mongoose.Types.ObjectId.isValid(req.session.admin)) {
//       return res.redirect("/admin/login");
//     }

//     const admin = await User.findById(req.session.admin);
//     console.log("admin session id :",admin)

//     if (!admin || !admin.isAdmin) {
      
//       req.session.destroy(); // Destroy session if invalid admin
//       return res.redirect("/admin/login");
//     }

//     next(); // Proceed to the next middleware/route
//   } catch (error) {
//     console.error("Admin authentication error:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };
const adminAuth = async (req, res, next) => {
  try {
    console.log("Admin session ID:", req.session.admin);
    if (!req.session.admin || !mongoose.Types.ObjectId.isValid(req.session.admin)) {
      console.log("Invalid session or admin ID, redirecting to login");
      return res.redirect("/admin/login");
    }

    const admin = await User.findById(req.session.admin);
    console.log("Admin details:", admin);

    if (!admin || !admin.isAdmin) {
      console.log("Invalid admin or not an admin, destroying session and redirecting to login");
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        return res.redirect("/admin/login");
      });
    } else {
      next(); // Proceed to the next middleware/route
    }
  } catch (error) {
    console.error("Admin authentication error:", error);
    res.status(500).send("Internal Server Error");
  }
};

const redirectIfAuthenticated = (req, res, next) => {
  console.log(req.session.admin,'in new auth');
  if (req.session.admin) {
    return res.redirect("/admin/dashboard"); // Redirect logged-in users
  }
  next(); // Proceed if not logged in
};


const checkBlockStatus = async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      const user = await User.findById(req.session.user._id);
      if (user && user.isBlocked) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
          res.redirect("/login");
        });
      } else {
        next();
      }
    } catch (error) {
      console.error("Error checking block status:", error);
      res.status(500).send("Server error");
    }
  } else {
    next();
  }
};

module.exports = {
  userAuth,
  adminAuth,
  checkBlockStatus,
  redirectIfAuthenticated
};