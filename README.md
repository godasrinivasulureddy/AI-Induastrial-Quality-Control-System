# 🏭 AI Industrial Quality Control System (AIQCS)

![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Welcome to **AIQCS**, a cutting-edge, end-to-end computer vision platform designed to automate and streamline industrial quality control. Using lightweight, high-speed deep learning models, AIQCS instantly inspects manufacturing products to classify them as either **Defective** or **Non-Defective**.

---

## 🚀 Key Features
*   **Dual Detection Modes:** Inspect products via direct **Image Upload** or **Real-Time Camera** feeds.
*   **Strict Model Isolation:** Each product type routes to its own highly specialized neural network, ensuring maximum accuracy and zero cross-contamination.
*   **Live Analytics Dashboard:** Track inspection history, view defect rates in real-time, and manage quality assurance trends over time.
*   **Lightning Fast:** Powered by edge-optimized `MobileNetV2` models for ultra-low latency inference.

---

## 📦 Trained Products
The system has been rigorously trained on thousands of customized industrial images to inspect the following production lines:

1.  🚗 **Cars** (Surface & structural integrity)
2.  📦 **Cardboard Boxes** (Tears, crushes, and water damage)
3.  📱 **Mobile Phones** (Screen cracks, casing defects)
4.  🍾 **Plastic Bottles** (Dents, label tears, cap misalignment)
5.  🏗️ **Steel Surfaces** (Rust, scratches, industrial wear)

---

## 💻 Tech Stack
**Frontend (User Interface)**
*   **React + Vite** (TypeScript)
*   **Tailwind CSS** + **shadcn/ui** for beautiful, responsive design
*   State management via **Zustand**

**Backend (AI & API)**
*   **FastAPI** (Python) for blazing-fast asynchronous endpoints
*   **TensorFlow / Keras** for deep learning inference
*   **SQLite** for local database tracking and historical logs

**AI Architecture**
*   **MobileNetV2**: A highly efficient convolutional neural network acting as a binary classifier (Defective vs. Non-Defective) for each independent product.

---

## 🖥️ Project Pages Overview
*   📊 **Dashboard:** The central hub. Get an at-a-glance view of total inspections, defect rates, and recent system activity.
*   📤 **Upload Detection:** Select your product category and upload batch images. The AI will highlight which items pass and which fail.
*   🎥 **Real-Time Detection:** Connect an industrial webcam to process items continuously as they move down the assembly line.
*   📈 **Analytics:** Dive deep into historical statistics and defect trends to help optimize your manufacturing processes.

---

## 🛠️ How to Run Locally

### 1. Start the AI Backend
```bash
cd backend
python -m venv .venv
# Activate virtual environment (.venv\Scripts\activate on Windows)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*The API will be available at `http://localhost:8000/docs`*

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
*The web dashboard will be available at `http://localhost:5173`*

---

*Note: The highly specialized `14+ GB` raw image datasets used to train these models are intentionally kept offline and are not included in this repository to comply with standard size constraints.*
