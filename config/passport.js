// const passport = require('passport');
// const googleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('../models/userSchema');
// const env = require('dotenv').config();


// passport.use(new googleStrategy({
//     clientID : process.env.GOOGLE_CLIENT_ID,
//     clientSecret : process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL : "http://localhost:3001/auth/google/callback"
// },

// async(accessToken, refreshToken, profile, done) => {

//     try{
//         let user = await User.findOne({googleId : profile.id});

//         if(user){
//            return done(null, user);
//         }else{
//             user = await User({
//                 name : profile.displayName,
//                 email : profile.emails[0].value,
//                 googleId : profile.id,
//             }).save();
//            return  done(null, user);
            
//         }
//     }catch(err){
//         return done(err,null)
//         console.error(err);
//     }
// }
// ))


// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });


// passport.deserializeUser((id, done) => {
//     User.findById(id)
//        .then(user => {
//            done(null, user);
//        })
//        .catch(err => {
//            done(err, null);
//            console.error(err);
//        })
// });


// module.exports = passport;

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const dotenv = require("dotenv").config();

passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3001/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            //console.log(" Google Profile:", profile);

            let userData = await User.findOne({ googleId: profile.id });
            
            console.log("userData : ", userData);
            if (userData) {
               // console.log("User already exists:", user);
             
                return done(null, userData);
            } else {
                userData = new User({
                    name: profile.name,
                    email: profile.emails[0].value,
                    googleId: profile.id,
                });
                console.log(firstname,lastname);
                
                let result = await userData.save();


                console.log("New user created:", result);
                return done(null, userData);
            }
        } catch (err) {
            console.error("Error in Google authentication:", err);
            return done(err, null);
        }
    }
));

// Serialize User (Stores user ID in session)
passport.serializeUser((userData, done) => {
   // console.log("Serializing User:", user.id);
    done(null, userData.id);
});

//  Deserialize User (Retrieves user from session)
passport.deserializeUser(async (id, done) => {
    try {
        //console.log("🔹 Deserializing User with ID:", id);
        const userData = await User.findById(id);
        if (!userData) {
            console.log(" User not found!");
            return done(null, false);
        }
       // console.log(" User found:", user);
        done(null, userData);
    } catch (err) {
        console.error(" Error deserializing user:", err);
        done(err, null);
    }
});

module.exports = passport;
