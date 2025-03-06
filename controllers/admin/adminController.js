const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

// Load Login Page
const loadLogin = async (req, res, next) => {
    try {
        if (req.session.admin) {
            return res.redirect("/admin/dashboard");
        }
        return res.render("login");
    } catch (error) {
        console.error("Error loading login page:", error);
        next(error);  
    }
};

// Admin Login
const login = async (req, res, next) => {
    console.log("login");
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            
            if (passwordMatch) {
                req.session.admin = true;
                console.log("Pass match");
                return res.redirect("/admin/dashboard");  
            } 
            console.log("Pass not matched");
            return res.render("login", { message: "Incorrect password!" });
        } 

        console.log("Admin not found");
        return res.render("login", { message: "Admin not found!" });

    } catch (error) {
        console.error("Login Error:", error);
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
