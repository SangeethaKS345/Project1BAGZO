const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const dotenv = require("dotenv").config();

passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://www.bagzo.sangeetha.blog/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log("Google Profile:", profile);

            let userData = await User.findOne({ googleId: profile.id });
            
            console.log("userData : ", userData);
            if (userData) {
               // console.log("User already exists:", user);
                return done(null, userData);
            } else {
                userData = new User({
                    name: profile.displayName, // Changed to displayName for full name
                    email: profile.emails[0].value,
                    googleId: profile.id,
                });
                
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