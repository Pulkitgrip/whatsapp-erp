require('dotenv').config();
const sequelize = require('./src/sequelize');
const User = require('./src/models/user');
const Category = require('./src/models/category');
const Product = require('./src/models/product');
const { BotResponse } = require('./src/models/whatsappModels');
const bcrypt = require('bcryptjs');

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Sync models
    await sequelize.sync({ force: false, alter: false });
    console.log('✅ Database models synchronized');
    
    // Create categories
    const electronics = await Category.findOrCreate({
      where: { name: 'Electronics' },
      defaults: { name: 'Electronics' }
    });
    
    const clothing = await Category.findOrCreate({
      where: { name: 'Clothing' },
      defaults: { name: 'Clothing' }
    });
    
    console.log('✅ Categories created');
    
    // Create products
    await Product.findOrCreate({
      where: { name: 'Gaming Laptop' },
      defaults: {
        name: 'Gaming Laptop',
        unitPrice: 1299.99,
        costPrice: 899.99,
        lowStockThreshold: 5,
        CategoryId: electronics[0].id
      }
    });
    
    await Product.findOrCreate({
      where: { name: 'Wireless Mouse' },
      defaults: {
        name: 'Wireless Mouse',
        unitPrice: 49.99,
        costPrice: 25.99,
        lowStockThreshold: 10,
        CategoryId: electronics[0].id
      }
    });
    
    await Product.findOrCreate({
      where: { name: 'Cotton T-Shirt' },
      defaults: {
        name: 'Cotton T-Shirt',
        unitPrice: 24.99,
        costPrice: 12.99,
        lowStockThreshold: 20,
        CategoryId: clothing[0].id
      }
    });
    
    console.log('✅ Products created');
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.findOrCreate({
      where: { email: 'admin@company.com' },
      defaults: {
        email: 'admin@company.com',
        password: hashedPassword,
        role: 'admin'
      }
    });
    
    console.log('✅ Admin user created (email: admin@company.com, password: admin123)');
    
    // Create bot responses
    const botResponses = [
      {
        triggerKeyword: 'hello',
        responseText: '👋 Hello! Welcome to our store. Type "catalog" to see our products or "help" for assistance.',
        priority: 1
      },
      {
        triggerKeyword: 'hi',
        responseText: '👋 Hi there! How can I help you today? Type "help" to see available commands.',
        priority: 1
      },
      {
        triggerKeyword: 'help',
        responseText: '🤖 *How can I help you?*\n\n📋 Type "catalog" - View our products\n🛒 Type "ORDER [Product]:[Qty]" - Place an order\n📦 Type "status" - Check order status\n💬 Type "contact" - Get contact info\n\nExample: ORDER Gaming Laptop:1',
        priority: 1
      },
      {
        triggerKeyword: 'contact',
        responseText: '📞 *Contact Information*\n\nPhone: +1-234-567-8900\nEmail: support@company.com\nWebsite: www.company.com\n\nFeel free to reach out anytime!',
        priority: 1
      },
      {
        triggerKeyword: 'thanks',
        responseText: '😊 You\'re welcome! Is there anything else I can help you with?',
        priority: 1
      }
    ];
    
    for (const response of botResponses) {
      await BotResponse.findOrCreate({
        where: { triggerKeyword: response.triggerKeyword },
        defaults: response
      });
    }
    
    console.log('✅ Bot responses created');
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`• Categories: ${await Category.count()}`);
    console.log(`• Products: ${await Product.count()}`);
    console.log(`• Users: ${await User.count()}`);
    console.log(`• Bot Responses: ${await BotResponse.count()}`);
    
    console.log('\n🚀 Ready to start the server with: npm start');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    await sequelize.close();
  }
}

setupDatabase();
