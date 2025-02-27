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


const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          // Set the user data in req.user
          req.user = data;
          next();
        } else {
          console.error("User is not authenticated");
          res.redirect("/login");
        }
      })
      .catch((error) => {
        console.log("Error in user auth middleware", error);
        res.status(500).send("Internal Server Error");
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