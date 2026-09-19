# GymSaaS – Gym Management Platform

GymSaaS is a full-stack **Gym Management SaaS platform** built to help gym owners manage their daily operations from one place.

The platform provides tools for **member management, memberships, attendance, inventory, equipment, staff tasks, billing, payments, and business analytics**.

## 🚀 Live Demo

https://gym-saas-gamma.vercel.app/

## ✨ Features

### 📊 Dashboard
- Real-time gym overview
- Active member statistics
- Revenue tracking
- Daily check-ins
- Business performance metrics

### 👥 Member Management
- Create and manage gym members
- Member profiles
- Membership management
- Membership expiry tracking
- Attendance tracking
- Payment tracking
- Membership renewals

### 🏋️ Inventory & Equipment
- Manage gym equipment
- Manage gym merchandise
- Track inventory quantities
- Monitor stock levels
- Low-stock alerts
- Equipment management

### 📋 Task Management
- Create staff tasks
- Assign tasks to staff
- Track task status
- Manage gym cleaning and maintenance activities

### 💳 Finance & Billing
- Member payment tracking
- Invoice generation
- Revenue tracking
- Expense management
- Financial reports

### 📈 Reports & Analytics
- Member statistics
- Attendance analytics
- Revenue reports
- Gym performance metrics
- Business insights

### 🔐 Authentication
- User authentication
- Protected routes
- Session management
- NextAuth integration

### 💰 Subscription Plans

The application supports different SaaS plans for gym businesses.

#### Basic Plan
- 1 gym
- 1 location
- Up to 200 members
- Up to 200 equipment items
- Automated expiry reminders
- PDF invoices
- Member payment tracking

#### Pro Plan
- Up to 2 gyms
- Up to 5 locations
- Up to 500 members per location
- Up to 500 equipment items per location
- Automated expiry reminders
- PDF invoices
- Member payment tracking

## 🛠️ Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Responsive UI

### Backend

- Next.js API Routes
- TypeScript
- Prisma ORM
- PostgreSQL
- NextAuth

### Development

- Git
- ESLint
- Automated Testing
- Vercel
- Environment Variables

## 📁 Project Structure

```text
GymSaaS/
│
├── app/                 # Next.js application routes
├── components/          # Reusable UI components
├── constants/           # Application constants
├── docs/                # Project documentation
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and libraries
├── pages/               # Pages and API functionality
├── prisma/              # Prisma schema and database configuration
├── providers/           # Application providers
├── public/              # Static assets
├── scripts/             # Utility scripts
├── tests/               # Automated tests
│
├── .vscode/             # VS Code configuration
├── package.json
├── tsconfig.json
└── README.md
