const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Load Dashboard Page
const loadDashboard = async (req, res, next) => {
  if (req.session.admin) {
    try {
      const [
        totalUsers,
        totalProducts,
        totalOrders,
        orders,
        recentOrdersData,
        monthlyData,
        topProductsData,
        topCategoriesData,
        topBrandsData,
        orderStatusData
      ] = await Promise.all([
        User.countDocuments({ isAdmin: false }),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.find(),
        Order.find()
          .populate('userId', 'name')
          .populate('OrderItems.product', 'productName')
          .sort({ createdOn: -1 })
          .limit(5),
        getMonthlyData('yearly'),
        getTopProductsData(),
        getTopCategoriesData(),
        getTopBrandsData(),
        getOrderStatusData()
      ]);

      const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0);

      const formattedRecentOrders = recentOrdersData.map(order => ({
        orderId: order.orderId,
        customerName: order.userId ? order.userId.name : 'Unknown Customer',
        productName: order.OrderItems.length > 0 && order.OrderItems[0].product ? order.OrderItems[0].product.productName : 'Unknown Product',
        amount: order.finalAmount,
        status: order.status,
        date: order.createdOn.toLocaleDateString()
      }));

      const { revenueData, ordersData, chartLabels } = monthlyData;

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
          topProductLabels: topProductsData.productLabels,
          topProductData: topProductsData.productData,
          topCategoryLabels: topCategoriesData.categoryLabels,
          topCategoryData: topCategoriesData.categoryData,
          topBrandLabels: topBrandsData.brandLabels,
          topBrandData: topBrandsData.brandData,
          orderStatusLabels: orderStatusData.statusLabels,
          orderStatusData: orderStatusData.statusData
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

// Get Chart Data
const getChartData = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const dateFilter = getDateFilter(range, startDate, endDate);

    const orders = await Order.find(dateFilter)
      .populate({
        path: 'OrderItems.product',
        populate: [
          { path: 'brand', select: 'brandName' },
          { path: 'category', select: 'name' }
        ]
      });

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

    const chartLabels = aggregation.map(item => item._id);
    const revenueData = aggregation.map(item => item.totalRevenue);
    const ordersData = aggregation.map(item => item.totalOrders);

    res.json({ chartLabels, revenueData, ordersData });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get Date Filter for Chart Data
const getDateFilter = (range, startDate, endDate) => {
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
      // Default to all data if range is invalid
      dateFilter = {};
  }
  return dateFilter;
};

// Get Top Products Data
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
    { $limit: 10 } 
  ]);

  const productLabels = topProducts.map(p => p.productName || 'Unknown Product');
  const productData = topProducts.map(p => p.totalQuantity);

  return { productLabels, productData };
};

// Get Top Brand Data
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
    { $limit: 10 } 
  ]);

  const brandLabels = topBrands.map(b => b.brandName || 'Unknown Brand');
  const brandData = topBrands.map(b => b.totalQuantity);

  return { brandLabels, brandData };
};

// Get Top Categories Data
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
        categoryName: { $first: "$category.name" },
        totalQuantity: { $sum: "$OrderItems.quantity" }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 } // Changed from 5 to 10
  ]);

  const categoryLabels = topCategories.map(c => c.categoryName || 'Unknown Category');
  const categoryData = topCategories.map(c => c.totalQuantity);

  return { categoryLabels, categoryData };
};

// Get Order Status Data
const getOrderStatusData = async () => {
  const orderStatuses = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const statusLabels = orderStatuses.map(s => s._id || 'Unknown');
  const statusData = orderStatuses.map(s => s.count);

  return { statusLabels, statusData };
};

// Download Report
const downloadReport = async (req, res) => {
  try {
    const { reportType, reportFormat, startDate, endDate } = req.query;
    const { startDate: start, endDate: end } = getDateRange(reportType, startDate, endDate);

    const orders = await Order.find({
      createdOn: { $gte: start, $lte: end }
    })
      .populate('userId', 'name')
      .populate('OrderItems.product', 'productName')
      .sort({ createdOn: -1 });

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

// Get Custom Report
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

// Generate Excel Report
const generateExcelReport = async (data, reportType) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

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

  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach((column, i) => {
    column.width = 
      i === 0 ? 36 :  
      i === 3 ? 40 :  
      i === 7 ? 15 :  
      20;             
  });

  return workbook;
};

// Generate PDF Report
const generatePDFReport = (data, reportType) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const pageWidth = doc.page.width - 60;

  doc.fontSize(20).fillColor('#DB4437').text('Bagzo Detailed Sales Report', { align: 'center' });
  doc.fontSize(12).moveDown().fillColor('#FF4B2B');
  doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, { align: 'center' });
  doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, { align: 'center' });

  const periodStart = data[0]?.date || '';
  const periodEnd = data[data.length - 1]?.date || '';
  doc.text(`Period: ${periodStart} to ${periodEnd}`, { align: 'center' });

  doc.moveDown().fillColor('#DB4437').text('Summary:', { align: 'center' });
  const totalOrders = data.length;
  const totalRevenue = data.reduce((sum, order) => sum + order.finalAmount, 0);
  doc.fillColor('#FF4B2B');
  doc.text(`Total Orders: ${totalOrders}`, { align: 'center' });
  doc.text(`Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`, { align: 'center' });

  doc.moveDown();
  let yPosition = 250;

  const padding = 6; 

  const columns = [
    { key: 'orderId', header: 'Order ID', width: 60, align: 'left' },
    { key: 'date', header: 'Date', width: 45, align: 'left' },
    { key: 'customer', header: 'Customer', width: 55, align: 'left' }, 
    { key: 'product', header: 'Product', width: 75, align: 'left' },
    { key: 'qty', header: 'Qty', width: 25, align: 'center' },
    { key: 'price', header: 'Price', width: 45, align: 'right' },
    { key: 'itemTotal', header: 'Item Total', width: 55, align: 'right' },
    { key: 'orderTotal', header: 'Order Total', width: 55, align: 'right' }, 
    { key: 'status', header: 'Status', width: 40, align: 'left' },
    { key: 'payment', header: 'Payment', width: 45, align: 'left' }
  ];

  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0) + (padding * (columns.length - 1));
  console.log(`Adjusted total width: ${totalWidth}, Page width: ${pageWidth}`);

  doc.fontSize(10).fillColor('#DB4437');
  let xPos = 30;

  columns.forEach(col => {
    doc.text(col.header, xPos, yPosition, { width: col.width, align: col.align });
    xPos += col.width + padding;
  });

  doc.lineWidth(1)
    .strokeColor('#DB4437')
    .moveTo(30, yPosition + 15)
    .lineTo(pageWidth + 30, yPosition + 15)
    .stroke();

  yPosition += 30;
  data.forEach(order => {
    order.products.forEach((product, index) => {
      if (yPosition > doc.page.height - 50) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(8).fillColor('#FF4B2B');
      xPos = 30;

      const rowData = [
        { col: columns[0], value: index === 0 ? order.orderId : '' },
        { col: columns[1], value: index === 0 ? order.date : '' },
        { col: columns[2], value: index === 0 ? order.customerName : '' },
        { col: columns[3], value: product.name },
        { col: columns[4], value: product.quantity.toString() },
        { col: columns[5], value: `₹${product.price.toLocaleString('en-IN')}` },
        { col: columns[6], value: `₹${product.total.toLocaleString('en-IN')}` },
        { col: columns[7], value: index === 0 ? `₹${order.finalAmount.toLocaleString('en-IN')}` : '' },
        { col: columns[8], value: index === 0 ? order.status : '' },
        { col: columns[9], value: index === 0 ? order.paymentMethod : '' }
      ];

      rowData.forEach(item => {
        let displayText = item.value;
        if (item.value && !item.value.startsWith('₹') && item.value.length > item.col.width / 4) {
          displayText = item.value.substring(0, Math.floor(item.col.width / 4) - 3) + '...';
        }
        
        const options = { 
          width: item.col.width, 
          align: item.col.align,
          ellipsis: false
        };
        
        doc.text(displayText, xPos, yPosition, options);
        xPos += item.col.width + padding;
      });

      yPosition += 25;
      
      doc.lineWidth(0.5)
        .strokeColor('#FF4B2B')
        .moveTo(30, yPosition - 7)
        .lineTo(pageWidth + 30, yPosition - 7)
        .stroke();
    });
  });

  return doc;
};

// Get Monthly Data for Chart
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
  getChartData,
  getOrderStatusData
};