<div align="center">
  <h1>🏭 AI Industrial Quality Control System (AIQCS)</h1>
  <p><strong>Next-Generation Automated Visual Inspection & Defect Detection</strong></p>

  ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
  ![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
</div>

<br />

## 🚀 Overview
**AIQCS (AI Industrial Quality Control System)** is an end-to-end, full-stack application designed to automate factory floor quality assurance. By combining a lightning-fast React frontend with a high-performance Python FastAPI backend, AIQCS allows factory operators to visually inspect manufacturing lines in real-time or via manual image uploads. 

The core of the system relies on highly optimized **MobileNetV2** deep learning models trained specifically to distinguish between perfectly manufactured products and defective ones with extreme precision.

---

## 📦 Supported Products
The system is actively trained on **five distinct manufacturing pipelines**. Our dedicated `MobileNetV2` models have been rigorously trained and validated on thousands of images to classify products as **Defective** or **Non-Defective**:

1. 🚗 **Cars (Automotive)** - Paint scratches, structural dents, assembly defects.
2. 📦 **Cardboard Boxes** - Crushed corners, tears, water damage, print smudges.
3. 📱 **Mobile Phones** - Cracked screens, casing scratches, lens damage.
4. 🧴 **Plastic Bottles** - Deformed plastic, cap missing/misaligned, label tearing.
5. 🛡️ **Steel Surfaces** - Pitting, rust, scuff marks, surface cracking.

---

## ✨ Features & Interface

- 📊 **Executive Dashboard**: Get real-time analytical insights into defect rates, total scans, and historical quality control data.
- 📤 **Frictionless Uploading**: Drag and drop product images straight into the UI. Select the product pipeline, and the backend dynamically routes your image to the correct neural network.
- 📷 **Real-time Camera Feed**: Connect factory inspection cameras directly to the web app for live, continuous prediction streaming.
- 🔐 **Secure Architecture**: Complete JWT authentication, user settings, and role-based access control.

---

## 🧠 Core AI Architecture

AIQCS strictly enforces **Model Isolation**. Instead of one monolithic model trying to guess everything, the FastAPI backend hosts **five specialized `.h5` MobileNetV2 models** loaded dynamically in memory.

**Inference Pipeline:**
1. **User Action:** Image uploaded via React frontend with the `product_type` explicitly declared.
2. **Dynamic Routing:** FastAPI backend dynamically routes the tensor to the corresponding production model (e.g., `plastic_bottles_model.h5`).
3. **Feature Extraction:** Deep convolutional layers extract visual patterns.
4. **Binary Classification:** A dense head evaluates the features outputting exact probability thresholds for `Defective` vs `Non_Defective`.

---

## 💻 How to Run the Project Locally

You will need two terminal windows to run both the backend and frontend development servers.

### 1. Start the Backend (FastAPI / TensorFlow)
Open a terminal (`cmd` or PowerShell) and run:

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*The backend API will start on `http://localhost:8000`*

### 2. Start the Frontend (React / Vite)
Open a **second** terminal and run:

```cmd
cd frontend
npm install
npm run dev
```
*The UI will start on `http://localhost:5173`*

*(Alternatively, you can double-click the `AIQCS.bat` file in the root directory to automatically launch both systems simultaneously on Windows).*

---

## 🛠️ How to Use the System
1. **Login**: Navigate to `http://localhost:5173` and log in (Default admin credentials if seeded: `admin@example.com` / `password123`).
2. **Navigate to Upload**: Click on the **Upload Detection** page.
3. **Select Pipeline**: Use the dropdown to explicitly select the product you are scanning (e.g., *Plastic Bottles*).
4. **Upload**: Drag and drop an inspection image.
5. **Analyze**: Click **Run AI**. The image is routed to the specialized AI model, and the result (Defective or Non-Defective) along with confidence metrics will instantly appear on the screen!

---
*Built with modern web technologies and deep learning to modernize industrial inspection.*
