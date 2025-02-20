const passport = require('passport');
const googleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const env = require('dotenv').config();


passport.use(new googleStrategy({
    clientID : process.env.GOOGLE_CLIENT_ID,
    clientSecret : process.env.GOOGLE_CLIENT_SECRET,
    callbackURL : "http://localhost:3001/auth/google/callback"
},

async(accessToken, refreshToken, profile, done) => {

    try{
        let user = await User.findOne({googleId : profile.id});

        if(user){
           return done(null, user);
        }else{
            user = await User({
                name : profile.displayName,
                email : profile.emails[0].value,
                googleId : profile.id,
            }).save();
           return  done(null, user);
            
        }
    }catch(err){
        return done(err,null)
        console.error(err);
    }
}
))


passport.serializeUser((user, done) => {
    done(null, user.id);
});


passport.deserializeUser((id, done) => {
    User.findById(id)
       .then(user => {
           done(null, user);
       })
       .catch(err => {
           done(err, null);
           console.error(err);
       })
});


module.exports = passport;