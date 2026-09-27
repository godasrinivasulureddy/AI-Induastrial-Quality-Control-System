
# AI-Powered Industrial Quality Control Web Application

## Project Overview
This project develops a complete modern AI-powered industrial quality control web application. It features a highly advanced frontend built with React.js, Tailwind CSS, and Framer Motion, and a FastAPI backend integrating TensorFlow/YOLOv8 for product defect detection.

## Tech Stack

### Frontend:
*   **React.js + Vite**: Fast development and modern component-based UI.
*   **Tailwind CSS**: Utility-first CSS framework for rapid styling.
*   **Framer Motion**: Powerful animation library for smooth UI transitions.
*   **Advanced JavaScript**: Interactive and dynamic user experience.
*   **Responsive Design**: Optimized for various screen sizes.
*   **Dark/Light Mode**: User preference for theme.
*   **Glassmorphism UI**: Modern aesthetic design.
*   **Professional Dashboard**: Intuitive and data-rich user interface.
*   **Recharts**: For powerful data visualization and analytics.
*   **React Router**: Declarative routing for React applications.
*   **Axios**: Promise-based HTTP client for API communication.
*   **Zustand (or Context API)**: State management for robust applications.

### Backend:
*   **FastAPI**: High-performance, easy-to-use web framework for Python.
*   **Python**: Primary language for backend logic and AI.
*   **TensorFlow / YOLOv8**: AI framework/model for object detection and classification.
*   **OpenCV**: Computer Vision library for image processing.
*   **JWT Authentication**: Secure user authentication.
*   **SQLite or PostgreSQL**: Database for storing application data.
*   **REST APIs**: Standardized communication between frontend and backend.
*   **File Upload Handling**: Securely manage image uploads.

### AI Features:
*   **Product Defect Detection**: Using Computer Vision to identify defects.
*   **Image Upload & Prediction**: Users can upload images for defect analysis.
*   **Confidence Score Visualization**: Display the AI model's prediction confidence.
*   **Real-time Webcam Inspection**: Option for live defect detection.
*   **Prediction History**: Track past predictions.
*   **AI Analytics Dashboard**: Visual summary of AI performance and defect trends.

## Project Structure

```
AI_Quality_Control_Project/
├── frontend/                # React.js application
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/             # API routes (auth, predictions, users)
│   │   ├── core/            # Configuration, settings, security
│   │   ├── crud/            # Create, Read, Update, Delete operations
│   │   ├── database/        # Database session and models
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas for data validation
│   │   └── main.py          # FastAPI application entry point
│   ├── requirements.txt
│   └── .env.example
├── ai_model/                # AI model code and trained weights
│   ├── models/              # Trained YOLOv8/TensorFlow models
│   ├── scripts/             # Training and evaluation scripts
│   ├── utils/               # Utility functions for AI
│   ├── predict.py           # Prediction inference script
│   └── requirements.txt
├── database/                # Database related files (migrations, etc.)
│   └── init_db.py
├── uploads/                 # Directory for uploaded images
└── README.md
```

## Frontend Pages

1.  **Advanced Landing Page**
    *   Modern hero section, animated AI graphics, smooth scrolling, feature cards, statistics, futuristic UI, responsive navbar, footer, interactive hover animations, loading animations.
2.  **Authentication System**
    *   Login, Signup, Forgot Password pages with JWT authentication, secure token storage, form validation, password visibility, animated transitions.
3.  **User Dashboard**
    *   Sidebar navigation, image upload, real-time prediction cards, AI analytics charts, defect statistics, recent activity, system status widgets, interactive charts, dark/light mode switch.
4.  **Profile Page**
    *   Profile image upload, user information editing, password change, account settings, activity history.
5.  **Settings Page**
    *   Theme customization, notification settings, language settings, AI model settings, system preferences, security settings.
6.  **Admin Panel**
    *   User management, prediction monitoring, dataset management, analytics dashboard, system logs, model retraining controls.

## Getting Started

### Prerequisites
*   Node.js (LTS version)
*   Python 3.9+
*   Git

### Installation
*(Detailed installation instructions will be provided in `INSTALLATION.md`)*

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/AI-Quality-Control-Project.git
    cd AI-Quality-Control-Project
    ```

2.  **Frontend Setup:**
    ```bash
    cd frontend
    npm install # or yarn install
    npm run dev # To start development server
    cd ..
    ```

3.  **Backend Setup:**
    ```bash
    cd backend
    pip install -r requirements.txt
    # Setup database (e.g., create an SQLite file or connect to PostgreSQL)
    # Run migrations if applicable
    uvicorn app.main:app --reload # To start development server
    cd ..
    ```

4.  **AI Model Setup:**
    ```bash
    cd ai_model
    pip install -r requirements.txt
    # Download or train your AI model if not already present
    cd ..
    ```

## Usage

*   Access the frontend application in your browser (usually `http://localhost:5173`).
*   Register and log in to explore the dashboard and AI features.
*   Upload images for defect prediction or use the real-time webcam option.

## Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'feat: Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

## License

This project is licensed under the MIT License.



# Additional Documentation (Consolidated)



## From DEPLOYMENT.md


# Deployment Instructions

This document outlines various strategies for deploying the AI Quality Control Web Application to production environments.

## 1. General Considerations

Before deploying, ensure:

*   All sensitive information (API keys, database credentials, JWT secrets) are stored in environment variables, not hardcoded.
*   Your database is robust and scalable (e.g., PostgreSQL in a cloud service).
*   AI models are optimized for inference.
*   HTTPS is enabled for all traffic.
*   Logging and monitoring are set up.

## 2. Backend (FastAPI) Deployment

FastAPI applications can be deployed using ASGI servers like Gunicorn with Uvicorn workers.

### Using Gunicorn + Uvicorn

1.  **Install Production Dependencies:**
    Ensure you have `gunicorn` installed:
    ```bash
    pip install gunicorn
    ```

2.  **Run with Gunicorn:**
    ```bash
    gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
    ```
    *   `-w 4`: Runs 4 Uvicorn worker processes (adjust based on CPU cores).
    *   `-k uvicorn.workers.UvicornWorker`: Specifies Uvicorn as the worker class.

### Reverse Proxy (Nginx/Caddy)

It is highly recommended to place a reverse proxy (like Nginx or Caddy) in front of your Gunicorn server for:

*   **SSL/TLS Termination (HTTPS)**
*   **Load Balancing**
*   **Static File Serving** (though not much static content from FastAPI usually)
*   **Request Filtering/Security**

### Process Manager (Systemd/Supervisor)

Use a process manager like `systemd` or `supervisor` to ensure your Gunicorn server starts automatically on boot and restarts if it crashes.

## 3. Frontend (React) Deployment

React applications built with Vite are typically deployed as static files.

1.  **Build the application:**
    ```bash
    cd frontend
    npm run build # This creates a 'dist' directory with optimized static assets
    ```

2.  **Serve Static Files:**
    The contents of the `dist` directory can be served by any static file server, a CDN, or a web server like Nginx/Apache.

    *   **Nginx Example:** Configure Nginx to serve the `dist` directory.
    *   **Netlify/Vercel/Cloudflare Pages:** These platforms are excellent for deploying static frontend applications.

## 4. Database Deployment

*   **Cloud SQL (e.g., Google Cloud SQL, AWS RDS, Azure SQL Database):** Recommended for production PostgreSQL or MySQL databases.
*   **Containerized Database:** Use Docker Compose or Kubernetes to deploy a database like PostgreSQL in a container.
*   **Migrations:** Use a tool like `Alembic` for managing database schema changes in a controlled way.

## 5. AI Model Deployment

Consider these options for deploying your AI model:

*   **Integrated with FastAPI Backend:** If the model inference is lightweight, it can run directly within the FastAPI application.
*   **Dedicated Model Server:** For heavy inference, deploy the model using a dedicated server like TensorFlow Serving, TorchServe, or NVIDIA Triton Inference Server. The FastAPI backend would then make API calls to this model server.
*   **Cloud AI Services:** Utilize cloud provider services like Google Cloud AI Platform, AWS SageMaker, or Azure Machine Learning for managed model deployment and scaling.

## 6. Containerization (Docker)

Docker is highly recommended for packaging your application and its dependencies into isolated containers, ensuring consistent environments across development and production.

### Dockerfile for Backend (Example)

```dockerfile
# Dockerfile for FastAPI Backend
FROM python:3.9-slim-buster

WORKDIR /app

COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "--bind", "0.0.0.0:8000"]
```

### Dockerfile for Frontend (Example)

```dockerfile
# Dockerfile for React Frontend
FROM node:18-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", ""daemon off;""]
```

### Docker Compose (Example)

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    command: gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - backend

  db:
    image: postgres:13-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: quality_control_db
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

volumes:
  pgdata:
```

## 7. Cloud Deployment

Consider platforms like:

*   **Google Cloud Platform (GCP)**: Cloud Run (serverless containers), App Engine, Kubernetes Engine.
*   **Amazon Web Services (AWS)**: EC2, ECS/EKS, Fargate, S3 (for static files), RDS.
*   **Microsoft Azure**: Azure App Service, Azure Kubernetes Service.




## From DEPLOYMENT_GUIDE.md

# AIQCS - Deployment & Operations Guide

## Prerequisites
*   Python 3.9+
*   Node.js 18+
*   SQLite3 (Bundled with Python)

---

## 1. Starting the Backend

The backend is built with FastAPI and runs on Uvicorn. It exposes the API endpoints and loads the TensorFlow AI models into memory.

1.  Open a Command Prompt or PowerShell terminal.
2.  Navigate to the backend directory:
    ```cmd
    cd C:\AIQCS\backend
    ```
3.  Activate the virtual environment (if not already active) and start the server:
    ```cmd
    .venv\Scripts\python.exe -m uvicorn app.main:app
    ```
    *The backend will be available at `http://localhost:8000`*

---

## 2. Starting the Frontend

The frontend is a React application served via Vite.

1.  Open a **second** Command Prompt or PowerShell terminal.
2.  Navigate to the frontend directory:
    ```cmd
    cd C:\AIQCS\frontend
    ```
3.  Start the development server:
    ```cmd
    npm run dev
    ```
    *The frontend will be available at `http://localhost:5173`*

---

## 3. Usage Guide

### Login Credentials
To access the application, use the following default test credentials:
*   **Email**: `admin@example.com`
*   **Password**: `password123`

### Prediction Workflow
1.  Navigate to the upload page: `http://localhost:5173/upload`
2.  Use the **Product Type Dropdown** to select the specific product you are inspecting (Mobile, Cardboard Boxes, or Cars). *This ensures the backend routes the image to the correct, specialized AI model.*
3.  Drag and drop an image (or click to browse) into the upload zone.
4.  Click the **Run AI** button.
5.  Review the Result Card generated below the upload zone, which will detail whether the product is Defective or Non-Defective.

---

## 4. API Usage Examples

If you wish to bypass the UI and test the AI directly, you can use `curl` to hit the FastAPI endpoint.

**Test Classification Endpoint via Curl (Windows cmd.exe):**
```cmd
curl -X POST http://127.0.0.1:8000/predictions/classify -F "product_type=cars" -F "file=@C:\path\to\your\image.jpg"
```

**Expected JSON Response:**
```json
{
  "product": "cars",
  "predicted_class": "non-defective",
  "confidence": 0.9842,
  "model_used": "cars_model"
}
```



## From INSTALLATION.md


# Installation Guide

This guide provides detailed steps to set up and run the AI Quality Control Web Application.

## 1. Prerequisites

Ensure you have the following installed on your system:

*   **Node.js**: LTS version (e.g., 18.x or 20.x) - [Download Node.js](https://nodejs.org/en/download/)
*   **npm** (Node Package Manager) or **yarn**: Comes with Node.js, or install yarn globally: `npm install -g yarn`
*   **Python**: Version 3.9+ - [Download Python](https://www.python.org/downloads/)
*   **pip**: Python package installer (comes with Python)
*   **Git**: For cloning the repository - [Download Git](https://git-scm.com/downloads)
*   **(Optional) Docker & Docker Compose**: For containerized deployment.

## 2. Clone the Repository

First, clone the project repository to your local machine:

```bash
git clone https://github.com/your-username/AI-Quality-Control-Project.git
cd AI-Quality-Control-Project
```

## 3. Backend Setup

Navigate to the `backend` directory, create a virtual environment, install dependencies, and set up the database.

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate # On Windows: .\venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Create a .env file (copy from .env.example) and configure your database
cp .env.example .env
# Open .env and set your database connection string, JWT secret, etc.

# Initialize the database (e.g., create tables for SQLite)
# For production, consider using Alembic for migrations instead.
python app/main.py # This will run the `create_db_tables()` function if added to main.py or a separate script

# Start the FastAPI backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend server should now be running at `http://localhost:8000`.

## 4. Frontend Setup

Open a new terminal window, navigate to the `frontend` directory, and install its dependencies.

```bash
cd frontend

# Install Node.js dependencies
npm install # or yarn install

# Start the React development server
npm run dev # or yarn dev
```

The frontend application should now be accessible in your web browser (usually `http://localhost:5173`).

## 5. AI Model Setup (Optional for initial development)

If you plan to train or use a specific AI model locally (beyond what the backend might handle remotely):

```bash
cd ai_model

# Activate the backend's virtual environment or create a new one if necessary
source ../backend/venv/bin/activate # or create a new venv

pip install -r requirements.txt

# Download pre-trained models or train your own
# (Instructions for specific models like YOLOv8 will go here)
# For example:
# python scripts/download_yolov8_weights.py
# python scripts/train_model.py
```

## 6. Running the Application

With both the backend and frontend development servers running:

1.  Open your browser to the frontend URL (e.g., `http://localhost:5173`).
2.  You should see the landing page. Register a new user and explore the dashboard.


