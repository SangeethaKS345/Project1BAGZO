const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

// Load Login Page
const loadLogin = async (req, res, next) => {
    try {
        console.log("Admin loadLogin called, rendering login.ejs");
        return res.render("login", { message: "" }); // Renders views/login.ejs
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    console.log("Admin login route hit");
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render("login", { message: "Email and password are required" });
        }

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            return res.render("login", { message: "Admin not found!" });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect password!" });
        }

        req.session.admin = admin._id.toString(); 

        return res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Admin Login Error:", error);
        next(error);
    }
};


// Load Admin Dashboard
const loadDashboard = async (req, res, next) => {
    console.log(1);
    if (!req.session.admin) {
        return res.redirect("/admin/login");
    }
    try {
        res.render("dashboard");
        console.log(200);
    } catch (error) {
        console.error("Dashboard Error:", error);
        next(error);
    }
};


// Logout Admin
const logout = async (req, res, next) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return next(err); 
            }
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.error("Unexpected error during logout:", error);
        next(error);
    }
};

// Export Controllers
module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout  
};
