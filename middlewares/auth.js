// const User = require("../models/userSchema")

// // userAuth.js
// const userAuth = (req, res, next) => {
//   if (req.path.startsWith('/public/') || req.path.startsWith('/assets/')) {
//     return next();
//   }
  
//   if (req.session && req.session.user) {
//     User.findById(req.session.user)
//       .then(data => {
//         if (data && !data.isBlocked) {
          
//           req.user = data;
          
//           // Set cache control headers to prevent back button issues
//           res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//           res.setHeader('Pragma', 'no-cache');
//           res.setHeader('Expires', '0');
          
//           next();
//         } else {
//           // Clear invalid session
//           req.session.destroy(err => {
//             if (err) console.error('Session destruction error:', err);
//             res.redirect("/");
//           });
//         }
//       })
//       .catch(error => {
//         console.error("Error in user authentication:", error);
//         const err = new Error('Authentication error');
//         err.statusCode = 500;
//         next(err); // Pass to error handler
//       });
//   } else {
//     res.redirect("/");
//   }
// };



// const adminAuth = async (req, res, next) => {
//     try {
//         const admin = await User.findOne({ isAdmin: true });

//         if (!admin) {
//             if (req.headers.accept && req.headers.accept.includes("application/json")) {
//                 return res.status(401).json({ error: "Unauthorized" });
//             } else {
//                 return res.redirect("/admin/login");
//             }
//         }

//         next(); // Continue if admin exists
//     } catch (error) {
//         console.log("Error in adminAuth middleware", error);
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// };

// module.exports = {
//     userAuth,
//     adminAuth
// }


<<<<<<< HEAD
=======
const mongoose = require("mongoose");
>>>>>>> 334f225 (cart page added. working on profile page.)
const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.user) {
<<<<<<< HEAD
    User.findById(req.session.user)
=======
    // Extract user ID properly
    let userId;
    if (typeof req.session.user === 'object' && req.session.user.id) {
      userId = req.session.user.id;
    } else {
      userId = req.session.user;
    }
    
    // Validate the ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid user ID format");
      req.session.destroy(); // Clear invalid session
      return res.redirect("/login");
    }
    
    User.findById(userId)
>>>>>>> 334f225 (cart page added. working on profile page.)
      .then((data) => {
        if (data && !data.isBlocked) {
          // Set the user data in req.user
          req.user = data;
<<<<<<< HEAD
          next();
        } else {
          console.error("User is not authenticated");
=======
          
          // Store only the ID in the session for future use
          req.session.user = userId;
          
          next();
        } else {
          console.error("User is not authenticated or is blocked");
          req.session.destroy();
>>>>>>> 334f225 (cart page added. working on profile page.)
          res.redirect("/login");
        }
      })
      .catch((error) => {
        console.log("Error in user auth middleware", error);
<<<<<<< HEAD
        res.status(500).send("Internal Server Error");
=======
        req.session.destroy();
        res.redirect("/login");
>>>>>>> 334f225 (cart page added. working on profile page.)
      });
  } else {
    res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    User.findOne({ isAdmin: true })
      .then((data) => {
        if (data) {
          next();
        } else {
          res.redirect("/admin/login");
        }
      })
      .catch((error) => {
        res.status(500).send("Internal Server Error");
      });
  } else {
    res.redirect("/admin/login");
  }
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
};