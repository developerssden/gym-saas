import { hashPassword } from '@/lib/authHelper';
import prisma from '@/lib/prisma';

async function main() {
  const password = await hashPassword('password');

  const admin = await prisma.user.findFirst({
    where: { email: 'ironsamurai786@gmail.com' }
  });
  if (!admin) {
    const superAdmin = await prisma.user.create({
      data: {
        first_name: 'Super',
        last_name: 'Admin',
        phone_number: '+923018407613',
        address: 'Admin HQ',
        city: 'Gujrat',
        state: 'Punjab',
        zip_code: '50700',
        country: 'Pakistan',
        date_of_birth: new Date('1999-05-15'),
        email: 'ironsamurai786@gmail.com',
        password,
        role: 'SUPER_ADMIN',
        createdAt: new Date()
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });