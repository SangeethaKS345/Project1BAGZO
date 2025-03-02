const User = require('../../models/userSchema');



// const loadUserProfile = async (req, res, next) => {
//     try {
//       const userId = req.session.user._id;
//       const user = await User.findById(userId);
//       const addressDoc = await Address.findOne({ userId: userId });
      
//       if (!user) {
//         return res.redirect('/login');
//       }
      
//       res.render('user-profile', { 
//         user: user,
//         addresses: addressDoc?.address || []
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

// module.exports = {
//     loadUserProfile
// };