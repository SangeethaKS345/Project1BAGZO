const User = require("../models/userSchema");

const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data =>{
            if(data && !data.isBlocked){
                next();
            }else{
                res.redirect("/signup?action=signup")
            }
        })
        .catch(error => {
            console.log("Error in user auth middleware");
            res.status(500).send("Internal Server error");
        })
    }else{
        res.redirect("/signup?action=signup");
    }
}


const adminAuth = async (req, res, next) => {
    try {
        const admin = await User.findOne({ isAdmin: true });

        if (!admin) {
            if (req.headers.accept && req.headers.accept.includes("application/json")) {
                return res.status(401).json({ error: "Unauthorized" });
            } else {
                return res.redirect("/admin/login");
            }
        }

        next(); // Continue if admin exists
    } catch (error) {
        console.log("Error in adminAuth middleware", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    userAuth,
    adminAuth
}