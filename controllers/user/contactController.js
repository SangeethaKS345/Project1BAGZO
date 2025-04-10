// This controller handles the contact page rendering

const contactController = {
  loadContact: (req, res) => {
    try {
      res.render('contact', {
        userData: req.session.user || null,
        title: 'Contact - Bagzo'
      });
    } catch (error) {
      console.error('Error loading contact page:', error);
      res.status(500).render('error', {
        message: 'Something went wrong while loading the contact page',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  }
};

module.exports = contactController;