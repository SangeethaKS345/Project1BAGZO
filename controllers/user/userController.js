

const pageNotFound = async (req, res) => {
    try{
        res.render("404");
    }catch (error){
       res.redirect("/pageNotFound");
    }
}


const loadHomePage = async (req, res) =>{
    try{
        return res.render('home');
    }catch (error){
        console.log("Home Page not found");
        res.status(500).send("Server error")
    }
}

module.exports = {
    loadHomePage,
    pageNotFound,
}