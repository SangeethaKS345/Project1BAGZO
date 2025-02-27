const User = require("../../models/userSchema");
const path = require("path");
const mongoose = require("mongoose");
//const dotenv = require("dotenv").config();
//const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const pageerror = (req, res) => {
    res.status(400).json( { message: "Something went wrong!", redirectUrl:"/admin/pageerror" });
};


// Load Home Page
const loadLogin=async(req,res)=>{
    try{
       if(req.session.admin){
        return res.redirect("/admin/dashboard");
       }
       else{
        return res.render("login");
       }
    }
    catch{
        console.error("Home Page not found:",error);
        res.render("login", {message:null});
    }
}




const login = async (req, res) => {
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
            } else {
                console.log("Pass not matched");
                return res.render("login", { message: "Incorrect password!" });
            }
        } else {
            console.log("Admin not found");
            return res.render("login", { message: "Admin not found!" });
        }
    } catch (error) {
        console.log("Kayyinn poyi");
        console.error("Login Error:", error);
        return res.redirect("/admin/login");  // ✅ FIXED
    }
};


const loadDashboard = async(req,res)=>{
    console.log(1);
    if(req.session.admin){
        try {
            res.render("dashboard");
            console.log(200);

        } catch (error) {
            res.redirect("/pageerror");
            console.log(0);
        }
    }
}
    

const logout = async (req,res) => {
    try{
        req.session.destroy(err => {
            if(err){
                console.log("Error destroying session", err);
                return res.redirect("/pageerror");
            }
            res.redirect("/admin/login");
        })
    }catch{

        console.log("unexpected error during logout", error);
        res.redirect("/pageerror");

    }
}

exports.pageerror = (req, res) => {
    console.log("Page Error route hit!");
    res.status(400).render("pageerror", { message: "Something went wrong!" }); 
};


        
module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}