const mongoose = require("mongoose");
const env = require("dotenv").config();

const connectDB = () =>{
    try{
         mongoose.connect(process.env.MONGODB_URI);
        console.log("DB Connected");
    }catch (error){
        console.log("DB Connection error", error.message);
        process.exit(1);
    }
    
};

module.exports = connectDB;



// const mongoose = require("mongoose");

// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });
//         console.log("✅ MongoDB Connected");
//     } catch (error) {
//         console.error("❌ MongoDB Connection Error:", error);
//         process.exit(1);
//     }
// };

<<<<<<< HEAD
// module.exports = connectDB;
=======
// module.exports = connectDB;
>>>>>>> 334f225 (cart page added. working on profile page.)
