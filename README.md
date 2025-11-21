# Solo Leveling API

The backend for the Solo Leveling application, built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (Authentication)
- dotenv (Environment management)
- CORS enabled  

## Getting Started  

### 1. Clone the repo  

git clone https://github.com/bomjuk94/Solo-Leveling-API  

### 2. Install Dependencies  

cd Solo-Leveling-API-main  
npm install  

### 3. Setup environment variables  

PORT=5000  
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/database-name  
JWT_SECRET=your_jwt_secret   

### 4. Start the Server  

npm run dev  

<!-- TODO: Update endpoints -->
### API Endpoints  

#### Auth  

POST /api/register  

POST /api/login  

#### Profile  

GET /api/profile/  

PUT /api/profile/update  

PATCH /api/profile/onboardingStatus  
