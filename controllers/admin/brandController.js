const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");





const getBrandPage = async(req,res)=>{
  try {
       const page = parseInt(req.query.page) || 1;
       const limit =4;
       const skip = (page-1)*limit;
       const brandData = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
       const totalBrands =await Brand.countDocuments();
       const totalPages = Math.ceil(totalBrands/limit)
       const reverseBrand = brandData.reverse();
       res.render("brands",{
        data : reverseBrand,
        currentPage : page,
        totalPages : totalPages,
        totalBrands : totalBrands,
       })

  } catch (error) {
    res.redirect("/pageerror")
  }
}

// const addBrand =async (req,res)=>{
//   try {
//     const brand = req.body.name;
//     const findBrand = await Brand.findOne({brandName: brand});
//     if(!findBrand){
//       const image = req.file.filename;
//       const newBrand = new Brand({
//         brandName :brand,
//         brandImage : image,
//       })
//       await newBrand.save();
//         res.redirect("/admin/brands")
      
//     }
//   } catch (error) {
//     res.redirect("/pageerror")
    
//   }
// }

const addBrand = async (req, res) => {
  try {
    console.log("Request received for adding a brand:", req.body); // Debug log
    console.log("Uploaded file:", req.file); // Debug log

    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).send("No image uploaded");
    }

    const brand = req.body.name;
    const findBrand = await Brand.findOne({ brandName: brand });

    if (!findBrand) {
      const image = req.file.filename;
      console.log("Saving new brand:", brand, image); // Debug log

      const newBrand = new Brand({
        brandName: brand,
        brandImage: image,
      });

      await newBrand.save();
      res.redirect("/admin/brands");
    } else {
      console.log("Brand already exists"); // Debug log
      res.status(400).send("Brand already exists");
    }
  } catch (error) {
    console.error("Error in addBrand:", error);
    res.redirect("/pageerror");
  }
};

const blockBrand = async (req,res)=>{
  try {
    
  const  id = req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/brands")
  } catch (error) {
  
}
}

const unBlockBrand = async (req,res)=>{
  try {
    const id = req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/brands");

    } catch (error) {
    res.redirect("/pageerror")
  }
}

const deletBrand = async (req,res)=>{
  try {
    const {id} = req.query;
    if(!id){
      return res.status(400).redirect("/pageerror")
    }
    await Brand.deleteOne({_id:id});
    res.redirect("/admin/brands")
  } catch (error) {
    console.error("Error deleting brand:",error);
    res.status(500).redirect("/pageerror")
  }
}

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deletBrand,
}