const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const loadDashboard = async (req, res, next) => {
  if (req.session.admin) {
    try {
      const totalUsers = await User.countDocuments({ isAdmin: false });
      const totalProducts = await Product.countDocuments();
      const totalOrders = await Order.countDocuments();

      const orders = await Order.find();
      const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0);

      const recentOrders = await Order.find()
        .populate('userId', 'name')
        .populate('OrderItems.product', 'productName')
        .sort({ createdOn: -1 })
        .limit(5);

      const formattedRecentOrders = recentOrders.map(order => ({
        orderId: order.orderId,
        customerName: order.userId ? order.userId.name : 'Unknown Customer',
        productName: order.OrderItems.length > 0 && order.OrderItems[0].product ? order.OrderItems[0].product.productName : 'Unknown Product',
        amount: order.finalAmount,
        status: order.status,
        date: order.createdOn.toLocaleDateString()
      }));

      const monthlyData = await getMonthlyData('yearly');
      const { revenueData, ordersData, chartLabels } = monthlyData;

      const topProducts = await getTopProductsData();
      const topCategories = await getTopCategoriesData();
      const topBrands = await getTopBrandsData();

      res.render("dashboard", {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue,
        recentOrders: formattedRecentOrders,
        chartData: {
          revenueData,
          ordersData,
          chartLabels,
          topProductLabels: topProducts.productLabels,
          topProductData: topProducts.productData,
          topCategoryLabels: topCategories.categoryLabels,
          topCategoryData: topCategories.categoryData,
          topBrandLabels: topBrands.brandLabels,
          topBrandData: topBrands.brandData
        }
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
      next(error);
    }
  } else {
    res.redirect('/admin/login');
  }
};

const getChartData = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;

    let dateFilter = {};
    switch (range) {
      case 'daily':
        dateFilter = { createdOn: { $gte: new Date(new Date().setDate(new Date().getDate() - 1)) } };
        break;
      case 'last3days':
        dateFilter = { createdOn: { $gte: new Date(new Date().setDate(new Date().getDate() - 3)) } };
        break;
      case 'last7days':
        dateFilter = { createdOn: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } };
        break;
      case 'last30days':
        dateFilter = { createdOn: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) } };
        break;
      case 'yearly':
        dateFilter = { createdOn: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) } };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = { 
            createdOn: { 
              $gte: new Date(startDate), 
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            } 
          };
        }
        break;
      default:
        dateFilter = {}; // Default to all data if range is invalid
    }

    const orders = await Order.find(dateFilter)
      .populate({
        path: 'OrderItems.product',
        populate: [
          { path: 'brand', select: 'brandName' },
          { path: 'category', select: 'name' }
        ]
      });

    const chartLabels = [];
    const revenueData = [];
    const ordersData = [];

    // Aggregate revenue and orders
    const aggregation = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: range === 'yearly' ? "%Y-%m" : "%Y-%m-%d", date: "$createdOn" } },
          totalRevenue: { $sum: "$finalAmount" },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    aggregation.forEach(item => {
      chartLabels.push(item._id);
      revenueData.push(item.totalRevenue);
      ordersData.push(item.totalOrders);
    });

    const chartData = {
      chartLabels,
      revenueData,
      ordersData,
      // Include top products, categories, and brands if needed (unchanged for now)
    };

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getTopProductsData = async () => {
  const topProducts = await Order.aggregate([
    { $unwind: "$OrderItems" },
    {
      $lookup: {
        from: "products",
        localField: "OrderItems.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $group: {
        _id: "$product._id",
        productName: { $first: "$product.productName" },
        totalQuantity: { $sum: "$OrderItems.quantity" },
        totalRevenue: { $sum: { $multiply: ["$OrderItems.quantity", "$OrderItems.price"] } }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 }
  ]);

  const productLabels = topProducts.map(p => p.productName || 'Unknown Product');
  const productData = topProducts.map(p => p.totalQuantity);

  return { productLabels, productData };
};

const getTopBrandsData = async () => {
  const topBrands = await Order.aggregate([
    { $unwind: "$OrderItems" },
    {
      $lookup: {
        from: "products",
        localField: "OrderItems.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "brands",
        localField: "product.brand",
        foreignField: "_id",
        as: "brand"
      }
    },
    { $unwind: "$brand" },
    {
      $group: {
        _id: "$product.brand",
        brandName: { $first: "$brand.brandName" },
        totalQuantity: { $sum: "$OrderItems.quantity" }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 }
  ]);

  const brandLabels = topBrands.map(b => b.brandName || 'Unknown Brand');
  const brandData = topBrands.map(b => b.totalQuantity);

  return { brandLabels, brandData };
};

const getTopCategoriesData = async () => {
  const topCategories = await Order.aggregate([
    { $unwind: "$OrderItems" },
    {
      $lookup: {
        from: "products",
        localField: "OrderItems.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$product.category",
        categoryName: { $first: "$category.name" }, // Changed from 'categoryName' to 'name'
        totalQuantity: { $sum: "$OrderItems.quantity" }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 }
  ]);

  const categoryLabels = topCategories.map(c => c.categoryName || 'Unknown Category');
  const categoryData = topCategories.map(c => c.totalQuantity);

  return { categoryLabels, categoryData };
};

const downloadReport = async (req, res) => {
  try {
    const { reportType, reportFormat, startDate, endDate } = req.query;
    const { startDate: start, endDate: end } = getDateRange(reportType, startDate, endDate);

    // Fetch orders with populated data
    const orders = await Order.find({
      createdOn: { $gte: start, $lte: end }
    })
      .populate('userId', 'name')
      .populate('OrderItems.product', 'productName')
      .sort({ createdOn: -1 });

    // Prepare detailed report data for each order
    const reportData = orders.map(order => ({
      orderId: order.orderId,
      date: order.createdOn.toLocaleDateString(),
      customerName: order.userId?.name || 'Unknown',
      products: order.OrderItems.map(item => ({
        name: item.product?.productName || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price
      })),
      status: order.status,
      paymentMethod: order.paymentMethod,
      finalAmount: order.finalAmount,
    }));

    if (reportFormat === 'excel') {
      const workbook = await generateExcelReport(reportData, reportType);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=sales_report_${reportType}_detailed.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (reportFormat === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sales_report_${reportType}_detailed.pdf`);
      const doc = generatePDFReport(reportData, reportType);
      doc.pipe(res);
      doc.end();
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

const getDateRange = (reportType, startDate, endDate) => {
  const endDateTime = new Date();
  let startDateTime = new Date();

  switch (reportType) {
    case 'daily':
      startDateTime.setDate(startDateTime.getDate() - 1);
      break;
    case 'weekly':
      startDateTime.setDate(startDateTime.getDate() - 7);
      break;
    case 'yearly':
      startDateTime.setFullYear(startDateTime.getFullYear() - 1);
      break;
    case 'custom':
      if (startDate && endDate) {
        startDateTime = new Date(startDate);
        endDateTime.setTime(new Date(endDate).getTime() + 86399999);
      }
      break;
  }

  return { startDate: startDateTime, endDate: endDateTime };
};

const generateExcelReport = async (data, reportType) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  // Headers for detailed report
  worksheet.addRow([
    'Order ID',
    'Date',
    'Customer',
    'Product Name',
    'Quantity',
    'Price',
    'Item Total',
    'Order Total',
    'Status',
    'Payment Method'
  ]);

  // Add data rows
  data.forEach(order => {
    order.products.forEach((product, index) => {
      worksheet.addRow([
        index === 0 ? order.orderId : '',
        index === 0 ? order.date : '',
        index === 0 ? order.customerName : '',
        product.name,
        product.quantity,
        product.price,
        product.total,
        index === 0 ? order.finalAmount : '',
        index === 0 ? order.status : '',
        index === 0 ? order.paymentMethod : ''
      ]);
    });
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach((column, i) => {
    column.width = 
      i === 0 ? 36 :    // Order ID
      i === 3 ? 40 :    // Product Name (increased from default 20 to 40)
      i === 7 ? 15 :    // Order Total
      20;               // Default width for others
  });

  return workbook;
};

const generatePDFReport = (data, reportType) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const pageWidth = doc.page.width - 60; // 552 points usable width with 30pt margins

  // Header
  doc.fontSize(20).fillColor('#DB4437').text('Bagzo Detailed Sales Report', { align: 'center' });
  doc.fontSize(12).moveDown().fillColor('#FF4B2B');
  doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, { align: 'center' });
  doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, { align: 'center' });

  const periodStart = data[0]?.date || '';
  const periodEnd = data[data.length - 1]?.date || '';
  doc.text(`Period: ${periodStart} to ${periodEnd}`, { align: 'center' });

  // Summary
  doc.moveDown().fillColor('#DB4437').text('Summary:', { align: 'center' });
  const totalOrders = data.length;
  const totalRevenue = data.reduce((sum, order) => sum + order.finalAmount, 0);
  doc.fillColor('#FF4B2B');
  doc.text(`Total Orders: ${totalOrders}`, { align: 'center' });
  doc.text(`Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`, { align: 'center' });

  doc.moveDown();
  let yPosition = 250;

  // Define column widths and padding
  const colWidths = {
    orderId: 90,
    date: 60,
    customer: 90,
    product: 140,
    qty: 40,
    price: 50,
    itemTotal: 50,
    orderTotal: 60,
    status: 50,
    payment: 50
  };
  const padding = 5; // Add 5pt padding between each column

  // Calculate total width including padding
  const totalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0) + (padding * (Object.keys(colWidths).length - 1));
  if (totalWidth > pageWidth) {
    console.warn(`Total width (${totalWidth}) exceeds page width (${pageWidth}). Consider reducing widths or padding.`);
  }

  // Table Headers
  doc.fontSize(10).fillColor('#DB4437');
  let xPos = 30;
  doc.text('Order ID', xPos, yPosition, { width: colWidths.orderId });
  xPos += colWidths.orderId + padding;
  doc.text('Date', xPos, yPosition, { width: colWidths.date });
  xPos += colWidths.date + padding;
  doc.text('Customer', xPos, yPosition, { width: colWidths.customer });
  xPos += colWidths.customer + padding;
  doc.text('Product', xPos, yPosition, { width: colWidths.product });
  xPos += colWidths.product + padding;
  doc.text('Qty', xPos, yPosition, { width: colWidths.qty });
  xPos += colWidths.qty + padding;
  doc.text('Price', xPos, yPosition, { width: colWidths.price });
  xPos += colWidths.price + padding;
  doc.text('Item Total', xPos, yPosition, { width: colWidths.itemTotal });
  xPos += colWidths.itemTotal + padding;
  doc.text('Order Total', xPos, yPosition, { width: colWidths.orderTotal });
  xPos += colWidths.orderTotal + padding;
  doc.text('Status', xPos, yPosition, { width: colWidths.status });
  xPos += colWidths.status + padding;
  doc.text('Payment', xPos, yPosition, { width: colWidths.payment });

  doc.lineWidth(1)
    .strokeColor('#DB4437')
    .moveTo(30, yPosition + 15)
    .lineTo(pageWidth + 30, yPosition + 15)
    .stroke();

  // Table Rows
  yPosition += 30;
  data.forEach(order => {
    order.products.forEach((product, index) => {
      if (yPosition > doc.page.height - 50) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(8).fillColor('#FF4B2B');
      xPos = 30;
      doc.text(index === 0 ? order.orderId : '', xPos, yPosition, { width: colWidths.orderId });
      xPos += colWidths.orderId + padding;
      doc.text(index === 0 ? order.date : '', xPos, yPosition, { width: colWidths.date });
      xPos += colWidths.date + padding;
      doc.text(index === 0 ? order.customerName : '', xPos, yPosition, { width: colWidths.customer });
      xPos += colWidths.customer + padding;
      doc.text(product.name, xPos, yPosition, { width: colWidths.product });
      xPos += colWidths.product + padding;
      doc.text(product.quantity.toString(), xPos, yPosition, { width: colWidths.qty });
      xPos += colWidths.qty + padding;
      doc.text(`₹${product.price.toLocaleString('en-IN')}`, xPos, yPosition, { width: colWidths.price });
      xPos += colWidths.price + padding;
      doc.text(`₹${product.total.toLocaleString('en-IN')}`, xPos, yPosition, { width: colWidths.itemTotal });
      xPos += colWidths.itemTotal + padding;
      doc.text(index === 0 ? `₹${order.finalAmount.toLocaleString('en-IN')}` : '', xPos, yPosition, { width: colWidths.orderTotal });
      xPos += colWidths.orderTotal + padding;
      doc.text(index === 0 ? order.status : '', xPos, yPosition, { width: colWidths.status });
      xPos += colWidths.status + padding;
      doc.text(index === 0 ? order.paymentMethod : '', xPos, yPosition, { width: colWidths.payment });

      yPosition += 20;
      doc.lineWidth(0.5)
        .strokeColor('#FF4B2B')
        .moveTo(30, yPosition - 5)
        .lineTo(pageWidth + 30, yPosition - 5)
        .stroke();
    });
  });

  return doc;
};

const getMonthlyData = async (range = 'yearly') => {
  const now = new Date();
  let startDate;

  switch (range) {
    case 'weekly':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'monthly':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'yearly':
    default:
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }

  const orders = await Order.aggregate([
    { $match: { createdOn: { $gte: startDate, $lte: new Date() } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
        totalRevenue: { $sum: "$finalAmount" },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  const chartLabels = orders.map(item => item._id);
  const revenueData = orders.map(item => item.totalRevenue || 0);
  const ordersData = orders.map(item => item.totalOrders || 0);

  return { chartLabels, revenueData, ordersData };
};

module.exports = {
  loadDashboard,
  downloadReport,
  generateExcelReport,
  generatePDFReport,
  getChartData
};