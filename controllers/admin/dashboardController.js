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

    const orders = await Order.find({
      createdOn: { $gte: start, $lte: end }
    }).populate('userId', 'name').sort({ createdOn: -1 });

    const reportData = orders.map(order => ({
      orderId: order.orderId,
      date: order.createdOn.toLocaleDateString(),
      customerName: order.userId?.name || 'Unknown',
      status: order.status,
      revenue: order.finalAmount || 0,
      orders: 1,
      productsSold: order.OrderItems
        ? order.OrderItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0
    }));

    const groupedData = reportData.reduce((acc, curr) => {
      const date = curr.date;
      if (!acc[date]) {
        acc[date] = {
          date: date,
          orderId: curr.orderId,
          customerName: curr.customerName,
          status: curr.status,
          orders: 0,
          revenue: 0,
          productsSold: 0
        };
      }
      acc[date].orders += curr.orders;
      acc[date].revenue += curr.revenue;
      acc[date].productsSold += curr.productsSold;
      return acc;
    }, {});

    const finalReportData = Object.values(groupedData);

    if (reportFormat === 'excel') {
      const workbook = await generateExcelReport(finalReportData, reportType);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=sales_report_${reportType}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (reportFormat === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sales_report_${reportType}.pdf`);
      const doc = generatePDFReport(finalReportData, reportType);
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

  worksheet.addRow(['Order ID', 'Date', 'Customer', 'Status', 'Amount']);
  data.forEach(row => {
    worksheet.addRow([row.orderId, row.date, row.customerName, row.status, row.revenue]);
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach(column => {
    column.width = 20;
  });

  return workbook;
};

const generatePDFReport = (data, reportType) => {
  const doc = new PDFDocument();

  doc.fontSize(20).fillColor('#DB4437').text('Bagzo Sales Report', { align: 'center' });
  doc.fontSize(12).moveDown().fillColor('#FF4B2B');
  doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, { align: 'center' });
  doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, { align: 'center' });

  const periodStart = data[0]?.date || '';
  const periodEnd = data[data.length - 1]?.date || '';
  doc.text(`Period: ${periodStart} to ${periodEnd}`, { align: 'center' });

  doc.moveDown().fillColor('#DB4437').text('Summary:', { align: 'center' });
  const totalOrders = data.reduce((sum, row) => sum + row.orders, 0);
  const totalRevenue = data.reduce((sum, row) => sum + row.revenue, 0);
  doc.fillColor('#FF4B2B');
  doc.text(`Total Orders: ${totalOrders}`, { align: 'center' });
  doc.text(`Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`, { align: 'center' });

  doc.moveDown();
  const tableTop = 250;

  doc.fontSize(12).fillColor('#DB4437');
  doc.text('Order ID', 50, tableTop);
  doc.text('Date', 200, tableTop);
  doc.text('Customer', 300, tableTop);
  doc.text('Status', 400, tableTop);
  doc.text('Amount', 500, tableTop);

  doc.lineWidth(1)
    .strokeColor('#DB4437')
    .moveTo(50, tableTop + 20)
    .lineTo(600, tableTop + 20)
    .stroke();

  let yPosition = tableTop + 40;
  data.forEach(row => {
    doc.fontSize(10).fillColor('#FF4B2B');
    doc.text(row.orderId || '', 50, yPosition, { width: 150 });
    doc.text(row.date || '', 200, yPosition, { width: 100 });
    doc.text(row.customerName || 'Unknown', 300, yPosition, { width: 100 });
    doc.text(row.status || '', 400, yPosition, { width: 100 });
    doc.text(`₹${row.revenue.toLocaleString('en-IN')}`, 500, yPosition, { width: 100 });

    yPosition += 30;
    doc.lineWidth(0.5)
      .strokeColor('#FF4B2B')
      .moveTo(50, yPosition - 5)
      .lineTo(600, yPosition - 5)
      .stroke();
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