import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/crypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data and assessment entities...');

  // 1. Assessment Organization & Default Credentials
  const viekOrg = await prisma.organization.upsert({
    where: { slug: 'viek-technologies' },
    update: {},
    create: {
      name: 'VIEK Client Management',
      slug: 'viek-technologies',
    },
  });

  const assessmentPasswordHash = await hashPassword('password123');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@viek.test' },
    update: {
      passwordHash: assessmentPasswordHash,
      status: 'ACTIVE',
      organizationId: viekOrg.id,
    },
    create: {
      organizationId: viekOrg.id,
      email: 'admin@viek.test',
      passwordHash: assessmentPasswordHash,
      fullName: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Assessment Admin User created:', adminUser.email);

  // Assessment Clients: Acme Limited, Bright Solutions
  let acmeClient = await prisma.client.findFirst({
    where: { organizationId: viekOrg.id, name: 'Acme Limited' },
  });
  if (!acmeClient) {
    acmeClient = await prisma.client.create({
      data: {
        organizationId: viekOrg.id,
        ownerId: adminUser.id,
        name: 'Acme Limited',
        company: 'Acme Limited',
        email: 'contact@acme.test',
        phone: '+1 (555) 234-5678',
        status: 'active',
      },
    });
  }

  let brightClient = await prisma.client.findFirst({
    where: { organizationId: viekOrg.id, name: 'Bright Solutions' },
  });
  if (!brightClient) {
    brightClient = await prisma.client.create({
      data: {
        organizationId: viekOrg.id,
        ownerId: adminUser.id,
        name: 'Bright Solutions',
        company: 'Bright Solutions Ltd',
        email: 'hello@bright.test',
        phone: '+1 (555) 876-5432',
        status: 'active',
      },
    });
  }

  // Assessment Projects:
  // 1. Website Development (Acme Limited)
  // 2. Mobile Application (Bright Solutions)
  // 3. UI/UX Design (Acme Limited)
  const existingProjects = await prisma.project.findMany({
    where: { organizationId: viekOrg.id },
  });

  if (existingProjects.length === 0) {
    await prisma.project.createMany({
      data: [
        {
          organizationId: viekOrg.id,
          clientId: acmeClient.id,
          name: 'Website Development',
          description: 'Full-stack responsive corporate portal and CMS integration.',
          status: 'active',
        },
        {
          organizationId: viekOrg.id,
          clientId: brightClient.id,
          name: 'Mobile Application',
          description: 'Cross-platform iOS and Android field service companion.',
          status: 'active',
        },
        {
          organizationId: viekOrg.id,
          clientId: acmeClient.id,
          name: 'UI/UX Design',
          description: 'Design system overhaul, user journey mapping, and Figma prototype.',
          status: 'active',
        },
      ],
    });
  }

  // 2. Demo Account (demo@viekcrm.com)
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  });

  const passwordHash = await hashPassword('Password123!');

  const user = await prisma.user.upsert({
    where: { email: 'demo@viekcrm.com' },
    update: {
      passwordHash,
      status: 'ACTIVE',
      organizationId: org.id,
    },
    create: {
      organizationId: org.id,
      email: 'demo@viekcrm.com',
      passwordHash,
      fullName: 'Alex Vance',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Demo User created:', user.email);
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
