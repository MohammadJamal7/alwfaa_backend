import pool from './config/db.js';

const seedProducts = async () => {
  try {
    // First, create a category
    await pool.query(`
      INSERT INTO categories (name, slug, sort_order) VALUES 
        ('خدمات الدعم', 'support-services', 1),
        ('ملفات مميزة', 'featured-files', 2),
        ('باقات شاملة', 'comprehensive-packages', 3)
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('✅ Categories created');

    // Get category IDs
    const categories = await pool.query('SELECT id, slug FROM categories');
    const categoryMap = {};
    categories.rows.forEach(cat => {
      categoryMap[cat.slug] = cat.id;
    });

    // Sample products with real images (using picsum for demo)
    const products = [
      {
        name: 'خدمة الدعم الأساسي',
        slug: 'basic-support',
        description: 'خدمة دعم فني أساسي تشمل الرد على الاستفسارات وحل المشاكل البسيطة',
        price: 50,
        image: 'https://picsum.photos/seed/support1/400/400',
        category_id: categoryMap['support-services'],
        is_featured: true,
      },
      {
        name: 'باقة الملفات المميزة',
        slug: 'premium-files',
        description: 'مجموعة من الملفات الحصرية والمميزة لمختلف الأغراض',
        price: 150,
        image: 'https://picsum.photos/seed/files1/400/400',
        category_id: categoryMap['featured-files'],
        is_featured: true,
      },
      {
        name: 'خدمة العملاء المميزة',
        slug: 'premium-support',
        description: 'دعم العملاء المتميز على مدار الساعة مع متابعة مستمرة',
        price: 100,
        image: 'https://picsum.photos/seed/support2/400/400',
        category_id: categoryMap['support-services'],
        is_featured: false,
      },
      {
        name: 'ملفات حصرية',
        slug: 'exclusive-files',
        description: 'ملفات حصرية غير متوفرة في أي مكان آخر',
        price: 200,
        image: 'https://picsum.photos/seed/files2/400/400',
        category_id: categoryMap['featured-files'],
        is_featured: false,
      },
      {
        name: 'باقة الدعم الشاملة',
        slug: 'full-support',
        description: 'باقة شاملة تتضمن جميع خدمات الدعم والتواصل',
        price: 300,
        image: 'https://picsum.photos/seed/support3/400/400',
        category_id: categoryMap['comprehensive-packages'],
        is_featured: false,
      },
      {
        name: 'ملفات متنوعة',
        slug: 'various-files',
        description: 'مجموعة متنوعة من الملفات المفيدة',
        price: 80,
        image: 'https://picsum.photos/seed/files3/400/400',
        category_id: categoryMap['featured-files'],
        is_featured: false,
      },
      {
        name: 'خدمة التقييم',
        slug: 'review-service',
        description: 'خدمة تقييم المنتجات والخدمات بدقة وموضوعية',
        price: 25,
        image: 'https://picsum.photos/seed/review1/400/400',
        category_id: categoryMap['support-services'],
        is_featured: false,
      },
      {
        name: 'باقة الملفات الكاملة',
        slug: 'complete-files',
        description: 'الباقة الكاملة تشمل جميع الملفات المتاحة',
        price: 500,
        image: 'https://picsum.photos/seed/files4/400/400',
        category_id: categoryMap['comprehensive-packages'],
        is_featured: true,
      },
      {
        name: 'خدمة التسويق',
        slug: 'marketing-service',
        description: 'خدمات التسويق والترويج لمنتجاتك وخدماتك',
        price: 250,
        image: 'https://picsum.photos/seed/marketing1/400/400',
        category_id: categoryMap['support-services'],
        is_featured: false,
      },
      {
        name: 'تصميم الشعارات',
        slug: 'logo-design',
        description: 'تصميم شعارات احترافية ومميزة لعلامتك التجارية',
        price: 180,
        image: 'https://picsum.photos/seed/design1/400/400',
        category_id: categoryMap['featured-files'],
        is_featured: false,
      },
    ];

    for (const product of products) {
      await pool.query(
        `INSERT INTO products (name, slug, description, price, image, category_id, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (slug) DO NOTHING`,
        [product.name, product.slug, product.description, product.price, product.image, product.category_id, product.is_featured]
      );
    }
    console.log('✅ Products seeded successfully!');

    // Seed slider images
    await pool.query(`
      INSERT INTO settings (key, value) VALUES 
        ('slider_1', 'https://picsum.photos/seed/slider1/1200/400'),
        ('slider_2', 'https://picsum.photos/seed/slider2/1200/400'),
        ('slider_3', 'https://picsum.photos/seed/slider3/1200/400'),
        ('banner_image', 'https://picsum.photos/seed/banner1/1200/300')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
    console.log('✅ Slider images seeded');

  } catch (error) {
    console.error('❌ Error seeding:', error);
  } finally {
    process.exit();
  }
};

seedProducts();