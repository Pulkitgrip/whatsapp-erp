const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create categories
  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics'
    }
  })

  const clothing = await prisma.category.create({
    data: {
      name: 'Clothing'
    }
  })

  console.log('✅ Categories created')

  // Create products
  const laptop = await prisma.product.create({
    data: {
      name: 'Gaming Laptop',
      unitPrice: 1299.99,
      costPrice: 899.99,
      currentStock: 15,
      lowStockThreshold: 5,
      description: 'High-performance gaming laptop with RTX graphics',
      categoryId: electronics.id
    }
  })

  const mouse = await prisma.product.create({
    data: {
      name: 'Wireless Mouse',
      unitPrice: 49.99,
      costPrice: 25.99,
      currentStock: 50,
      lowStockThreshold: 10,
      description: 'Ergonomic wireless mouse with RGB lighting',
      categoryId: electronics.id
    }
  })

  const tshirt = await prisma.product.create({
    data: {
      name: 'Cotton T-Shirt',
      unitPrice: 24.99,
      costPrice: 12.99,
      currentStock: 100,
      lowStockThreshold: 20,
      description: 'Comfortable cotton t-shirt in various colors',
      categoryId: clothing.id
    }
  })

  console.log('✅ Products created')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'admin',
      phoneNumber: '+1234567890'
    }
  })

  console.log('✅ Admin user created (email: admin@company.com, password: admin123)')

  // Create some bot responses
  await prisma.botResponse.create({
    data: {
      triggerKeyword: 'hello',
      responseText: 'Hello! Welcome to our store. How can I help you today?',
      priority: 1
    }
  })

  await prisma.botResponse.create({
    data: {
      triggerKeyword: 'thanks',
      responseText: 'You\'re welcome! Is there anything else I can help you with?',
      priority: 1
    }
  })

  console.log('✅ Bot responses created')

  console.log('🎉 Database seeding completed successfully!')
  
  console.log('\n📊 Summary:')
  console.log(`• ${await prisma.category.count()} categories`)
  console.log(`• ${await prisma.product.count()} products`)
  console.log(`• ${await prisma.user.count()} users`)
  console.log(`• ${await prisma.botResponse.count()} bot responses`)
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
