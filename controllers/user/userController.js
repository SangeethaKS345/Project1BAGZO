const User = require("../../models/userSchema")


const loadHomePage = async (req, res) =>{
    try{
        return res.render('home');
    }catch (error){
        console.log("Home Page not found");
        res.status(500).send("Server error")
    }
}

const loadSignup = async (req, res) => {
    
    try {
        return res.render('signup');
    }catch (error){
        console.log('Home page not loading : ', error);
        res.status(500).send('Server Error');
    }
}


const loadShopping = async (req, res) => {

    try{
        return res.render('shop');
    }catch (error){
        console.log("Shopping page not loading : ", error);
        res.status(500).send('Server Error');
    }
}



const pageNotFound = async (req, res) => {
    try{
        res.render("404");
    }catch (error){
       res.redirect("/pageNotFound");
    }
}


const signup = async (req,res) => {
    const {name,email,phone,password} = req.body;
    try{
        
        const newUser = new User({name,email,phone,password});
        console.log(newUser);
        await newUser.save();
        return res.redirect("/signup");
    }catch (error){
        console.error("Error for save user", error);
        res.status(500).send('Internal server error');

    }
}



module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    loadShopping,
    signup
}