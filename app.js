
const express =require('express');
const app=express();
const path = require("path");
const dotenv = require("dotenv").config();
const session = require("express-session")
const passport = require("./config/passport");
const db =require("./config/db")
const userRouter=require("./routes/userRouter");
const adminRouter=require("./routes/adminRouter");
db()




app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true, maxAge: 72 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
  res.set("Cache-Control","no-store")
  next();
})

app.set("view engine" ,"ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
// app.set("views",path.join(__dirname,'views/user'));

app.use(express.static("public"))


app.use("/",userRouter);
app.use("/admin",adminRouter);



const PORT=process.env.PORT || 4488;
app.listen(3001,()=>{
  console.log("server running on port 3001 or 4488");
})




