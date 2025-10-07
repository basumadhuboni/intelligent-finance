# Intelligent Personal Finance Manager

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0-purple.svg)](https://www.prisma.io/)

<p align="center">
  <a href="https://drive.google.com/file/d/1ZKnbMKroh0m0CbB7_QVuAJc-0YRB5y1d/view?usp=sharing" target="_blank">
    <img src="https://drive.google.com/thumbnail?id=1hKhKh3TvsBeqXSTkIUf97VXsZp76phLN" 
         alt="Demo video of the working app" 
         width="200" 
         style="border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.15);" />
  </a>
</p>

**Demo Video Link:** [https://drive.google.com/file/d/1ZKnbMKroh0m0CbB7_QVuAJc-0YRB5y1d/view?usp=sharing](https://drive.google.com/file/d/1ZKnbMKroh0m0CbB7_QVuAJc-0YRB5y1d/view?usp=sharing)

**Repository:** [https://github.com/basumadhuboni/intelligent-finance](https://github.com/basumadhuboni/intelligent-finance)

---

## Overview

**Intelligent Personal Finance Manager** is a next-generation AI-powered application designed to simplify financial management.
It offers intelligent document processing, personalized chatbot assistance, predictive analytics, and a visually rich dashboard for complete financial control.

---

## Key Features

### AI-Powered Financial Assistant

* **Smart Chatbot:** Responds to natural language queries for instant financial insights
* **Document Intelligence:** AI-based OCR and PDF parsing for receipts and bank statements
* **Automated Categorization:** Accurate transaction classification using Gemini AI
* **Personalized Budgeting:** Data-driven spending recommendations and alerts

### Advanced Analytics & Reporting

* **Interactive Dashboard:** Real-time spending visualization and analytics
* **Trend Analysis:** Monthly and category-wise spending summaries
* **Budget Tracking:** Set and monitor spending limits efficiently
* **Savings Metrics:** Automatic savings rate calculation and progress tracking
* **Export Options:** Generate and download detailed financial reports

### Smart Data Import

* **Receipt Scanning:** Upload receipt images for AI-based data extraction
* **Bank Statement Import:** Parse and categorize transactions from PDF statements
* **Multi-Format Support:** Supports PDF, PNG, and JPG uploads
* **Gemini AI Integration:** High-accuracy extraction and validation

### Security & Authentication

* **JWT Authentication:** Secure user sessions
* **bcrypt Encryption:** Strong password protection
* **Role-Based Access Control:** Manage secure access to APIs
* **Data Privacy:** Strict compliance for secure data handling

---

## AI Integration

### Chatbot Capabilities

* **Natural Queries:** “What did I spend last week?” or “Can I afford this purchase?”
* **Smart Date Recognition:** Understands time-based requests like *“Compare last month to this month.”*
* **Category Insights:** Identifies top spending areas and trends
* **Budget Evaluation:** Analyzes budget survivability and spending pace
* **AI Recommendations:** Suggests savings tips and budget optimization

### Document Processing

* **OCR:** Powered by **Tesseract.js** for image-to-text extraction
* **PDF Parsing:** Automated extraction using **pdf-parse**
* **AI Validation:** **Gemini AI** refines and validates parsed data
* **Error Correction:** AI-assisted cleanup of noisy text or misclassified entries

---

## Architecture & Technology Stack

### Frontend (React + TypeScript)

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Main application pages
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and API clients
│   └── ...
├── public/
└── package.json
```

**Technologies:**

* React 18 + TypeScript
* Vite (for fast builds)
* Tailwind CSS
* Shadcn/UI (component library)
* React Router
* TanStack Query (data fetching)
* Recharts (data visualization)

---

### Backend (Node.js + Express)

```
backend/
├── src/
│   ├── routes/          # REST API routes
│   ├── middleware/      # Auth & validation
│   └── server.ts        # Entry point
├── prisma/              # Schema & migrations
└── package.json
```

**Technologies:**

* Node.js + Express
* TypeScript
* Prisma ORM (SQLite / PostgreSQL)
* JWT Authentication
* bcrypt for password hashing
* Zod for validation

---

### AI & Data Processing

* **Google Gemini AI** – NLP for chatbot & data interpretation
* **Tesseract.js** – OCR for text extraction
* **pdf-parse** – PDF transaction parsing
* **Multer** – Secure file uploads

---

## Installation & Setup

### Prerequisites

* Node.js v16+
* Git installed

### 1. Clone Repository

```bash
git clone https://github.com/basumadhuboni/intelligent-finance.git
cd intelligent-finance
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure:
# DATABASE_URL="file:./prisma/dev.db"
# JWT_SECRET="your-secret-key"
# GEMINI_API_KEY="your-gemini-api-key"

npm run prisma:migrate
npm run prisma:generate
npm run dev
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

---

## Environment Variables

### Backend `.env`

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-super-secret-jwt-key"
GEMINI_API_KEY="your-google-gemini-api-key"
PORT=4000
```

**Get Gemini API Key:**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Generate an API key
3. Add it to `.env`

---

## Usage

### User Authentication

* Register or log in with secure JWT sessions

### Transaction Management

* Manual entry or AI-powered imports
* Bank statement and receipt uploads
* Auto-categorization with Gemini AI

### Dashboard & Reports

* Visual spending analytics
* Real-time updates
* Budget tracking and alerts

### Chatbot Assistant

* Natural language financial insights
* Spending and savings queries
* Personalized recommendations

---

## API Reference

### Authentication

| Method | Endpoint             | Description   |
| ------ | -------------------- | ------------- |
| POST   | `/api/auth/register` | Register user |
| POST   | `/api/auth/login`    | Login user    |

### Transactions

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| GET    | `/api/transactions`         | Fetch user transactions |
| POST   | `/api/transactions`         | Add new transaction     |
| PUT    | `/api/transactions/:id`     | Update transaction      |
| DELETE | `/api/transactions/:id`     | Delete transaction      |
| GET    | `/api/transactions/summary` | Financial summary       |
| GET    | `/api/transactions/trends`  | Spending trends         |

### Budgets

| Method | Endpoint             | Description                 |
| ------ | -------------------- | --------------------------- |
| POST   | `/api/budget/set`    | Define monthly budget       |
| GET    | `/api/budget/status` | Fetch current budget status |

### AI & Files

| Method | Endpoint                  | Description                  |
| ------ | ------------------------- | ---------------------------- |
| POST   | `/api/uploads/receipt`    | Upload basic receipt         |
| POST   | `/api/uploads/ai-receipt` | AI-enhanced receipt analysis |
| POST   | `/api/uploads/statement`  | Bank statement import        |
| POST   | `/api/chatbot/query`      | Chatbot query endpoint       |

---

## Design System

* **Modern UI/UX:** Glass morphism and clean visual hierarchy
* **Responsive Layout:** Optimized for desktop and mobile
* **Dark Mode Ready:** Configurable theme support
* **Accessible Components:** ARIA-compliant and keyboard friendly
* **Animated Interactions:** Smooth transitions with framer-motion

---

## Security & Compliance

* bcrypt password hashing
* JWT-based authentication
* Zod input validation
* CORS configuration
* Helmet.js security headers
* Safe file upload handling

---

## Deployment

### Production Build

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

### Recommended Setup

| Component | Platform                            |
| --------- | ----------------------------------- |
| Frontend  | Vercel / Netlify                    |
| Backend   | Railway / Render                    |
| Database  | PostgreSQL (Supabase / PlanetScale) |
| Storage   | Cloudinary for images               |

---

## Contribution Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit with a descriptive message
4. Push and create a Pull Request

**Development Standards**

* Follow TypeScript conventions
* Write unit tests for new functionality
* Maintain responsive design
* Use conventional commits

---

## Author

**Madhuboni Basu**
*Full Stack Developer*
[GitHub](https://github.com/basumadhuboni)

---

## Acknowledgments

* **Google Gemini AI** – Language and financial insight engine
* **Tesseract.js** – OCR processing
* **Shadcn/UI** – Modern React component framework
* **Prisma** – ORM and database management
* **Recharts** – Data visualization

---

## Support

For questions or issues:

* Visit the [Issues](https://github.com/basumadhuboni/intelligent-finance/issues) page
* Or open a new ticket with detailed context

---

**Professional, AI-powered, and secure — the future of personal finance management.**

---
