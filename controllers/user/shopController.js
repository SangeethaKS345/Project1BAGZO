// controllers/shopController.js
const Product = require('../../models/Product');
const User = require('../../models/userSchema')

const shopController = {
    getShopPage: async (req, res) => {
        try {
            
            const currentPage = parseInt(req.query.page) || 1;
            const limit = 9; 
            const skip = (currentPage - 1) * limit;

            
            const priceRange = req.query.price;
            const category = req.query.category;
            const brand = req.query.brand;
            const searchQuery = req.query.query;

            
            let filter = {};

            
            if (priceRange) {
                switch (priceRange) {
                    case 'under500':
                        filter.price = { $lt: 500 };
                        break;
                    case '500-1000':
                        filter.price = { $gte: 500, $lte: 1000 };
                        break;
                    case '1000-1500':
                        filter.price = { $gte: 1000, $lte: 1500 };
                        break;
                    case 'above1500':
                        filter.price = { $gt: 1500 };
                        break;
                }
            }

            
            if (category) {
                filter.category = category;
            }

           
            if (brand) {
                filter.brand = brand;
            }

          
            if (searchQuery) {
                filter.$or = [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { description: { $regex: searchQuery, $options: 'i' } }
                ];
            }

           
            const products = await Product.find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }); // Sort by newest first

            
            const totalProducts = await Product.countDocuments(filter);
            const totalPages = Math.ceil(totalProducts / limit);

            const categories = await Product.distinct('category');
            const brands = await Product.distinct('brand');

          
            res.render('user/shop', {
                userData: req.session.userData || "",
                products,
                categories,
                brands,
                currentPage,
                totalPages,
                priceRange,
                selectedCategory: category,
                selectedBrand: brand,
                searchQuery
            });

        } catch (error) {
            console.error('Error in getShopPage:', error);
            res.status(500).render('error', { error: 'Internal server error' });
        }
    },

    searchProducts: async (req, res) => {
        try {
            const searchQuery = req.body.query;
          
            res.redirect(`/shop?query=${encodeURIComponent(searchQuery)}`);
        } catch (error) {
            console.error('Error in searchProducts:', error);
            res.status(500).render('error', { error: 'Internal server error' });
        }
    },

    addToWishlist: async (req, res) => {
        try {
            const { productId } = req.body;
            const userId = req.session.userData._id;

           

            res.json({ success: true });
        } catch (error) {
            console.error('Error in addToWishlist:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    },

    addToCart: async (req, res) => {
        try {
            const { productId } = req.body;
            const userId = req.session.userData._id;


            res.json({ success: true });
        } catch (error) {
            console.error('Error in addToCart:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
};

module.exports = shopController;